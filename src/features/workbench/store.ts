import { computed, ref, watch } from "vue";
import appConfig from "../../../app.config.json";
import { useProviderStatusSummary } from "../../composables/useProviderSettings";
import { useWorkbenchDebugSettings } from "../../composables/useWorkbenchDebug";
import {
  clearContextWindow,
  loadContextWindow,
  submitContextEvent,
} from "../context/api";
import {
  EchoLiveWebSocketClient,
  createInitialEchoLiveConnectionStatus,
  type EchoLiveConnectionStatus,
  type EchoLiveTextPayload,
} from "../context/echoLiveClient";
import { loadMemorySnapshot } from "../memory/api";
import {
  deriveAudienceViewFromMemory,
  deriveReviewViewFromMemory,
} from "../memory/viewModels";
import {
  buildAudienceBatchGenerationPrompt,
  createInitialAudienceSimulationStatus,
} from "./audiencePlanner";
import { generateAudienceBatch } from "./audienceGeneration";
import {
  createLocalBlivechatQueue,
  type BlivechatEventInput,
  type BlivechatQueueRecord,
  type BlivechatQueueSnapshot,
  type BlivechatQueuedEvent,
} from "./eventRuntime";
import {
  createInitialMockSourceStatus,
  isMockInteractionDeliverable,
  WorkbenchMockDataSource,
  type WorkbenchMockPlanTrace,
} from "./mockDataSource";
import { BIGV_WORKBENCH_SNAPSHOT } from "./mockSnapshot";
import type { ContextWindowSnapshot } from "../context/types";
import type { MemoryStoreSnapshot } from "../memory/types";
import type {
  BlivechatRenderChannel,
  BlivechatRenderItem,
  BigVWorkbenchSnapshot,
  DanmakuViewModel,
  InputSourceStatus,
  InteractionEvent,
  InteractionType,
  MockSourceRecord,
  RuntimeNotice,
  RuntimeToggleState,
  AudienceSimulationStatus,
  WorkbenchInsightRecord,
  WorkbenchRuntimeInsight,
} from "./types";

const STORAGE_KEY = `${appConfig.storageKeyPrefix}.workbench`;
const { providerStatusSummary } = useProviderStatusSummary();
const EMPTY_CONTEXT_WINDOW: ContextWindowSnapshot = {
  windowStartedAt: 0,
  windowSeconds: 300,
  events: [],
  sourceStatuses: [
    {
      source: "voice",
      label: "主播语音",
      statusLabel: "待输入",
      tone: "info",
      summary: "等待本地 ASR 或手动面板提交主播语音文本。",
      eventCount: 0,
    },
    {
      source: "echo_live",
      label: "Echo-Live",
      statusLabel: "未连接",
      tone: "info",
      summary: "等待 Echo-Live WebSocket 文本输入。",
      eventCount: 0,
    },
    {
      source: "vision",
      label: "视觉上下文",
      statusLabel: "预留接口",
      tone: "info",
      summary: "视觉摘要输入接口已预留，阶段 3 不处理原始视频流。",
      eventCount: 0,
    },
  ],
};

