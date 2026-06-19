<script setup lang="ts">
import { Download } from "@lucide/vue";
import { computed } from "vue";
import { useProviderSettings } from "../../composables/useProviderSettings";

const settings = useProviderSettings();

const probeResultTone = computed(() => {
  if (!settings.probeResult.value) return null;
  return settings.probeResult.value.ok ? "ok" : "error";
});
</script>

<template>
  <div class="card">
    <h2>模型配置</h2>

    <div v-if="settings.loadError.value" class="provider-banner provider-banner--error" role="alert">
      读取本地配置失败：{{ settings.loadError.value }}
    </div>
    <div v-if="settings.saveError.value" class="provider-banner provider-banner--error" role="alert">
      本地保存失败：{{ settings.saveError.value }}
    </div>

    <div class="settings-row">
      <label class="settings-field">
        <span class="settings-field__label">Base URL</span>
        <span class="settings-field__hint">OpenAI 兼容 HTTP 接口根路径，例如 `https://api.openai.com/v1`。</span>
        <input
          v-model="settings.draft.baseUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          aria-label="Base URL"
          placeholder="https://api.openai.com/v1"
        />
        <span v-if="settings.validationErrors.value.baseUrl" class="settings-field__error">
          {{ settings.validationErrors.value.baseUrl }}
        </span>
      </label>
    </div>

    <div class="settings-row">
      <label class="settings-field">
        <span class="settings-field__label">API Key</span>
        <span class="settings-field__hint">用于 Provider 鉴权。</span>
        <input
          v-model="settings.draft.apiKey"
          type="password"
          autocomplete="off"
          spellcheck="false"
          aria-label="API Key"
          placeholder="sk-..."
        />
        <span v-if="settings.validationErrors.value.apiKey" class="settings-field__error">
          {{ settings.validationErrors.value.apiKey }}
        </span>
      </label>
    </div>

    <div class="settings-row">
      <div class="settings-field">
        <span class="settings-field__label">模型</span>
        <span class="settings-field__hint">先从远端获取模型列表，再选择默认模型。</span>
        <div class="model-select-row">
          <select
            v-model="settings.draft.model"
            aria-label="模型"
            :disabled="settings.loadingModels.value || settings.modelOptions.value.length === 0"
          >
            <option value="" disabled>
              {{ settings.loadingModels.value ? "正在获取模型..." : "请选择模型" }}
            </option>
            <option
              v-for="model in settings.modelOptions.value"
              :key="model"
              :value="model"
            >
              {{ model }}
            </option>
          </select>
          <button
            type="button"
            class="ghost model-fetch-button"
            :aria-label="settings.loadingModels.value ? '正在获取模型' : '获取模型'"
            :title="settings.loadingModels.value ? '正在获取模型' : '获取模型'"
            :disabled="settings.loading.value || settings.loadingModels.value"
            @click="settings.refreshModels"
          >
            <Download :size="14" aria-hidden="true" />
          </button>
        </div>
        <span v-if="settings.validationErrors.value.model" class="settings-field__error">
          {{ settings.validationErrors.value.model }}
        </span>
        <span v-if="settings.modelListError.value" class="settings-field__error">
          {{ settings.modelListError.value }}
        </span>
      </div>
    </div>

    <div class="provider-actions">
      <button
        type="button"
        class="primary"
        :disabled="settings.loading.value || settings.probing.value"
        @click="settings.runProbe"
      >
        {{ settings.probing.value ? "测试中..." : "测试连通性" }}
      </button>
      <button
        type="button"
        class="ghost"
        :disabled="settings.loading.value || settings.saving.value"
        @click="settings.save"
      >
        {{ settings.saving.value ? "保存中..." : "保存" }}
      </button>
    </div>

    <div
      v-if="settings.probeResult.value"
      class="provider-banner"
      :class="{
        'provider-banner--ok': probeResultTone === 'ok',
        'provider-banner--error': probeResultTone === 'error',
      }"
      :role="settings.probeResult.value.ok ? 'status' : 'alert'"
    >
      <template v-if="settings.probeResult.value.ok">
        <strong>{{ settings.probeResult.value.message }}</strong>
        <span>模型：{{ settings.probeResult.value.model }}</span>
        <span>耗时：{{ settings.probeResult.value.latencyMs }} ms</span>
      </template>
      <template v-else>
        <strong>{{ settings.probeResult.value.error.kind }}</strong>
        <span>{{ settings.probeResult.value.error.message }}</span>
        <code v-if="settings.probeResult.value.error.statusCode">
          HTTP {{ settings.probeResult.value.error.statusCode }}
        </code>
        <pre v-if="settings.probeResult.value.error.responseBodySnippet"><code>{{
          settings.probeResult.value.error.responseBodySnippet
        }}</code></pre>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-soft);
}

.settings-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.settings-field__label {
  font-size: 13px;
  font-weight: 600;
}

.settings-field__hint {
  color: var(--text-muted);
  font-size: 12px;
}

.settings-field__error {
  color: var(--err);
  font-size: 12px;
}

.model-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.model-select-row select {
  flex: 1 1 auto;
  min-width: 0;
}

.model-fetch-button {
  flex: 0 0 32px;
  width: 32px;
  padding: 0;
}

.provider-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
}

.provider-banner {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

.provider-banner--ok {
  border-color: color-mix(in srgb, var(--ok) 36%, var(--border));
  background: var(--ok-soft);
}

.provider-banner--error {
  border-color: color-mix(in srgb, var(--err) 40%, var(--border));
  background: var(--err-soft);
}

.provider-banner strong {
  font-size: 13px;
}

.provider-banner span,
.provider-banner code {
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .provider-actions {
    flex-wrap: wrap;
  }
}
</style>
