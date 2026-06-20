import type { ContextEvent, ContextWindowSnapshot } from "../context/types";
import type { MemoryStoreSnapshot, MemoryWriteInput } from "../memory/types";
import type { BlivechatEventInput, BlivechatQueueSnapshot } from "./eventRuntime";
import type {
  AudienceActivityLevel,
  AudienceInteractionIntent,
  AudienceKind,
  AudienceReactionKind,
  AudienceRelationship,
  AudienceRhythmState,
  AudienceSimulationStatus,
  AudienceSpendingTier,
  InteractionType,
} from "./types";

const DEFAULT_SHADOW_AUDIENCE_COUNT = 240;
const MAX_ACTIVATED_AUDIENCES = 16;
const MEMORY_WRITE_INTENSITY_THRESHOLD = 4;

const RHYTHM_LABELS: Record<AudienceRhythmState, string> = {
  cold: "冷场观察",
  steady: "平稳互动",
  peak: "高潮放大",
  closing: "收束回声",
};

const INTERACTION_LABELS: Record<InteractionType, string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

export interface PlannerAudienceProfile {
  id: string;
  name: string;
  kind: AudienceKind;
  activityLevel: AudienceActivityLevel;
  spendingTier: AudienceSpendingTier;
  relationship: AudienceRelationship;
  languageStyle: string;
  styleHints: string[];
  archetype: string;
}

interface AudiencePlanInput {
  contextWindow: ContextWindowSnapshot;
  memorySnapshot?: MemoryStoreSnapshot | null;
  queueSnapshot?: BlivechatQueueSnapshot;
  canDeliverInteraction?: (type: InteractionType) => boolean;
  now: number;
}

export interface AudiencePlanResult {
  intents: AudienceInteractionIntent[];
  events: BlivechatEventInput[];
  generationRequest: AudienceBatchGenerationRequest | null;
  memoryWriteCandidates: MemoryWriteInput[];
  status: AudienceSimulationStatus;
}

export interface AudienceBatchGenerationRequest {
  compressedContext: string;
  activeAudienceProfiles: AudienceGenerationProfile[];
  intents: AudienceInteractionIntent[];
  maxOutputCount: number;
}

export interface AudienceGenerationProfile {
  audienceId: string;
  audienceName: string;
  audienceKind: AudienceKind;
  styleHints: string[];
  summary: string;
}

interface AudienceBatchGenerationItem {
  audienceId: string;
  type: InteractionType;
  content: string;
  amountLabel?: string;
}

export type AudienceBatchGenerationResult =
  | { ok: true; events: BlivechatEventInput[] }
  | { ok: false; error: string };

interface PlannerCounters {
  cooldownRejectCount: number;
  throttleRejectCount: number;
  budgetRejectCount: number;
}

const EMPTY_COUNTERS: PlannerCounters = {
  cooldownRejectCount: 0,
  throttleRejectCount: 0,
  budgetRejectCount: 0,
};

export function createInitialAudienceSimulationStatus(): AudienceSimulationStatus {
  return {
    rhythmState: "cold",
    rhythmLabel: RHYTHM_LABELS.cold,
    activeAudienceCount: 0,
    plannedIntentCount: 0,
    llmBatchCallCount: 0,
    localGeneratedCount: 0,
    cooldownRejectCount: 0,
    throttleRejectCount: 0,
    budgetRejectCount: 0,
    memoryAudienceCount: 0,
    shadowAudienceCount: DEFAULT_SHADOW_AUDIENCE_COUNT,
  };
}

export class AudiencePlanner {
  private readonly shadowAudiences: PlannerAudienceProfile[];
  private readonly cooldownUntil = new Map<string, number>();
  private readonly spentBudget = new Map<string, number>();
  private readonly lastSpecialAt = new Map<InteractionType, number>();
  private tickIndex = 0;
  private llmBatchCallCount = 0;
  private localGeneratedCount = 0;

  constructor(
    private readonly seed = "bigv-v1-audience-planner",
    shadowAudienceCount = DEFAULT_SHADOW_AUDIENCE_COUNT,
  ) {
    this.shadowAudiences = createShadowAudiencePool(shadowAudienceCount);
  }

