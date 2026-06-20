import type { ContextEvent, ContextSourceKind } from "../context/types";

export type WorkbenchNavKey = "danmaku" | "quota" | "audience" | "review";
export type InteractionType = "danmaku" | "gift" | "super_chat" | "membership";
export type StatusTone = "ok" | "warn" | "error" | "info";
export type UsageWindowKey = "24h" | "7d" | "30d";
export type AudienceActivityLevel = "high" | "medium" | "low";
export type AudienceSpendingTier = "high" | "medium" | "low";
export type AudienceRelationship = "core" | "regular" | "new";
export type AudienceKind = "memory_profile" | "shadow_profile";
export type AudienceRhythmState = "cold" | "steady" | "peak" | "closing";
export type AudienceReactionKind =
  | "agreement"
  | "question"
  | "advice"
  | "joke"
  | "support"
  | "spending"
  | "membership_entry";

export interface WorkbenchNavItem {
  key: WorkbenchNavKey;
  label: string;
  to: string;
  description: string;
}

export interface LiveRoomStatus {
  roomLabel: string;
  streamTitle: string;
  statusLabel: string;
  tone: StatusTone;
  viewerEstimate: number;
  rhythmLabel: string;
  nextActionHint: string;
  updatedAt: string;
}

export interface InputSourceStatus {
  key: string;
  label: string;
  statusLabel: string;
  tone: StatusTone;
  summary: string;
  source?: ContextSourceKind;
  lastEventAt?: number;
  eventCount?: number;
  latencyMs?: number;
  latencyLabel?: string;
}

export interface RuntimeToggleState {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface InteractionEvent {
  id: string;
  type: InteractionType;
  audienceName: string;
  content: string;
  amountLabel?: string;
  statusLabel: string;
  tone: StatusTone;
  happenedAt: string;
}

export interface DeliveryQueueStat {
  type: InteractionType;
  label: string;
  queued: number;
  delivered: number;
  throttled: number;
}

export type BlivechatRenderAction = "enqueue" | "deliver" | "throttle";

export interface BlivechatRenderItem {
  id: string;
  eventId: string;
  action: BlivechatRenderAction;
  type: InteractionType;
  audienceName: string;
  content: string;
  amountLabel?: string;
  statusLabel: string;
  tone: StatusTone;
  happenedAt: string;
  reasonLabel?: string;
}

export interface BlivechatRenderChannel {
  type: InteractionType;
  label: string;
  items: BlivechatRenderItem[];
}

export interface WorkbenchInsightRecord {
  id: string;
  happenedAt: string;
  title: string;
  detail: string;
  statusLabel: string;
  tone: StatusTone;
  meta?: string;
  evidence?: string[];
  codePreview?: string;
}

export interface WorkbenchInsightSection {
  id: string;
  title: string;
  emptyText: string;
  records: WorkbenchInsightRecord[];
}

export interface WorkbenchRuntimeInsight {
  updatedAt: string;
  sections: WorkbenchInsightSection[];
}

export interface RuntimeNotice {
  id: string;
  title: string;
  detail: string;
  tone: StatusTone;
}

export type MockSourceRunState = "idle" | "running" | "paused" | "error";

export interface MockSourceStatus {
  state: MockSourceRunState;
  scenarioLabel: string;
  tickCount: number;
  intervalMs: number;
  lastEventLabel?: string;
  error?: string;
}

export interface MockSourceRecord {
  id: string;
  frameLabel: string;
  contextLabels: string[];
  interactionLabels: string[];
  statusLabel: string;
  tone: StatusTone;
  happenedAt: string;
}

export interface AudienceInteractionIntent {
  audienceId: string;
  audienceName: string;
  audienceKind: AudienceKind;
  interactionType: InteractionType;
  reactionKind: AudienceReactionKind;
  intensity: number;
  styleHints: string[];
  contextRefs: string[];
  needsGeneration: boolean;
}

export interface AudienceSimulationStatus {
  rhythmState: AudienceRhythmState;
  rhythmLabel: string;
  activeAudienceCount: number;
  plannedIntentCount: number;
  llmBatchCallCount: number;
  localGeneratedCount: number;
  cooldownRejectCount: number;
  throttleRejectCount: number;
  budgetRejectCount: number;
  memoryAudienceCount: number;
  shadowAudienceCount: number;
}

export interface DanmakuViewModel {
  liveStatus: LiveRoomStatus;
  inputSources: InputSourceStatus[];
  contextEvents: ContextEvent[];
  contextWindowSeconds: number;
  toggles: RuntimeToggleState[];
  queueStats: DeliveryQueueStat[];
  recentEvents: InteractionEvent[];
  blivechatChannels: BlivechatRenderChannel[];
  mockSource: MockSourceStatus;
  mockSourceRecords: MockSourceRecord[];
  simulationStatus: AudienceSimulationStatus;
  notices: RuntimeNotice[];
}

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  retryWasteTokens: number;
}

