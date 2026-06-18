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

const SAVE_DEBOUNCE_MS = 300;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function probeFailure(error: ProviderError): ProviderProbeResult {
  return { ok: false, error };
}

export function useProviderSettings() {
  const draft = reactive<ProviderDraft>(createProviderDraft());
  const loading = ref(true);
  const saving = ref(false);
  const probing = ref(false);
  const loadError = ref<string | null>(null);
  const saveError = ref<string | null>(null);
  const savedOnce = ref(false);
  const probeResult = ref<ProviderProbeResult | null>(null);

  let saveTimer: number | null = null;
  let applyingRemoteState = false;

  const validationErrors = computed<ProviderDraftErrors>(() =>
    validateProviderDraft(draft),
  );

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

  async function load() {
    loading.value = true;
    loadError.value = null;

    try {
      applyConfigToDraft(await loadProviderConfig());
      saveError.value = null;
      savedOnce.value = false;
    } catch (error) {
      loadError.value = toErrorMessage(error);
      applyConfigToDraft(DEFAULT_PROVIDER_CONFIG);
    } finally {
      loading.value = false;
    }
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
      probeResult.value = probeFailure({
        kind: "invalid_config",
        message: firstProviderError(errors) ?? "当前配置不完整。",
      });
      return;
    }

    const saved = await persistNow();
    if (!saved) {
      probeResult.value = probeFailure({
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
      if (loading.value || applyingRemoteState) return;
      scheduleSave();
    },
    { deep: true },
  );

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
    statusText,
    validationErrors,
    runProbe,
    reload: load,
  };
}
