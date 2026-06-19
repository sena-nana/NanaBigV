import { computed, ref } from "vue";
import appConfig from "../../../app.config.json";
import { useProviderStatusSummary } from "../../composables/useProviderSettings";
import { BIGV_WORKBENCH_SNAPSHOT } from "./mockSnapshot";
import type {
  BigVWorkbenchSnapshot,
  DanmakuViewModel,
  InputSourceStatus,
  InteractionEvent,
  RuntimeNotice,
  RuntimeToggleState,
} from "./types";

const STORAGE_KEY = `${appConfig.storageKeyPrefix}.workbench`;
const { providerStatusSummary } = useProviderStatusSummary();

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  const dispatchEnabled = findToggle(toggles, "dispatch")?.enabled !== false;
  if (!dispatchEnabled) return true;
  if ((type === "gift" || type === "membership") && findToggle(toggles, "gifts")?.enabled === false) {
    return true;
  }
  return type === "super_chat" && findToggle(toggles, "super-chat")?.enabled === false;
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
  return notices;
}

function deriveDanmakuView(snapshot: BigVWorkbenchSnapshot): DanmakuViewModel {
  const baseView = snapshot.danmaku;
  const toggles = baseView.toggles;
  const dispatchEnabled = findToggle(toggles, "dispatch")?.enabled !== false;
  const providerSummary = providerStatusSummary.value;

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
  const inputSources = [
    ...baseView.inputSources.filter((source) => source.key !== "provider"),
    providerSource,
  ];

  const queueStats = baseView.queueStats.map((stat) => {
    if (!isChannelDisabled(stat.type, toggles)) return stat;
    return {
      ...stat,
      queued: 0,
      throttled: stat.throttled + stat.queued,
    };
  });

  return {
    ...baseView,
    liveStatus,
    inputSources,
    queueStats,
    notices: deriveNotices(baseView),
  };
}

const snapshot = ref<BigVWorkbenchSnapshot>(loadInitialSnapshot());

function replaceSnapshot(next: BigVWorkbenchSnapshot) {
  snapshot.value = next;
  persistSnapshot(next);
}

const danmakuView = computed(() => deriveDanmakuView(snapshot.value));
const quotaView = computed(() => snapshot.value.quota);
const audienceView = computed(() => snapshot.value.audience);
const reviewView = computed(() => snapshot.value.review);

function toggleRuntime(key: string) {
  const next = cloneSnapshot(snapshot.value);
  next.danmaku.toggles = next.danmaku.toggles.map((toggle) =>
    toggle.key === key ? { ...toggle, enabled: !toggle.enabled } : toggle,
  );
  replaceSnapshot(next);
}

export function useWorkbenchStore() {
  return {
    snapshot,
    danmakuView,
    quotaView,
    audienceView,
    reviewView,
    toggleRuntime,
  };
}