const contextWindow = ref<ContextWindowSnapshot>(structuredClone(EMPTY_CONTEXT_WINDOW));
const contextLoading = ref(false);
const contextError = ref<string | null>(null);
const echoLiveStatus = ref<EchoLiveConnectionStatus>(createInitialEchoLiveConnectionStatus());
const memorySnapshot = ref<MemoryStoreSnapshot | null>(null);
const memoryLoading = ref(false);
const memoryError = ref<string | null>(null);
const mockSourceStatus = ref(createInitialMockSourceStatus());
const mockSourceRecords = ref<MockSourceRecord[]>([]);
const simulationStatus = ref<AudienceSimulationStatus>(createInitialAudienceSimulationStatus());
const promptRecords = ref<WorkbenchInsightRecord[]>([]);
const generationRecords = ref<WorkbenchInsightRecord[]>([]);
const memoryRecords = ref<WorkbenchInsightRecord[]>([]);
const baselineInteractionSeed: BlivechatEventInput[] = [
  {
    type: "danmaku",
    audienceName: "阿黎",
    content: "这一段反应好快，像是真的在跟弹幕对线。",
  },
  {
    type: "gift",
    audienceName: "北街舟",
    content: "送出荧光棒 x2，配合主播刚提到的新梗。",
    amountLabel: "¥20",
  },
  {
    type: "super_chat",
    audienceName: "糖霜六号",
    content: "建议下一段切回剧情点评，不要一直卡在设置界面。",
    amountLabel: "¥30",
  },
  {
    type: "membership",
    audienceName: "镜岛",
    content: "触发舰长入场欢迎，等待本地投递队列放行。",
  },
];

const BLIVECHAT_CHANNEL_LABELS: Record<InteractionType, string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

const BLIVECHAT_CHANNEL_TYPES = Object.keys(BLIVECHAT_CHANNEL_LABELS) as InteractionType[];

const BLIVECHAT_RENDER_ACTION_META = {
  enqueue: { label: "排队中", tone: "info" },
  deliver: { label: "已投递", tone: "ok" },
  throttle: { label: "被节流", tone: "warn" },
} satisfies Record<BlivechatRenderItem["action"], { label: string; tone: BlivechatRenderItem["tone"] }>;

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readStoredSnapshot(): BigVWorkbenchSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BigVWorkbenchSnapshot;
  } catch {
    return null;
  }
}

function mergeToggles(
  fallback: RuntimeToggleState[],
  next: unknown,
): RuntimeToggleState[] {
  if (!Array.isArray(next)) return fallback;
  const incoming = new Map<string, unknown>();
  for (const item of next) {
    if (!item || typeof item !== "object") continue;
    const key = Reflect.get(item, "key");
    if (typeof key === "string") incoming.set(key, item);
  }
  return fallback.map((toggle) => {
    const stored = incoming.get(toggle.key);
    if (!stored || typeof stored !== "object") return toggle;
    const enabled = Reflect.get(stored, "enabled");
    return typeof enabled === "boolean" ? { ...toggle, enabled } : toggle;
  });
}

function mergeSnapshot(
  fallback: BigVWorkbenchSnapshot,
  next: BigVWorkbenchSnapshot | null,
): BigVWorkbenchSnapshot {
  if (!next) return fallback;
  return {
    ...fallback,
    danmaku: {
      ...fallback.danmaku,
      ...next.danmaku,
      toggles: mergeToggles(fallback.danmaku.toggles, next.danmaku?.toggles),
    },
  };
}

function loadInitialSnapshot(): BigVWorkbenchSnapshot {
  return mergeSnapshot(cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT), readStoredSnapshot());
}

function persistSnapshot(snapshot: BigVWorkbenchSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore persistence failures in private mode or quota errors
  }
}

function findToggle(toggles: RuntimeToggleState[], key: string): RuntimeToggleState | null {
  return toggles.find((toggle) => toggle.key === key) ?? null;
}

function isChannelDisabled(type: InteractionEvent["type"], toggles: RuntimeToggleState[]) {
  return !isMockInteractionDeliverable(type, toggles);
}

