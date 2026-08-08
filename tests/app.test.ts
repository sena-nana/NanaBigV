import { screen, waitFor } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { RouterView, createMemoryHistory } from "vue-router";
import { afterEach, describe, expect, it } from "vitest";
import { createBigVApp } from "../src/app";
import type { BigVUIPresetAdapter } from "../src/ui/preset";

const mounted: Array<() => void> = [];
afterEach(() => {
  while (mounted.length) mounted.pop()?.();
});

async function mountPreset(preset: BigVUIPresetAdapter, path = "/workspace") {
  const root = document.createElement("div");
  document.body.append(root);
  const { app, router } = createBigVApp(createMemoryHistory(), preset);
  await router.push(path);
  await router.isReady();
  app.mount(root);
  mounted.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const policy = {
  density: "compact",
  advancedDisclosure: "visible",
  errorPresentation: "technical",
  selectionPresentation: "outline",
  feedbackStrength: "minimal",
  sidebarDefault: "expanded",
  destructiveAction: "application",
} as const;

function mockPreset(label: string): BigVUIPresetAdapter {
  const Shell = defineComponent({
    setup: () => () => h("main", { "data-agent-id": "mock.lilia.shell" }, h(RouterView)),
  });
  const Page = defineComponent({ setup: () => () => h("h1", label) });
  return {
    id: "lilia",
    shell: Shell,
    policy,
    defaultDensity: policy.density,
    capabilities: [],
    routes: [{ path: "workspace", component: async () => Page }],
  };
}

describe("application assembly", () => {
  it("mounts the active Lilia shell and settings provider", async () => {
    const active = (await import("../src/ui/preset")).activeUIPreset;
    const root = await mountPreset(active, "/workspace");
    await waitFor(() => {
      expect(root.querySelector('[data-agent-id="app-shell"]')).not.toBeNull();
    });
    expect(window.__liliaAgentDebug).toBeUndefined();
  });

  it("creates independent routers from injected adapters", async () => {
    await mountPreset(mockPreset("Mock page"), "/workspace");
    await screen.findByRole("heading", { name: "Mock page" });
  });
});
