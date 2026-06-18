<script setup lang="ts">
import { computed } from "vue";
import MiniLineChart from "../components/workbench/MiniLineChart.vue";
import { APP_METADATA } from "../config/appShell";
import { usePersistentString } from "../composables/usePersistentState";
import { useWorkbenchStore } from "../features/workbench/store";
import type { UsageWindowKey } from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { quotaView: view } = useWorkbenchStore();
const WINDOW_KEYS = view.value.windows.map((item) => item.key) as UsageWindowKey[];
const activeWindow = usePersistentString<UsageWindowKey>({
  key: `${APP_METADATA.storageKeyPrefix}.quotaWindow`,
  defaultValue: view.value.defaultWindow,
  allowedValues: WINDOW_KEYS,
});
const currentWindowData = computed(() => view.value.windowData[activeWindow.value]);
const currentWindowLabel = computed(
  () => view.value.windows.find((item) => item.key === activeWindow.value)?.label ?? "",
);

function setWindow(next: UsageWindowKey) {
  activeWindow.value = next;
}

function percentLabel(share: number) {
  return `${share}%`;
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>额度检查</h1>
      <div class="workbench-segmented" role="tablist" aria-label="额度时间窗">
        <button
          v-for="window in view.windows"
          :key="window.key"
          type="button"
          :class="{ 'is-active': activeWindow === window.key }"
          :aria-pressed="activeWindow === window.key"
          @click="setWindow(window.key)"
        >
          {{ window.label }}
        </button>
      </div>
    </div>

    <div class="workbench-main-grid">
      <div class="workbench-stack">
        <div class="card">
          <div class="workbench-card-head">
            <h2>{{ currentWindowLabel }}趋势</h2>
          </div>
          <ul class="workbench-kv workbench-kv--grid">
            <li>
              <span>请求</span>
              <strong>{{ currentWindowData.summary.requestCount }}</strong>
            </li>
            <li>
              <span>输入</span>
              <strong>{{ currentWindowData.summary.inputTokens.toLocaleString() }}</strong>
            </li>
            <li>
              <span>输出</span>
              <strong>{{ currentWindowData.summary.outputTokens.toLocaleString() }}</strong>
            </li>
            <li>
              <span>成本</span>
              <strong>¥{{ currentWindowData.summary.estimatedCost.toFixed(2) }}</strong>
            </li>
          </ul>
          <MiniLineChart
            :title="`${currentWindowLabel} token 使用趋势`"
            :series="currentWindowData.trend"
          />
        </div>

        <div class="card">
          <h2>模型拆分</h2>
          <div class="workbench-chart-bars">
            <div
              v-for="row in currentWindowData.byModel"
              :key="row.id"
              class="workbench-chart-row"
            >
              <div class="workbench-chart-label">{{ row.label }}</div>
              <div class="workbench-chart-track">
                <div class="workbench-chart-fill" :class="`is-${row.tone}`" :style="{ width: percentLabel(row.share) }" />
              </div>
              <div class="workbench-chart-value">{{ row.value.toLocaleString() }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>能力消耗拆分</h2>
          <div class="workbench-chart-bars">
            <div
              v-for="row in currentWindowData.byCapability"
              :key="row.id"
              class="workbench-chart-row"
            >
              <div class="workbench-chart-label">{{ row.label }}</div>
              <div class="workbench-chart-track">
                <div class="workbench-chart-fill" :class="`is-${row.tone}`" :style="{ width: percentLabel(row.share) }" />
              </div>
              <div class="workbench-chart-value">{{ percentLabel(row.share) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="workbench-stack">
        <div class="card">
          <h2>子系统消耗</h2>
          <div class="workbench-list">
            <article
              v-for="row in currentWindowData.bySubsystem"
              :key="row.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ row.label }}</span>
                <span class="workbench-list-item__meta">{{ percentLabel(row.share) }}</span>
              </div>
              <div class="workbench-chart-track">
                <div class="workbench-chart-fill" :class="`is-${row.tone}`" :style="{ width: percentLabel(row.share) }" />
              </div>
              <div class="workbench-list-item__meta">{{ row.helperText }}</div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