function deriveNotices(view: DanmakuViewModel): RuntimeNotice[] {
  const notices = view.notices.filter((notice) => !notice.id.startsWith("runtime-"));
  const toggles = view.toggles;
  const dispatchEnabled = findToggle(toggles, "dispatch")?.enabled !== false;
  const giftsEnabled = findToggle(toggles, "gifts")?.enabled !== false;
  const superChatEnabled = findToggle(toggles, "super-chat")?.enabled !== false;
  const memoryWriteEnabled = findToggle(toggles, "memory-write")?.enabled !== false;

  if (!dispatchEnabled) {
    notices.unshift({
      id: "runtime-dispatch-paused",
      title: "自动投递已暂停",
      detail: "当前不会把新互动事件送入前端渲染队列，页面只保留历史统计和状态观察。",
      tone: "warn",
    });
  }
  if (!giftsEnabled) {
    notices.push({
      id: "runtime-gifts-disabled",
      title: "礼物通道关闭",
      detail: "gift 与 membership 互动已暂停，相关待投递事件会停留在本地工作台。",
      tone: "info",
    });
  }
  if (!superChatEnabled) {
    notices.push({
      id: "runtime-super-chat-disabled",
      title: "SC 通道关闭",
      detail: "当前不会继续放行新的 SC 互动，适合保守验证直播节奏。",
      tone: "info",
    });
  }
  if (!memoryWriteEnabled) {
    notices.push({
      id: "runtime-memory-write-disabled",
      title: "记忆写回预演已关闭",
      detail: "当前连预演态也不会继续记录，避免把临时测试结论误当成稳定记忆。",
      tone: "warn",
    });
  }
  if (contextError.value) {
    notices.unshift({
      id: "runtime-context-error",
      title: "上下文输入异常",
      detail: contextError.value,
      tone: "error",
    });
  }
  if (echoLiveStatus.value.error) {
    notices.unshift({
      id: "runtime-echo-live-error",
      title: "Echo-Live 连接异常",
      detail: echoLiveStatus.value.error,
      tone: "error",
    });
  }
  if (memoryError.value) {
    notices.unshift({
      id: "runtime-memory-error",
      title: "记忆层异常",
      detail: memoryError.value,
      tone: "error",
    });
  }
  return notices;
}

function deriveContextSources(window: ContextWindowSnapshot): InputSourceStatus[] {
  return window.sourceStatuses.map((source) => {
    if (source.source === "echo_live") {
      return mergeEchoLiveSourceStatus(source);
    }
    return contextSourceStatus(source);
  });
}

function mergeEchoLiveSourceStatus(
  source: ContextWindowSnapshot["sourceStatuses"][number],
): InputSourceStatus {
  const connection = echoLiveStatus.value;
  const base = contextSourceStatus(source);
  if (connection.state === "connecting") {
    return {
      ...base,
      statusLabel: connection.statusLabel,
      tone: connection.tone,
      summary: `正在连接 ${connection.url}`,
    };
  }
  if (connection.state === "connected" && source.eventCount === 0) {
    return {
      ...base,
      statusLabel: connection.statusLabel,
      tone: connection.tone,
      summary: "Echo-Live WebSocket 已连接，等待文本广播。",
      lastEventAt: connection.lastMessageAt,
    };
  }
  if (connection.state === "error") {
    return {
      ...base,
      statusLabel: connection.statusLabel,
      tone: connection.tone,
      summary: connection.error ?? "Echo-Live WebSocket 连接异常。",
    };
  }
  return {
    ...base,
    lastEventAt: base.lastEventAt ?? connection.lastMessageAt,
  };
}

function contextSourceStatus(
  source: ContextWindowSnapshot["sourceStatuses"][number],
): InputSourceStatus {
  return {
    key: source.source,
    source: source.source,
    label: source.label,
    statusLabel: source.statusLabel,
    tone: source.tone,
    summary: source.summary,
    lastEventAt: source.lastEventAt,
    eventCount: source.eventCount,
  };
}

function deriveBlivechatChannels(queueSnapshot: BlivechatQueueSnapshot): BlivechatRenderChannel[] {
  const items = [
    ...queueSnapshot.records
      .filter((record) => record.action !== "enqueue")
      .map(recordToBlivechatRenderItem),
    ...queueSnapshot.pending.map(pendingToBlivechatRenderItem),
  ];

  return BLIVECHAT_CHANNEL_TYPES.map((type) => ({
    type,
    label: BLIVECHAT_CHANNEL_LABELS[type],
    items: items.filter((item) => item.type === type),
  }));
}

