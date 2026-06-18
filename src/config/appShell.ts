import {
  FilePlus2,
  Folder,
  Home,
  Info,
  MoreHorizontal,
  Palette,
  Puzzle,
  Search,
  Settings,
  Sparkles,
} from "@lucide/vue";
import { defineAsyncComponent, type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import appConfig from "../../app.config.json";

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
  to?: string;
  label: string;
  icon: Component;
  tools?: SidebarActionItem[];
  disabled?: boolean;
}

export interface SidebarGroup {
  title: string;
  tools?: SidebarActionItem[];
  items?: SidebarNavItem[];
  emptyText?: string;
}

export interface SidebarFooterLink {
  to: string;
  label: string;
  title?: string;
  icon: Component;
}

export interface SidebarFooterStatus {
  to: string;
  label: string;
  title: string;
  tone: "ok" | "warn" | "error";
  icon: Component;
}

export const SIDEBAR_GLOBAL_ACTIONS: SidebarActionItem[] = [
  { key: "new", label: "新建", icon: FilePlus2, disabled: true },
  { key: "search", label: "搜索", icon: Search, disabled: true },
];

export const SIDEBAR_NAV: SidebarNavItem[] = [
  {
    to: "/",
    label: "概览",
    icon: Home,
    tools: [{ key: "new", label: "新建", icon: FilePlus2, disabled: true }],
  },
];

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: "示例分组",
    tools: [{ key: "more", label: "更多", icon: MoreHorizontal, disabled: true }],
    items: [
      {
        label: APP_SHELL_COPY.workspaceName,
        icon: Folder,
        disabled: true,
        tools: [{ key: "more", label: "更多", icon: MoreHorizontal, disabled: true }],
      },
    ],
    emptyText: APP_SHELL_COPY.workspaceEmptyText,
  },
];

export const SIDEBAR_FOOTER_LINKS: SidebarFooterLink[] = [
  { to: "/settings", label: "设置", icon: Settings },
  { to: "/plugins", label: "扩展", icon: Puzzle },
];

export const SIDEBAR_FOOTER_STATUS: SidebarFooterStatus = {
  to: "/settings",
  label: APP_SHELL_COPY.statusLabel,
  title: APP_SHELL_COPY.statusTitle,
  tone: "ok",
  icon: Sparkles,
};

export type SettingsTabKey = "appearance" | "about";

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
    key: "about",
    label: "关于",
    icon: Info,
    to: { path: "/settings", query: { tab: "about" } },
  },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "appearance";

export const SETTINGS_SECTIONS: Record<SettingsTabKey, Component> = {
  appearance: defineAsyncComponent(() => import("../pages/settings/AppearanceSection.vue")),
  about: defineAsyncComponent(() => import("../pages/settings/AboutSection.vue")),
};

export function normalizeSettingsTab(value: unknown): SettingsTabKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SETTINGS_TABS.some((tab) => tab.key === candidate)
    ? (candidate as SettingsTabKey)
    : DEFAULT_SETTINGS_TAB;
}
