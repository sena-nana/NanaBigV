import { fireEvent, render, screen } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
import { APP_METADATA } from "../src/config/appShell";
import {
  resetProviderSettingsStateForTest,
} from "../src/composables/useProviderSettings";
import type {
  ProviderConfig,
  ProviderProbeResult,
} from "../src/features/provider/types";
import { createBigVRouter } from "../src/router";

const loadedProviderConfig: ProviderConfig = {
  baseUrl: "https://example.com/v1",
  apiKey: "sk-router-test",
  model: "gpt-4.1-mini",
  temperature: 0.6,
  topP: 0.9,
  timeoutSeconds: 45,
};

const mockInvoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: Record<string, unknown>) => Promise<unknown>>(),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

function successProbe(): ProviderProbeResult {
  return {
    ok: true,
    latencyMs: 182,
    model: loadedProviderConfig.model,
    message: "已通过 chat/completions 连通性测试",
  };
}

function failureProbe(): ProviderProbeResult {
  return {
    ok: false,
    error: {
      kind: "http_status",
      message: "provider 返回 HTTP 401",
      statusCode: 401,
    },
  };
}

function installInvokeMock(overrides: Partial<Record<string, unknown>> = {}) {
  mockInvoke.mockImplementation(async (command, payload) => {
    if (command in overrides) {
      const value = overrides[command];
      if (value instanceof Error) throw value;
      return value;
    }
    if (command === "load_provider_config") return loadedProviderConfig;
    if (command === "save_provider_config") return payload?.config ?? loadedProviderConfig;
    if (command === "test_provider_connection") return successProbe();
    throw new Error(`unexpected command: ${command}`);
  });
}

async function renderAt(path: string) {
  const router = createBigVRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();

  const view = render(App, {
    global: {
      plugins: [router],
    },
  });
  return {
    ...view,
    router,
  };
}

beforeEach(() => {
  resetProviderSettingsStateForTest();
  mockInvoke.mockReset();
  installInvokeMock();
});

