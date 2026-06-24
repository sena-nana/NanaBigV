import {
  BookOpenText,
  Gauge,
  Bug,
  ClipboardList,
  Info,
  Palette,
  Radar,
  Server,
  ShieldCheck,
  SquarePen,
  Settings,
  UsersRound,
} from "@lucide/vue";
import { defineAsyncComponent, type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import appConfig from "../../app.config.json";
import type { WorkbenchNavItem } from "../features/workbench/types";
import { BIGV_WORKBENCH_SNAPSHOT } from "../features/workbench/mockSnapshot";

export const APP_METADATA = {
  appName: appConfig.appName,
  productTitle: appConfig.productTitle,
  version: appConfig.version,
  storageKeyPrefix: appConfig.storageKeyPrefix,
} as const;

export const APP_SHELL_COPY = appConfig.shell;

export const APP_TITLE = APP_METADATA.productTitle;

export const SIDEBAR_CONFIG = {
  widthStorageKey: `${APP_METADATA.storageKeyPrefix}.sidebarWidth`,
  collapsedStorageKey: `${APP_METADATA.storageKeyPrefix}.sidebarCollapsed`,
  minWidth: 180,
  maxWidth: 480,
  defaultWidth: 220,
} as const;

export interface SidebarActionItem {
  key: string;
  label: string;
  icon: Component;
  disabled?: boolean;
}

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: Component;
}

export interface SidebarFooterLink {
  to: string;
  label: string;
  title?: string;
  icon: Component;
}

export interface SidebarFooterStatus {
  to: RouteLocationRaw;
  label: string;
  title: string;
  tone: "ok" | "warn" | "error";
  icon: Component;
}

const WORKBENCH_NAV_ICONS: Record<WorkbenchNavItem["key"], Component> = {
  workspace: Gauge,
  live: Radar,
  setup: SquarePen,
  audienceGroups: UsersRound,
  topics: BookOpenText,
  safety: ShieldCheck,
  records: ClipboardList,
};

export const SIDEBAR_GLOBAL_ACTIONS: SidebarActionItem[] = [];

export const SIDEBAR_NAV: SidebarNavItem[] = BIGV_WORKBENCH_SNAPSHOT.nav.map((item) => ({
  to: item.to,
  label: item.label,
  icon: WORKBENCH_NAV_ICONS[item.key],
}));

export const SIDEBAR_FOOTER_LINKS: SidebarFooterLink[] = [
  { to: "/settings", label: "设置", icon: Settings },
];

export const SIDEBAR_FOOTER_STATUS: SidebarFooterStatus = {
  to: "/live",
  label: APP_SHELL_COPY.statusLabel,
  title: APP_SHELL_COPY.statusTitle,
  tone: "warn",
  icon: Gauge,
};

export type SettingsTabKey = "appearance" | "provider" | "debug" | "about";

export interface SettingsTab {
  key: SettingsTabKey;
  label: string;
  icon: Component;
  to: RouteLocationRaw;
}

export const SETTINGS_TABS: SettingsTab[] = [
  {
    key: "appearance",
    label: "外观",
    icon: Palette,
    to: { path: "/settings", query: { tab: "appearance" } },
  },
  {
    key: "provider",
    label: "Provider",
    icon: Server,
    to: { path: "/settings", query: { tab: "provider" } },
  },
  {
    key: "debug",
    label: "调试",
    icon: Bug,
    to: { path: "/settings", query: { tab: "debug" } },
  },
  {
    key: "about",
    label: "关于",
    icon: Info,
    to: { path: "/settings", query: { tab: "about" } },
  },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "appearance";

export const SETTINGS_SECTIONS: Record<SettingsTabKey, Component> = {
  appearance: defineAsyncComponent(() => import("../pages/settings/AppearanceSection.vue")),
  provider: defineAsyncComponent(() => import("../pages/settings/ProviderSection.vue")),
  debug: defineAsyncComponent(() => import("../pages/settings/DebugSection.vue")),
  about: defineAsyncComponent(() => import("../pages/settings/AboutSection.vue")),
};

export function normalizeSettingsTab(value: unknown): SettingsTabKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SETTINGS_TABS.some((tab) => tab.key === candidate)
    ? (candidate as SettingsTabKey)
    : DEFAULT_SETTINGS_TAB;
}
