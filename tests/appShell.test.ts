import { fireEvent, render, waitFor, within } from "@testing-library/vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_CONFIG } from "../src/config/appShell";
import {
  resetProviderSettingsStateForTest,
} from "../src/composables/useProviderSettings";
import AppShell from "../src/layouts/AppShell.vue";

const loadedProviderConfig = {
  baseUrl: "https://example.com/v1",
  apiKey: "sk-app-shell-test",
  model: "gpt-4.1-mini",
  temperature: 0.6,
  topP: 0.9,
  timeoutSeconds: 45,
};

const mockInvoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: Record<string, unknown>) => Promise<unknown>>(),
);
const mockIsMaximized = vi.fn(async () => false);
const mockOnResized = vi.fn(async () => vi.fn());
const mockMinimize = vi.fn(async () => undefined);
const mockToggleMaximize = vi.fn(async () => undefined);
const mockClose = vi.fn(async () => undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: mockIsMaximized,
    onResized: mockOnResized,
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
  }),
}));

async function renderAppShell(initialRoute = "/danmaku") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/danmaku",
        component: { template: "<div>danmaku</div>" },
        meta: { sidebar: "main", returnable: true },
      },
      {
        path: "/quota",
        component: { template: "<div>quota</div>" },
        meta: { sidebar: "main", returnable: true },
      },
      {
        path: "/audience",
        component: { template: "<div>audience</div>" },
        meta: { sidebar: "main", returnable: true },
      },
      {
        path: "/review",
        component: { template: "<div>review</div>" },
        meta: { sidebar: "main", returnable: true },
      },
      {
        path: "/settings",
        component: { template: "<div>settings</div>" },
        meta: { sidebar: "settings", lockSidebar: true, returnable: false },
      },
      { path: "/:pathMatch(.*)*", redirect: "/danmaku" },
    ],
  });
  await router.push(initialRoute);
  await router.isReady();

  const view = render(AppShell, {
    global: {
      plugins: [router],
    },
  });

  return {
    ...view,
    router,
  };
}

function shellElement(container: HTMLElement): HTMLElement {
  const shell = container.querySelector(".shell");
  if (!(shell instanceof HTMLElement)) {
    throw new Error("未找到 shell");
  }
  return shell;
}

function leftResizer(container: HTMLElement): HTMLElement {
  const resizer = container.querySelector(".shell__resizer");
  if (!(resizer instanceof HTMLElement)) {
    throw new Error("未找到左侧栏拖拽线");
  }
  return resizer;
}

function sidebarRowForText(container: HTMLElement, text: string): HTMLElement {
  const label = Array.from(container.querySelectorAll(".sb-tree__name")).find(
    (node) => node.textContent === text,
  );
  const row = label?.closest(".sb-tree__row");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`未找到侧边栏行: ${text}`);
  }
  return row;
}

beforeEach(() => {
  localStorage.clear();
  resetProviderSettingsStateForTest();
  mockInvoke.mockReset();
  mockInvoke.mockImplementation(async (command, payload) => {
    if (command === "load_provider_config") return loadedProviderConfig;
    if (command === "save_provider_config") return payload?.config ?? loadedProviderConfig;
    if (command === "test_provider_connection") {
      return {
        ok: true,
        latencyMs: 182,
        model: loadedProviderConfig.model,
        message: "已通过 chat/completions 连通性测试",
      };
    }
    throw new Error(`unexpected command: ${command}`);
  });
  mockIsMaximized.mockClear();
  mockOnResized.mockClear();
  mockMinimize.mockClear();
  mockToggleMaximize.mockClear();
  mockClose.mockClear();
});

