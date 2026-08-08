import type { App, Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import type { AppUIPresetAdapter } from "@lilia/ui-contract";

export interface BigVUIPresetAdapter extends AppUIPresetAdapter<Component> {
  routes: readonly RouteRecordRaw[];
  shellProps?: Readonly<Record<string, unknown>>;
  hosts?: Component;
  install?: (app: App) => void;
  installDiagnostics?: () => Promise<boolean>;
}
