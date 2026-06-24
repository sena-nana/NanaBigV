<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { Activity, Check, Pause, Pencil, Send, SlidersHorizontal, Trash2, X, Zap } from "@lucide/vue";
import BlivechatOutputChannels from "../components/workbench/BlivechatOutputChannels.vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { useProviderSettings } from "../composables/useProviderSettings";
import { useLiveAssistConfig } from "../features/liveConfig/store";
import { useWorkbenchStore } from "../features/workbench/store";
import type { ContextEvent, ContextSourceKind } from "../features/context/types";
import type { DanmakuGenerationRecord } from "../features/liveConfig/types";
import type { InputSourceStatus } from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const {
  danmakuView: view,
  runtimeInsight,
  contextLoading,
  contextError,
  echoLiveStatus,
  refreshContextWindow,
  submitVoiceContext,
  connectEchoLive,
  disconnectEchoLive,
  clearWorkbenchContextWindow,
  toggleRuntime,
  enqueueControlDanmaku,
} = useWorkbenchStore();
const liveConfig = useLiveAssistConfig();
const {
  config,
  currentPlan,
  enabledAudienceGroups,
  enabledTopicCards,
  load,
  saving,
  appendGenerationRecord,
  updateGenerationRecord,
} = liveConfig;
const provider = useProviderSettings();

const WorkbenchRuntimeInsights = defineAsyncComponent(
  () => import("../components/workbench/WorkbenchRuntimeInsights.vue"),
);

const voiceDraft = ref("");
const rewriteDrafts = ref<Record<string, string>>({});
const runtimeInsightsOpen = ref(false);
const canSubmitVoice = computed(() => voiceDraft.value.trim().length > 0 && !contextLoading.value);
const echoLiveConnected = computed(() => echoLiveStatus.value.state === "connected");
const echoLiveBusy = computed(() => echoLiveStatus.value.state === "connecting");
const activeSafetyRules = computed(() => config.value.safety.basicRules.filter((rule) => rule.enabled).length);
const directCandidates = computed(() =>
  config.value.generationRecords.filter((record) => record.status === "pending").slice(0, 4),
);
const blockedCandidates = computed(() =>
  config.value.generationRecords.filter((record) => record.status === "blocked").slice(0, 3),
);
const confirmCandidates = computed(() =>
  config.value.generationRecords
    .filter((record) => record.status === "rewritten" || record.status === "ignored")
    .slice(0, 3),
);
const currentTopic = computed(() => enabledTopicCards.value[0]);
const rescueGroup = computed(() => enabledAudienceGroups.value.find((group) => group.id.includes("rescue")) ?? enabledAudienceGroups.value[0]);
const runtimeNotices = computed(() => view.value.notices.slice(0, 3));

const contextSourceLabels: Record<ContextSourceKind, string> = {
  voice: "主播语音",
  echo_live: "Echo-Live",
  vision: "视觉",
};

onMounted(() => {
  void load();
  void refreshContextWindow();
});

