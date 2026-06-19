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
  listProviderModels,
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
const loadingModels = ref(false);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const modelListError = ref<string | null>(null);
const probeResult = ref<ProviderProbeResult | null>(null);
const lastProbeAt = ref<Date | null>(null);
const modelOptions = ref<string[]>([]);

let saveTimer: number | null = null;
let applyingRemoteState = false;
let loadedOnce = false;
let loadPromise: Promise<void> | null = null;
let currentProviderKey = "";

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
      detail: "正在测试 Provider 连通性。",
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
  currentProviderKey = providerKey();
  applyingRemoteState = false;
}

function providerKey() {
  return `${draft.baseUrl.trim()}\n${draft.apiKey.trim()}`;
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
      loadedOnce = true;
      if (draft.baseUrl.trim() && draft.apiKey.trim()) {
        void refreshModels();
      }
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
  return parseProviderDraft(draft, { requireApiKey: false, requireModel: false });
}

async function persistNow() {
  clearPendingSave();
  const { config, errors } = parseStorageDraft();

  if (!config) {
    saveError.value = firstProviderError(errors) ?? "当前配置尚未保存。";
    return false;
  }

  saving.value = true;
  saveError.value = null;

  try {
    const saved = await saveProviderConfig(config);
    applyConfigToDraft(saved);
    return true;
  } catch (error) {
    saveError.value = toErrorMessage(error);
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

async function refreshModels() {
  const { config, errors } = parseProviderDraft(draft, { requireModel: false });
  if (!config) {
    modelListError.value = firstProviderError(errors) ?? "请先填写 Base URL 和 API Key。";
    modelOptions.value = [];
    return;
  }

  loadingModels.value = true;
  modelListError.value = null;

  try {
    const result = await listProviderModels(config);
    if (!result.ok) {
      modelListError.value = result.error.message;
      modelOptions.value = [];
      return;
    }
    modelOptions.value = result.models;
    if (draft.model && !modelOptions.value.includes(draft.model)) {
      draft.model = "";
    }
  } catch (error) {
    modelListError.value = toErrorMessage(error);
    modelOptions.value = [];
  } finally {
    loadingModels.value = false;
  }
}

watch(
  () => [draft.baseUrl, draft.apiKey],
  () => {
    if (loading.value || applyingRemoteState) return;
    const nextProviderKey = providerKey();
    if (nextProviderKey === currentProviderKey) return;
    currentProviderKey = nextProviderKey;
    modelOptions.value = [];
    modelListError.value = null;
    if (draft.model) draft.model = "";
  },
);

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
    loadingModels,
    loadError,
    saveError,
    modelListError,
    probeResult,
    lastProbeAt,
    modelOptions,
    providerStatusSummary,
    validationErrors,
    runProbe,
    refreshModels,
    save: persistNow,
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
  currentProviderKey = providerKey();
  applyingRemoteState = false;
  loading.value = true;
  saving.value = false;
  probing.value = false;
  loadingModels.value = false;
  loadError.value = null;
  saveError.value = null;
  modelListError.value = null;
  probeResult.value = null;
  lastProbeAt.value = null;
  modelOptions.value = [];
  loadedOnce = false;
  loadPromise = null;
}
