import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { createMemorySnapshot } from "./memoryFixtures";

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

vi.mock("vue-chartjs", async () => {
  const vue = await vi.importActual<typeof import("vue")>("vue");
  const chartComponent = (name: string) =>
    vue.defineComponent({
      name,
      props: {
        data: {
          type: Object,
          required: true,
        },
        options: {
          type: Object,
          required: true,
        },
      },
      setup(props) {
        return () => {
          const data = props.data as {
            labels?: unknown[];
            datasets?: Array<{ label?: string; data?: unknown[]; yAxisID?: string }>;
          };
          return vue.h("div", {
            "data-testid": `mock-${name}-chart`,
            "data-chart-labels": JSON.stringify(data.labels ?? []),
            "data-chart-values": JSON.stringify(data.datasets?.[0]?.data ?? []),
            "data-chart-series": JSON.stringify(
              data.datasets?.map((dataset) => ({
                label: dataset.label,
                values: dataset.data ?? [],
                yAxisID: dataset.yAxisID ?? "y",
              })) ?? [],
            ),
          });
        };
      },
    });

  return {
    Line: chartComponent("line"),
  };
});

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
      statusLabel: "未连接",
      tone: "info",
      summary: "等待 Echo-Live WebSocket 文本输入。",
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

function echoLiveContextWindow(content: string) {
  return {
    ...emptyContextWindow,
    events: [
      {
        id: "ctx-echo-live-1",
        source: "echo_live",
        content,
        summary: content,
        occurredAt: 1_800_000_001_000,
        receivedAt: 1_800_000_001_000,
        status: "accepted",
      },
    ],
    sourceStatuses: [
      emptyContextWindow.sourceStatuses[0],
      {
        source: "echo_live",
        label: "Echo-Live",
        statusLabel: "在线",
        tone: "ok",
        summary: "最近 60 秒内收到 Echo-Live 文本，当前窗口有 1 条输入。",
        lastEventAt: 1_800_000_001_000,
        eventCount: 1,
      },
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
    if (command === "load_memory_snapshot") return createMemorySnapshot();
    if (command === "submit_context_event") {
      const event = payload?.event as { content?: string; source?: string } | undefined;
      return event?.source === "echo_live"
        ? echoLiveContextWindow(event?.content ?? "")
        : voiceContextWindow(event?.content ?? "");
    }
    if (command === "clear_context_window") return emptyContextWindow;
    throw new Error(`unexpected command: ${command}`);
  });
}

