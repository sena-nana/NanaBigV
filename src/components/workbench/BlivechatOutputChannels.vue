<script setup lang="ts">
import StatusBadge from "./StatusBadge.vue";
import type {
  BlivechatRenderChannel,
} from "../../features/workbench/types";

defineProps<{
  channels: BlivechatRenderChannel[];
}>();
</script>

<template>
  <div class="blivechat-channels">
    <section
      v-for="channel in channels"
      :key="channel.type"
      class="blivechat-channel"
      :class="`is-${channel.type}`"
      role="region"
      :aria-label="`blivechat ${channel.label}通道`"
    >
      <header class="blivechat-channel__head">
        <h3>{{ channel.label }}通道</h3>
        <span>{{ channel.items.length }} 条</span>
      </header>

      <div v-if="channel.items.length" class="blivechat-channel__list">
        <article
          v-for="item in channel.items"
          :key="item.id"
          class="blivechat-item"
          :class="[`is-${item.type}`, `is-${item.action}`]"
        >
          <template v-if="item.type === 'danmaku'">
            <div class="blivechat-item__line">
              <strong>{{ item.audienceName }}：</strong>
              <span>{{ item.content }}</span>
            </div>
          </template>

          <template v-else-if="item.type === 'gift'">
            <div class="blivechat-item__line blivechat-item__line--stacked">
              <strong>{{ item.audienceName }}</strong>
              <span>
                {{ item.content }}<template v-if="item.amountLabel"> · {{ item.amountLabel }}</template>
              </span>
            </div>
          </template>

          <template v-else-if="item.type === 'super_chat'">
            <div class="blivechat-item__sc-head">
              <strong>{{ item.audienceName }}</strong>
              <span>{{ item.amountLabel ?? "SC" }}</span>
            </div>
            <p class="blivechat-item__body">{{ item.content }}</p>
          </template>

          <template v-else>
            <div class="blivechat-item__line blivechat-item__line--stacked">
              <strong>{{ item.audienceName }}</strong>
              <span>{{ item.content }}</span>
            </div>
          </template>

          <footer class="blivechat-item__meta">
            <span>{{ item.happenedAt }}</span>
            <StatusBadge :label="item.statusLabel" :tone="item.tone" />
            <span v-if="item.reasonLabel" class="blivechat-item__reason">{{ item.reasonLabel }}</span>
          </footer>
        </article>
      </div>

      <p v-else class="blivechat-channel__empty">等待本地队列事件。</p>
    </section>
  </div>
</template>

<style scoped>
.blivechat-channels {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-right: 4px;
}

.blivechat-channel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg);
}

.blivechat-channel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.blivechat-channel__head h3 {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.35;
}

.blivechat-channel__head span,
.blivechat-channel__empty {
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.45;
}

.blivechat-channel__empty {
  margin: 0;
}

.blivechat-channel__list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blivechat-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.blivechat-item.is-throttle {
  border-color: var(--warn-soft);
}

.blivechat-item__line {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
}

.blivechat-item__line--stacked {
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
}

.blivechat-item__line strong,
.blivechat-item__sc-head strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}

.blivechat-item__line span,
.blivechat-item__body {
  min-width: 0;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.blivechat-item__sc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.blivechat-item__sc-head span {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 12px;
  font-weight: 700;
}

.blivechat-item__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.45;
}

.blivechat-item__meta :deep(.status-badge) {
  min-height: 20px;
  padding-inline: 7px;
}

.blivechat-item__reason {
  color: var(--warn);
  overflow-wrap: anywhere;
}

@media (max-width: 1180px) {
  .blivechat-channels {
    grid-template-columns: 1fr;
  }
}
</style>