  plan(input: AudiencePlanInput): AudiencePlanResult {
    const rhythmState = inferRhythm(input.contextWindow);
    const memoryAudiences = buildMemoryAudienceProfiles(input.memorySnapshot);
    const audiencePool = [...memoryAudiences, ...this.shadowAudiences];
    const targetCount = targetIntentCount(rhythmState, input.contextWindow, input.queueSnapshot);
    const counters: PlannerCounters = { ...EMPTY_COUNTERS };
    const rng = createRng(`${this.seed}:${this.tickIndex}:${input.now}:${latestContextText(input.contextWindow)}`);
    const intents = this.selectIntents({
      audiencePool,
      contextWindow: input.contextWindow,
      rhythmState,
      targetCount,
      counters,
      rng,
      now: input.now,
      canDeliverInteraction: input.canDeliverInteraction ?? (() => true),
    });
    const generationRequest = buildAudienceBatchGenerationRequest(
      input.contextWindow,
      audiencePool,
      intents.filter((intent) => intent.needsGeneration),
    );
    if (generationRequest) this.llmBatchCallCount += 1;

    const events = generateLocalAudienceEvents(intents, input.contextWindow);
    this.localGeneratedCount += events.length;
    this.tickIndex += 1;

    return {
      intents,
      events,
      generationRequest,
      memoryWriteCandidates: createAudienceMemoryWriteCandidates(intents),
      status: buildSimulationStatus({
        rhythmState,
        intents,
        counters,
        llmBatchCallCount: this.llmBatchCallCount,
        localGeneratedCount: this.localGeneratedCount,
        memoryAudienceCount: memoryAudiences.length,
        shadowAudienceCount: this.shadowAudiences.length,
      }),
    };
  }

  private selectIntents(input: {
    audiencePool: PlannerAudienceProfile[];
    contextWindow: ContextWindowSnapshot;
    rhythmState: AudienceRhythmState;
    targetCount: number;
    counters: PlannerCounters;
    rng: () => number;
    now: number;
    canDeliverInteraction: (type: InteractionType) => boolean;
  }) {
    const intents: AudienceInteractionIntent[] = [];
    const maxAttempts = Math.max(input.targetCount * 8, 12);
    const contextRefs = contextRefsFromWindow(input.contextWindow);

    for (let attempt = 0; attempt < maxAttempts && intents.length < input.targetCount; attempt += 1) {
      const audience = weightedPick(input.audiencePool, input.rng);
      if (!audience) break;
      if ((this.cooldownUntil.get(audience.id) ?? 0) > input.now) {
        input.counters.cooldownRejectCount += 1;
        continue;
      }

      const interactionType = chooseInteractionType(audience, input.rhythmState, input.rng);
      if (!input.canDeliverInteraction(interactionType)) {
        input.counters.throttleRejectCount += 1;
        continue;
      }
      if (!this.reserveBudget(audience, interactionType, input.now)) {
        input.counters.budgetRejectCount += 1;
        continue;
      }

      const reactionKind = chooseReactionKind(interactionType, input.rhythmState, input.rng);
      const intensity = chooseIntensity(interactionType, input.rhythmState, audience, input.rng);
      const needsGeneration =
        interactionType !== "danmaku" ||
        audience.kind === "memory_profile" ||
        intensity >= MEMORY_WRITE_INTENSITY_THRESHOLD;
      const intent: AudienceInteractionIntent = {
        audienceId: audience.id,
        audienceName: audience.name,
        audienceKind: audience.kind,
        interactionType,
        reactionKind,
        intensity,
        styleHints: compactStyleHints(audience),
        contextRefs,
        needsGeneration,
      };
      intents.push(intent);
      this.cooldownUntil.set(audience.id, input.now + cooldownMs(audience, interactionType));
    }

    return intents;
  }

  private reserveBudget(audience: PlannerAudienceProfile, type: InteractionType, now: number) {
    if (type === "danmaku") return true;
    const channelGap = type === "super_chat" ? 45_000 : type === "membership" ? 90_000 : 25_000;
    if ((this.lastSpecialAt.get(type) ?? 0) + channelGap > now) return false;

    const nextCost = type === "membership" ? 3 : type === "super_chat" ? 2 : 1;
    const budgetLimit = spendingBudget(audience);
    const spent = this.spentBudget.get(audience.id) ?? 0;
    if (spent + nextCost > budgetLimit) return false;

    this.spentBudget.set(audience.id, spent + nextCost);
    this.lastSpecialAt.set(type, now);
    return true;
  }
}

function buildSimulationStatus(input: {
  rhythmState: AudienceRhythmState;
  intents: AudienceInteractionIntent[];
  counters: PlannerCounters;
  llmBatchCallCount: number;
  localGeneratedCount: number;
  memoryAudienceCount: number;
  shadowAudienceCount: number;
}): AudienceSimulationStatus {
  return {
    rhythmState: input.rhythmState,
    rhythmLabel: RHYTHM_LABELS[input.rhythmState],
    activeAudienceCount: new Set(input.intents.map((intent) => intent.audienceId)).size,
    plannedIntentCount: input.intents.length,
    llmBatchCallCount: input.llmBatchCallCount,
    localGeneratedCount: input.localGeneratedCount,
    cooldownRejectCount: input.counters.cooldownRejectCount,
    throttleRejectCount: input.counters.throttleRejectCount,
    budgetRejectCount: input.counters.budgetRejectCount,
    memoryAudienceCount: input.memoryAudienceCount,
    shadowAudienceCount: input.shadowAudienceCount,
  };
}