export interface UsageSeriesPoint {
  label: string;
  inputTokens: number;
  outputTokens: number;
  retryWasteTokens: number;
  estimatedCost: number;
}

export interface UsageBreakdown {
  id: string;
  label: string;
  value: number;
  share: number;
  tone: StatusTone;
  helperText?: string;
}

export interface QuotaWindowData {
  summary: UsageSummary;
  trend: UsageSeriesPoint[];
  byModel: UsageBreakdown[];
  byCapability: UsageBreakdown[];
  bySubsystem: UsageBreakdown[];
}

export interface QuotaViewModel {
  defaultWindow: UsageWindowKey;
  windows: Array<{ key: UsageWindowKey; label: string }>;
  windowData: Record<UsageWindowKey, QuotaWindowData>;
}

export interface AudiencePreference {
  label: string;
  detail: string;
  strength: string;
}

export interface AudienceMemoryRecord {
  id: string;
  layer: string;
  summary: string;
  confidence: string;
  updatedAt: string;
}

export interface AudienceBehaviorRecord {
  id: string;
  happenedAt: string;
  type: InteractionType;
  detail: string;
  result: string;
}

export interface AudienceProfile {
  id: string;
  name: string;
  tagLine: string;
  summary: string;
  roleTags: string[];
  activityLevel: AudienceActivityLevel;
  activityLabel: string;
  spendingTier: AudienceSpendingTier;
  spendingLabel: string;
  relationship: AudienceRelationship;
  relationshipLabel: string;
  appearanceFrequency: string;
  languageStyle: string;
  preferences: AudiencePreference[];
  memories: AudienceMemoryRecord[];
  recentBehaviors: AudienceBehaviorRecord[];
}

export interface AudienceViewModel {
  defaultAudienceId: string;
  audiences: AudienceProfile[];
}

export interface HostProfileSnapshot {
  streamerName: string;
  personaSummary: string;
  languageStyle: string;
  streamTraits: string[];
  stableTopics: string[];
  tabooTopics: string[];
  updatedAt: string;
}

export interface SessionRecap {
  id: string;
  dateLabel: string;
  title: string;
  rhythmLabel: string;
  summary: string;
  peakMoment: string;
  memoryWrites: number;
}

export interface HighlightEvent {
  id: string;
  happenedAt: string;
  title: string;
  detail: string;
  impact: string;
}

export interface StreamSuggestion {
  id: string;
  category: string;
  title: string;
  detail: string;
  priority: string;
}

export interface ReviewViewModel {
  hostProfile: HostProfileSnapshot;
  sessionRecaps: SessionRecap[];
  highlights: HighlightEvent[];
  suggestions: StreamSuggestion[];
}

export interface BigVWorkbenchSnapshot {
  nav: WorkbenchNavItem[];
  danmaku: DanmakuViewModel;
  quota: QuotaViewModel;
  audience: AudienceViewModel;
  review: ReviewViewModel;
}
