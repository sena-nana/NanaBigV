<script setup lang="ts">
import StatusBadge from "./StatusBadge.vue";
import type { WorkbenchRuntimeInsight } from "../../features/workbench/types";

defineProps<{
  insight: WorkbenchRuntimeInsight;
}>();

function trimPreview(value: string) {
  return value.length > 360 ? `${value.slice(0, 360)}...` : value;
}
</script>

<template>
  <section class="runtime-insights" aria-labelledby="runtime-insights-title">
    <div class="workbench-card-head runtime-insights__head">
      <div>
        <h2 id="runtime-insights-title">运行观测</h2>
        <p>最近输入、prompt 组装、生成兜底、投递与记忆候选</p>
      </div>
      <span class="workbench-list-item__meta">{{ insight.updatedAt }}</span>
    </div>

    <div class="runtime-insights__grid">
      <article
        v-for="section in insight.sections"
        :key="section.id"
        class="runtime-panel"
        :class="{ 'runtime-panel--wide': section.id === 'memory' }"
      >
        <h3>{{ section.title }}</h3>
        <div v-if="section.records.length" class="workbench-list">
          <div
            v-for="record in section.records"
            :key="record.id"
            class="workbench-list-item runtime-item"
          >
            <div class="workbench-list-item__row">
              <strong class="workbench-list-item__title">{{ record.title }}</strong>
              <StatusBadge :label="record.statusLabel" :tone="record.tone" />
            </div>
            <p>{{ record.detail }}</p>
            <code v-if="record.codePreview">{{ trimPreview(record.codePreview) }}</code>
            <span class="workbench-list-item__meta">{{ record.happenedAt }}<template v-if="record.meta"> · {{ record.meta }}</template></span>
            <div v-if="record.evidence?.length" class="workbench-tag-list">
              <span v-for="evidence in record.evidence" :key="evidence" class="workbench-tag">{{ evidence }}</span>
            </div>
          </div>
        </div>
        <p v-else class="workbench-list-item__meta">{{ section.emptyText }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.runtime-insights {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg);
}

.runtime-insights__head {
  margin-bottom: 0;
}

.runtime-insights__head p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.runtime-insights__grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  overflow: auto;
}

.runtime-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.runtime-panel h3 {
  margin: 0;
  color: var(--text);
  font-size: 13px;
}

.runtime-panel--wide {
  grid-column: 1 / -1;
}

.runtime-item {
  min-width: 0;
  padding: 9px 10px;
  background: var(--bg);
}

.runtime-item p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.runtime-item code {
  max-height: 74px;
  overflow: auto;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 760px) {
  .runtime-insights__grid {
    grid-template-columns: 1fr;
  }

  .runtime-panel--wide {
    grid-column: auto;
  }
}
</style>