function recordToBlivechatRenderItem(record: BlivechatQueueRecord): BlivechatRenderItem {
  const action = BLIVECHAT_RENDER_ACTION_META[record.action];
  return {
    id: record.id,
    eventId: record.eventId,
    action: record.action,
    type: record.type,
    audienceName: record.event.audienceName,
    content: record.event.content,
    amountLabel: record.event.amountLabel,
    statusLabel: action.label,
    tone: action.tone,
    happenedAt: formatQueueTime(record.happenedAt),
    reasonLabel: record.reason,
  };
}

function pendingToBlivechatRenderItem(event: BlivechatQueuedEvent): BlivechatRenderItem {
  const action = BLIVECHAT_RENDER_ACTION_META.enqueue;
  return {
    id: `${event.id}-pending`,
    eventId: event.id,
    action: "enqueue",
    type: event.type,
    audienceName: event.audienceName,
    content: event.content,
    amountLabel: event.amountLabel,
    statusLabel: action.label,
    tone: action.tone,
    happenedAt: formatQueueTime(event.createdAt),
  };
}

function formatQueueTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function createRuntimeInsight(): WorkbenchRuntimeInsight {
  const queueSnapshot = localEventQueueSnapshot.value;
  return {
    updatedAt: formatQueueTime(Date.now()),
    sections: [
      {
        id: "inputs",
        title: "最近输入",
        emptyText: "暂无主播语音输入。",
        records: contextWindow.value.events.slice(0, 5).map((event) => ({
          id: event.id,
          title: event.summary,
          detail: event.content,
          happenedAt: formatQueueTime(event.receivedAt),
          statusLabel: event.source,
          tone: "info" as const,
        })),
      },
      {
        id: "prompts",
        title: "提示组装",
        emptyText: "等待 mock 数据源产生编排记录。",
        records: promptRecords.value,
      },
      {
        id: "generations",
        title: "生成结果",
        emptyText: "等待本地生成或 provider 生成结果。",
        records: generationRecords.value,
      },
      {
        id: "deliveries",
        title: "投递结果",
        emptyText: "暂无投递协议记录。",
        records: queueSnapshot.records.slice(0, 8).map((record) => {
          const item = recordToBlivechatRenderItem(record);
          return {
            id: item.id,
            title: item.audienceName,
            detail: item.content,
            happenedAt: item.happenedAt,
            statusLabel: item.statusLabel,
            tone: item.tone,
            meta: `${item.type}${item.reasonLabel ? ` · ${item.reasonLabel}` : ""}`,
          };
        }),
      },
      {
        id: "memory",
        title: "记忆检索与写回",
        emptyText: "等待记忆检索或写回候选记录。",
        records: memoryRecords.value,
      },
    ],
  };
}

function deriveDanmakuView(snapshot: BigVWorkbenchSnapshot): DanmakuViewModel {
  const baseView = snapshot.danmaku;
  const toggles = baseView.toggles;
  const dispatchEnabled = findToggle(toggles, "dispatch")?.enabled !== false;
  const providerSummary = providerStatusSummary.value;
  const queueSnapshot = localEventQueueSnapshot.value;

  const liveStatus = dispatchEnabled
    ? {
        ...baseView.liveStatus,
        nextActionHint:
          findToggle(toggles, "super-chat")?.enabled === false
            ? "自动投递运行中，当前仍建议以弹幕和轻量礼物为主，暂不继续放开 SC。"
            : baseView.liveStatus.nextActionHint,
      }
    : {
        ...baseView.liveStatus,
        statusLabel: "本地暂停投递",
        tone: "warn" as const,
        nextActionHint: "自动投递已关闭，新的互动结果不会继续进入渲染队列。",
      };

  const providerSource: InputSourceStatus = {
    key: "provider",
    label: "Provider",
    statusLabel: providerSummary.label,
    tone: providerSummary.tone,
    summary: `${providerSummary.detail} ${providerSummary.configSummary}`,
    latencyLabel: providerSummary.latencyLabel,
  };
  const inputSources = [...deriveContextSources(contextWindow.value), providerSource];

  return {
    ...baseView,
    liveStatus,
    inputSources,
    contextEvents: contextWindow.value.events,
    contextWindowSeconds: contextWindow.value.windowSeconds,
    queueStats: queueSnapshot.stats,
    recentEvents: queueSnapshot.recentEvents,
    blivechatChannels: deriveBlivechatChannels(queueSnapshot),
    mockSource: mockSourceStatus.value,
    mockSourceRecords: mockSourceRecords.value,
    simulationStatus: simulationStatus.value,
    notices: deriveNotices(baseView),
  };
}

