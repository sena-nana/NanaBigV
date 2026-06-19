import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
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
};

const mockInvoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: Record<string, unknown>) => Promise<unknown>>(),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

const emptyContextWindow = {
  windowStartedAt: 1_800_000_000_000,
  windowSeconds: 300,
  events: [],
  sourceStatuses: [
    {
      source: "voice",
      label: "主播语音",
      statusLabel: "待输入",
      tone: "info",
      summary: "等待本地 ASR 或手动面板提交主播语音文本。",
      eventCount: 0,
    },
    {
      source: "echo_live",
      label: "Echo-Live",
      statusLabel: "预留接口",
      tone: "info",
      summary: "Echo-Live 输入适配器已预留，阶段 3 不接入真实事件。",
      eventCount: 0,
    },
    {
      source: "vision",
      label: "视觉上下文",
      statusLabel: "预留接口",
      tone: "info",
      summary: "视觉摘要输入接口已预留，阶段 3 不处理原始视频流。",
      eventCount: 0,
    },
  ],
};

function voiceContextWindow(content: string) {
  return {
    ...emptyContextWindow,
    events: [
      {
        id: "ctx-test-1",
        source: "voice",
        content,
        summary: content,
        occurredAt: 1_800_000_001_000,
        receivedAt: 1_800_000_001_000,
        status: "accepted",
      },
    ],
    sourceStatuses: [
      {
        source: "voice",
        label: "主播语音",
        statusLabel: "在线",
        tone: "ok",
        summary: "最近 60 秒内收到主播语音文本，当前窗口有 1 条输入。",
        lastEventAt: 1_800_000_001_000,
        eventCount: 1,
      },
      emptyContextWindow.sourceStatuses[1],
      emptyContextWindow.sourceStatuses[2],
    ],
  };
}

function successProbe(): ProviderProbeResult {
  return {
    ok: true,
    latencyMs: 182,
    model: loadedProviderConfig.model,
    message: "Provider 连通性测试通过",
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

function modelList() {
  return {
    ok: true,
    models: ["gpt-4.1", loadedProviderConfig.model],
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
    if (command === "list_provider_models") return modelList();
    if (command === "test_provider_connection") return successProbe();
    if (command === "load_context_window") return emptyContextWindow;
    if (command === "submit_context_event") {
      const event = payload?.event as { content?: string } | undefined;
      return voiceContextWindow(event?.content ?? "");
    }
    if (command === "clear_context_window") return emptyContextWindow;
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
    expect(await screen.findByRole("status")).toHaveTextContent("Provider 连通性测试通过");

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

  it("弹幕姬页可提交主播语音文本并刷新上下文窗口", async () => {
    await renderAt("/danmaku");

    const input = await screen.findByRole("textbox", { name: "主播语音文本" });
    await fireEvent.update(input, "主播刚说下一局换成高难模式");
    await fireEvent.click(screen.getByRole("button", { name: "提交语音" }));

    expect(mockInvoke).toHaveBeenCalledWith("submit_context_event", {
      event: {
        source: "voice",
        content: "主播刚说下一局换成高难模式",
      },
    });
    expect((await screen.findAllByText("主播刚说下一局换成高难模式")).length).toBeGreaterThan(0);
    expect(screen.getByText("在线")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("弹幕姬页可清空上下文窗口回到待输入状态", async () => {
    await renderAt("/danmaku");

    await fireEvent.update(
      await screen.findByRole("textbox", { name: "主播语音文本" }),
      "主播提到马上进 boss",
    );
    await fireEvent.click(screen.getByRole("button", { name: "提交语音" }));
    expect((await screen.findAllByText("主播提到马上进 boss")).length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole("button", { name: "清空窗口" }));

    await waitFor(() => {
      expect(screen.queryByText("主播提到马上进 boss")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("等待主播语音文本输入。").length).toBeGreaterThan(0);
    expect(mockInvoke).toHaveBeenCalledWith("clear_context_window", undefined);
  });

  it("主播语音提交失败时展示错误且保留草稿", async () => {
    installInvokeMock({
      submit_context_event: new Error("local ASR bridge unavailable"),
    });
    await renderAt("/danmaku");

    const input = await screen.findByRole("textbox", { name: "主播语音文本" });
    await fireEvent.update(input, "这条不要丢");
    await fireEvent.click(screen.getByRole("button", { name: "提交语音" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "提交主播语音失败：local ASR bridge unavailable",
    );
    expect(input).toHaveValue("这条不要丢");
    expect(screen.getAllByText("等待主播语音文本输入。").length).toBeGreaterThan(0);
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