function formatSourceLatency(source: InputSourceStatus) {
  if (source.latencyLabel) return source.latencyLabel;
  if (typeof source.latencyMs === "number") return `延迟 ${source.latencyMs}ms`;
  if (source.lastEventAt) return `最近 ${formatTimestamp(source.lastEventAt)}`;
  if (typeof source.eventCount === "number") return `${source.eventCount} 条`;
  return "无事件";
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatContextMeta(event: ContextEvent) {
  return `${contextSourceLabels[event.source]} · ${formatTimestamp(event.receivedAt)}`;
}

async function submitVoiceDraft() {
  const content = voiceDraft.value.trim();
  if (!content) return;
  if (await submitVoiceContext(content)) voiceDraft.value = "";
}

function toggleEchoLiveConnection() {
  if (echoLiveConnected.value || echoLiveBusy.value) {
    disconnectEchoLive();
    return;
  }
  connectEchoLive();
}

async function clearContextEvents() {
  await clearWorkbenchContextWindow();
}

async function triggerColdRescue(kind: "question" | "support" | "passerby" | "roast") {
  const group = rescueGroup.value;
  const contentMap = {
    question: "刚刚这个点能不能展开讲讲？",
    support: "这里慢慢讲也挺舒服的，不用急。",
    passerby: "这是在测试直播辅助工具吗？",
    roast: "这个节奏像是在给冷场做压力测试。",
  };
  const content = contentMap[kind];
  enqueueControlDanmaku({
    audienceName: group?.name ?? "控场救急组",
    content,
    reason: "冷场救急按钮",
  });
  await appendGenerationRecord({
    id: `record-${Date.now()}-${kind}`,
    happenedAt: formatTimestamp(Date.now()),
    content,
    audienceGroupId: group?.id ?? "group-rescue",
    audienceGroupName: group?.name ?? "控场救急组",
    triggerReason: "冷场救急按钮",
    status: config.value.safety.outputMode === "auto_assist" ? "adopted" : "pending",
    riskTags: ["低风险"],
    similarity: 10,
    userFeedback: config.value.safety.outputMode === "auto_assist" ? "自动辅助" : "待确认",
  });
}

function rewriteDraftValue(record: DanmakuGenerationRecord) {
  return rewriteDrafts.value[record.id] ?? record.content;
}

function setRewriteDraft(recordId: string, event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  rewriteDrafts.value = {
    ...rewriteDrafts.value,
    [recordId]: target.value,
  };
}

async function adoptCandidate(record: DanmakuGenerationRecord) {
  enqueueControlDanmaku({
    audienceName: record.audienceGroupName,
    content: record.content,
    reason: "手动审核采用",
  });
  await updateGenerationRecord(record.id, {
    status: "adopted",
    userFeedback: "手动采用并投递",
  });
}

async function ignoreCandidate(record: DanmakuGenerationRecord) {
  await updateGenerationRecord(record.id, {
    status: "ignored",
    userFeedback: "手动忽略",
  });
}

async function rewriteCandidate(record: DanmakuGenerationRecord) {
  const content = rewriteDraftValue(record).trim();
  if (!content) return;
  enqueueControlDanmaku({
    audienceName: record.audienceGroupName,
    content,
    reason: "手动改写采用",
  });
  await updateGenerationRecord(record.id, {
    content,
    status: "rewritten",
    userFeedback: "手动改写并投递",
  });
  const rest = { ...rewriteDrafts.value };
  delete rest[record.id];
  rewriteDrafts.value = rest;
}
</script>

<template>
  <section class="workbench-page workbench-page--fill live-console">
    <div class="live-statusbar">
      <strong>直播辅助中</strong>
      <StatusBadge :label="currentPlan.outputMode === 'auto_assist' ? '自动生成' : currentPlan.outputMode === 'prompt_only' ? '仅提词' : '手动审核'" :tone="currentPlan.outputMode === 'auto_assist' ? 'warn' : 'ok'" />
      <StatusBadge :label="echoLiveStatus.statusLabel" :tone="echoLiveStatus.tone" />
      <StatusBadge :label="provider.providerStatusSummary.value.label" :tone="provider.providerStatusSummary.value.tone" />
      <span>AI 弹幕：{{ config.safety.maxGeneratedPerMinute }}/分钟</span>
      <span>安全规则 {{ activeSafetyRules }} 项</span>
      <button class="button-danger" type="button" @click="toggleRuntime('dispatch')">
        <Pause :size="15" aria-hidden="true" />
        一键暂停
      </button>
    </div>

    <div v-if="runtimeNotices.length" class="live-notices" aria-label="运行通知">
      <p v-for="notice in runtimeNotices" :key="notice.id">{{ notice.detail }}</p>
    </div>

    <div class="live-layout">
      <aside class="live-side">
        <section class="card">
          <h2>当前直播状态</h2>
          <div class="live-metric">
            <span>气氛热度</span>
            <strong>{{ view.simulationStatus.rhythmLabel }}</strong>
          </div>
          <div class="live-metric">
            <span>冷场风险</span>
            <strong>{{ view.simulationStatus.rhythmState === 'cold' ? '高' : '中' }}</strong>
          </div>
          <div class="live-metric">
            <span>当前话题</span>
            <strong>{{ currentTopic?.title ?? currentPlan.theme }}</strong>
          </div>
          <p class="live-note">当前触发：{{ view.mockSource.lastEventLabel ?? "等待上下文输入" }}</p>
        </section>

        <section class="card">
          <h2>输入源</h2>
          <div class="workbench-list">
            <article v-for="source in view.inputSources" :key="source.key" class="workbench-list-item">
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ source.label }}</span>
                <StatusBadge :label="source.statusLabel" :tone="source.tone" />
              </div>
              <div class="workbench-list-item__meta">{{ formatSourceLatency(source) }}</div>
              <div class="workbench-list-item__meta">{{ source.summary }}</div>
            </article>
          </div>
        </section>

        <section class="card">
          <h2>运行开关</h2>
          <div class="live-toggle-list">
            <label v-for="toggle in view.toggles" :key="toggle.key" class="live-toggle">
              <span>{{ toggle.label }}</span>
              <ToggleSwitch
                :model-value="toggle.enabled"
                :aria-label="toggle.label"
                @update:model-value="() => toggleRuntime(toggle.key)"
              />
            </label>
          </div>
        </section>
      </aside>

      <main class="live-main">
        <section class="card live-context-card">
          <div class="workbench-card-head">
            <h2>主播语音与 Echo-Live</h2>
            <StatusBadge :label="contextLoading ? '同步中' : '本地接入口'" :tone="contextLoading ? 'info' : 'ok'" />
          </div>
          <form class="live-voice-form" @submit.prevent="submitVoiceDraft">
            <label class="sr-only" for="voice-text">主播语音文本</label>
            <textarea
              id="voice-text"
              v-model="voiceDraft"
              rows="3"
              placeholder="粘贴或输入本地 ASR 已转写的主播语音文本"
              :disabled="contextLoading"
            />
            <div class="live-actions">
              <button class="button-primary" type="submit" :disabled="!canSubmitVoice">
                <Send :size="15" aria-hidden="true" />
                提交语音
              </button>
              <button class="button-secondary" type="button" :disabled="contextLoading" @click="toggleEchoLiveConnection">
                <Activity :size="15" aria-hidden="true" />
                {{ echoLiveConnected || echoLiveBusy ? "断开" : "连接" }}
              </button>
              <button class="button-secondary" type="button" :disabled="contextLoading || view.contextEvents.length === 0" @click="clearContextEvents">
                <Trash2 :size="15" aria-hidden="true" />
                清空窗口
              </button>
            </div>
            <p v-if="contextError" class="workbench-error" role="alert">{{ contextError }}</p>
          </form>
          <div v-if="view.contextEvents.length" class="live-context-list">
            <article v-for="event in view.contextEvents.slice(0, 4)" :key="event.id">
              <span>{{ formatContextMeta(event) }}</span>
              <strong>{{ event.summary }}</strong>
            </article>
          </div>
          <p v-else class="live-note">等待主播语音或 Echo-Live 文本输入。</p>
        </section>

        <section class="card live-candidates">
          <div class="workbench-card-head">
            <h2>弹幕候选流</h2>
            <button class="button-secondary" type="button" @click="runtimeInsightsOpen = !runtimeInsightsOpen">
              <SlidersHorizontal :size="15" aria-hidden="true" />
              {{ runtimeInsightsOpen ? "收起观测" : "观测详情" }}
            </button>
          </div>

          <div class="candidate-columns">
            <div>
              <h3>可直接使用</h3>
              <article v-for="record in directCandidates" :key="record.id" class="candidate-item">
                <strong>{{ record.content }}</strong>
                <span>{{ record.audienceGroupName }} · {{ record.triggerReason }}</span>
                <div class="candidate-actions">
                  <button class="button-primary" type="button" :disabled="saving" @click="adoptCandidate(record)">
                    <Check :size="14" aria-hidden="true" />
                    采用
                  </button>
                  <button class="button-secondary" type="button" :disabled="saving" @click="ignoreCandidate(record)">
                    <X :size="14" aria-hidden="true" />
                    忽略
                  </button>
                </div>
                <div class="candidate-rewrite">
                  <label :for="`rewrite-${record.id}`">改写候选</label>
                  <textarea
                    :id="`rewrite-${record.id}`"
                    :value="rewriteDraftValue(record)"
                    rows="2"
                    :aria-label="`改写弹幕：${record.content}`"
                    @input="setRewriteDraft(record.id, $event)"
                  />
                  <button
                    class="button-secondary"
                    type="button"
                    :disabled="saving || !rewriteDraftValue(record).trim()"
                    @click="rewriteCandidate(record)"
                  >
                    <Pencil :size="14" aria-hidden="true" />
                    改写
                  </button>
                </div>
              </article>
              <p v-if="directCandidates.length === 0" class="live-note">当前没有待审核候选。</p>
            </div>
            <div>
              <h3>已处理</h3>
              <article v-for="record in confirmCandidates" :key="record.id" class="candidate-item">
                <strong>{{ record.content }}</strong>
                <span>{{ record.userFeedback }}</span>
              </article>
              <p v-if="confirmCandidates.length === 0" class="live-note">当前没有已处理候选。</p>
            </div>
            <div>
              <h3>不建议使用</h3>
              <article v-for="record in blockedCandidates" :key="record.id" class="candidate-item is-blocked">
                <strong>{{ record.content }}</strong>
                <span>{{ record.riskTags.join(" / ") }}</span>
              </article>
            </div>
          </div>

          <Suspense v-if="runtimeInsightsOpen">
            <WorkbenchRuntimeInsights :insight="runtimeInsight" />
            <template #fallback>
              <div class="live-note">正在加载运行观测。</div>
            </template>
          </Suspense>
        </section>

        <section class="card live-output">
          <div class="workbench-card-head">
            <h2>互动投递渲染</h2>
            <StatusBadge :label="view.mockSource.state === 'running' ? '运行中' : view.mockSource.state === 'paused' ? '已暂停' : '本地模拟'" :tone="view.mockSource.state === 'running' ? 'ok' : 'info'" />
          </div>
          <BlivechatOutputChannels :channels="view.blivechatChannels" />
        </section>
      </main>

      <aside class="live-prompter">
        <section class="card">
          <h2>主播提词</h2>
          <p class="live-prompter-text">
            可以接：“{{ currentTopic?.hostTalkingPoint ?? "刚好可以讲一下今天为什么选择这个主题。" }}”
          </p>
          <div class="workbench-tag-list">
            <span v-for="topic in enabledTopicCards.slice(0, 4)" :key="topic.id" class="workbench-tag">{{ topic.title }}</span>
          </div>
        </section>

        <section class="card">
          <h2>冷场救急</h2>
          <div class="rescue-grid">
            <button type="button" @click="triggerColdRescue('question')">
              <Zap :size="15" aria-hidden="true" />
              轻松问题
            </button>
            <button type="button" @click="triggerColdRescue('support')">粉丝捧哏</button>
            <button type="button" @click="triggerColdRescue('passerby')">路人疑问</button>
            <button type="button" @click="triggerColdRescue('roast')">轻吐槽</button>
            <button type="button" @click="toggleRuntime('super-chat')">降低频率</button>
            <button type="button" @click="toggleRuntime('dispatch')">暂停 AI</button>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.live-console {
  gap: 12px;
}