export function buildAudienceBatchGenerationRequest(
  contextWindow: ContextWindowSnapshot,
  audiencePool: PlannerAudienceProfile[],
  intents: AudienceInteractionIntent[],
): AudienceBatchGenerationRequest | null {
  if (intents.length === 0) return null;
  const activeIds = new Set(intents.map((intent) => intent.audienceId));
  const activeAudienceProfiles = audiencePool
    .filter((audience) => activeIds.has(audience.id))
    .slice(0, MAX_ACTIVATED_AUDIENCES)
    .map((audience) => ({
      audienceId: audience.id,
      audienceName: audience.name,
      audienceKind: audience.kind,
      styleHints: compactStyleHints(audience),
      summary: `${audience.archetype}；${audience.languageStyle}`.slice(0, 90),
    }));

  return {
    compressedContext: compressContext(contextWindow),
    activeAudienceProfiles,
    intents,
    maxOutputCount: intents.length,
  };
}

export function buildAudienceBatchGenerationPrompt(request: AudienceBatchGenerationRequest) {
  return JSON.stringify({
    task: "为本地单直播间生成一批结构化观众互动，不逐观众扩写背景。",
    constraints: [
      "只输出 JSON 对象",
      "对象包含 items 数组",
      "items 每项包含 audienceId、type、content，可选 amountLabel",
      "不得新增观众，不得输出未请求的互动类型",
    ],
    context: request.compressedContext,
    activeAudienceProfiles: request.activeAudienceProfiles,
    intents: request.intents.map((intent) => ({
      audienceId: intent.audienceId,
      type: intent.interactionType,
      reactionKind: intent.reactionKind,
      intensity: intent.intensity,
      styleHints: intent.styleHints,
      contextRefs: intent.contextRefs,
    })),
    maxOutputCount: request.maxOutputCount,
  });
}

export function parseAudienceBatchGenerationResult(
  rawContent: string,
  request: AudienceBatchGenerationRequest,
): AudienceBatchGenerationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return { ok: false, error: `批量生成结果不是合法 JSON：${String(error)}` };
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;
  if (!items) return { ok: false, error: "批量生成结果必须包含 items 数组" };
  if (items.length > request.maxOutputCount) {
    return { ok: false, error: "批量生成结果数量超过本轮意图上限" };
  }

  const intentByAudience = new Map(request.intents.map((intent) => [intent.audienceId, intent]));
  const events: BlivechatEventInput[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "批量生成数组项必须是对象" };
    }
    const candidate = item as Partial<AudienceBatchGenerationItem>;
    if (typeof candidate.audienceId !== "string") {
      return { ok: false, error: "批量生成结果缺少 audienceId" };
    }
    const intent = intentByAudience.get(candidate.audienceId);
    if (!intent) return { ok: false, error: `批量生成结果包含未激活观众：${candidate.audienceId}` };
    if (candidate.type !== intent.interactionType) {
      return { ok: false, error: `批量生成结果类型不匹配：${candidate.audienceId}` };
    }
    if (typeof candidate.content !== "string" || candidate.content.trim().length === 0) {
      return { ok: false, error: `批量生成结果缺少有效 content：${candidate.audienceId}` };
    }
    events.push({
      type: intent.interactionType,
      audienceName: intent.audienceName,
      content: candidate.content.trim(),
      amountLabel: typeof candidate.amountLabel === "string" ? candidate.amountLabel : amountLabelFor(intent),
    });
  }
  return { ok: true, events };
}

export function generateLocalAudienceEvents(
  intents: AudienceInteractionIntent[],
  contextWindow: ContextWindowSnapshot,
): BlivechatEventInput[] {
  const topic = latestContextText(contextWindow) || "当前直播节奏";
  return intents.map((intent) => ({
    type: intent.interactionType,
    audienceName: intent.audienceName,
    content: localContentForIntent(intent, topic),
    amountLabel: amountLabelFor(intent),
  }));
}