describe("基础路由", () => {
  it("默认首页跳转到弹幕姬工作台", async () => {
    await renderAt("/");

    expect(await screen.findByLabelText("自动投递")).toBeInTheDocument();
    expect(screen.getByText("把调试段落拆成“目标 -> 过程 -> 结论”三段")).toBeInTheDocument();
    expect(screen.getByText("阿黎：这一段反应好快，像是真的在跟弹幕对线。")).toBeInTheDocument();
    expect(screen.getByText("糖霜六号 [SC ¥30]：建议下一段切回剧情点评，不要一直卡在设置界面。")).toBeInTheDocument();
    expect((await screen.findAllByText("Provider")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试")).not.toHaveLength(0);
    expect(screen.getByText(/example\.com\/v1 · 模型 gpt-4\.1-mini · API Key 已配置/)).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith("test_provider_connection", undefined);
  });

  it("侧边栏显示四个功能标签，底部保留设置和状态入口", async () => {
    await renderAt("/");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "弹幕姬" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "额度检查" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "观众信息" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "直播回顾" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "新建" })).toBeNull();
    expect(screen.queryByRole("button", { name: "搜索" })).toBeNull();
    expect(screen.queryByRole("button", { name: "添加" })).toBeNull();
    expect(screen.queryByRole("link", { name: "扩展" })).toBeNull();
    expect(await screen.findByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试").length).toBeGreaterThan(0);
  });

  it("Provider 手动探活成功后首页和侧栏展示真实结果", async () => {
    const view = await renderAt("/settings?tab=provider");

    await screen.findByDisplayValue(loadedProviderConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));
    expect(await screen.findByRole("status")).toHaveTextContent("已通过 chat/completions 连通性测试");

    await view.router.push("/danmaku");

    expect(await screen.findByText("可用")).toBeInTheDocument();
    expect(screen.getByText("182ms")).toBeInTheDocument();
    expect(screen.getByText(/最近测试 .*模型 gpt-4\.1-mini，耗时 182ms/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /模拟状态：自动投递运行中 .*example\.com\/v1/ })).toHaveClass("sb-conn--ok");
  });

  it("Provider 手动探活失败后首页和侧栏展示错误态", async () => {
    installInvokeMock({ test_provider_connection: failureProbe() });
    const view = await renderAt("/settings?tab=provider");

    await screen.findByDisplayValue(loadedProviderConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("provider 返回 HTTP 401");

    await view.router.push("/danmaku");

    expect(await screen.findAllByText("异常")).not.toHaveLength(0);
    expect(screen.getByText(/provider 返回 HTTP 401/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Provider 异常：provider 返回 HTTP 401/ })).toHaveClass("sb-conn--error");
  });

  it("设置页默认显示外观设置并使用设置侧栏", async () => {
    await renderAt("/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "设置分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /外观/ })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: /Provider/ })).toBeInTheDocument();
    expect(await screen.findByRole("radiogroup", { name: "圆角" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "圆角半径" })).toBeInTheDocument();
    expect(screen.queryByText(/Claude|Codex|CC-Switch|agent/i)).toBeNull();
  });

  it("外观页圆角设置可即时切换全局 data-corners", async () => {
    await renderAt("/settings");

    const smooth = await screen.findByRole("radio", { name: /平滑/ });
    const round = screen.getByRole("radio", { name: /普通/ });

    expect(smooth).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("smooth");

    await fireEvent.click(round);

    expect(round).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("round");

    await fireEvent.click(smooth);

    expect(smooth).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("smooth");
  });

  it("外观页圆角半径设置可即时切换全局半径变量", async () => {
    await renderAt("/settings");

    const radius = await screen.findByRole("slider", { name: "圆角半径" });

    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("8px");
    expect(screen.getByText("8px")).toBeInTheDocument();

    await fireEvent.input(radius, { target: { value: "14" } });

    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("14px");
    expect(screen.getByText("14px")).toBeInTheDocument();
  });

  it("设置页可通过 tab query 显示关于页，未知 tab 回落外观", async () => {
    await renderAt("/settings?tab=about");

    expect(await screen.findByRole("heading", { level: 1, name: "关于" })).toBeInTheDocument();
    expect(await screen.findByText("Tauri 2 + Vue 3")).toBeInTheDocument();
  });

  it("弹幕姬页开关只切换本地状态", async () => {
    await renderAt("/danmaku");

    const toggle = await screen.findByRole("checkbox", { name: "自动投递" });

    expect(toggle).toBeChecked();
    await fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByText("自动投递已关闭，新的互动结果不会继续进入渲染队列。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试").length).toBeGreaterThan(0);
    expect(localStorage.getItem("bigv.workbench")).toContain("\"key\":\"dispatch\"");
    expect(localStorage.getItem("bigv.workbench")).toContain("\"enabled\":false");
  });

  it("额度检查页支持切换时间窗", async () => {
    await renderAt("/quota");

    expect(await screen.findByText("24 小时趋势")).toBeInTheDocument();
    expect(screen.getByText("请求")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "7 天" }));

    expect(await screen.findByText("7 天趋势")).toBeInTheDocument();
  });

  it("额度检查页会恢复上次选择的时间窗", async () => {
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.quotaWindow`, "30d");

    await renderAt("/quota");

    expect(await screen.findByText("30 天趋势")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 天" })).toHaveAttribute("aria-pressed", "true");
  });

  it("观众信息页支持切换选中观众并按筛选自动同步详情", async () => {
    await renderAt("/audience");

    expect(await screen.findByRole("heading", { level: 2, name: "阿黎" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /北街舟/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "北街舟" })).toBeInTheDocument();

    await fireEvent.change(screen.getByRole("combobox", { name: "关系类型筛选" }), {
      target: { value: "new" },
    });

    expect(await screen.findByRole("heading", { level: 2, name: "糖霜六号" })).toBeInTheDocument();
  });

  it("观众信息页会恢复筛选条件和上次选中的观众", async () => {
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceActivityFilter`, "medium");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceSpendingFilter`, "low");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceRelationshipFilter`, "regular");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.selectedAudienceId`, "jing-dao");

    await renderAt("/audience");

    expect(((await screen.findByRole("combobox", { name: "活跃度筛选" })) as HTMLSelectElement).value).toBe("medium");
    expect((screen.getByRole("combobox", { name: "消费倾向筛选" }) as HTMLSelectElement).value).toBe("low");
    expect((screen.getByRole("combobox", { name: "关系类型筛选" }) as HTMLSelectElement).value).toBe("regular");
    expect(await screen.findByRole("heading", { level: 2, name: "镜岛" })).toBeInTheDocument();
  });

  it("直播回顾页显示主播快照和建议", async () => {
    await renderAt("/review");

    expect(await screen.findByText("主播：青栀")).toBeInTheDocument();
    expect(screen.getByText("把调试段落拆成“目标 -> 过程 -> 结论”三段")).toBeInTheDocument();
  });

  it("未知路由回到弹幕姬", async () => {
    await renderAt("/missing");

    expect(await screen.findByLabelText("自动投递")).toBeInTheDocument();
  });

  it("未知设置 tab 回落到外观", async () => {
    await renderAt("/settings?tab=missing");

    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
  });
});
