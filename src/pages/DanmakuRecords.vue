<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useLiveAssistConfig } from "../features/liveConfig/store";
import type { GenerationRecordStatus } from "../features/liveConfig/types";
import { useWorkbenchStore } from "../features/workbench/store";
import "../styles/page.css";
import "../styles/workbench.css";

const { config, loading, error, load } = useLiveAssistConfig();
const { danmakuView } = useWorkbenchStore();
const statusFilter = ref<GenerationRecordStatus | "all">("all");
const groupFilter = ref("all");
const triggerFilter = ref("all");

const statusLabels: Record<GenerationRecordStatus, string> = {
  adopted: "已采用",
  ignored: "已忽略",
  blocked: "已拦截",
  rewritten: "已改写",
  pending: "待确认",
};
const statusTones: Record<GenerationRecordStatus, "ok" | "warn" | "error" | "info"> = {
  adopted: "ok",
  ignored: "info",
  blocked: "error",
  rewritten: "warn",
  pending: "info",
};
const groups = computed(() => [
  ...new Map(config.value.generationRecords.map((record) => [record.audienceGroupId, record.audienceGroupName])).entries(),
]);
const triggers = computed(() => Array.from(new Set(config.value.generationRecords.map((record) => record.triggerReason))));
const filteredRecords = computed(() =>
  config.value.generationRecords.filter((record) => {
    if (statusFilter.value !== "all" && record.status !== statusFilter.value) return false;
    if (groupFilter.value !== "all" && record.audienceGroupId !== groupFilter.value) return false;
    if (triggerFilter.value !== "all" && record.triggerReason !== triggerFilter.value) return false;
    return true;
  }),
);
const queueRecords = computed(() => danmakuView.value.blivechatChannels.flatMap((channel) => channel.items).slice(0, 12));

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>弹幕记录</h1>
      <StatusBadge :label="loading ? '读取配置' : `${filteredRecords.length} 条`" tone="info" />
    </div>
    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="records-filters">
      <label>状态
        <select v-model="statusFilter">
          <option value="all">全部</option>
          <option value="adopted">已采用</option>
          <option value="ignored">已忽略</option>
          <option value="blocked">已拦截</option>
          <option value="rewritten">已改写</option>
          <option value="pending">待确认</option>
        </select>
      </label>
      <label>观众组
        <select v-model="groupFilter">
          <option value="all">全部</option>
          <option v-for="[id, name] in groups" :key="id" :value="id">{{ name }}</option>
        </select>
      </label>
      <label>触发原因
        <select v-model="triggerFilter">
          <option value="all">全部</option>
          <option v-for="trigger in triggers" :key="trigger" :value="trigger">{{ trigger }}</option>
        </select>
      </label>
    </div>

    <div class="records-layout">
      <section class="card">
        <div class="workbench-card-head">
          <h2>生成记录</h2>
          <span>{{ config.generationRecords.length }} / 200</span>
        </div>
        <div class="records-table-wrap">
          <table class="records-table">
            <caption>AI 弹幕生成记录</caption>
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">内容</th>
                <th scope="col">观众组</th>
                <th scope="col">触发原因</th>
                <th scope="col">状态</th>
                <th scope="col">风险</th>
                <th scope="col">相似度</th>
                <th scope="col">反馈</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in filteredRecords" :key="record.id">
                <td>{{ record.happenedAt }}</td>
                <td>{{ record.content }}</td>
                <td>{{ record.audienceGroupName }}</td>
                <td>{{ record.triggerReason }}</td>
                <td><StatusBadge :label="statusLabels[record.status]" :tone="statusTones[record.status]" /></td>
                <td>{{ record.riskTags.join(" / ") || "无" }}</td>
                <td>{{ record.similarity }}%</td>
                <td>{{ record.userFeedback }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>投递协议记录</h2>
        <div class="workbench-list">
          <article v-for="item in queueRecords" :key="item.id" class="workbench-list-item">
            <div class="workbench-list-item__row">
              <span class="workbench-list-item__title">{{ item.audienceName }}</span>
              <StatusBadge :label="item.statusLabel" :tone="item.tone" />
            </div>
            <div>{{ item.content }}</div>
            <div class="workbench-list-item__meta">{{ item.happenedAt }} · {{ item.type }} {{ item.reasonLabel ?? "" }}</div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.records-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.records-filters label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.records-filters select {
  min-width: 140px;
}

.records-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
  gap: 12px;
}

.records-table-wrap {
  overflow: auto;
}

.records-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
}

.records-table caption {
  width: 1px;
  height: 1px;
  overflow: hidden;
  position: absolute;
  clip: rect(0 0 0 0);
}

.records-table th,
.records-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border-soft);
  text-align: left;
  vertical-align: top;
  font-size: 12px;
  line-height: 1.5;
}

.records-table th {
  color: var(--text-muted);
}

@media (max-width: 1100px) {
  .records-layout {
    grid-template-columns: 1fr;
  }
}
</style>
