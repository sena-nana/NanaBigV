<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Send, Trash2 } from "@lucide/vue";
import BlivechatOutputChannels from "../components/workbench/BlivechatOutputChannels.vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { useProviderSettings } from "../composables/useProviderSettings";
import { useWorkbenchStore } from "../features/workbench/store";
import type { ContextEvent, ContextSourceKind } from "../features/context/types";
import type { InputSourceStatus } from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const {
  danmakuView: view,
  reviewView,
  contextLoading,
  contextError,
  refreshContextWindow,
  submitVoiceContext,
  clearWorkbenchContextWindow,
  toggleRuntime,
} = useWorkbenchStore();
useProviderSettings();

const voiceDraft = ref("");
const homeSuggestions = computed(() => reviewView.value.suggestions.slice(0, 3));
const canSubmitVoice = computed(() => voiceDraft.value.trim().length > 0 && !contextLoading.value);

const mockSourceStateMeta = computed(() => {
  const state = view.value.mockSource.state;
  return {
    idle: { label: "未启用", tone: "info" },
    running: { label: "运行中", tone: "ok" },
    paused: { label: "已暂停", tone: "warn" },
    error: { label: "异常", tone: "error" },
  }[state] as { label: string; tone: "ok" | "warn" | "error" | "info" };
});
const mockSourceLastEvent = computed(() => view.value.mockSource.lastEventLabel ?? "Mock 数据源未启用，请到设置开启 Debug");

const contextSourceLabels: Record<ContextSourceKind, string> = {
  voice: "主播语音",
  echo_live: "Echo-Live",
  vision: "视觉",
};

onMounted(() => {
  void refreshContextWindow();
});

function suggestionTone(priority: string) {
  return priority.includes("高") ? "warn" : "info";
}

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
  const label = contextSourceLabels[event.source];
  return `${label} · ${formatTimestamp(event.receivedAt)}`;
}

async function submitVoiceDraft() {
  const content = voiceDraft.value.trim();
  if (!content) return;
  if (await submitVoiceContext(content)) voiceDraft.value = "";
}

async function clearContextEvents() {
  await clearWorkbenchContextWindow();
}

</script>

