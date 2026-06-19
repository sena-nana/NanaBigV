import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  DEFAULT_PROVIDER_CONFIG,
  createProviderDraft,
  firstProviderError,
  parseProviderDraft,
  validateProviderDraft,
} from "../features/provider/config";
import type {
  ProviderDraft,
  ProviderDraftErrors,
} from "../features/provider/config";
import {
  loadProviderConfig,
  saveProviderConfig,
  testProviderConnection,
} from "../features/provider/api";
import type {
  ProviderError,
  ProviderProbeResult,
} from "../features/provider/types";
import type { StatusTone } from "../features/workbench/types";

const SAVE_DEBOUNCE_MS = 300;
const PROVIDER_SETTINGS_ROUTE = { path: "/settings", query: { tab: "provider" as const } };

export interface ProviderStatusSummary {
  label: string;
  tone: StatusTone;
  title: string;
  detail: string;
  configSummary: string;
  latencyLabel: string;
  lastProbeLabel: string;
  to: typeof PROVIDER_SETTINGS_ROUTE;
}

const draft = reactive<ProviderDraft>(createProviderDraft());
const loading = ref(true);
const saving = ref(false);
const probing = ref(false);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const savedOnce = ref(false);
const probeResult = ref<ProviderProbeResult | null>(null);
const lastProbeAt = ref<Date | null>(null);

let saveTimer: number | null = null;
let applyingRemoteState = false;
let loadedOnce = false;
let loadPromise: Promise<void> | null = null;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function probeFailure(error: ProviderError): ProviderProbeResult {
  return { ok: false, error };
}

function setProbeFailure(error: ProviderError) {
  probeResult.value = probeFailure(error);
  lastProbeAt.value = new Date();
}

const validationErrors = computed<ProviderDraftErrors>(() =>
  validateProviderDraft(draft),
);

function apiKeyLabel() {
  return draft.apiKey.trim() ? "API Key 已配置" : "API Key 未配置";
}

