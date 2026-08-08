import type { App, Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { AppUIPresetAdapter } from "./contract";

export interface BigVAppCapability {
  id: string;
  install: (app: App) => void;
}

export interface BigVUIPresetAdapter extends AppUIPresetAdapter<Component> {
  routes: readonly RouteRecordRaw[];
  shellProps?: Readonly<Record<string, unknown>>;
  hosts?: Component;
  appCapabilities?: readonly BigVAppCapability[];
  install?: (app: App) => void;
  installDiagnostics?: () => Promise<boolean>;
}
