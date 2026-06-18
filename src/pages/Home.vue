<script setup lang="ts">
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { APP_SHELL_COPY } from "../config/appShell";
import { useWorkbenchStore } from "../features/workbench/store";
import type {
  DeliveryQueueStat,
  InteractionEvent,
} from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { danmakuView: view, toggleRuntime } = useWorkbenchStore();

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
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>{{ APP_SHELL_COPY.homeTitle }}</h1>
    </div>

    <div class="workbench-main-grid">
      <div class="workbench-stack">
        <div class="card">
          <div class="workbench-card-head">
            <h2>实时互动流</h2>
            <div class="workbench-inline">
              <StatusBadge :label="view.liveStatus.statusLabel" :tone="view.liveStatus.tone" />
              <span class="workbench-list-item__meta">{{ view.liveStatus.updatedAt }}</span>
            </div>
          </div>
          <ul class="workbench-kv workbench-kv--compact">
            <li>
              <span>房间</span>
              <strong>{{ view.liveStatus.roomLabel }}</strong>
            </li>
            <li>
              <span>节奏</span>
              <strong>{{ view.liveStatus.rhythmLabel }}</strong>
            </li>
            <li>
              <span>同接估算</span>
              <strong>{{ view.liveStatus.viewerEstimate }}</strong>
            </li>
          </ul>
          <div class="workbench-list">
            <article
              v-for="event in view.recentEvents"
              :key="event.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <div class="workbench-inline">
                  <StatusBadge
                    :label="interactionTypeLabels[event.type]"
                    :tone="event.tone === 'info' ? 'info' : 'ok'"
                  />
                  <span class="workbench-list-item__title">{{ event.audienceName }}</span>
                </div>
                <StatusBadge :label="event.statusLabel" :tone="event.tone" />
              </div>
              <div>{{ event.content }}</div>
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__meta">{{ event.happenedAt }}</span>
                <span v-if="event.amountLabel" class="workbench-list-item__meta">{{ event.amountLabel }}</span>
              </div>
            </article>
          </div>
        </div>

        <div class="card">
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
      </div>

      <div class="workbench-stack">
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
    </div>
  </section>
</template>

<style scoped>
.danmaku-kv {
  margin-top: 12px;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toggle-card {
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
</style>
