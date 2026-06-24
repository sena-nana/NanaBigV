<script setup lang="ts">
import { computed, onMounted } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { useLiveAssistConfig } from "../features/liveConfig/store";
import type { OutputMode } from "../features/liveConfig/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { config, loading, saving, error, load, updateConfig, setOutputMode } = useLiveAssistConfig();
const outputModeLabel = computed(() => {
  if (config.value.safety.outputMode === "auto_assist") return "自动辅助";
  if (config.value.safety.outputMode === "prompt_only") return "仅提词";
  return "人工确认";
});

onMounted(() => {
  void load();
});

async function toggleRule(id: string) {
  await updateConfig((draft) => {
    const rule = draft.safety.basicRules.find((item) => item.id === id);
    if (rule) rule.enabled = !rule.enabled;
  });
}

async function toggleFilter(id: string) {
  await updateConfig((draft) => {
    const filter = draft.safety.qualityFilters.find((item) => item.id === id);
    if (filter) filter.enabled = !filter.enabled;
  });
}

async function updateNumber(field: "maxGeneratedPerMinute" | "maxConsecutivePerTopic", value: string) {
  await updateConfig((draft) => {
    draft.safety[field] = Number(value);
  });
}

async function changeOutputMode(mode: OutputMode) {
  await setOutputMode(mode);
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>安全设置</h1>
      <StatusBadge :label="loading ? '读取配置' : saving ? '保存中' : outputModeLabel" :tone="config.safety.outputMode === 'auto_assist' ? 'warn' : 'ok'" />
    </div>
    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="safety-layout">
      <section class="card">
        <h2>输出模式</h2>
        <div class="output-mode-grid">
          <button type="button" :class="{ 'is-active': config.safety.outputMode === 'prompt_only' }" @click="changeOutputMode('prompt_only')">
            <strong>仅提词</strong>
            <span>只给主播看，不发送到直播间。</span>
          </button>
          <button type="button" :class="{ 'is-active': config.safety.outputMode === 'manual_review' }" @click="changeOutputMode('manual_review')">
            <strong>人工确认</strong>
            <span>AI 生成后由用户确认使用。</span>
          </button>
          <button type="button" :class="{ 'is-active': config.safety.outputMode === 'auto_assist' }" @click="changeOutputMode('auto_assist')">
            <strong>自动辅助</strong>
            <span>限定规则内自动生成，严格限频。</span>
          </button>
        </div>
        <label class="safety-row">
          <span>需要人工确认</span>
          <ToggleSwitch
            :model-value="config.safety.requireManualConfirmation"
            aria-label="需要人工确认"
            @update:model-value="(value) => updateConfig((draft) => { draft.safety.requireManualConfirmation = value; })"
          />
        </label>
      </section>

      <section class="card">
        <h2>基础安全</h2>
        <div class="safety-rule-list">
          <label v-for="rule in config.safety.basicRules" :key="rule.id" class="safety-row">
            <span>{{ rule.label }}</span>
            <ToggleSwitch
              :model-value="rule.enabled"
              :aria-label="rule.label"
              @update:model-value="() => toggleRule(rule.id)"
            />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>弹幕质量</h2>
        <div class="safety-rule-list">
          <label v-for="filter in config.safety.qualityFilters" :key="filter.id" class="safety-row">
            <span>{{ filter.label }}</span>
            <ToggleSwitch
              :model-value="filter.enabled"
              :aria-label="filter.label"
              @update:model-value="() => toggleFilter(filter.id)"
            />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>频率限制</h2>
        <label class="safety-number">
          <span>单分钟最大生成数</span>
          <input
            type="number"
            min="1"
            max="60"
            :value="config.safety.maxGeneratedPerMinute"
            @change="updateNumber('maxGeneratedPerMinute', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="safety-number">
          <span>单话题最大连续条数</span>
          <input
            type="number"
            min="1"
            max="20"
            :value="config.safety.maxConsecutivePerTopic"
            @change="updateNumber('maxConsecutivePerTopic', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </section>
    </div>
  </section>
</template>

<style scoped>
.safety-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.output-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.output-mode-grid button {
  min-height: 94px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text);
  display: grid;
  gap: 6px;
  text-align: left;
}

.output-mode-grid button.is-active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 70%, var(--bg));
}

.output-mode-grid span,
.safety-number span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.safety-rule-list {
  display: grid;
  gap: 8px;
}

.safety-row,
.safety-number {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-soft);
}

.safety-row:last-child,
.safety-number:last-child {
  border-bottom: 0;
}

.safety-number input {
  width: 92px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 8px 10px;
}

@media (max-width: 980px) {
  .safety-layout,
  .output-mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