<template>
  <section class="workbench-page workbench-page--fill home-page">
    <div class="home-layout">
      <div class="home-column home-column--sidebar">
          <div class="card home-sidebar-card">
            <div class="toggle-list">
              <div
                v-for="toggle in view.toggles"
                :key="toggle.key"
                class="toggle-card"
              >
                <span class="toggle-card__title">{{ toggle.label }}</span>
                <ToggleSwitch
                  :model-value="toggle.enabled"
                  :aria-label="toggle.label"
                  @update:model-value="() => toggleRuntime(toggle.key)"
                />
              </div>
            </div>
          </div>

        <div class="card home-sidebar-card">
          <div class="workbench-list">
            <article
              v-for="suggestion in homeSuggestions"
              :key="suggestion.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ suggestion.title }}</span>
                <StatusBadge :label="suggestion.priority" :tone="suggestionTone(suggestion.priority)" />
              </div>
            </article>
          </div>
        </div>

        <div class="card home-sidebar-card">
          <div class="workbench-list">
            <article
              v-for="source in view.inputSources"
              :key="source.key"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row home-source-row">
                <span class="workbench-list-item__title">{{ source.label }}</span>
                <div class="home-source-side">
                  <span class="workbench-list-item__meta">{{ formatSourceLatency(source) }}</span>
                  <StatusBadge :label="source.statusLabel" :tone="source.tone" />
                </div>
              </div>
              <p class="workbench-list-item__meta home-source-summary">{{ source.summary }}</p>
            </article>
          </div>
        </div>

        <div class="card home-sidebar-card home-queue-card">
          <div class="workbench-list">
            <article
              v-for="stat in view.queueStats"
              :key="stat.type"
              class="workbench-list-item home-queue-item"
            >
              <div class="workbench-list-item__row home-queue-row">
                <span class="workbench-list-item__title">{{ stat.label }}</span>
                <span class="workbench-list-item__meta">投 {{ stat.delivered }}</span>
                <span class="workbench-list-item__meta">排 {{ stat.queued }}</span>
                <span class="workbench-list-item__meta">节 {{ stat.throttled }}</span>
                <span class="workbench-list-item__meta">总 {{ stat.queued + stat.delivered + stat.throttled }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="home-column home-column--feed">
        <div class="card home-feed-shell">
          <p class="home-feed-hint">{{ view.liveStatus.nextActionHint }}</p>

          <section class="home-context-panel" aria-labelledby="voice-input-title">
            <div class="home-section-head">
              <div>
                <h2 id="voice-input-title">主播语音文本</h2>
                <p>{{ view.contextEvents.length }} 条 / 最近 {{ view.contextWindowSeconds }} 秒</p>
              </div>
              <StatusBadge
                :label="contextLoading ? '同步中' : '本地接入口'"
                :tone="contextLoading ? 'info' : 'ok'"
              />
            </div>

            <form class="home-voice-form" @submit.prevent="submitVoiceDraft">
              <label class="home-voice-label" for="voice-text">主播语音文本</label>
              <textarea
                id="voice-text"
                v-model="voiceDraft"
                class="home-voice-textarea"
                rows="4"
                placeholder="粘贴或输入本地 ASR 已转写的主播语音文本"
                :disabled="contextLoading"
              />
              <div class="home-voice-actions">
                <button class="button-primary home-action-button" type="submit" :disabled="!canSubmitVoice">
                  <Send :size="15" aria-hidden="true" />
                  <span>提交语音</span>
                </button>
                <button
                  class="button-secondary home-action-button"
                  type="button"
                  :disabled="contextLoading || view.contextEvents.length === 0"
                  @click="clearContextEvents"
                >
                  <Trash2 :size="15" aria-hidden="true" />
                  <span>清空窗口</span>
                </button>
              </div>
              <p v-if="contextError" class="home-context-error" role="alert">{{ contextError }}</p>
            </form>
          </section>

          <section class="home-context-panel home-context-panel--events" aria-labelledby="context-events-title">
            <div class="home-section-head">
              <div>
                <h2 id="context-events-title">最近上下文事件</h2>
                <p>主播语音优先，Echo-Live 和视觉仅预留挂接口</p>
              </div>
            </div>

            <div v-if="view.contextEvents.length" class="home-context-list">
              <article
                v-for="event in view.contextEvents"
                :key="event.id"
                class="home-context-event"
              >
                <span class="home-context-event__meta">{{ formatContextMeta(event) }}</span>
                <strong>{{ event.summary }}</strong>
                <p>{{ event.content }}</p>
              </article>
            </div>
            <p v-else class="home-empty-state">等待主播语音文本输入。</p>
          </section>

          <section class="home-output-panel" aria-labelledby="output-events-title">
            <div class="home-section-head">
              <div>
                <h2 id="output-events-title">模拟互动输出</h2>
                <p>本地 blivechat 队列记录 enqueue / deliver / throttle</p>
              </div>
              <StatusBadge :label="mockSourceStateMeta.label" :tone="mockSourceStateMeta.tone" />
            </div>

            <div class="home-mock-source">
              <div class="home-mock-source__meta">
                <strong>{{ view.mockSource.scenarioLabel }}</strong>
                <span>{{ view.mockSource.tickCount }} 次 · {{ view.mockSource.intervalMs }}ms</span>
                <span>{{ mockSourceLastEvent }}</span>
                <span v-if="view.mockSource.error" class="home-context-error">{{ view.mockSource.error }}</span>
              </div>
            </div>

            <div v-if="view.mockSourceRecords.length" class="home-mock-records">
              <div
                v-for="record in view.mockSourceRecords.slice(0, 3)"
                :key="record.id"
                class="home-mock-record"
              >
                <span>{{ record.happenedAt }}</span>
                <strong>{{ record.frameLabel }}</strong>
                <span>{{ [...record.contextLabels, ...record.interactionLabels].join(" / ") }}</span>
                <StatusBadge :label="record.statusLabel" :tone="record.tone" />
              </div>
            </div>

            <BlivechatOutputChannels :channels="view.blivechatChannels" />
          </section>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-page {
  gap: 0;
}

.home-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 12px;
}