.live-statusbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 12px;
}

.live-statusbar strong {
  color: var(--text);
  font-size: 13px;
}

.live-layout {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(250px, 300px) minmax(0, 1fr) minmax(260px, 320px);
  gap: 12px;
}

.live-notices {
  display: grid;
  gap: 6px;
}

.live-notices p {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 12px;
}

.live-side,
.live-main,
.live-prompter {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.live-metric {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-soft);
}

.live-metric span,
.live-note,
.candidate-item span {
  color: var(--text-muted);
  font-size: 12px;
}

.live-toggle-list,
.rescue-grid {
  display: grid;
  gap: 8px;
}

.live-toggle {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.live-voice-form {
  display: grid;
  gap: 10px;
}

.live-voice-form textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 10px 12px;
  font: inherit;
}

.live-actions,
.candidate-columns,
.candidate-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.live-actions button,
.candidate-actions button,
.candidate-rewrite button,
.button-danger,
.rescue-grid button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--radius-md);
  padding: 0 12px;
  font-weight: 700;
}

.button-primary {
  background: var(--accent);
  color: var(--accent-text);
}

.button-secondary,
.rescue-grid button {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

.button-danger {
  margin-left: auto;
  border: 1px solid color-mix(in srgb, var(--err) 42%, var(--border));
  background: color-mix(in srgb, var(--err) 12%, var(--bg));
  color: var(--text);
}

.live-context-list {
  display: grid;
  gap: 8px;
}

.live-context-list article,
.candidate-item {
  padding: 9px 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: grid;
  gap: 4px;
}

.candidate-columns {
  align-items: stretch;
}

.candidate-columns > div {
  flex: 1 1 220px;
  display: grid;
  align-content: start;
  gap: 8px;
}

.candidate-columns h3 {
  margin: 0;
  font-size: 13px;
}

.candidate-actions {
  margin-top: 4px;
}

.candidate-rewrite {
  display: grid;
  gap: 6px;
}

.candidate-rewrite label {
  color: var(--text-muted);
  font-size: 12px;
}

.candidate-rewrite textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  padding: 8px 10px;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
}

.candidate-item.is-blocked {
  border-color: color-mix(in srgb, var(--err) 28%, var(--border));
}

.live-output {
  min-height: 280px;
}

.live-output :deep(.blivechat-channels) {
  min-height: 220px;
}

.live-prompter-text {
  color: var(--text);
  line-height: 1.7;
}

.sr-only {
  width: 1px;
  height: 1px;
  overflow: hidden;
  position: absolute;
  clip: rect(0 0 0 0);
}

@media (max-width: 1200px) {
  .live-layout {
    grid-template-columns: 1fr;
  }

  .live-side,
  .live-main,
  .live-prompter {
    overflow: visible;
  }
}
</style>
