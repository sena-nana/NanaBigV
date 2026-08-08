import { createApp } from "vue";
import {
  createRouter,
  createWebHistory,
  type RouterHistory,
} from "vue-router";
import AppRoot from "./AppRoot.vue";
import { commands } from "./commands";
import { installCommandRegistry } from "./ui/commands";
import { activeUIPreset, type BigVUIPresetAdapter } from "./ui/preset";

export function createBigVApp(
  history?: RouterHistory,
  preset: BigVUIPresetAdapter = activeUIPreset,
) {
  const app = createApp(AppRoot, {
    provider: preset.provider,
    policy: preset.policy,
    hosts: preset.hosts,
  });
  const router = createBigVRouter(history, preset);

  preset.install?.(app);
  for (const capability of preset.appCapabilities ?? []) {
    capability.install(app);
  }
  installCommandRegistry(app, commands);
  app.use(router);
  if (
    import.meta.env.DEV
    && (import.meta.env.VITE_LILIA_AGENT_DEBUG === "1" || import.meta.env.MODE === "agent-debug")
  ) {
    void preset.installDiagnostics?.();
  }

  return { app, router };
}

export function createBigVRouter(
  history?: RouterHistory,
  preset: BigVUIPresetAdapter = activeUIPreset,
) {
  return createRouter({
    history: history ?? createWebHistory(),
    routes: [
      {
        path: "/",
        component: preset.shell,
        props: preset.shellProps,
        meta: { sidebar: "main", returnable: true },
        children: [...preset.routes],
      },
      { path: "/:pathMatch(.*)*", redirect: "/workspace" },
    ],
  });
}
