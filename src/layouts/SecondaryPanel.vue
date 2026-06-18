<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  APP_SHELL_COPY,
  SIDEBAR_FOOTER_LINKS,
  SIDEBAR_FOOTER_STATUS,
  SIDEBAR_GLOBAL_ACTIONS,
  SIDEBAR_NAV,
} from "../config/appShell";
import SidebarFooter from "../components/sidebar/SidebarFooter.vue";
import { useWorkbenchStore } from "../features/workbench/store";

const { danmakuView } = useWorkbenchStore();

const footerStatus = computed(() => {
  const dispatchEnabled = danmakuView.value.toggles.some(
    (toggle) => toggle.key === "dispatch" && toggle.enabled,
  );
  const hasError = danmakuView.value.notices.some((notice) => notice.tone === "error");

  if (hasError) {
    return {
      ...SIDEBAR_FOOTER_STATUS,
      label: "异常",
      title: "模拟状态：存在需要处理的异常",
      tone: "error" as const,
    };
  }

  if (!dispatchEnabled) {
    return {
      ...SIDEBAR_FOOTER_STATUS,
      label: "暂停",
      title: "模拟状态：自动投递已暂停",
      tone: "warn" as const,
    };
  }

  return {
    ...SIDEBAR_FOOTER_STATUS,
    label: "运行",
    title: "模拟状态：自动投递运行中",
    tone: "ok" as const,
  };
});
</script>

<template>
  <aside class="secondary-panel">
    <div
      v-if="SIDEBAR_GLOBAL_ACTIONS.length"
      class="sb-section sb-section--actions"
    >
      <button
        v-for="action in SIDEBAR_GLOBAL_ACTIONS"
        :key="action.key"
        type="button"
        class="sb-action"
        :title="action.label"
        :aria-label="action.label"
        :disabled="action.disabled"
      >
        <component :is="action.icon" :size="16" aria-hidden="true" />
      </button>
    </div>

    <div class="sb-section">
      <div class="sb-section__header">
        <span class="sb-section__title">{{ APP_SHELL_COPY.workspaceSectionTitle }}</span>
      </div>
      <nav class="sb-tree" aria-label="主导航">
        <RouterLink
          v-for="item in SIDEBAR_NAV"
          :key="item.label"
          :to="item.to"
          class="sb-tree__row"
          active-class="is-active"
        >
          <component :is="item.icon" :size="14" aria-hidden="true" />
          <span class="sb-tree__name">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <SidebarFooter
      :links="SIDEBAR_FOOTER_LINKS"
      :status="footerStatus"
    />
  </aside>
</template>

<style scoped>
.sb-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.sb-section--actions {
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 2px 2px 0;
}

.sb-section__header {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 6px 0 8px;
  color: var(--text-faint);
}

.sb-section__title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.sb-action {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.sb-action {
  flex: 1;
  height: 30px;
  padding: 0;
  border-radius: var(--radius-sm);
}

.sb-action:hover {
  background: var(--bg-hover);
  color: var(--text);
  filter: none;
}

.sb-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  min-height: 0;
}

.sb-tree__row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
}

.sb-tree__row:hover {
  background: var(--bg-hover);
}

.sb-tree__row.is-active {
  background: var(--bg-active);
  color: var(--accent);
}

.sb-tree__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
