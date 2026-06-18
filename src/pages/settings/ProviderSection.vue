<script setup lang="ts">
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
    <h2>Provider</h2>
    <div class="provider-intro">
      <p>Provider 配置由本地 Rust store 托管，连通性测试走 OpenAI 兼容 `chat/completions`。</p>
      <p class="muted">{{ settings.statusText.value }}</p>
    </div>

    <div v-if="settings.loadError.value" class="provider-banner provider-banner--error" role="alert">
      读取本地配置失败：{{ settings.loadError.value }}
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
        <span class="settings-field__hint">仅保存在本地 Rust store，用于 Provider 鉴权。</span>
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
      <label class="settings-field">
        <span class="settings-field__label">模型名</span>
        <span class="settings-field__hint">用于连通性测试和后续生成层默认调用。</span>
        <input
          v-model="settings.draft.model"
          type="text"
          autocomplete="off"
          spellcheck="false"
          aria-label="模型名"
          placeholder="gpt-4.1-mini"
        />
        <span v-if="settings.validationErrors.value.model" class="settings-field__error">
          {{ settings.validationErrors.value.model }}
        </span>
      </label>
    </div>

    <div class="provider-grid">
      <label class="settings-field">
        <span class="settings-field__label">temperature</span>
        <input
          v-model="settings.draft.temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          inputmode="decimal"
          aria-label="temperature"
        />
        <span v-if="settings.validationErrors.value.temperature" class="settings-field__error">
          {{ settings.validationErrors.value.temperature }}
        </span>
      </label>

      <label class="settings-field">
        <span class="settings-field__label">top_p</span>
        <input
          v-model="settings.draft.topP"
          type="number"
          min="0"
          max="1"
          step="0.1"
          inputmode="decimal"
          aria-label="top_p"
        />
        <span v-if="settings.validationErrors.value.topP" class="settings-field__error">
          {{ settings.validationErrors.value.topP }}
        </span>
      </label>

      <label class="settings-field">
        <span class="settings-field__label">超时(秒)</span>
        <input
          v-model="settings.draft.timeoutSeconds"
          type="number"
          min="1"
          max="300"
          step="1"
          inputmode="numeric"
          aria-label="超时(秒)"
        />
        <span v-if="settings.validationErrors.value.timeoutSeconds" class="settings-field__error">
          {{ settings.validationErrors.value.timeoutSeconds }}
        </span>
      </label>
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
        :disabled="settings.loading.value"
        @click="settings.reload"
      >
        重新读取
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
.provider-intro {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
}

.provider-intro p {
  margin: 0;
}

.settings-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-soft);
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 12px 0 0;
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
  .provider-grid {
    grid-template-columns: 1fr;
  }

  .provider-actions {
    flex-wrap: wrap;
  }
}
</style>
