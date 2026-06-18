<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useWorkbenchStore } from "../features/workbench/store";
import type {
  DeliveryQueueStat,
  InteractionEvent,
} from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { danmakuView: view, reviewView, toggleRuntime } = useWorkbenchStore();

const homeSuggestions = computed(() => reviewView.value.suggestions.slice(0, 3));

const interactionTypeLabels: Record<InteractionEvent["type"], string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

function queueFillWidth(stat: DeliveryQueueStat) {
  const total = stat.queued + stat.delivered + stat.throttled;
  return `${Math.max(12, Math.round((stat.delivered / Math.max(total, 1)) * 100))}%`;
}

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
</script>

<template>
  <section class="workbench-page workbench-page--fill home-page">
    <div class="home-layout">
      <div class="home-column home-column--sidebar">
        <div class="card">
          <h2>功能启停</h2>
          <div class="toggle-list">
            <button
              v-for="toggle in view.toggles"
              :key="toggle.key"
              type="button"
              role="switch"
              class="toggle-card"
              :class="{ 'is-enabled': toggle.enabled }"
              :aria-checked="toggle.enabled"
              :aria-label="toggle.label"
              @click="toggleRuntime(toggle.key)"
            >
              <div class="toggle-card__copy">
                <span class="toggle-card__title">{{ toggle.label }}</span>
                <span class="toggle-card__desc">{{ toggle.description }}</span>
              </div>
              <span class="toggle-card__state">{{ toggle.enabled ? "开" : "关" }}</span>
            </button>
          </div>
        </div>

        <div class="card">
          <h2>AI 建议</h2>
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
              <div class="home-suggestion-category">{{ suggestion.category }}</div>
              <div>{{ suggestion.detail }}</div>
            </article>
          </div>
        </div>

        <div class="card">
          <h2>输入链路状态</h2>
          <div class="workbench-list">
            <article
              v-for="source in view.inputSources"
              :key="source.key"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ source.label }}</span>
                <StatusBadge :label="source.statusLabel" :tone="source.tone" />
              </div>
              <div class="workbench-list-item__meta">{{ source.summary }}</div>
              <div class="workbench-list-item__meta">延迟 {{ source.latencyMs }}ms</div>
            </article>
          </div>
        </div>

        <div class="card home-queue-card">
          <div class="workbench-card-head">
            <h2>投递通道统计</h2>
            <span class="workbench-list-item__meta">{{ view.liveStatus.nextActionHint }}</span>
          </div>
          <div class="workbench-chart-bars">
            <div
              v-for="stat in view.queueStats"
              :key="stat.type"
              class="workbench-chart-row"
            >
              <div class="workbench-chart-label">{{ stat.label }}</div>
              <div class="workbench-chart-track">
                <div class="workbench-chart-fill is-ok" :style="{ width: queueFillWidth(stat) }" />
              </div>
              <div class="workbench-chart-value">
                {{ stat.delivered }}/{{ stat.queued + stat.delivered + stat.throttled }}
              </div>
            </div>
          </div>
          <ul class="workbench-kv danmaku-kv">
            <li v-for="stat in view.queueStats" :key="`${stat.type}-detail`">
              <span>{{ stat.label }}</span>
              <strong>排队 {{ stat.queued }} / 节流 {{ stat.throttled }}</strong>
            </li>
          </ul>
        </div>

        <div class="card">
          <h2>最近异常</h2>
          <div class="workbench-list">
            <article
              v-for="notice in view.notices"
              :key="notice.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ notice.title }}</span>
                <StatusBadge :label="notice.tone === 'warn' ? '关注' : notice.tone === 'error' ? '异常' : '提示'" :tone="notice.tone" />
              </div>
              <div class="workbench-list-item__meta">{{ notice.detail }}</div>
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

.home-suggestion-category {
  color: var(--text-muted);
  font-size: 12px;
}

.danmaku-kv {
  margin-top: 12px;
}

.home-queue-card .workbench-card-head {
  align-items: flex-start;
}

.home-queue-card .workbench-chart-row {
  grid-template-columns: minmax(60px, 72px) minmax(0, 1fr) 48px;
  gap: 8px;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toggle-card {
  width: 100%;
  height: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  text-align: left;
}

.toggle-card.is-enabled {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 70%, var(--bg-subtle));
}

.toggle-card__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toggle-card__title {
  font-size: 14px;
  font-weight: 600;
}

.toggle-card__desc {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.toggle-card__state {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
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
</style>
