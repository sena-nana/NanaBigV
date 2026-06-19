<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useProviderSettings } from "../composables/useProviderSettings";
import { useWorkbenchStore } from "../features/workbench/store";
import type { InputSourceStatus } from "../features/workbench/types";
import type { InteractionEvent } from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { danmakuView: view, reviewView, toggleRuntime } = useWorkbenchStore();
useProviderSettings();

const homeSuggestions = computed(() => reviewView.value.suggestions.slice(0, 3));

const interactionTypeLabels: Record<InteractionEvent["type"], string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

function suggestionTone(priority: string) {
  return priority.includes("高") ? "warn" : "info";
}

function formatEventText(event: InteractionEvent) {
  switch (event.type) {
    case "danmaku":
      return `${event.audienceName}：${event.content}`;
    case "super_chat":
      return `${event.audienceName}${event.amountLabel ? ` [SC ${event.amountLabel}]` : " [SC]"}：${event.content}`;
    case "gift":
      return `${event.audienceName} ${event.content}${event.amountLabel ? ` (${event.amountLabel})` : ""}`;
    default:
      return `${event.audienceName} ${event.content}`;
  }
}

function formatSourceLatency(source: InputSourceStatus) {
  if (source.latencyLabel) return source.latencyLabel;
  if (typeof source.latencyMs === "number") return `延迟 ${source.latencyMs}ms`;
  return "未上报";
}
</script>

<template>
  <section class="workbench-page workbench-page--fill home-page">
    <div class="home-layout">
      <div class="home-column home-column--sidebar">
        <div class="card home-sidebar-card">
          <div class="toggle-list">
            <label
              v-for="toggle in view.toggles"
              :key="toggle.key"
              class="toggle-card"
            >
              <span class="toggle-card__title">{{ toggle.label }}</span>
              <input
                class="toggle-card__checkbox"
                type="checkbox"
                :checked="toggle.enabled"
                :aria-label="toggle.label"
                @change="toggleRuntime(toggle.key)"
              >
            </label>
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

          <div class="home-feed-events">
            <div class="home-feed-stream">
              <div
                v-for="event in view.recentEvents"
                :key="event.id"
                class="home-feed-event"
              >
                <span class="home-feed-event__type">{{ interactionTypeLabels[event.type] }}</span>
                <span class="home-feed-event__text">{{ formatEventText(event) }}</span>
              </div>
            </div>
          </div>
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
  grid-template-rows: auto 1fr;
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

.home-feed-events {
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  display: flex;
}

.home-feed-stream {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  gap: 8px;
}

.home-feed-event {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
}

.home-feed-event__type {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.home-feed-event__text {
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
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

.toggle-card__checkbox {
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--accent);
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
  }

  .home-feed-events {
    overflow: visible;
    padding-right: 0;
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
