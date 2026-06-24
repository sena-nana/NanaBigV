<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { cloneLiveConfigValue, useLiveAssistConfig } from "../features/liveConfig/store";
import type { AudienceGroupConfig } from "../features/liveConfig/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { config, loading, saving, error, load, updateAudienceGroup } = useLiveAssistConfig();
const selectedId = ref("");
const draft = ref<AudienceGroupConfig | null>(null);
const selectedGroup = computed(
  () => config.value.audienceGroups.find((group) => group.id === selectedId.value) ?? config.value.audienceGroups[0],
);
const boundarySummary = computed(() => draft.value?.boundaryRules.join("、") ?? "");
const styleSummary = computed(() => draft.value?.languageStyles.join("、") ?? "");

onMounted(async () => {
  await load();
  selectedId.value = config.value.audienceGroups[0]?.id ?? "";
});

watch(
  selectedGroup,
  (group) => {
    draft.value = group ? cloneLiveConfigValue(group) : null;
  },
  { immediate: true },
);

function splitTextList(value: string) {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function saveDraft() {
  if (!draft.value) return;
  await updateAudienceGroup(draft.value);
}

function updateStyles(value: string) {
  if (!draft.value) return;
  draft.value.languageStyles = splitTextList(value);
}

function updateBoundaries(value: string) {
  if (!draft.value) return;
  draft.value.boundaryRules = splitTextList(value);
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>AI 观众</h1>
      <StatusBadge :label="loading ? '读取配置' : saving ? '保存中' : '观众组'" :tone="saving ? 'info' : 'ok'" />
    </div>
    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="audience-groups-layout">
      <aside class="card audience-groups-list">
        <h2>观众组列表</h2>
        <button
          v-for="group in config.audienceGroups"
          :key="group.id"
          type="button"
          class="audience-group-card"
          :class="{ 'is-active': selectedId === group.id }"
          @click="selectedId = group.id"
        >
          <span class="audience-group-color" :style="{ backgroundColor: group.color }" />
          <strong>{{ group.name }}</strong>
          <StatusBadge :label="group.enabled ? '启用' : '停用'" :tone="group.enabled ? 'ok' : 'warn'" />
          <small>{{ group.useCase }}</small>
        </button>
      </aside>

      <main v-if="draft" class="card audience-editor">
        <div class="workbench-card-head">
          <h2>{{ draft.name }}</h2>
          <ToggleSwitch
            :model-value="draft.enabled"
            aria-label="启用观众组"
            @update:model-value="(value) => draft && (draft.enabled = value)"
          />
        </div>

        <div class="audience-form-grid">
          <label>名称<input v-model="draft.name" /></label>
          <label>标识色<input v-model="draft.color" type="color" /></label>
          <label class="is-wide">使用场景<input v-model="draft.useCase" /></label>
          <label>平均句长<input v-model="draft.averageLength" /></label>
          <label>记忆范围
            <select v-model="draft.memoryScope">
              <option value="host_profile">主播设定</option>
              <option value="room_memes">直播间梗</option>
              <option value="last_session">上次直播</option>
              <option value="current_session_only">仅本场</option>
            </select>
          </label>
        </div>

        <section class="audience-sliders">
          <h3>行为参数</h3>
          <label>发言频率 <input v-model.number="draft.frequency" type="range" min="0" max="100" /> <output>{{ draft.frequency }}%</output></label>
          <label>提问概率 <input v-model.number="draft.questionRate" type="range" min="0" max="100" /> <output>{{ draft.questionRate }}%</output></label>
          <label>夸奖概率 <input v-model.number="draft.praiseRate" type="range" min="0" max="100" /> <output>{{ draft.praiseRate }}%</output></label>
          <label>玩梗概率 <input v-model.number="draft.memeRate" type="range" min="0" max="100" /> <output>{{ draft.memeRate }}%</output></label>
          <label>吐槽概率 <input v-model.number="draft.roastRate" type="range" min="0" max="100" /> <output>{{ draft.roastRate }}%</output></label>
          <label>主动带话题 <input v-model.number="draft.topicRate" type="range" min="0" max="100" /> <output>{{ draft.topicRate }}%</output></label>
          <label>冷场触发 <input v-model.number="draft.silenceTriggerRate" type="range" min="0" max="100" /> <output>{{ draft.silenceTriggerRate }}%</output></label>
        </section>

        <div class="audience-form-grid">
          <label class="is-wide">语言风格<input :value="styleSummary" @input="updateStyles(($event.target as HTMLInputElement).value)" /></label>
          <label class="is-wide">边界规则<input :value="boundarySummary" @input="updateBoundaries(($event.target as HTMLInputElement).value)" /></label>
        </div>

        <details class="advanced-prompt">
          <summary>高级提示词</summary>
          <textarea v-model="draft.advancedPrompt" rows="4" placeholder="默认不需要填写复杂 Prompt" />
        </details>

        <div class="audience-actions">
          <button class="button-primary" type="button" :disabled="saving" @click="saveDraft">保存观众组</button>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.audience-groups-layout {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 12px;
}

.audience-groups-list,
.audience-editor {
  display: grid;
  gap: 12px;
  align-content: start;
}

.audience-group-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text);
  padding: 12px;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  text-align: left;
}

.audience-group-card.is-active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
}

.audience-group-card small {
  grid-column: 2 / 4;
  color: var(--text-muted);
  line-height: 1.5;
}

.audience-group-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.audience-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.audience-form-grid label,
.audience-sliders label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.audience-form-grid .is-wide {
  grid-column: 1 / -1;
}

.audience-form-grid input,
.audience-form-grid select,
.advanced-prompt textarea {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 9px 10px;
  font: inherit;
}

.audience-sliders {
  display: grid;
  gap: 10px;
}

.audience-sliders label {
  grid-template-columns: 110px minmax(0, 1fr) 42px;
  align-items: center;
}

.advanced-prompt {
  color: var(--text-muted);
}

.advanced-prompt textarea {
  width: 100%;
  margin-top: 8px;
}

.audience-actions {
  display: flex;
  justify-content: flex-end;
}

.button-primary {
  min-height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}

@media (max-width: 900px) {
  .audience-groups-layout,
  .audience-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
