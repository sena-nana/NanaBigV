<script setup lang="ts">
import { computed, ref } from "vue";
import UsageTrendChart from "../components/workbench/UsageTrendChart.vue";
import { APP_METADATA } from "../config/appShell";
import { usePersistentString } from "../composables/usePersistentState";
import { useWorkbenchStore } from "../features/workbench/store";
import type { UsageBreakdown, UsageWindowKey } from "../features/workbench/types";
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
type ConsumptionGroupId = "model" | "capability" | "subsystem";

const quotaMetrics = computed(() => [
  {
    id: "requests",
    label: "请求",
    value: currentWindowData.value.summary.requestCount.toLocaleString(),
  },
  {
    id: "input",
    label: "输入",
    value: currentWindowData.value.summary.inputTokens.toLocaleString(),
  },
  {
    id: "output",
    label: "输出",
    value: currentWindowData.value.summary.outputTokens.toLocaleString(),
  },
  {
    id: "cost",
    label: "成本",
    value: `¥${currentWindowData.value.summary.estimatedCost.toFixed(2)}`,
  },
  {
    id: "retry",
    label: "失败重试",
    value: currentWindowData.value.summary.retryWasteTokens.toLocaleString(),
  },
]);
const consumptionGroups = computed<Array<{
  id: ConsumptionGroupId;
  tabLabel: string;
  rows: UsageBreakdown[];
  valueMode: "tokens" | "percent";
}>>(() => [
  {
    id: "model",
    tabLabel: "模型统计",
    rows: currentWindowData.value.byModel,
    valueMode: "tokens",
  },
  {
    id: "capability",
    tabLabel: "能力统计",
    rows: currentWindowData.value.byCapability,
    valueMode: "tokens",
  },
  {
    id: "subsystem",
    tabLabel: "子系统统计",
    rows: currentWindowData.value.bySubsystem,
    valueMode: "percent",
  },
]);
const activeConsumptionGroupId = ref<ConsumptionGroupId>("model");
const activeConsumptionGroup = computed(
  () =>
    consumptionGroups.value.find((group) => group.id === activeConsumptionGroupId.value) ??
    consumptionGroups.value[0]!,
);

function setWindow(next: UsageWindowKey) {
  activeWindow.value = next;
}

function setConsumptionGroup(next: ConsumptionGroupId) {
  activeConsumptionGroupId.value = next;
}

function percentLabel(share: number) {
  return `${share}%`;
}

function formatBreakdownValue(row: UsageBreakdown, mode: "tokens" | "percent") {
  return mode === "tokens" ? row.value.toLocaleString() : percentLabel(row.share);
}
</script>

<template>
  <section class="workbench-page workbench-page--fill quota-page">
    <div class="page-header quota-page__header">
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

    <div class="quota-page__scroll">
      <div class="quota-overview" aria-label="额度概览">
        <article v-for="metric in quotaMetrics" :key="metric.id" class="quota-metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </div>

      <div class="quota-layout">
        <div class="card quota-trend-card">
          <div class="workbench-card-head quota-card-head">
            <h2>{{ currentWindowLabel }}趋势</h2>
            <span>Token 使用</span>
          </div>
          <UsageTrendChart
            :title="`${currentWindowLabel} token 使用趋势`"
            :series="currentWindowData.trend"
          />
        </div>

        <div class="card quota-stats-card">
          <div class="workbench-card-head quota-card-head">
            <h2>统计</h2>
            <span>{{ currentWindowLabel }}</span>
          </div>
          <div class="workbench-segmented quota-stats-tabs" role="tablist" aria-label="额度统计类别">
            <button
              v-for="group in consumptionGroups"
              :key="group.id"
              type="button"
              :class="{ 'is-active': activeConsumptionGroup.id === group.id }"
              :aria-pressed="activeConsumptionGroup.id === group.id"
              @click="setConsumptionGroup(group.id)"
            >
              {{ group.tabLabel }}
            </button>
          </div>
          <div class="quota-stats-table-wrap">
            <table class="quota-stats-table">
              <caption>{{ activeConsumptionGroup.tabLabel }}</caption>
              <thead>
                <tr>
                  <th scope="col">名称</th>
                  <th scope="col">数值</th>
                  <th scope="col">占比</th>
                  <th scope="col">说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activeConsumptionGroup.rows" :key="`${activeConsumptionGroup.id}-${row.id}`">
                  <th scope="row">
                    <span class="quota-stats-table__name">
                      <span class="quota-stats-table__swatch" :class="`is-${row.tone}`" />
                      {{ row.label }}
                    </span>
                  </th>
                  <td>{{ formatBreakdownValue(row, activeConsumptionGroup.valueMode) }}</td>
                  <td>{{ percentLabel(row.share) }}</td>
                  <td>{{ row.helperText ?? "无" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
