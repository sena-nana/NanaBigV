<script setup lang="ts">
import { computed, watch } from "vue";
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { APP_METADATA } from "../config/appShell";
import { usePersistentString } from "../composables/usePersistentState";
import { useWorkbenchStore } from "../features/workbench/store";
import type {
  AudienceActivityLevel,
  AudienceProfile,
  AudienceRelationship,
  AudienceSpendingTier,
} from "../features/workbench/types";
import "../styles/page.css";
import "../styles/workbench.css";

const { audienceView: view } = useWorkbenchStore();
const ACTIVITY_FILTER_VALUES = ["all", "high", "medium", "low"] as const;
const SPENDING_FILTER_VALUES = ["all", "high", "medium", "low"] as const;
const RELATIONSHIP_FILTER_VALUES = ["all", "core", "regular", "new"] as const;
const AUDIENCE_IDS = view.value.audiences.map((audience) => audience.id);

const activityFilter = usePersistentString<AudienceActivityLevel | "all">({
  key: `${APP_METADATA.storageKeyPrefix}.audienceActivityFilter`,
  defaultValue: "all",
  allowedValues: ACTIVITY_FILTER_VALUES,
});
const spendingFilter = usePersistentString<AudienceSpendingTier | "all">({
  key: `${APP_METADATA.storageKeyPrefix}.audienceSpendingFilter`,
  defaultValue: "all",
  allowedValues: SPENDING_FILTER_VALUES,
});
const relationshipFilter = usePersistentString<AudienceRelationship | "all">({
  key: `${APP_METADATA.storageKeyPrefix}.audienceRelationshipFilter`,
  defaultValue: "all",
  allowedValues: RELATIONSHIP_FILTER_VALUES,
});
const selectedAudienceId = usePersistentString<string>({
  key: `${APP_METADATA.storageKeyPrefix}.selectedAudienceId`,
  defaultValue: view.value.defaultAudienceId,
  allowedValues: AUDIENCE_IDS,
});

const filteredAudiences = computed(() =>
  view.value.audiences.filter((audience) => {
    if (activityFilter.value !== "all" && audience.activityLevel !== activityFilter.value) return false;
    if (spendingFilter.value !== "all" && audience.spendingTier !== spendingFilter.value) return false;
    if (relationshipFilter.value !== "all" && audience.relationship !== relationshipFilter.value) return false;
    return true;
  }),
);

watch(filteredAudiences, (next) => {
  if (!next.some((item) => item.id === selectedAudienceId.value)) {
    selectedAudienceId.value = next[0]?.id ?? view.value.defaultAudienceId;
  }
}, { immediate: true });

const selectedAudience = computed<AudienceProfile | null>(() =>
  filteredAudiences.value.find((item) => item.id === selectedAudienceId.value) ?? null,
);

function selectAudience(id: string) {
  selectedAudienceId.value = id;
}

function behaviorTypeLabel(type: AudienceProfile["recentBehaviors"][number]["type"]) {
  if (type === "super_chat") return "SC";
  if (type === "membership") return "舰长";
  return type === "danmaku" ? "弹幕" : "礼物";
}
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>观众信息</h1>
      <div class="audience-filters">
        <label>
          活跃度
          <select v-model="activityFilter" aria-label="活跃度筛选">
            <option value="all">全部</option>
            <option value="high">高活跃</option>
            <option value="medium">中活跃</option>
            <option value="low">低活跃</option>
          </select>
        </label>
        <label>
          消费倾向
          <select v-model="spendingFilter" aria-label="消费倾向筛选">
            <option value="all">全部</option>
            <option value="high">高消费</option>
            <option value="medium">中消费</option>
            <option value="low">低消费</option>
          </select>
        </label>
        <label>
          关系类型
          <select v-model="relationshipFilter" aria-label="关系类型筛选">
            <option value="all">全部</option>
            <option value="core">核心熟客</option>
            <option value="regular">稳定观众</option>
            <option value="new">新观众</option>
          </select>
        </label>
      </div>
    </div>

    <div class="audience-layout">
      <div class="card audience-list-card">
        <h2>观众列表</h2>
        <div class="audience-list">
          <button
            v-for="audience in filteredAudiences"
            :key="audience.id"
            type="button"
            class="audience-item"
            :class="{ 'is-active': selectedAudience?.id === audience.id }"
            @click="selectAudience(audience.id)"
          >
            <div class="audience-item__head">
              <span class="audience-item__name">{{ audience.name }}</span>
              <StatusBadge :label="audience.activityLabel" :tone="audience.activityLevel === 'high' ? 'ok' : audience.activityLevel === 'medium' ? 'info' : 'warn'" />
            </div>
            <div class="audience-item__tagline">{{ audience.tagLine }}</div>
            <div class="workbench-tag-list">
              <span v-for="tag in audience.roleTags" :key="tag" class="workbench-tag">{{ tag }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="workbench-stack">
        <div v-if="selectedAudience" class="card">
          <h2>{{ selectedAudience.name }}</h2>
          <p class="audience-summary">{{ selectedAudience.summary }}</p>
          <div class="workbench-tag-list">
            <span class="workbench-tag">{{ selectedAudience.relationshipLabel }}</span>
            <span class="workbench-tag">{{ selectedAudience.spendingLabel }}</span>
            <span class="workbench-tag">{{ selectedAudience.appearanceFrequency }}</span>
            <span class="workbench-tag">{{ selectedAudience.languageStyle }}</span>
          </div>
        </div>

        <div v-if="selectedAudience" class="card">
          <h2>互动偏好</h2>
          <div class="workbench-list">
            <article
              v-for="preference in selectedAudience.preferences"
              :key="preference.label"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ preference.label }}</span>
                <span class="workbench-list-item__meta">{{ preference.strength }}</span>
              </div>
              <div class="workbench-list-item__meta">{{ preference.detail }}</div>
            </article>
          </div>
        </div>

        <div v-if="selectedAudience" class="card">
          <h2>长期记忆</h2>
          <div class="workbench-list">
            <article
              v-for="memory in selectedAudience.memories"
              :key="memory.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ memory.layer }}</span>
                <span class="workbench-list-item__meta">{{ memory.confidence }}</span>
              </div>
              <div>{{ memory.summary }}</div>
              <div class="workbench-list-item__meta">{{ memory.updatedAt }}</div>
            </article>
          </div>
        </div>

        <div v-if="selectedAudience" class="card">
          <h2>最近行为</h2>
          <div class="workbench-list">
            <article
              v-for="behavior in selectedAudience.recentBehaviors"
              :key="behavior.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ behavior.detail }}</span>
                <StatusBadge :label="behaviorTypeLabel(behavior.type)" tone="info" />
              </div>
              <div class="workbench-list-item__meta">{{ behavior.result }}</div>
              <div class="workbench-list-item__meta">{{ behavior.happenedAt }}</div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.audience-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.audience-filters label {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.audience-filters select {
  min-width: 124px;
}

.audience-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.audience-list-card {
  min-height: 0;
}

.audience-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.audience-item {
  height: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  text-align: left;
}

.audience-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 72%, var(--bg-subtle));
}

.audience-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.audience-item__name {
  font-size: 14px;
  font-weight: 600;
}

.audience-item__tagline,
.audience-summary {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 980px) {
  .audience-layout {
    grid-template-columns: 1fr;
  }
}
</style>