const snapshot = ref<BigVWorkbenchSnapshot>(loadInitialSnapshot());
const localEventQueue = createLocalBlivechatQueue();
const localEventQueueSnapshot = ref(localEventQueue.snapshot());
localEventQueue.onSnapshot((next) => {
  localEventQueueSnapshot.value = next;
});
seedLocalEventQueue(snapshot.value.danmaku.toggles);
const mockDataSource = new WorkbenchMockDataSource({
  queue: localEventQueue,
  submitContextEvent,
  updateContextWindow(next) {
    contextWindow.value = next;
  },
  canDeliverInteraction(type) {
    return isMockInteractionDeliverable(type, snapshot.value.danmaku.toggles);
  },
  getMemorySnapshot() {
    return memorySnapshot.value;
  },
  onChange(status, records) {
    mockSourceStatus.value = status;
    mockSourceRecords.value = records;
  },
  onSimulationStatusChange(status) {
    simulationStatus.value = status;
  },
  onPlanTrace(trace) {
    recordPlanTrace(trace);
  },
  generateAudienceBatch,
});
const echoLiveClient = new EchoLiveWebSocketClient({
  async submitText(payload) {
    await submitEchoLiveContext(payload);
  },
  onStatusChange(status) {
    echoLiveStatus.value = status;
  },
});

const { mockDataSourceEnabled } = useWorkbenchDebugSettings();
watch(
  mockDataSourceEnabled,
  (enabled) => {
    if (enabled) {
      mockDataSource.start();
    } else {
      mockDataSource.pause();
    }
  },
  { immediate: true },
);

function replaceSnapshot(next: BigVWorkbenchSnapshot) {
  snapshot.value = next;
  persistSnapshot(next);
}

const danmakuView = computed(() => deriveDanmakuView(snapshot.value));
const quotaView = computed(() => snapshot.value.quota);
const audienceView = computed(() => deriveAudienceViewFromMemory(memorySnapshot.value));
const reviewView = computed(() => deriveReviewViewFromMemory(memorySnapshot.value));
const runtimeInsight = computed(createRuntimeInsight);

void refreshMemorySnapshot();

function toggleRuntime(key: string) {
  const next = cloneSnapshot(snapshot.value);
  next.danmaku.toggles = next.danmaku.toggles.map((toggle) =>
    toggle.key === key ? { ...toggle, enabled: !toggle.enabled } : toggle,
  );
  replaceSnapshot(next);
  applyQueueToggles(next.danmaku.toggles);
}

function seedLocalEventQueue(toggles: RuntimeToggleState[]) {
  const startedAt = Date.now() - 24_000;
  for (const [index, event] of baselineInteractionSeed.entries()) {
    localEventQueue.enqueue(event, startedAt + index * 4_000);
    if (index < 3) {
      localEventQueue.deliverNext(
        (queuedEvent) => !isChannelDisabled(queuedEvent.type, toggles),
        startedAt + index * 4_000 + 1_200,
      );
    }
  }
  applyQueueToggles(toggles);
}

