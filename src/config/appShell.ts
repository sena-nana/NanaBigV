import {
  BookOpenText,
  Bug,
  ClipboardList,
  Gauge,
  Info,
  Palette,
  Radar,
  Server,
  ShieldCheck,
  SquarePen,
  UsersRound,
} from "@lucide/vue";
import type { Component } from "vue";
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

const WORKBENCH_NAV_ICONS: Record<WorkbenchNavItem["key"], Component> = {
  workspace: Gauge,
  live: Radar,
  setup: SquarePen,
  audienceGroups: UsersRound,
  topics: BookOpenText,
  safety: ShieldCheck,
  records: ClipboardList,
};

export interface BigVSidebarNavItem {
  key: string;
  to: string;
  label: string;
  icon: Component;
}

export const SIDEBAR_NAV: BigVSidebarNavItem[] = BIGV_WORKBENCH_SNAPSHOT.nav.map((item) => ({
  key: item.key,
  to: item.to,
  label: item.label,
  icon: WORKBENCH_NAV_ICONS[item.key],
}));

export const SETTINGS_ICON_MAP = {
  appearance: Palette,
  provider: Server,
  debug: Bug,
  about: Info,
} as const;