function baseUrlLabel() {
  const value = draft.baseUrl.trim();
  if (!value) return "Base URL 未配置";
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.host}${path}`;
  } catch {
    return value;
  }
}

function modelLabel() {
  const value = draft.model.trim();
  return value ? `模型 ${value}` : "模型未配置";
}

function formatProbeTime(value: Date | null) {
  if (!value) return "尚未测试";
  return value.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function configSummary() {
  return `${baseUrlLabel()} · ${modelLabel()} · ${apiKeyLabel()}`;
}

function failureMessage(result: ProviderProbeResult | null) {
  if (!result || result.ok) return null;
  return result.error.message;
}

const providerStatusSummary = computed<ProviderStatusSummary>(() => {
  const summary = configSummary();
  const lastProbeLabel = formatProbeTime(lastProbeAt.value);
  const withCommon = (
    value: Omit<ProviderStatusSummary, "configSummary" | "lastProbeLabel" | "to">,
  ): ProviderStatusSummary => ({
    ...value,
    configSummary: summary,
    lastProbeLabel,
    to: PROVIDER_SETTINGS_ROUTE,
  });

  if (loading.value) {
    return withCommon({
      label: "读取中",
      tone: "info",
      title: `Provider：正在读取本地配置 · ${summary}`,
      detail: "正在读取本地 Provider 配置。",
      latencyLabel: "读取中",
    });
  }

  if (probing.value) {
    return withCommon({
      label: "测试中",
      tone: "info",
      title: `Provider：正在测试连通性 · ${summary}`,
      detail: "正在通过 chat/completions 测试 Provider 连通性。",
      latencyLabel: "测试中",
    });
  }

  const firstError =
    loadError.value
    ?? saveError.value
    ?? firstProviderError(validationErrors.value)
    ?? failureMessage(probeResult.value);
  if (firstError) {
    return withCommon({
      label: "异常",
      tone: "error",
      title: `Provider 异常：${firstError} · ${summary}`,
      detail: firstError,
      latencyLabel: "不可用",
    });
  }

  if (probeResult.value?.ok) {
    const model = probeResult.value.model || draft.model.trim() || "未返回模型";
    const latencyLabel = `${probeResult.value.latencyMs}ms`;
    return withCommon({
      label: "可用",
      tone: "ok",
      title: `Provider 可用：${model} · ${baseUrlLabel()} · ${latencyLabel} · 最近测试 ${lastProbeLabel}`,
      detail: `最近测试 ${lastProbeLabel}，模型 ${model}，耗时 ${latencyLabel}。`,
      latencyLabel,
    });
  }

  return withCommon({
    label: "待测试",
    tone: "warn",
    title: `Provider 待测试：${summary}`,
    detail: "配置已读取，尚未执行本次会话的连通性测试。",
    latencyLabel: "待测试",
  });
});

function clearPendingSave() {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function applyConfigToDraft(config = DEFAULT_PROVIDER_CONFIG) {
  applyingRemoteState = true;
  Object.assign(draft, createProviderDraft(config));
  applyingRemoteState = false;
}

async function load(force = false) {
  if (!force && loadedOnce) return;
  if (loadPromise) return loadPromise;

  loading.value = true;
  loadError.value = null;
  loadPromise = (async () => {
    try {
      applyConfigToDraft(await loadProviderConfig());
      saveError.value = null;
      savedOnce.value = false;
      loadedOnce = true;
    } catch (error) {
      loadError.value = toErrorMessage(error);
      applyConfigToDraft(DEFAULT_PROVIDER_CONFIG);
    } finally {
      loading.value = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function parseStorageDraft() {
  return parseProviderDraft(draft, { requireCredentials: false });
}

async function persistNow() {
  clearPendingSave();
  const { config, errors } = parseStorageDraft();

  if (!config) {
    saveError.value = firstProviderError(errors) ?? "当前配置尚未保存。";
    savedOnce.value = false;
    return false;
  }

  saving.value = true;
  saveError.value = null;

  try {
    const saved = await saveProviderConfig(config);
    applyConfigToDraft(saved);
    savedOnce.value = true;
    return true;
  } catch (error) {
    saveError.value = toErrorMessage(error);
    savedOnce.value = false;
    return false;
  } finally {
    saving.value = false;
  }
}

function scheduleSave() {
  clearPendingSave();
  const { errors } = parseStorageDraft();

  if (Object.keys(errors).length > 0) {
    saveError.value = firstProviderError(errors) ?? "当前配置尚未保存。";
    savedOnce.value = false;
    return;
  }

  saveTimer = window.setTimeout(() => {
    void persistNow();
  }, SAVE_DEBOUNCE_MS);
}

async function runProbe() {
  const { errors } = parseProviderDraft(draft);
  if (Object.keys(errors).length > 0) {
    setProbeFailure({
      kind: "invalid_config",
      message: firstProviderError(errors) ?? "当前配置不完整。",
    });
    return;
  }

  const saved = await persistNow();
  if (!saved) {
    setProbeFailure({
      kind: "invalid_config",
      message: saveError.value ?? "当前配置尚未保存。",
    });
    return;
  }

  probing.value = true;

  try {
    probeResult.value = await testProviderConnection();
  } catch (error) {
    probeResult.value = probeFailure({
      kind: "transport",
      message: toErrorMessage(error),
    });
  } finally {
    lastProbeAt.value = new Date();
    probing.value = false;
  }
}

const statusText = computed(() => {
  if (loading.value) return "正在读取本地 Provider 配置";
  if (saving.value) return "正在保存到本地 store";
  if (saveError.value) return `本地保存失败：${saveError.value}`;
  if (savedOnce.value) return "已保存到本地 store";
  return "配置由本地 Rust store 托管";
});

watch(
  draft,
  () => {
    probeResult.value = null;
    lastProbeAt.value = null;
    if (loading.value || applyingRemoteState) return;
    scheduleSave();
  },
  { deep: true },
);

export function useProviderSettings() {
  onMounted(() => {
    void load();
  });

  onBeforeUnmount(() => {
    clearPendingSave();
  });

  return {
    draft,
    loading,
    saving,
    probing,
    loadError,
    saveError,
    probeResult,
    lastProbeAt,
    providerStatusSummary,
    statusText,
    validationErrors,
    runProbe,
    reload: () => load(true),
  };
}

export function useProviderStatusSummary() {
  return {
    providerStatusSummary,
  };
}

export function resetProviderSettingsStateForTest() {
  clearPendingSave();
  applyingRemoteState = true;
  Object.assign(draft, createProviderDraft());
  applyingRemoteState = false;
  loading.value = true;
  saving.value = false;
  probing.value = false;
  loadError.value = null;
  saveError.value = null;
  savedOnce.value = false;
  probeResult.value = null;
  lastProbeAt.value = null;
  loadedOnce = false;
  loadPromise = null;
}