function applyQueueToggles(toggles: RuntimeToggleState[]) {
  localEventQueue.throttlePending(
    (event) => isChannelDisabled(event.type, toggles),
    "通道关闭或自动投递暂停",
  );
}

function recordPlanTrace(trace: WorkbenchMockPlanTrace) {
  promptRecords.value = pushLimited(promptRecords.value, promptRecord(trace), 8);
  generationRecords.value = pushLimited(generationRecords.value, generationRecord(trace), 8);
  memoryRecords.value = pushLimited(memoryRecords.value, memoryRecordsFor(trace, memorySnapshot.value), 10);
}

function promptRecord(trace: WorkbenchMockPlanTrace): WorkbenchInsightRecord {
  const request = trace.generationRequest;
  return {
    id: `${trace.id}-prompt`,
    title: trace.frameLabel,
    detail: summarizeContext(trace.contextWindow),
    happenedAt: formatQueueTime(trace.happenedAt),
    statusLabel: request ? "已组装" : "本地兜底",
    tone: request ? "ok" : "info",
    meta: request
      ? `${request.activeAudienceProfiles.length} 个观众 · ${request.intents.length} 个意图`
      : "无需 provider 生成",
    codePreview: request
      ? buildAudienceBatchGenerationPrompt(request)
      : "本轮互动意图无需 provider 生成，使用本地兜底文案进入同一投递链路。",
  };
}

function generationRecord(trace: WorkbenchMockPlanTrace): WorkbenchInsightRecord {
  const detail = trace.generatedEvents
    .slice(0, 3)
    .map((event) => `${event.audienceName}：${event.content}`)
    .join(" / ");
  const usedProvider = trace.generationSource === "provider";
  const providerFallback = Boolean(trace.generationRequest && !usedProvider);
  const title =
    usedProvider
      ? "Provider 生成"
      : providerFallback
        ? "Provider 失败，本地兜底"
        : "本地兜底生成";
  const metaParts = [`${trace.frameLabel} · ${trace.generatedEvents.length} 条`];
  if (trace.providerModel) metaParts.push(trace.providerModel);
  if (typeof trace.providerLatencyMs === "number") metaParts.push(`${trace.providerLatencyMs}ms`);
  return {
    id: `${trace.id}-generation`,
    title,
    detail:
      detail ||
      trace.generationError?.message ||
      "本轮没有生成可投递互动。",
    happenedAt: formatQueueTime(trace.happenedAt),
    statusLabel: usedProvider
      ? "Provider"
      : providerFallback
        ? "已兜底"
        : trace.generatedEvents.length > 0
          ? "本地"
          : "无输出",
    tone: usedProvider
      ? "ok"
      : providerFallback
        ? "warn"
        : trace.generatedEvents.length > 0
          ? "info"
          : "warn",
    meta: metaParts.join(" · "),
    evidence: trace.generationError ? [trace.generationError.message] : undefined,
  };
}

function memoryRecordsFor(
  trace: WorkbenchMockPlanTrace,
  memory: MemoryStoreSnapshot | null,
): WorkbenchInsightRecord[] {
  const retrieval: WorkbenchInsightRecord = {
    id: `${trace.id}-memory-retrieval`,
    title: "记忆检索快照",
    detail: memory
      ? `${memory.hostProfile.streamerName} · ${memory.audienceProfiles.length} 个观众画像 · ${memory.sessionRecaps.length} 条场次摘要`
      : "记忆快照尚未加载，planner 本轮只使用影子观众池。",
    happenedAt: formatQueueTime(trace.happenedAt),
    statusLabel: memory ? "已读取" : "未就绪",
    tone: memory ? "ok" : "warn",
    meta: trace.frameLabel,
    evidence: trace.contextWindow.events.slice(0, 2).map((event) => event.summary || event.content),
  };

  if (trace.memoryWriteCandidates.length === 0) {
    return [
      {
        id: `${trace.id}-memory-write-empty`,
        title: "写回候选",
        detail: "本轮未达到写回阈值，不提交长期记忆污染风险。",
        happenedAt: formatQueueTime(trace.happenedAt),
        statusLabel: "无候选",
        tone: "info",
        meta: trace.frameLabel,
      },
      retrieval,
    ];
  }

  return [
    ...trace.memoryWriteCandidates.map((candidate, index) => ({
      id: `${trace.id}-memory-write-${index}`,
      title: "写回候选",
      detail: candidate.summary,
      happenedAt: formatQueueTime(trace.happenedAt),
      statusLabel: "待提交",
      tone: "warn" as const,
      meta: trace.frameLabel,
      evidence: candidate.evidence ?? [],
    })),
    retrieval,
  ];
}

