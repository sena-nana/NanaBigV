<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { cloneLiveConfigValue, useLiveAssistConfig } from "../features/liveConfig/store";
import type { TopicCard } from "../features/liveConfig/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { config, loading, saving, error, load, updateConfig, updateTopicCard } = useLiveAssistConfig();
const selectedId = ref("");
const draft = ref<TopicCard | null>(null);
const selectedTopic = computed(
  () => config.value.topicCards.find((topic) => topic.id === selectedId.value) ?? config.value.topicCards[0],
);

onMounted(async () => {
  await load();
  selectedId.value = config.value.topicCards[0]?.id ?? "";
});

watch(
  selectedTopic,
  (topic) => {
    draft.value = topic ? cloneLiveConfigValue(topic) : null;
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
  await updateTopicCard(draft.value);
}

async function updateOutline(field: "opening" | "mainContent" | "closing", value: string) {
  await updateConfig((next) => {
    next.outline[field] = value;
  });
}

async function updateOutlineList(field: "interactionPoints" | "forbiddenDetours", value: string) {
  await updateConfig((next) => {
    next.outline[field] = splitTextList(value);
  });
}

async function updateMemeList(field: "roomMemes" | "catchphrases" | "fanNames" | "disabledMemes" | "recentMemes" | "expiredMemes", value: string) {
  await updateConfig((next) => {
    next.memeLibrary[field] = splitTextList(value);
  });
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>话题库</h1>
      <StatusBadge :label="loading ? '读取配置' : saving ? '保存中' : '直播节奏素材'" :tone="saving ? 'info' : 'ok'" />
    </div>
    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="topic-layout">
      <section class="card topic-outline">
        <h2>今日直播大纲</h2>
        <label>开场话题<textarea :value="config.outline.opening" rows="2" @change="updateOutline('opening', ($event.target as HTMLTextAreaElement).value)" /></label>
        <label>主要内容<textarea :value="config.outline.mainContent" rows="2" @change="updateOutline('mainContent', ($event.target as HTMLTextAreaElement).value)" /></label>
        <label>中途互动点<input :value="config.outline.interactionPoints.join('、')" @change="updateOutlineList('interactionPoints', ($event.target as HTMLInputElement).value)" /></label>
        <label>结尾话术<textarea :value="config.outline.closing" rows="2" @change="updateOutline('closing', ($event.target as HTMLTextAreaElement).value)" /></label>
        <label>禁止偏离的话题<input :value="config.outline.forbiddenDetours.join('、')" @change="updateOutlineList('forbiddenDetours', ($event.target as HTMLInputElement).value)" /></label>
      </section>

      <section class="card topic-list">
        <h2>话题卡片</h2>
        <button
          v-for="topic in config.topicCards"
          :key="topic.id"
          type="button"
          class="topic-card-button"
          :class="{ 'is-active': selectedId === topic.id }"
          @click="selectedId = topic.id"
        >
          <strong>{{ topic.title }}</strong>
          <span>{{ topic.stage }}</span>
          <StatusBadge :label="topic.enabled ? '启用' : '停用'" :tone="topic.enabled ? 'ok' : 'warn'" />
        </button>
      </section>

      <section v-if="draft" class="card topic-editor">
        <div class="workbench-card-head">
          <h2>{{ draft.title }}</h2>
          <ToggleSwitch
            :model-value="draft.enabled"
            aria-label="启用话题卡"
            @update:model-value="(value) => draft && (draft.enabled = value)"
          />
        </div>
        <label>话题标题<input v-model="draft.title" /></label>
        <label>适合阶段
          <select v-model="draft.stage">
            <option value="opening">开场</option>
            <option value="middle">中段</option>
            <option value="cold">冷场</option>
            <option value="peak">高潮</option>
            <option value="closing">结尾</option>
          </select>
        </label>
        <label>推荐弹幕<input :value="draft.recommendedDanmaku.join('、')" @input="draft.recommendedDanmaku = splitTextList(($event.target as HTMLInputElement).value)" /></label>
        <label>推荐主播接话<textarea v-model="draft.hostTalkingPoint" rows="3" /></label>
        <label>不适合说的内容<input :value="draft.unsuitableContent.join('、')" @input="draft.unsuitableContent = splitTextList(($event.target as HTMLInputElement).value)" /></label>
        <button class="button-primary" type="button" :disabled="saving" @click="saveDraft">保存话题卡</button>
      </section>

      <section class="card topic-memes">
        <h2>梗库</h2>
        <label>直播间固定梗<input :value="config.memeLibrary.roomMemes.join('、')" @change="updateMemeList('roomMemes', ($event.target as HTMLInputElement).value)" /></label>
        <label>主播口癖<input :value="config.memeLibrary.catchphrases.join('、')" @change="updateMemeList('catchphrases', ($event.target as HTMLInputElement).value)" /></label>
        <label>粉丝称呼<input :value="config.memeLibrary.fanNames.join('、')" @change="updateMemeList('fanNames', ($event.target as HTMLInputElement).value)" /></label>
        <label>禁用梗<input :value="config.memeLibrary.disabledMemes.join('、')" @change="updateMemeList('disabledMemes', ($event.target as HTMLInputElement).value)" /></label>
        <label>最近高频梗<input :value="config.memeLibrary.recentMemes.join('、')" @change="updateMemeList('recentMemes', ($event.target as HTMLInputElement).value)" /></label>
      </section>
    </div>
  </section>
</template>

<style scoped>
.topic-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(220px, 0.6fr) minmax(320px, 1fr);
  gap: 12px;
  align-items: start;
}

.topic-outline,
.topic-list,
.topic-editor,
.topic-memes {
  display: grid;
  gap: 12px;
}

.topic-layout label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.topic-layout input,
.topic-layout textarea,
.topic-layout select {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 9px 10px;
  font: inherit;
}

.topic-card-button {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text);
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  text-align: left;
}

.topic-card-button.is-active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
}

.topic-card-button span {
  color: var(--text-muted);
  font-size: 12px;
}

.button-primary {
  min-height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
  justify-self: end;
}

@media (max-width: 1100px) {
  .topic-layout {
    grid-template-columns: 1fr;
  }
}
</style>