async function renderAt(path: string) {
  const { useWorkbenchStore } = await import("../src/features/workbench/store");
  await useWorkbenchStore().refreshMemorySnapshot();
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("基础路由", () => {
  it("默认首页跳转到弹幕姬工作台", async () => {
    await renderAt("/");

    expect(await screen.findByLabelText("自动投递")).toBeInTheDocument();
    expect(screen.getByText("把调试段落拆成“目标 -> 过程 -> 结论”三段")).toBeInTheDocument();
    const danmakuChannel = await screen.findByRole("region", { name: "blivechat 弹幕通道" });
    const giftChannel = screen.getByRole("region", { name: "blivechat 礼物通道" });
    const superChatChannel = screen.getByRole("region", { name: "blivechat SC通道" });
    const membershipChannel = screen.getByRole("region", { name: "blivechat 舰长通道" });
    expect(danmakuChannel).toHaveTextContent("阿黎：这一段反应好快，像是真的在跟弹幕对线。");
    expect(giftChannel).toHaveTextContent("北街舟");
    expect(giftChannel).toHaveTextContent("送出荧光棒 x2，配合主播刚提到的新梗。 · ¥20");
    expect(superChatChannel).toHaveTextContent("糖霜六号");
    expect(superChatChannel).toHaveTextContent("¥30");
    expect(superChatChannel).toHaveTextContent("建议下一段切回剧情点评，不要一直卡在设置界面。");
    expect(superChatChannel).toHaveTextContent("通道关闭或自动投递暂停");
    expect(membershipChannel).toHaveTextContent("镜岛");
    expect(membershipChannel).toHaveTextContent("排队中");
    expect(
      screen.queryByText("糖霜六号 [SC ¥30]：建议下一段切回剧情点评，不要一直卡在设置界面。"),
    ).not.toBeInTheDocument();
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
    expect(screen.getAllByText("通道关闭或自动投递暂停").length).toBeGreaterThan(0);
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

  it("弹幕姬页可连接 Echo-Live 并提交收到的文本", async () => {
    const sockets: MockWebSocket[] = [];
    const MockWebSocketConstructor = function (this: unknown, url: string) {
      const socket = new MockWebSocket(url);
      sockets.push(socket);
      return socket;
    };
    Reflect.set(MockWebSocketConstructor, "OPEN", 1);
    vi.stubGlobal("WebSocket", MockWebSocketConstructor);
    await renderAt("/danmaku");

    await fireEvent.click(await screen.findByRole("button", { name: "连接" }));
    expect(sockets[0]?.url).toBe("ws://127.0.0.1:3000");

    sockets[0].open();
    expect((await screen.findAllByText("已连接")).length).toBeGreaterThan(0);
    expect(sockets[0].sent).toEqual([JSON.stringify({ action: "hello" })]);

    sockets[0].message("not-json");
    expect(await screen.findAllByText(/收到无法解析的 JSON 消息/)).not.toHaveLength(0);

    sockets[0].message(JSON.stringify({ action: "room_update" }));
    expect(await screen.findAllByText(/非 message_data 消息：room_update/)).not.toHaveLength(0);
    expect(screen.getAllByText(/共 2 次|累计 2 次/).length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole("button", { name: "观测详情" }));
    expect(await screen.findByText("Echo-Live 丢弃消息")).toBeInTheDocument();
    expect(screen.getByText("丢弃 2")).toBeInTheDocument();

    sockets[0].message(
      JSON.stringify({
        action: "message_data",
        data: {
          username: "Echo",
          messages: [{ message: "外部文本进入上下文" }],
        },
      }),
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("submit_context_event", {
        event: {
          source: "echo_live",
          content: "Echo：外部文本进入上下文",
          summary: "Echo：外部文本进入上下文",
        },
      });
    });
    expect((await screen.findAllByText("Echo：外部文本进入上下文")).length).toBeGreaterThan(0);
  });

  it("弹幕姬页展示 Echo-Live 提交失败诊断", async () => {
    installInvokeMock({
      submit_context_event: new Error("context submit failed"),
    });
    const sockets: MockWebSocket[] = [];
    const MockWebSocketConstructor = function (this: unknown, url: string) {
      const socket = new MockWebSocket(url);
      sockets.push(socket);
      return socket;
    };
    Reflect.set(MockWebSocketConstructor, "OPEN", 1);
    vi.stubGlobal("WebSocket", MockWebSocketConstructor);
    await renderAt("/danmaku");

    const initialConnectionButton = await screen.findByRole("button", { name: /连接|断开/ });
    if (initialConnectionButton.textContent?.includes("断开")) {
      await fireEvent.click(initialConnectionButton);
    }
    await fireEvent.click(await screen.findByRole("button", { name: "连接" }));
    sockets[0].open();
    sockets[0].message(
      JSON.stringify({
        action: "message_data",
        data: {
          username: "Echo",
          messages: [{ message: "这条会提交失败" }],
        },
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "提交 Echo-Live 文本失败：context submit failed",
    );
    expect(await screen.findAllByText(/提交失败：提交 Echo-Live 文本失败：context submit failed/)).not.toHaveLength(0);

    await fireEvent.click(screen.getByRole("button", { name: "观测详情" }));
    expect(await screen.findByText("Echo-Live 提交失败")).toBeInTheDocument();
    expect(screen.getAllByText(/失败 [1-9]/).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText("等待主播语音或 Echo-Live 文本输入。").length).toBeGreaterThan(0);
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
    expect(screen.getAllByText("等待主播语音或 Echo-Live 文本输入。").length).toBeGreaterThan(0);
  });

  it("额度检查页支持切换时间窗", async () => {
    const view = await renderAt("/quota");

    expect(await screen.findByText("24 小时趋势")).toBeInTheDocument();
    expect(screen.getByText("请求")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "24 小时 token 使用趋势" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "模型统计" })).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1-mini")).toBeInTheDocument();
    expect(screen.getByText("214,000")).toBeInTheDocument();
    expect(view.container.querySelector("[data-testid='mock-pie-chart']")).not.toBeInTheDocument();
    expect(view.container.querySelector("[data-testid='mock-line-chart']")).toHaveAttribute(
      "data-chart-labels",
      JSON.stringify(["00", "04", "08", "12", "16", "20"]),
    );
    expect(view.container.querySelector("[data-testid='mock-line-chart']")).toHaveAttribute(
      "data-chart-series",
      JSON.stringify([
        { label: "输入", values: [22400, 18800, 49200, 64200, 74500, 89300], yAxisID: "y" },
        { label: "输出", values: [6400, 5400, 12600, 16300, 21600, 30300], yAxisID: "y" },
        { label: "失败重试", values: [1200, 900, 2400, 3500, 4400, 5840], yAxisID: "y" },
        { label: "成本", values: [2.64, 2.18, 5.78, 7.42, 9.24, 11.46], yAxisID: "cost" },
      ]),
    );

    await fireEvent.click(screen.getByRole("button", { name: "能力统计" }));
    expect(await screen.findByRole("table", { name: "能力统计" })).toBeInTheDocument();
    expect(screen.getByText("互动生成")).toBeInTheDocument();
    expect(screen.getByText("196,000")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "子系统统计" }));
    expect(await screen.findByRole("table", { name: "子系统统计" })).toBeInTheDocument();
    expect(screen.getByText("Provider 请求")).toBeInTheDocument();
    expect(screen.getByText("峰值每小时 18 次")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "7 天" }));

    expect(await screen.findByText("7 天趋势")).toBeInTheDocument();
    await waitFor(() => {
      expect(view.container.querySelector("[data-testid='mock-line-chart']")).toHaveAttribute(
        "data-chart-labels",
        JSON.stringify(["周一", "周二", "周三", "周四", "周五", "周六", "周日"]),
      );
    });
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

  it("观众信息和直播回顾页读取 MemoryStore 快照而不是 mockSnapshot 占位", async () => {
    const baseMemorySnapshot = createMemorySnapshot();
    const memorySnapshot = createMemorySnapshot({
      hostProfile: {
        ...baseMemorySnapshot.hostProfile,
        streamerName: "主播：MemoryStore 测试",
      },
      audienceProfiles: [
        {
          ...baseMemorySnapshot.audienceProfiles[0],
          id: "memory-store-audience",
          name: "记忆层观众",
          summary: "来自真实 MemoryStore 快照的观众画像。",
          memories: [
            {
              id: "memory-store-record",
              layer: "audience_profile",
              summary: "这条记忆只存在于测试 MemoryStore 快照。",
              confidence: "高置信",
              updatedAt: "刚刚",
              audienceId: "memory-store-audience",
            },
          ],
        },
        baseMemorySnapshot.audienceProfiles[1],
      ],
      suggestions: [
        {
          id: "memory-store-suggestion",
          category: "记忆策略",
          title: "来自 MemoryStore 的建议",
          detail: "测试页面数据来源。",
          priority: "高优先级",
        },
      ],
      writeRecords: [
        {
          id: "write-accepted",
          layer: "audience_profile",
          status: "accepted",
          summary: "阿黎在调试段落会主动起梗。",
          reason: "重复出现且与既有画像一致，写入观众画像。",
          updatedAt: "刚刚",
          audienceId: "memory-store-audience",
          riskFlags: [],
        },
        {
          id: "write-quarantined",
          layer: "long_term_fact",
          status: "quarantined",
          summary: "北街舟可能不喜欢节奏拉扯。",
          reason: "单场观察不足，进入隔离区等待后续验证。",
          updatedAt: "2 分钟前",
          audienceId: "bei-jie-zhou",
          riskFlags: ["单场观察", "画像漂移"],
        },
        {
          id: "write-rejected",
          layer: "host_profile",
          status: "rejected",
          summary: "主播应该改成高压催促风格。",
          reason: "与主播设定冲突，拒绝写入。",
          updatedAt: "3 分钟前",
          riskFlags: ["设定冲突"],
          conflictWith: "host-memory-1",
        },
      ],
    });
    installInvokeMock({ load_memory_snapshot: memorySnapshot });

    const view = await renderAt("/audience");

    expect(await screen.findByRole("heading", { level: 2, name: "记忆层观众" })).toBeInTheDocument();
    expect(screen.getByText("这条记忆只存在于测试 MemoryStore 快照。")).toBeInTheDocument();

    await view.router.push("/review");

    expect(await screen.findByText("主播：MemoryStore 测试")).toBeInTheDocument();
    expect(screen.getByText("来自 MemoryStore 的建议")).toBeInTheDocument();
    const writeStats = screen.getByLabelText("记忆写回状态统计");
    expect(writeStats).toHaveTextContent("accepted1");
    expect(writeStats).toHaveTextContent("quarantined1");
    expect(writeStats).toHaveTextContent("rejected1");
    expect(screen.getByText("阿黎在调试段落会主动起梗。")).toBeInTheDocument();
    expect(screen.getAllByText("accepted").length).toBeGreaterThan(0);
    expect(screen.getByText("重复出现且与既有画像一致，写入观众画像。")).toBeInTheDocument();
    expect(screen.getByText("记忆层观众")).toBeInTheDocument();
    expect(screen.getAllByText("quarantined").length).toBeGreaterThan(0);
    expect(screen.getByText("单场观察不足，进入隔离区等待后续验证。")).toBeInTheDocument();
    expect(screen.getByText("北街舟")).toBeInTheDocument();
    expect(screen.getByText("画像漂移")).toBeInTheDocument();
    expect(screen.getAllByText("rejected").length).toBeGreaterThan(0);
    expect(screen.getByText("与主播设定冲突，拒绝写入。")).toBeInTheDocument();
    expect(screen.getByText("未绑定观众")).toBeInTheDocument();
    expect(screen.getByText("冲突：host-memory-1")).toBeInTheDocument();
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

class MockWebSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  message(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}