function pushLimited<T>(records: T[], next: T | T[], limit: number) {
  return [...(Array.isArray(next) ? next : [next]), ...records].slice(0, limit);
}

function summarizeContext(window: ContextWindowSnapshot) {
  const summaries = window.events.slice(0, 3).map((event) => event.summary || event.content);
  return summaries.length ? summaries.join(" / ") : "暂无主播语音，保持低频暖场。";
}

async function refreshContextWindow() {
  contextLoading.value = true;
  contextError.value = null;
  try {
    contextWindow.value = await loadContextWindow();
  } catch (error) {
    contextWindow.value = structuredClone(EMPTY_CONTEXT_WINDOW);
    contextError.value = `读取上下文窗口失败：${toErrorMessage(error)}`;
  } finally {
    contextLoading.value = false;
  }
}

async function refreshMemorySnapshot(): Promise<boolean> {
  memoryLoading.value = true;
  memoryError.value = null;
  try {
    memorySnapshot.value = await loadMemorySnapshot();
    return true;
  } catch (error) {
    memoryError.value = `读取记忆快照失败：${toErrorMessage(error)}`;
    return false;
  } finally {
    memoryLoading.value = false;
  }
}

async function submitVoiceContext(content: string): Promise<boolean> {
  contextLoading.value = true;
  contextError.value = null;
  try {
    contextWindow.value = await submitContextEvent({ source: "voice", content });
    return true;
  } catch (error) {
    contextError.value = `提交主播语音失败：${toErrorMessage(error)}`;
    return false;
  } finally {
    contextLoading.value = false;
  }
}

async function submitEchoLiveContext(payload: EchoLiveTextPayload): Promise<void> {
  contextLoading.value = true;
  contextError.value = null;
  try {
    contextWindow.value = await submitContextEvent({
      source: "echo_live",
      content: payload.content,
      summary: payload.summary,
    });
  } catch (error) {
    contextError.value = `提交 Echo-Live 文本失败：${toErrorMessage(error)}`;
    throw error;
  } finally {
    contextLoading.value = false;
  }
}

function connectEchoLive() {
  echoLiveClient.connect();
}

function disconnectEchoLive() {
  echoLiveClient.disconnect();
}

async function clearWorkbenchContextWindow(): Promise<boolean> {
  contextLoading.value = true;
  contextError.value = null;
  try {
    contextWindow.value = await clearContextWindow();
    return true;
  } catch (error) {
    contextError.value = `清空上下文窗口失败：${toErrorMessage(error)}`;
    return false;
  } finally {
    contextLoading.value = false;
  }
}

export function useWorkbenchStore() {
  return {
    snapshot,
    danmakuView,
    quotaView,
    audienceView,
    reviewView,
    runtimeInsight,
    contextLoading,
    contextError,
    memorySnapshot,
    memoryLoading,
    memoryError,
    echoLiveStatus,
    refreshContextWindow,
    refreshMemorySnapshot,
    submitVoiceContext,
    connectEchoLive,
    disconnectEchoLive,
    clearWorkbenchContextWindow,
    toggleRuntime,
  };
}
