import { screen, waitFor } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBigVApp } from "../src/app";
import { SIDEBAR_NAV } from "../src/config/appShell";
import { resetProviderSettingsStateForTest } from "../src/composables/useProviderSettings";

const mockInvoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: Record<string, unknown>) => Promise<unknown>>(),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: vi.fn(async () => false),
    onResized: vi.fn(async () => vi.fn()),
    minimize: vi.fn(async () => undefined),
    toggleMaximize: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  }),
}));

const mounted: Array<() => void> = [];

async function mountApp(path = "/workspace") {
  const root = document.createElement("div");
  document.body.append(root);
  const { app, router } = createBigVApp(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  app.mount(root);
  mounted.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

beforeEach(() => {
  resetProviderSettingsStateForTest();
  mockInvoke.mockReset();
  mockInvoke.mockImplementation(async (command) => {
    if (command === "load_provider_config") {
      return {
        baseUrl: "https://example.com/v1",
        apiKey: "sk-app-test",
        model: "gpt-4.1-mini",
      };
    }
    if (command === "load_live_assist_config") {
      return {
        currentPlanId: null,
        plans: [],
        audienceGroups: [],
        topicCards: [],
        outline: {
          opening: "",
          mainContent: "",
          interactionPoints: [],
          closing: "",
          forbiddenDetours: [],
        },
        memeLibrary: {
          roomMemes: [],
          catchphrases: [],
          fanNames: [],
          disabledMemes: [],
          recentMemes: [],
          expiredMemes: [],
        },
        safety: {
          outputMode: "manual_review",
          requireManualConfirmation: true,
          basicRules: [],
          qualityFilters: [],
          maxGeneratedPerMinute: 8,
          maxConsecutivePerTopic: 3,
        },
        generationRecords: [],
      };
    }
    if (command === "load_context_window") {
      return { windowStartedAt: 0, windowSeconds: 300, events: [], sourceStatuses: [] };
    }
    if (command === "load_memory_snapshot") {
      return {
        hostProfile: null,
        longTermFacts: [],
        audienceProfiles: [],
        sessionSummaries: [],
      };
    }
    return null;
  });
});

afterEach(() => {
  while (mounted.length) mounted.pop()?.();
});

describe("application assembly", () => {
  it("挂载 Lilia shell 与主导航", async () => {
    await mountApp("/workspace");
    await waitFor(() => {
      expect(document.querySelector('[data-agent-id="app-shell"]')).not.toBeNull();
    });
    for (const item of SIDEBAR_NAV) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
  });

  it("设置页切换为设置侧栏", async () => {
    await mountApp("/settings");
    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "设置分类" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
  });
});