export function createAudienceMemoryWriteCandidates(
  intents: AudienceInteractionIntent[],
): MemoryWriteInput[] {
  return intents
    .filter(
      (intent) =>
        intent.audienceKind === "memory_profile" &&
        intent.intensity >= MEMORY_WRITE_INTENSITY_THRESHOLD &&
        (intent.reactionKind === "advice" || intent.reactionKind === "support"),
    )
    .map((intent) => ({
      layer: "session_recap",
      summary: `${intent.audienceName} 对本轮${INTERACTION_LABELS[intent.interactionType]}表现出稳定${reactionLabel(intent.reactionKind)}倾向。`,
      source: "audience-planner",
      evidence: intent.contextRefs,
      confidence: 0.62,
      stability: "single_observation",
      audienceId: intent.audienceId,
      pollutionRisks: ["单次互动观察，不直接写入长期观众画像"],
    }));
}

function createShadowAudiencePool(count: number): PlannerAudienceProfile[] {
  const archetypes = [
    ["潜水熟客", "短句接梗", "少量冒泡"],
    ["新观众", "直接提问", "谨慎互动"],
    ["技术党", "建议型", "喜欢拆机制"],
    ["氛围组", "鼓励型", "会跟节奏"],
    ["剧情党", "长线观察", "偏文字讨论"],
    ["路过观众", "随手反馈", "低频出现"],
  ];
  const names = ["星河", "南栀", "白塔", "小满", "青柚", "渡口", "夏眠", "空山"];
  return Array.from({ length: count }, (_, index) => {
    const archetype = archetypes[index % archetypes.length];
    const activityLevel: AudienceActivityLevel =
      index % 9 === 0 ? "high" : index % 3 === 0 ? "medium" : "low";
    const spendingTier: AudienceSpendingTier =
      index % 41 === 0 ? "high" : index % 13 === 0 ? "medium" : "low";
    const relationship: AudienceRelationship =
      index % 17 === 0 ? "regular" : index % 29 === 0 ? "core" : "new";
    return {
      id: `shadow-${index + 1}`,
      name: `${names[index % names.length]}${index + 1}`,
      kind: "shadow_profile",
      activityLevel,
      spendingTier,
      relationship,
      languageStyle: archetype[1],
      styleHints: [archetype[1], archetype[2]],
      archetype: archetype[0],
    };
  });
}

function buildMemoryAudienceProfiles(snapshot?: MemoryStoreSnapshot | null): PlannerAudienceProfile[] {
  return (snapshot?.audienceProfiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    kind: "memory_profile",
    activityLevel: profile.activityLevel,
    spendingTier: profile.spendingTier,
    relationship: profile.relationship,
    languageStyle: profile.languageStyle,
    styleHints: [
      profile.languageStyle,
      ...profile.roleTags.slice(0, 2),
      ...profile.preferences.slice(0, 1).map((preference) => preference.label),
    ],
    archetype: profile.summary,
  }));
}

function inferRhythm(window: ContextWindowSnapshot): AudienceRhythmState {
  const latest = latestContextText(window);
  if (/下播|最后|收尾|总结|复盘/.test(latest)) return "closing";
  if (/高能|关键|隐藏|翻车|赢|爆|冲|破防/.test(latest)) return "peak";
  if (window.events.length >= 2 || latest.length >= 24) return "steady";
  return "cold";
}

function targetIntentCount(
  rhythm: AudienceRhythmState,
  window: ContextWindowSnapshot,
  queueSnapshot?: BlivechatQueueSnapshot,
) {
  const base = rhythm === "peak" ? 4 : rhythm === "steady" ? 2 : rhythm === "closing" ? 2 : 1;
  const queuedPressure = queueSnapshot?.pending.length ?? 0;
  if (queuedPressure >= 6) return 1;
  if (window.events.length === 0) return 1;
  return base;
}

function weightedPick(audiences: PlannerAudienceProfile[], rng: () => number) {
  let total = 0;
  const weights = audiences.map((audience) => {
    const weight = audienceWeight(audience);
    total += weight;
    return weight;
  });
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (let index = 0; index < audiences.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return audiences[index];
  }
  return audiences[audiences.length - 1] ?? null;
}

function audienceWeight(audience: PlannerAudienceProfile) {
  const activity = audience.activityLevel === "high" ? 6 : audience.activityLevel === "medium" ? 3 : 1;
  const relationship = audience.relationship === "core" ? 4 : audience.relationship === "regular" ? 2 : 1;
  const memoryBoost = audience.kind === "memory_profile" ? 4 : 1;
  return activity + relationship + memoryBoost;
}