.home-column {
  min-height: 0;
}

.home-column--sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
}

.home-column--feed {
  overflow: hidden;
}

.home-feed-shell {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(160px, 0.8fr) minmax(180px, 1fr);
  gap: 12px;
}

.home-feed-hint {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.home-context-panel,
.home-output-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.home-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.home-section-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
}

.home-section-head p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.home-voice-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-voice-label {
  width: 1px;
  height: 1px;
  overflow: hidden;
  position: absolute;
  clip: rect(0 0 0 0);
}

.home-voice-textarea {
  width: 100%;
  min-height: 92px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
}

.home-voice-textarea:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}

.home-voice-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.home-action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
}

.button-primary {
  background: var(--accent);
  color: var(--accent-text);
}

.button-secondary {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

.home-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.home-context-error {
  margin: 0;
  color: var(--err);
  font-size: 12px;
  line-height: 1.45;
}

.home-context-panel--events {
  overflow: hidden;
}

.home-context-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.home-context-event {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg);
}

.home-context-event__meta {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 700;
}

.home-context-event strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}

.home-context-event p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-empty-state {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.home-output-panel {
  overflow: hidden;
}

.home-output-panel :deep(.blivechat-channels) {
  flex: 1;
}

.home-mock-source {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg);
}

.home-mock-source__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.home-mock-source__meta strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.35;
}

.home-mock-source__meta span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.home-mock-records {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.home-mock-record {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.home-mock-record strong {
  flex: 0 0 auto;
  color: var(--text);
}

.home-mock-record span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-mock-record :deep(.status-badge) {
  flex: 0 0 auto;
}

.home-sidebar-card {
  padding: 12px;
}

.home-sidebar-card :deep(.status-badge) {
  flex: 0 0 auto;
}

.home-sidebar-card .workbench-list {
  gap: 8px;
}

.home-sidebar-card .workbench-list-item {
  gap: 4px;
  padding: 10px 12px;
}

.home-sidebar-card .workbench-list-item__row {
  min-width: 0;
}

.home-sidebar-card .workbench-list-item__title {
  min-width: 0;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-card {
  width: 100%;
  height: auto;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  gap: 12px;
  cursor: pointer;
}

.toggle-card__title {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.home-source-row {
  align-items: center;
  flex-wrap: wrap;
}

.home-source-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex: 0 0 auto;
  flex-wrap: wrap;
}

.home-source-summary {
  margin: 0;
  line-height: 1.45;
}

.home-queue-item {
  padding-block: 8px;
}

.home-queue-row {
  justify-content: flex-start;
  gap: 8px 12px;
  flex-wrap: wrap;
}

.home-queue-row .workbench-list-item__title {
  margin-right: auto;
}

.home-queue-row .workbench-list-item__meta,
.home-source-side .workbench-list-item__meta,
.home-source-side :deep(.status-badge) {
  white-space: nowrap;
}

@media (max-width: 980px) {
  .home-page {
    height: auto;
    overflow: visible;
  }

  .home-layout {
    min-height: auto;
    grid-template-columns: 1fr;
  }

  .home-column--feed {
    order: -1;
    overflow: visible;
  }

  .home-column--sidebar {
    overflow: visible;
    padding-right: 0;
  }

  .home-feed-shell {
    height: auto;
    grid-template-rows: auto;
  }

  .home-mock-source {
    flex-direction: column;
  }

}

@media (max-width: 700px) {
  .home-source-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .home-source-side {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
