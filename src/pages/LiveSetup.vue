<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useLiveAssistConfig } from "../features/liveConfig/store";
import type { LivePlan, OutputMode } from "../features/liveConfig/types";
import "../styles/page.css";
import "../styles/workbench.css";

const router = useRouter();
const { config, currentPlan, enabledTopicCards, loading, saving, error, load, savePlan } =
  useLiveAssistConfig();
const step = ref(0);
const streamTypes = ["杂谈", "游戏", "绘画", "唱歌", "学习 / 工作陪伴", "商品介绍", "角色扮演", "自定义"];
const hostStates = ["精力充足", "有点累", "想轻松播", "想热闹一点", "想认真讲内容"];
const atmospherePresets = [
  { id: "companion", label: "轻松陪伴型", detail: "弹幕少，主要捧场，少提尖锐问题。" },
  { id: "active", label: "热闹互动型", detail: "弹幕较多，会接梗并主动抛话题。" },
  { id: "passerby", label: "路人围观型", detail: "像真实路人，会问基础问题。" },
  { id: "rescue", label: "控场救急型", detail: "冷场和话题断掉时主动补位。" },
];
const steps = ["直播类型", "直播信息", "观众氛围", "启动检查"];

const draft = reactive({
  streamType: "杂谈",
  title: "晚间杂谈与功能演练",
  theme: "测试 AI 观众氛围与控场提词",
  bannedTopics: "隐私推测、争议引战",
  focusTopics: "冷场救急、弹幕风格选择",
  hostState: "想轻松播",
  atmosphere: "rescue",
  outputMode: "manual_review" as OutputMode,
});
const selectedAudienceIds = ref<string[]>([]);
const selectedTopicIds = ref<string[]>([]);

const previewPlan = computed<LivePlan>(() => ({
  id: `plan-${Date.now()}`,
  streamType: draft.streamType,
  title: draft.title.trim() || "未命名直播辅助",
  theme: draft.theme.trim() || "今日主题待填写",
  bannedTopics: splitTextList(draft.bannedTopics),
  focusTopics: splitTextList(draft.focusTopics),
  hostState: draft.hostState,
  audienceGroupIds: selectedAudienceIds.value,
  topicCardIds: selectedTopicIds.value,
  outputMode: draft.outputMode,
  updatedAt: new Date().toLocaleString("zh-CN"),
}));

onMounted(async () => {
  await load();
  Object.assign(draft, {
    streamType: currentPlan.value.streamType,
    title: currentPlan.value.title,
    theme: currentPlan.value.theme,
    bannedTopics: currentPlan.value.bannedTopics.join("、"),
    focusTopics: currentPlan.value.focusTopics.join("、"),
    hostState: currentPlan.value.hostState,
    outputMode: currentPlan.value.outputMode,
  });
  selectedAudienceIds.value = [...currentPlan.value.audienceGroupIds];
  selectedTopicIds.value = [...currentPlan.value.topicCardIds];
});