function chooseInteractionType(
  audience: PlannerAudienceProfile,
  rhythm: AudienceRhythmState,
  rng: () => number,
): InteractionType {
  const roll = rng();
  const spendingBoost = audience.spendingTier === "high" ? 0.06 : audience.spendingTier === "medium" ? 0.03 : 0;
  if (rhythm === "peak" && roll < 0.04 + spendingBoost) return "super_chat";
  if ((rhythm === "peak" || rhythm === "steady") && roll < 0.10 + spendingBoost) return "gift";
  if (rhythm === "closing" && audience.relationship !== "new" && roll < 0.03 + spendingBoost) {
    return "membership";
  }
  return "danmaku";
}

function chooseReactionKind(
  type: InteractionType,
  rhythm: AudienceRhythmState,
  rng: () => number,
): AudienceReactionKind {
  if (type === "gift") return "spending";
  if (type === "membership") return "membership_entry";
  if (type === "super_chat") return rng() < 0.55 ? "advice" : "support";
  if (rhythm === "cold") return rng() < 0.5 ? "question" : "joke";
  if (rhythm === "peak") return rng() < 0.4 ? "support" : "joke";
  if (rhythm === "closing") return rng() < 0.55 ? "support" : "agreement";
  return rng() < 0.42 ? "agreement" : "advice";
}

function chooseIntensity(
  type: InteractionType,
  rhythm: AudienceRhythmState,
  audience: PlannerAudienceProfile,
  rng: () => number,
) {
  const typeBase = type === "danmaku" ? 2 : type === "gift" ? 3 : 4;
  const rhythmBoost = rhythm === "peak" ? 1 : rhythm === "cold" ? -1 : 0;
  const audienceBoost = audience.kind === "memory_profile" || audience.relationship === "core" ? 1 : 0;
  return Math.max(1, Math.min(5, typeBase + rhythmBoost + audienceBoost + Math.floor(rng() * 2)));
}

function cooldownMs(audience: PlannerAudienceProfile, type: InteractionType) {
  const base = audience.activityLevel === "high" ? 6_000 : audience.activityLevel === "medium" ? 10_000 : 15_000;
  return type === "danmaku" ? base : base + 30_000;
}

function spendingBudget(audience: PlannerAudienceProfile) {
  const base = audience.spendingTier === "high" ? 6 : audience.spendingTier === "medium" ? 3 : 1;
  return audience.kind === "memory_profile" ? base + 1 : base;
}

function compactStyleHints(audience: PlannerAudienceProfile) {
  return Array.from(new Set([audience.languageStyle, ...audience.styleHints])).filter(Boolean).slice(0, 4);
}

function contextRefsFromWindow(window: ContextWindowSnapshot) {
  return window.events.slice(0, 2).map((event) => event.summary || event.content).filter(Boolean);
}

function compressContext(window: ContextWindowSnapshot) {
  const events = window.events.slice(0, 3).map((event) => `${sourceLabel(event)}:${event.summary}`);
  return events.length ? events.join(" / ").slice(0, 240) : "暂无主播语音，保持低频暖场。";
}

function latestContextText(window: ContextWindowSnapshot) {
  const latest = window.events[0];
  return latest?.summary || latest?.content || "";
}

function sourceLabel(event: ContextEvent) {
  return event.source === "voice" ? "主播语音" : event.source === "echo_live" ? "Echo-Live" : "视觉";
}

function localContentForIntent(intent: AudienceInteractionIntent, topic: string) {
  const shortTopic = topic.slice(0, 28);
  if (intent.interactionType === "gift") return `送出荧光棒 x1，跟一下“${shortTopic}”这段节奏。`;
  if (intent.interactionType === "super_chat") return `${shortTopic}这里可以展开讲一下，我想听主播怎么判断。`;
  if (intent.interactionType === "membership") return "触发舰长入场欢迎，先占个位置继续看这一段。";
  if (intent.reactionKind === "question") return `${shortTopic}这个点是不是还有另一种打法？`;
  if (intent.reactionKind === "advice") return `感觉可以先把${shortTopic}拆成两步讲，弹幕会更容易跟上。`;
  if (intent.reactionKind === "support") return `这段节奏稳住了，${shortTopic}继续推进就行。`;
  if (intent.reactionKind === "joke") return `主播这句“${shortTopic}”有点节目效果。`;
  return `我跟上了，${shortTopic}这一段挺清楚。`;
}

function amountLabelFor(intent: AudienceInteractionIntent) {
  if (intent.interactionType === "gift") return "¥10";
  if (intent.interactionType === "super_chat") return intent.intensity >= 5 ? "¥50" : "¥30";
  return undefined;
}

function reactionLabel(kind: AudienceReactionKind) {
  if (kind === "advice") return "建议";
  if (kind === "support") return "支持";
  return "互动";
}

function createRng(seed: string) {
  let state = hashString(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