describe("AppShell sidebar", () => {
  it("主侧边栏切换为 BigV 四个功能标签", async () => {
    const view = await renderAppShell("/quota");
    const nav = view.getByRole("navigation", { name: "主导航" });

    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "弹幕姬" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "额度检查" })).toHaveClass("is-active");
    expect(within(nav).getByRole("link", { name: "观众信息" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "直播回顾" })).toBeInTheDocument();
    expect(sidebarRowForText(view.container, "额度检查")).toHaveClass("sb-tree__row", "is-active");
    expect(view.queryByText("BigV 工作台")).toBeNull();
  });

  it("左上角按钮切换左侧栏折叠状态并写回本地存储", async () => {
    const view = await renderAppShell("/danmaku");
    const shell = shellElement(view.container);
    const collapse = view.getByRole("button", { name: "折叠左侧栏" });

    expect(shell).not.toHaveClass("is-sidebar-collapsed");
    expect(leftResizer(view.container)).not.toHaveAttribute("aria-disabled");
    expect(collapse).toHaveAttribute("aria-pressed", "false");

    await fireEvent.click(collapse);

    expect(shell).toHaveClass("is-sidebar-collapsed");
    expect(leftResizer(view.container)).toHaveAttribute("aria-disabled", "true");
    expect(localStorage.getItem(SIDEBAR_CONFIG.collapsedStorageKey)).toBe("1");

    const expand = view.getByRole("button", { name: "展开左侧栏" });
    expect(expand).toHaveAttribute("aria-pressed", "true");

    await fireEvent.click(expand);

    expect(shell).not.toHaveClass("is-sidebar-collapsed");
    expect(leftResizer(view.container)).not.toHaveAttribute("aria-disabled");
    expect(localStorage.getItem(SIDEBAR_CONFIG.collapsedStorageKey)).toBe("0");
  });

  it("左侧栏宽度可拖拽调整、写回存储并双击恢复默认", async () => {
    localStorage.setItem(SIDEBAR_CONFIG.widthStorageKey, "260");
    const view = await renderAppShell();
    const shell = shellElement(view.container);
    const resizer = leftResizer(view.container);

    expect(shell.style.getPropertyValue("--sidebar-width")).toBe("260px");
    expect(resizer).toHaveAttribute("aria-valuemin", "180");
    expect(resizer).toHaveAttribute("aria-valuemax", "480");
    expect(resizer).toHaveAttribute("aria-valuenow", "260");

    await fireEvent.pointerDown(resizer, {
      button: 0,
      clientX: 200,
      pointerId: 1,
    });
    await fireEvent.pointerMove(window, {
      clientX: 300,
      pointerId: 1,
    });

    expect(shell.style.getPropertyValue("--sidebar-width")).toBe("360px");
    expect(resizer).toHaveAttribute("aria-valuenow", "360");

    await fireEvent.pointerUp(window, {
      clientX: 300,
      pointerId: 1,
    });

    expect(localStorage.getItem(SIDEBAR_CONFIG.widthStorageKey)).toBe("360");

    await fireEvent.dblClick(resizer);

    expect(shell.style.getPropertyValue("--sidebar-width")).toBe("220px");
    expect(localStorage.getItem(SIDEBAR_CONFIG.widthStorageKey)).toBe("220");
  });

  it("设置页替换左侧栏、禁用折叠并保留折叠偏好", async () => {
    localStorage.setItem(SIDEBAR_CONFIG.collapsedStorageKey, "1");
    const view = await renderAppShell("/settings");
    const shell = shellElement(view.container);
    const leftToggle = view.getByRole("button", { name: "折叠左侧栏" });

    expect(shell).toHaveClass("is-settings-mode");
    expect(shell).not.toHaveClass("is-sidebar-collapsed");
    expect(leftToggle).toBeDisabled();
    expect(view.getByRole("navigation", { name: "设置分类" })).toBeInTheDocument();
    expect(view.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: /外观/ })).toHaveClass("is-active");
    expect(view.getByRole("button", { name: /Provider/ })).toBeInTheDocument();
    expect(view.router.currentRoute.value.meta.sidebar).toBe("settings");
    expect(view.router.currentRoute.value.meta.lockSidebar).toBe(true);
    expect(localStorage.getItem(SIDEBAR_CONFIG.collapsedStorageKey)).toBe("1");

    await fireEvent.click(view.getByRole("button", { name: /Provider/ }));

    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/settings?tab=provider");
    });
    expect(view.getByRole("button", { name: /Provider/ })).toHaveClass("is-active");

    await fireEvent.click(view.getByRole("button", { name: /关于/ }));

    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/settings?tab=about");
    });
    expect(view.getByRole("button", { name: /关于/ })).toHaveClass("is-active");

    await view.router.push("/danmaku");
    expect(shell).toHaveClass("is-sidebar-collapsed");
    expect(localStorage.getItem(SIDEBAR_CONFIG.collapsedStorageKey)).toBe("1");
  });

  it("设置页返回进入设置前的主窗口路由", async () => {
    const view = await renderAppShell("/review");

    await view.router.push("/settings?tab=about");
    await fireEvent.click(view.getByRole("button", { name: "返回" }));
    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/review");
    });
  });

  it("标题栏窗口按钮会调用 Tauri 窗口控制", async () => {
    const view = await renderAppShell("/danmaku");

    await fireEvent.click(view.getByRole("button", { name: "最小化" }));
    await fireEvent.click(view.getByRole("button", { name: "最大化" }));
    await fireEvent.click(view.getByRole("button", { name: "关闭" }));

    expect(mockMinimize).toHaveBeenCalledTimes(1);
    expect(mockToggleMaximize).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockOnResized).toHaveBeenCalledTimes(1);
    expect(mockIsMaximized).toHaveBeenCalled();
  });
});