function splitTextList(value: string) {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleAudienceGroup(id: string) {
  selectedAudienceIds.value = selectedAudienceIds.value.includes(id)
    ? selectedAudienceIds.value.filter((item) => item !== id)
    : [...selectedAudienceIds.value, id];
}

function toggleTopic(id: string) {
  selectedTopicIds.value = selectedTopicIds.value.includes(id)
    ? selectedTopicIds.value.filter((item) => item !== id)
    : [...selectedTopicIds.value, id];
}

async function startLiveAssist() {
  const ok = await savePlan({
    ...previewPlan.value,
    id: `plan-${Date.now()}`,
  });
  if (ok) await router.push("/live");
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>新建直播辅助</h1>
      <StatusBadge :label="loading ? '读取配置' : saving ? '保存中' : '本地方案'" :tone="saving ? 'info' : 'ok'" />
    </div>

    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="setup-shell">
      <aside class="card setup-steps" aria-label="直播向导步骤">
        <button
          v-for="(label, index) in steps"
          :key="label"
          type="button"
          :class="{ 'is-active': step === index }"
          @click="step = index"
        >
          <span>{{ index + 1 }}</span>
          {{ label }}
        </button>
      </aside>

      <main class="card setup-main">
        <section v-if="step === 0" class="setup-section">
          <h2>选择直播类型</h2>
          <div class="setup-card-grid">
            <button
              v-for="type in streamTypes"
              :key="type"
              type="button"
              class="setup-choice-card"
              :class="{ 'is-active': draft.streamType === type }"
              @click="draft.streamType = type"
            >
              <strong>{{ type }}</strong>
              <span>推荐观众组、弹幕密度和互动方式会跟随方案保存。</span>
            </button>
          </div>
        </section>

        <section v-else-if="step === 1" class="setup-section">
          <h2>填写直播信息</h2>
          <label>直播标题<input v-model="draft.title" /></label>
          <label>今日主题<textarea v-model="draft.theme" rows="3" /></label>
          <label>不能聊的话题<input v-model="draft.bannedTopics" /></label>
          <label>想重点引导的话题<input v-model="draft.focusTopics" /></label>
          <div class="setup-segmented">
            <button
              v-for="state in hostStates"
              :key="state"
              type="button"
              :class="{ 'is-active': draft.hostState === state }"
              @click="draft.hostState = state"
            >
              {{ state }}
            </button>
          </div>
        </section>

        <section v-else-if="step === 2" class="setup-section">
          <h2>选择 AI 观众氛围</h2>
          <div class="setup-card-grid">
            <button
              v-for="preset in atmospherePresets"
              :key="preset.id"
              type="button"
              class="setup-choice-card"
              :class="{ 'is-active': draft.atmosphere === preset.id }"
              @click="draft.atmosphere = preset.id"
            >
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.detail }}</span>
            </button>
          </div>
          <h3>观众组</h3>
          <div class="setup-card-grid">
            <button
              v-for="group in config.audienceGroups"
              :key="group.id"
              type="button"
              class="setup-choice-card"
              :class="{ 'is-active': selectedAudienceIds.includes(group.id) }"
              @click="toggleAudienceGroup(group.id)"
            >
              <strong>{{ group.name }}</strong>
              <span>{{ group.useCase }}</span>
            </button>
          </div>
        </section>

        <section v-else class="setup-section">
          <h2>启动前检查</h2>
          <div class="setup-review-grid">
            <article>
              <span>当前方案</span>
              <strong>{{ previewPlan.title }}</strong>
            </article>
            <article>
              <span>观众组</span>
              <strong>{{ selectedAudienceIds.length }}</strong>
            </article>
            <article>
              <span>话题卡</span>
              <strong>{{ selectedTopicIds.length }}</strong>
            </article>
            <article>
              <span>输出模式</span>
              <strong>{{ draft.outputMode === 'auto_assist' ? '自动辅助' : draft.outputMode === 'prompt_only' ? '仅提词' : '人工确认' }}</strong>
            </article>
          </div>
          <div class="setup-segmented">
            <button type="button" :class="{ 'is-active': draft.outputMode === 'prompt_only' }" @click="draft.outputMode = 'prompt_only'">仅提词</button>
            <button type="button" :class="{ 'is-active': draft.outputMode === 'manual_review' }" @click="draft.outputMode = 'manual_review'">人工确认</button>
            <button type="button" :class="{ 'is-active': draft.outputMode === 'auto_assist' }" @click="draft.outputMode = 'auto_assist'">自动辅助</button>
          </div>
          <h3>话题卡</h3>
          <div class="setup-card-grid">
            <button
              v-for="topic in enabledTopicCards"
              :key="topic.id"
              type="button"
              class="setup-choice-card"
              :class="{ 'is-active': selectedTopicIds.includes(topic.id) }"
              @click="toggleTopic(topic.id)"
            >
              <strong>{{ topic.title }}</strong>
              <span>{{ topic.hostTalkingPoint }}</span>
            </button>
          </div>
        </section>

        <div class="setup-footer">
          <button class="button-secondary" type="button" :disabled="step === 0" @click="step -= 1">上一步</button>
          <button v-if="step < steps.length - 1" class="button-primary" type="button" @click="step += 1">下一步</button>
          <button v-else class="button-primary" type="button" :disabled="saving" @click="startLiveAssist">开始直播辅助</button>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.setup-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
}

.setup-steps {
  display: grid;
  align-content: start;
  gap: 8px;
}

.setup-steps button,
.setup-choice-card,
.setup-segmented button,
.setup-footer button {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
}

.setup-steps button {
  min-height: 38px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.setup-steps span {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bg-subtle);
}

.setup-steps .is-active,
.setup-choice-card.is-active,
.setup-segmented .is-active {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 70%, var(--bg));
}

.setup-main {
  display: grid;
  gap: 18px;
}

.setup-section {
  display: grid;
  gap: 12px;
}

.setup-section label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.setup-section input,
.setup-section textarea {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 9px 10px;
  font: inherit;
}

.setup-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.setup-choice-card {
  min-height: 86px;
  padding: 12px;
  text-align: left;
  display: grid;
  gap: 6px;
}

.setup-choice-card span,
.setup-review-grid span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.setup-segmented,
.setup-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.setup-segmented button,
.setup-footer button {
  min-height: 32px;
  padding: 0 12px;
  font-weight: 700;
}

.setup-review-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.setup-review-grid article {
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: grid;
  gap: 6px;
}

.setup-footer {
  justify-content: flex-end;
}

.button-primary {
  background: var(--accent);
  color: var(--accent-text);
}

.button-secondary {
  background: var(--bg);
  color: var(--text);
}

@media (max-width: 900px) {
  .setup-shell,
  .setup-review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
