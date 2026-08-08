import { liliaPresetDefinition } from "@lilia/ui/preset/definition";
import {
  createSettingsModel,
  provideSettings,
} from "@lilia/ui-foundation/settings";
import { resolveLiliaIcon, setLiliaUiConfig } from "@lilia/ui/shell/config";
import {
  installCornerStyle,
  installGlobalScrollbarVisibility,
  installLiliaContextMenu,
  installNativeAppearance,
} from "@lilia/ui/runtime";
import ContextMenuHost from "@lilia/ui/components/ContextMenuHost";
import OverlayHost from "@lilia/ui/components/OverlayHost";
import type { AppUIPresetAdapter } from "@lilia/ui-contract";
import appConfigJson from "../../app.config.json";
import { defineComponent, h, type Component } from "vue";
import { APP_METADATA, SETTINGS_ICON_MAP } from "../config/appShell";
import type { BigVUIPresetAdapter } from "./types";
import ActiveShell from "./ActiveShell.vue";

const upstream = liliaPresetDefinition as AppUIPresetAdapter<Component>;
const Hosts = defineComponent({
  setup: () => () => [h(ContextMenuHost), h(OverlayHost)],
});

const settings = createSettingsModel({
  path: "/settings",
  defaultTab: "appearance",
  description: "偏好设置会保存到本地。",
  tabs: [
    { key: "appearance", label: "外观", icon: SETTINGS_ICON_MAP.appearance },
    { key: "provider", label: "Provider", icon: SETTINGS_ICON_MAP.provider },
    { key: "debug", label: "调试", icon: SETTINGS_ICON_MAP.debug },
    { key: "about", label: "关于", icon: SETTINGS_ICON_MAP.about },
  ],
  sections: {
    appearance: () => import("../pages/settings/AppearanceSection.vue"),
    provider: () => import("../pages/settings/ProviderSection.vue"),
    debug: () => import("../pages/settings/DebugSection.vue"),
    about: () => import("../pages/settings/AboutSection.vue"),
  },
});

export const bigVPreset: BigVUIPresetAdapter = {
  ...upstream,
  shell: ActiveShell,
  routes: [
    { path: "", redirect: "/workspace" },
    {
      path: "workspace",
      component: () => import("../pages/Workspace.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "live",
      component: () => import("../pages/LiveConsole.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "setup",
      component: () => import("../pages/LiveSetup.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "audience-groups",
      component: () => import("../pages/AudienceGroups.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "topics",
      component: () => import("../pages/TopicLibrary.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "safety",
      component: () => import("../pages/SafetySettings.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    {
      path: "danmaku-records",
      component: () => import("../pages/DanmakuRecords.vue"),
      meta: { sidebar: "main", returnable: true },
    },
    { path: "danmaku", redirect: "/live" },
    { path: "audience", redirect: "/audience-groups" },
    { path: "quota", redirect: "/settings?tab=provider" },
    { path: "review", redirect: "/danmaku-records" },
    {
      path: "settings",
      component: () =>
        import("@lilia/ui/settings").then((module) => module.LiliaSettingsPage),
      meta: { sidebar: "settings", lockSidebar: true, returnable: false },
    },
  ],
  hosts: Hosts,
  install(app) {
    setLiliaUiConfig({
      appName: APP_METADATA.appName,
      productTitle: APP_METADATA.productTitle,
      version: APP_METADATA.version,
      storageKeyPrefix: APP_METADATA.storageKeyPrefix,
      identifier: appConfigJson.identifier,
      appearance: { backdropTarget: "sidebar" },
      sidebar: {
        footerLinks: [
          {
            key: "settings",
            to: "/settings",
            label: "设置",
            icon: resolveLiliaIcon("settings"),
          },
        ],
        footerStatuses: [
          {
            key: "status",
            to: "/live",
            label: appConfigJson.shell.statusLabel,
            title: appConfigJson.shell.statusTitle,
            tone: "warn",
            icon: resolveLiliaIcon("gauge"),
          },
        ],
      },
    });
    provideSettings(app, settings);
    installLiliaContextMenu(app);
    installGlobalScrollbarVisibility();
    const corners = installCornerStyle();
    corners.setCornerStyle(corners.cornerStyle.value);
    corners.setCornerRadius(corners.cornerRadius.value);
    installNativeAppearance();
  },
  installDiagnostics: async () => {
    const diagnostics = await import("@lilia/ui/diagnostics");
    if (!diagnostics.isLiliaAgentDebugEnabled()) return false;
    diagnostics.installAgentDebugHarness();
    return true;
  },
};
