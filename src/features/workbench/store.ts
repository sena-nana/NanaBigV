import { computed, ref, watch } from "vue";
import appConfig from "../../../app.config.json";
import { useProviderStatusSummary } from "../../composables/useProviderSettings";
import { useWorkbenchDebugSettings } from "../../composables/useWorkbenchDebug";
import {
  clearContextWindow,
  loadContextWindow,
  submitContextEvent,
} from "../context/api";
import { loadMemorySnapshot } from "../memory/api";
import {
  deriveAudienceViewFromMemory,
  deriveReviewViewFromMemory,
} from "../memory/viewModels";
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
      statusLabel: "预留接口",
      tone: "info",
      summary: "Echo-Live 输入适配器已预留，阶段 3 不接入真实事件。",
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
const memorySnapshot = ref<MemoryStoreSnapshot | null>(null);
const memoryLoading = ref(false);
const memoryError = ref<string | null>(null);
const mockSourceStatus = ref(createInitialMockSourceStatus());
const mockSourceRecords = ref<MockSourceRecord[]>([]);
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
  return window.sourceStatuses.map((source) => ({
    key: source.source,
    source: source.source,
    label: source.label,
    statusLabel: source.statusLabel,
    tone: source.tone,
    summary: source.summary,
    lastEventAt: source.lastEventAt,
    eventCount: source.eventCount,
  }));
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
  onChange(status, records) {
    mockSourceStatus.value = status;
    mockSourceRecords.value = records;
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
    contextLoading,
    contextError,
    memorySnapshot,
    memoryLoading,
    memoryError,
    refreshContextWindow,
    refreshMemorySnapshot,
    submitVoiceContext,
    clearWorkbenchContextWindow,
    toggleRuntime,
  };
}
