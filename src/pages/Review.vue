<script setup lang="ts">
import StatusBadge from "../components/workbench/StatusBadge.vue";
import { useWorkbenchStore } from "../features/workbench/store";
import "../styles/page.css";
import "../styles/workbench.css";

const { reviewView: view } = useWorkbenchStore();
</script>

<template>
  <section class="workbench-page">
    <div class="page-header">
      <h1>直播回顾</h1>
    </div>

    <div class="workbench-main-grid">
      <div class="workbench-stack">
        <div class="card">
          <div class="workbench-card-head">
            <h2>主播设定快照</h2>
            <span class="workbench-list-item__meta">{{ view.hostProfile.updatedAt }}</span>
          </div>
          <ul class="workbench-kv workbench-kv--compact">
            <li>
              <span>主播</span>
              <strong>{{ view.hostProfile.streamerName }}</strong>
            </li>
            <li>
              <span>语言风格</span>
              <strong>{{ view.hostProfile.languageStyle }}</strong>
            </li>
          </ul>
          <p class="review-summary">{{ view.hostProfile.personaSummary }}</p>
          <div class="workbench-tag-list">
            <span v-for="trait in view.hostProfile.streamTraits" :key="trait" class="workbench-tag">{{ trait }}</span>
          </div>
          <ul class="workbench-kv review-kv">
            <li>
              <span>稳定主题</span>
              <strong>{{ view.hostProfile.stableTopics.join("、") }}</strong>
            </li>
            <li>
              <span>回避事项</span>
              <strong>{{ view.hostProfile.tabooTopics.join("、") }}</strong>
            </li>
          </ul>
        </div>

        <div class="card">
          <h2>往期直播概要</h2>
          <div class="timeline-list">
            <article
              v-for="session in view.sessionRecaps"
              :key="session.id"
              class="timeline-item"
            >
              <div class="timeline-item__date">{{ session.dateLabel }}</div>
              <div class="timeline-item__body">
                <div class="workbench-list-item__row">
                  <span class="workbench-list-item__title">{{ session.title }}</span>
                  <StatusBadge :label="session.rhythmLabel" tone="warn" />
                </div>
                <p class="timeline-item__summary">{{ session.summary }}</p>
                <p class="timeline-item__summary">{{ session.peakMoment }}</p>
                <p class="workbench-list-item__meta">写回记录 {{ session.memoryWrites }} 条</p>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="workbench-stack">
        <div class="card">
          <h2>高光行为</h2>
          <div class="workbench-list">
            <article
              v-for="highlight in view.highlights"
              :key="highlight.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ highlight.title }}</span>
                <span class="workbench-list-item__meta">{{ highlight.happenedAt }}</span>
              </div>
              <div>{{ highlight.detail }}</div>
              <div class="workbench-list-item__meta">{{ highlight.impact }}</div>
            </article>
          </div>
        </div>

        <div class="card">
          <h2>直播建议</h2>
          <div class="workbench-list">
            <article
              v-for="suggestion in view.suggestions"
              :key="suggestion.id"
              class="workbench-list-item"
            >
              <div class="workbench-list-item__row">
                <span class="workbench-list-item__title">{{ suggestion.title }}</span>
                <StatusBadge :label="suggestion.priority" tone="info" />
              </div>
              <div class="workbench-list-item__meta">{{ suggestion.category }}</div>
              <div>{{ suggestion.detail }}</div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.review-summary {
  margin: 12px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.review-kv {
  margin-top: 14px;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 12px;
}

.timeline-item__date {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 700;
  padding-top: 4px;
}

.timeline-item__body {
  position: relative;
  padding: 0 0 0 14px;
  border-left: 1px solid var(--border);
}

.timeline-item__summary {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .timeline-item {
    grid-template-columns: 1fr;
  }

  .timeline-item__body {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
