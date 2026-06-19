<script setup lang="ts">
import { computed } from "vue";
import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "vue-chartjs";
import type { UsageSeriesPoint } from "../../features/workbench/types";
import { cssVar, formatTokens } from "./chartSetup";
import "./chartSetup";

const props = defineProps<{
  title: string;
  series: UsageSeriesPoint[];
}>();

type TrendMetricKey = "inputTokens" | "outputTokens" | "retryWasteTokens" | "estimatedCost";

const TREND_SERIES: Array<{
  key: TrendMetricKey;
  label: string;
  colorVar: string;
  fallback: string;
  yAxisID?: "cost";
}> = [
  { key: "inputTokens", label: "输入", colorVar: "--accent", fallback: "#4f8cff" },
  { key: "outputTokens", label: "输出", colorVar: "--ok", fallback: "#27c286" },
  { key: "retryWasteTokens", label: "失败重试", colorVar: "--err", fallback: "#ff5a66" },
  { key: "estimatedCost", label: "成本", colorVar: "--warn", fallback: "#f5a524", yAxisID: "cost" },
];

const chartData = computed<ChartData<"line", number[], string>>(() => ({
  labels: props.series.map((point) => point.label),
  datasets: TREND_SERIES.map((series) => {
    const color = cssVar(series.colorVar, series.fallback);
    return {
      label: series.label,
      data: props.series.map((point) => point[series.key]),
      borderColor: color,
      backgroundColor: color,
      pointBackgroundColor: color,
      pointBorderColor: cssVar("--bg-elev", "#ffffff"),
      pointHoverRadius: 5,
      pointRadius: 3,
      borderWidth: 2,
      fill: false,
      tension: 0.35,
      yAxisID: series.yAxisID,
    };
  }),
}));

const chartOptions = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: "index",
  },
  plugins: {
    legend: {
      display: true,
      position: "bottom",
      labels: {
        color: cssVar("--text-muted", "#a3a7b0"),
        boxHeight: 8,
        boxWidth: 18,
        usePointStyle: true,
      },
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label(context) {
          const value = Number(context.parsed.y ?? 0);
          const label = context.dataset.label ? `${context.dataset.label}: ` : "";
          return context.dataset.yAxisID === "cost"
            ? `${label}¥${value.toFixed(2)}`
            : `${label}${formatTokens(value)}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: cssVar("--border-soft", "rgba(148, 163, 184, 0.22)"),
      },
      ticks: {
        color: cssVar("--text-faint", "#8a8f98"),
        maxRotation: 0,
      },
    },
    y: {
      type: "linear",
      position: "left",
      beginAtZero: true,
      grid: {
        color: cssVar("--border-soft", "rgba(148, 163, 184, 0.22)"),
      },
      ticks: {
        color: cssVar("--text-faint", "#8a8f98"),
        callback(value) {
          return Number(value).toLocaleString();
        },
      },
    },
    cost: {
      type: "linear",
      position: "right",
      beginAtZero: true,
      grid: {
        drawOnChartArea: false,
      },
      ticks: {
        color: cssVar("--text-faint", "#8a8f98"),
        callback(value) {
          return `¥${Number(value).toFixed(0)}`;
        },
      },
    },
  },
}));
</script>

<template>
  <div class="usage-chart usage-chart--trend" role="img" :aria-label="title">
    <Line aria-hidden="true" :data="chartData" :options="chartOptions" />
  </div>
</template>
