<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import {
  normalizeSettingsTab,
  useSettings,
} from "@lilia/ui-foundation/settings";
import {
  LiliaPrimaryContent,
  LiliaSectionNavigation,
  LiliaWorkspace,
} from "@lilia/ui/layouts";
import { LiliaSettingsSidebar } from "@lilia/ui/settings/sidebar";
import { LiliaAppShell } from "@lilia/ui/shell/app";
import { SIDEBAR_FOOTER_LINKS, type SidebarFooterStatus } from "@lilia/ui/shell/config";
import { LiliaSidebarFrame, LiliaSidebarNavRow } from "@lilia/ui/shell/sidebar";
import { Gauge } from "@lucide/vue";
import { APP_SHELL_COPY, SIDEBAR_NAV } from "../config/appShell";
import { useProviderSettings } from "../composables/useProviderSettings";
import { useWorkbenchStore } from "../features/workbench/store";

const route = useRoute();
const settings = useSettings();
const settingsMode = computed(
  () => settings !== null && route.path === settings.path,
);
const activeSettingsTab = computed(() =>
  settings ? normalizeSettingsTab(settings, route.query.tab) : "",
);
const returnTo = computed(() => {
  const candidate = route.query.returnTo;
  return typeof candidate === "string" && candidate.startsWith("/")
    ? candidate
    : "/workspace";
});

const { danmakuView } = useWorkbenchStore();
const { providerStatusSummary } = useProviderSettings();

const footerStatus = computed((): SidebarFooterStatus => {
  const dispatchEnabled = danmakuView.value.toggles.some(
    (toggle) => toggle.key === "dispatch" && toggle.enabled,
  );
  const hasError = danmakuView.value.notices.some((notice) => notice.tone === "error");
  const providerStatus = providerStatusSummary.value;
  const providerTo = "/settings?tab=provider";

  if (providerStatus.tone === "error") {
    return {
      key: "status",
      to: providerTo,
      label: "Provider",
      title: providerStatus.title,
      tone: "error",
      icon: Gauge,
    };
  }

  if (providerStatus.tone === "warn" || providerStatus.tone === "info") {
    return {
      key: "status",
      to: providerTo,
      label: providerStatus.tone === "info" ? "Provider" : "待测试",
      title: providerStatus.title,
      tone: "warn",
      icon: Gauge,
    };
  }

  if (hasError) {
    return {
      key: "status",
      to: "/live",
      label: "异常",
      title: `模拟状态：存在需要处理的异常 · ${providerStatus.configSummary}`,
      tone: "error",
      icon: Gauge,
    };
  }

  if (!dispatchEnabled) {
    return {
      key: "status",
      to: "/live",
      label: "暂停",
      title: `模拟状态：自动投递已暂停 · ${providerStatus.configSummary}`,
      tone: "warn",
      icon: Gauge,
    };
  }

  return {
    key: "status",
    to: "/live",
    label: APP_SHELL_COPY.statusLabel,
    title: `模拟状态：自动投递运行中 · ${providerStatus.configSummary}`,
    tone: "ok",
    icon: Gauge,
  };
});
</script>

<template>
  <LiliaAppShell>
    <LiliaWorkspace aria-label="NaNaBigV 工作区">
      <LiliaSectionNavigation id="bigv-navigation">
        <LiliaSettingsSidebar
          v-if="settingsMode && settings"
          :tabs="settings.tabs"
          :active-key="activeSettingsTab"
          :return-to="returnTo"
        />
        <LiliaSidebarFrame v-else aria-label="主导航" :default-footer="false">
          <nav class="bigv-sidebar-nav" aria-label="主导航">
            <LiliaSidebarNavRow
              v-for="item in SIDEBAR_NAV"
              :key="item.key"
              :item="item"
              :agent-id="`sidebar.nav.${item.key}`"
            />
          </nav>
          <template #footer>
            <div class="bigv-sidebar-footer">
              <RouterLink
                v-for="link in SIDEBAR_FOOTER_LINKS"
                :key="link.key"
                :to="link.to"
                class="sb-footer__btn lilia-interactive-item"
                active-class="is-active"
                :title="link.title ?? link.label"
                :aria-label="link.label"
              >
                <component :is="link.icon" :size="14" aria-hidden="true" />
              </RouterLink>
              <RouterLink
                :to="footerStatus.to"
                class="sb-conn"
                :class="`sb-conn--${footerStatus.tone}`"
                :title="footerStatus.title"
                :aria-label="footerStatus.title"
              >
                <component :is="footerStatus.icon" :size="12" aria-hidden="true" />
                <span class="sb-conn__label">{{ footerStatus.label }}</span>
              </RouterLink>
            </div>
          </template>
        </LiliaSidebarFrame>
      </LiliaSectionNavigation>
      <LiliaPrimaryContent id="bigv-primary">
        <RouterView />
      </LiliaPrimaryContent>
    </LiliaWorkspace>
  </LiliaAppShell>
</template>

<style scoped>
.bigv-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
}

.bigv-sidebar-footer {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  width: 100%;
}
</style>
