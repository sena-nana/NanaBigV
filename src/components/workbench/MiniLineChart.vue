<script setup lang="ts">
import { computed } from "vue";
import type { UsageSeriesPoint } from "../../features/workbench/types";

const props = defineProps<{
  title: string;
  series: UsageSeriesPoint[];
}>();

const points = computed(() => {
  if (!props.series.length) return "";
  const max = Math.max(...props.series.map((point) => point.value));
  const min = Math.min(...props.series.map((point) => point.value));
  const range = Math.max(max - min, 1);

  return props.series
    .map((point, index) => {
      const x = props.series.length === 1 ? 0 : (index / (props.series.length - 1)) * 100;
      const y = 100 - ((point.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
});
</script>

<template>
  <div class="line-card">
    <div class="line-card__title">{{ title }}</div>
    <svg
      class="line-card__chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      :aria-label="title"
    >
      <polyline class="line-card__polyline" :points="points" />
    </svg>
    <div class="line-card__labels">
      <span v-for="point in series" :key="point.label">{{ point.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.line-card__title {
  font-size: 12px;
  color: var(--text-muted);
}

.line-card__chart {
  height: 120px;
  padding: 8px 0 4px;
}

.line-card__polyline {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.line-card__labels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(32px, 1fr));
  gap: 8px;
  color: var(--text-faint);
  font-size: 11px;
}
</style>
