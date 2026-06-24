<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { Play, RotateCcw, Settings2 } from "@lucide/vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useProviderSettings } from "../composables/useProviderSettings";
import { useLiveAssistConfig } from "../features/liveConfig/store";
import { useWorkbenchStore } from "../features/workbench/store";
import "../styles/page.css";
import "../styles/workbench.css";

const liveConfig = useLiveAssistConfig();
const { currentPlan, config, enabledAudienceGroups, enabledTopicCards, loading, error, load } = liveConfig;
const { danmakuView, reviewView, echoLiveStatus, refreshContextWindow } = useWorkbenchStore();
const provider = useProviderSettings();

const quickStats = computed(() => [
  { label: "观众组", value: enabledAudienceGroups.value.length },
  { label: "话题卡", value: enabledTopicCards.value.length },
  { label: "记录", value: config.value.generationRecords.length },
  { label: "每分钟上限", value: config.value.safety.maxGeneratedPerMinute },
]);
const connectionRows = computed(() => [
  ...danmakuView.value.inputSources.filter((source) => source.key !== "provider"),
  {
    key: "provider",
    label: "模型服务",
    statusLabel: provider.providerStatusSummary.value.label,
    tone: provider.providerStatusSummary.value.tone,
    summary: provider.providerStatusSummary.value.detail,
  },
]);
const recentSuggestions = computed(() => reviewView.value.suggestions.slice(0, 3));

onMounted(() => {
  void load();
  void refreshContextWindow();
});
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <div>
        <h1>NaNaBigV</h1>
        <p class="workspace-subtitle">AI 观众氛围与直播控场助手</p>
      </div>
      <StatusBadge
        :label="loading ? '读取配置' : currentPlan.outputMode === 'auto_assist' ? '自动辅助' : currentPlan.outputMode === 'prompt_only' ? '仅提词' : '人工确认'"
        :tone="currentPlan.outputMode === 'auto_assist' ? 'warn' : 'ok'"
      />
    </div>

    <p v-if="error" class="workbench-error" role="alert">{{ error }}</p>

    <div class="workspace-grid">
      <section class="card workspace-hero" aria-labelledby="workspace-current-plan">
        <div>
          <h2 id="workspace-current-plan">{{ currentPlan.title }}</h2>
          <p>{{ currentPlan.theme }}</p>
          <div class="workbench-tag-list">
            <span class="workbench-tag">{{ currentPlan.streamType }}</span>
            <span class="workbench-tag">{{ currentPlan.hostState }}</span>
            <span class="workbench-tag">主播语音优先</span>
          </div>
        </div>
        <div class="workspace-actions">
          <RouterLink class="button-primary workspace-button" to="/live">
            <Play :size="15" aria-hidden="true" />
            进入中控台
          </RouterLink>
          <RouterLink class="button-secondary workspace-button" to="/setup">
            <RotateCcw :size="15" aria-hidden="true" />
            继续配置
          </RouterLink>
          <RouterLink class="button-secondary workspace-button" to="/safety">
            <Settings2 :size="15" aria-hidden="true" />
            检查安全
          </RouterLink>
        </div>
      </section>

      <section class="card" aria-labelledby="workspace-quick-start">
        <h2 id="workspace-quick-start">快速开始</h2>
        <div class="workspace-start-list">
          <RouterLink to="/setup">新建直播辅助</RouterLink>
          <RouterLink to="/workspace">继续上次配置</RouterLink>
          <RouterLink to="/live">进入演练模式</RouterLink>
          <RouterLink to="/live">进入直播中控台</RouterLink>
        </div>
      </section>
    </div>

    <div class="workspace-grid workspace-grid--bottom">
      <section class="card">
        <div class="workbench-card-head">
          <h2>状态检查</h2>
          <span>{{ echoLiveStatus.url }}</span>
        </div>
        <div class="workbench-list">
          <article v-for="source in connectionRows" :key="source.key" class="workbench-list-item">
            <div class="workbench-list-item__row">
              <span class="workbench-list-item__title">{{ source.label }}</span>
              <StatusBadge :label="source.statusLabel" :tone="source.tone" />
            </div>
            <div class="workbench-list-item__meta">{{ source.summary }}</div>
          </article>
        </div>
      </section>

      <section class="card">
        <h2>当前方案</h2>
        <div class="workspace-stat-grid">
          <div v-for="stat in quickStats" :key="stat.label" class="workspace-stat">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </div>
        </div>
        <div class="workbench-tag-list workspace-topic-tags">
          <span v-for="topic in currentPlan.focusTopics" :key="topic" class="workbench-tag">{{ topic }}</span>
        </div>
      </section>

      <section class="card">
        <h2>最近复盘</h2>
        <div class="workbench-list">
          <article v-for="suggestion in recentSuggestions" :key="suggestion.id" class="workbench-list-item">
            <div class="workbench-list-item__row">
              <span class="workbench-list-item__title">{{ suggestion.title }}</span>
              <StatusBadge :label="suggestion.priority" tone="info" />
            </div>
            <div class="workbench-list-item__meta">{{ suggestion.detail }}</div>
          </article>
          <p v-if="recentSuggestions.length === 0" class="workbench-list-item__meta">暂无复盘建议。</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.workspace-subtitle {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
  gap: 12px;
}

.workspace-grid--bottom {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 12px;
}

.workspace-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.workspace-hero p {
  color: var(--text-muted);
  line-height: 1.6;
}

.workspace-actions,
.workspace-start-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-button,
.workspace-start-list a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-md);
  font-weight: 700;
  justify-content: center;
}

.workspace-start-list a {
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg-subtle);
}

.workspace-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.workspace-stat {
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.workspace-stat span {
  color: var(--text-muted);
  font-size: 12px;
}

.workspace-topic-tags {
  margin-top: 12px;
}

.button-primary {
  background: var(--accent);
  color: var(--accent-text);
}

.button-secondary {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

@media (max-width: 980px) {
  .workspace-grid,
  .workspace-grid--bottom {
    grid-template-columns: 1fr;
  }

  .workspace-hero {
    flex-direction: column;
  }
}
</style>
