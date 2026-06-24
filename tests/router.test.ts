import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";
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

function liveAssistConfig() {
  return {
    currentPlanId: "plan-chat",
    plans: [
      {
        id: "plan-chat",
        streamType: "杂谈",
        title: "晚间杂谈与功能演练",
        theme: "测试 AI 观众氛围与控场提词",
        bannedTopics: ["隐私推测", "争议引战"],
        focusTopics: ["冷场救急", "弹幕风格选择"],
        hostState: "想轻松播",
        audienceGroupIds: ["group-support", "group-passerby", "group-rescue"],
        topicCardIds: ["topic-why-nanabigv", "topic-style-choice", "topic-cold-rescue"],
        outputMode: "manual_review",
        updatedAt: "默认方案",
      },
    ],
    audienceGroups: [
      {
        id: "group-support",
        name: "捧哏组",
        color: "#3b82f6",
        enabled: true,
        useCase: "负责接话、缓和气氛和轻量夸赞。",
        frequency: 48,
        averageLength: "短句",
        questionRate: 35,
        praiseRate: 55,
        memeRate: 28,
        roastRate: 8,
        topicRate: 24,
        silenceTriggerRate: 50,
        languageStyles: ["弹幕腔", "克制"],
        boundaryRules: ["禁止攻击主播", "禁止假装真实付费用户"],
        memoryScope: "room_memes",
      },
      {
        id: "group-rescue",
        name: "控场救急组",
        color: "#f59e0b",
        enabled: true,
        useCase: "主播沉默或话题断掉时主动补轻量问题。",
        frequency: 26,
        averageLength: "短句",
        questionRate: 70,
        praiseRate: 18,
        memeRate: 18,
        roastRate: 5,
        topicRate: 58,
        silenceTriggerRate: 82,
        languageStyles: ["克制", "熟人"],
        boundaryRules: ["禁止刷屏", "禁止引战"],
        memoryScope: "last_session",
      },
    ],
    topicCards: [
      {
        id: "topic-why-nanabigv",
        title: "为什么做 NaNaBigV",
        stage: "opening",
        recommendedDanmaku: ["这个工具是给主播自己用的吗？"],
        hostTalkingPoint: "其实最开始是为了解决直播冷场问题。",
        unsuitableContent: ["暗示真实观众被替代"],
        enabled: true,
      },
    ],
    outline: {
      opening: "说明今天会测试 NaNaBigV 的互动节奏。",
      mainContent: "展示弹幕候选、主播提词和安全拦截。",
      interactionPoints: ["问观众喜欢哪种弹幕风格"],
      closing: "总结本场哪些控场建议最有用。",
      forbiddenDetours: ["不要让 AI 假装真实付费用户"],
    },
    memeLibrary: {
      roomMemes: ["今天先低压测试"],
      catchphrases: ["先把节奏稳住"],
      fanNames: ["陪跑员"],
      disabledMemes: ["过度夸奖主播声音"],
      recentMemes: ["别突然刷屏"],
      expiredMemes: [],
    },
    safety: {
      outputMode: "manual_review",
      requireManualConfirmation: true,
      basicRules: ["禁止攻击主播", "禁止伪造付费行为", "禁止假装真实用户经历", "禁止诱导消费"].map((label, index) => ({
        id: `rule-${index}`,
        label,
        enabled: true,
      })),
      qualityFilters: ["重复过滤", "相似句过滤"].map((label, index) => ({
        id: `filter-${index}`,
        label,
        enabled: true,
      })),
      maxGeneratedPerMinute: 8,
      maxConsecutivePerTopic: 3,
    },
    generationRecords: [
      {
        id: "record-default-1",
        happenedAt: "20:41:13",
        content: "刚刚这个地方是不是可以展开讲讲？",
        audienceGroupId: "group-rescue",
        audienceGroupName: "控场救急组",
        triggerReason: "主播沉默 18 秒",
        status: "pending",
        riskTags: ["低风险"],
        similarity: 12,
        userFeedback: "待确认",
      },
      {
        id: "record-default-2",
        happenedAt: "20:39:49",
        content: "我刚充了舰长所以主播必须听我的。",
        audienceGroupId: "group-support",
        audienceGroupName: "捧哏组",
        triggerReason: "高价值互动模拟",
        status: "blocked",
        riskTags: ["伪造付费行为"],
        similarity: 8,
        userFeedback: "安全规则拦截",
      },
    ],
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
    if (command === "load_live_assist_config") return liveAssistConfig();
    if (command === "save_live_assist_config") return payload?.config ?? liveAssistConfig();
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

function savedLiveAssistConfig(): ReturnType<typeof liveAssistConfig> | undefined {
  const call = mockInvoke.mock.calls
    .filter(([command]) => command === "save_live_assist_config")
    .at(-1);
  return (call?.[1] as { config?: ReturnType<typeof liveAssistConfig> } | undefined)?.config;
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

beforeEach(async () => {
  resetProviderSettingsStateForTest();
  mockInvoke.mockReset();
  installInvokeMock();
  const { useLiveAssistConfig } = await import("../src/features/liveConfig/store");
  await useLiveAssistConfig().updateConfig((draft) => {
    Object.assign(draft, liveAssistConfig());
  });
  mockInvoke.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("基础路由", () => {
  it("默认入口跳转到 NaNaBigV 工作台", async () => {
    await renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "NaNaBigV" })).toBeInTheDocument();
    expect(screen.getByText("AI 观众氛围与直播控场助手")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入中控台/ })).toHaveAttribute("href", "/live");
    expect(screen.getByText("状态检查")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
  });

  it("直播中控台展示运行态输入、候选和 blivechat 通道", async () => {
    await renderAt("/live");

    expect(await screen.findByLabelText("自动投递")).toBeInTheDocument();
    expect(screen.getByText("弹幕候选流")).toBeInTheDocument();
    expect(screen.getByText("主播提词")).toBeInTheDocument();
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
    expect(membershipChannel).toHaveTextContent("被节流");
    expect(
      screen.queryByText("糖霜六号 [SC ¥30]：建议下一段切回剧情点评，不要一直卡在设置界面。"),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试")).not.toHaveLength(0);
    expect(screen.getByText(/example\.com\/v1 · 模型 gpt-4\.1-mini · API Key 已配置/)).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith("test_provider_connection", undefined);
  });

  it("直播中控台手动审核候选会写回生成记录并投递采用内容", async () => {
    const { useLiveAssistConfig } = await import("../src/features/liveConfig/store");
    await useLiveAssistConfig().updateConfig((draft) => {
      draft.generationRecords = [
        {
          id: "record-adopt",
          happenedAt: "21:00:01",
          content: "这条可以直接采用",
          audienceGroupId: "group-support",
          audienceGroupName: "捧哏组",
          triggerReason: "测试采用",
          status: "pending",
          riskTags: ["低风险"],
          similarity: 6,
          userFeedback: "待确认",
        },
        {
          id: "record-ignore",
          happenedAt: "21:00:02",
          content: "这条需要忽略",
          audienceGroupId: "group-support",
          audienceGroupName: "捧哏组",
          triggerReason: "测试忽略",
          status: "pending",
          riskTags: ["低风险"],
          similarity: 8,
          userFeedback: "待确认",
        },
        {
          id: "record-rewrite",
          happenedAt: "21:00:03",
          content: "这条需要改写",
          audienceGroupId: "group-rescue",
          audienceGroupName: "控场救急组",
          triggerReason: "测试改写",
          status: "pending",
          riskTags: ["低风险"],
          similarity: 11,
          userFeedback: "待确认",
        },
      ];
    });

    const view = await renderAt("/live");

    await fireEvent.click(screen.getAllByRole("button", { name: "采用" })[0]);
    await waitFor(() => {
      expect(savedLiveAssistConfig()?.generationRecords.find((record) => record.id === "record-adopt")).toMatchObject({
        status: "adopted",
        userFeedback: "手动采用并投递",
      });
    });
    expect(await screen.findByText("这条可以直接采用")).toBeInTheDocument();

    await fireEvent.click(screen.getAllByRole("button", { name: "忽略" })[0]);
    await waitFor(() => {
      expect(savedLiveAssistConfig()?.generationRecords.find((record) => record.id === "record-ignore")).toMatchObject({
        status: "ignored",
        userFeedback: "手动忽略",
      });
    });

    await fireEvent.update(screen.getByRole("textbox", { name: "改写弹幕：这条需要改写" }), "改写后可以投递");
    await fireEvent.click(screen.getByRole("button", { name: "改写" }));
    await waitFor(() => {
      expect(savedLiveAssistConfig()?.generationRecords.find((record) => record.id === "record-rewrite")).toMatchObject({
        content: "改写后可以投递",
        status: "rewritten",
        userFeedback: "手动改写并投递",
      });
    });

    await view.router.push("/danmaku-records");

    expect(await screen.findByText("手动采用并投递")).toBeInTheDocument();
    expect(screen.getByText("手动忽略")).toBeInTheDocument();
    expect(screen.getAllByText("改写后可以投递").length).toBeGreaterThan(0);
    expect(screen.getByText("手动改写并投递")).toBeInTheDocument();
  });

  it("侧边栏显示 MVP 功能标签，底部保留设置和状态入口", async () => {
    await renderAt("/");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "直播中控台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新建直播" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI 观众" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "话题库" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "安全设置" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "弹幕记录" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "新建" })).toBeNull();
    expect(screen.queryByRole("button", { name: "搜索" })).toBeNull();
    expect(screen.queryByRole("button", { name: "添加" })).toBeNull();
    expect(screen.queryByRole("link", { name: "扩展" })).toBeNull();
    expect(await screen.findByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试").length).toBeGreaterThan(0);
  });

  it("Provider 手动探活成功后工作台和侧栏展示真实结果", async () => {
    const view = await renderAt("/settings?tab=provider");

    await screen.findByDisplayValue(loadedProviderConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Provider 连通性测试通过");

    await view.router.push("/live");

    expect((await screen.findAllByText("可用")).length).toBeGreaterThan(0);
    expect(screen.getByText("182ms")).toBeInTheDocument();
    expect(screen.getByText(/最近测试 .*模型 gpt-4\.1-mini，耗时 182ms/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /模拟状态：自动投递运行中 .*example\.com\/v1/ })).toHaveClass("sb-conn--ok");
  });

  it("Provider 手动探活失败后工作台和侧栏展示错误态", async () => {
    installInvokeMock({ test_provider_connection: failureProbe() });
    const view = await renderAt("/settings?tab=provider");

    await screen.findByDisplayValue(loadedProviderConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("provider 返回 HTTP 401");

    await view.router.push("/live");

    expect(await screen.findAllByText("异常")).not.toHaveLength(0);
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

  it("直播中控台开关只切换本地状态", async () => {
    await renderAt("/live");

    const toggle = await screen.findByRole("checkbox", { name: "自动投递" });

    expect(toggle).toBeChecked();
    await fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getAllByText("通道关闭或自动投递暂停").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Provider 待测试/ })).toHaveClass("sb-conn--warn");
    expect(screen.getAllByText("待测试").length).toBeGreaterThan(0);
    expect(localStorage.getItem("nanabigv.workbench")).toContain("\"key\":\"dispatch\"");
    expect(localStorage.getItem("nanabigv.workbench")).toContain("\"enabled\":false");
  });

  it("直播中控台可提交主播语音文本并刷新上下文窗口", async () => {
    await renderAt("/live");

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

  it("直播中控台可连接 Echo-Live 并提交收到的文本", async () => {
    const sockets: MockWebSocket[] = [];
    const MockWebSocketConstructor = function (this: unknown, url: string) {
      const socket = new MockWebSocket(url);
      sockets.push(socket);
      return socket;
    };
    Reflect.set(MockWebSocketConstructor, "OPEN", 1);
    vi.stubGlobal("WebSocket", MockWebSocketConstructor);
    await renderAt("/live");

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

  it("直播中控台展示 Echo-Live 提交失败诊断", async () => {
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
    await renderAt("/live");

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

  it("直播中控台可清空上下文窗口回到待输入状态", async () => {
    await renderAt("/live");

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
    await renderAt("/live");

    const input = await screen.findByRole("textbox", { name: "主播语音文本" });
    await fireEvent.update(input, "这条不要丢");
    await fireEvent.click(screen.getByRole("button", { name: "提交语音" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "提交主播语音失败：local ASR bridge unavailable",
    );
    expect(input).toHaveValue("这条不要丢");
    expect(screen.getAllByText("等待主播语音或 Echo-Live 文本输入。").length).toBeGreaterThan(0);
  });

  it("新建直播向导保存当前方案并进入中控台", async () => {
    await renderAt("/setup");

    expect(await screen.findByRole("heading", { level: 1, name: "新建直播辅助" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    await fireEvent.update(screen.getByLabelText("直播标题"), "测试直播方案");
    await fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    await fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    await fireEvent.click(screen.getByRole("button", { name: "开始直播辅助" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "save_live_assist_config",
        expect.objectContaining({
          config: expect.objectContaining({ currentPlanId: expect.stringMatching(/^plan-/) }),
        }),
      );
    });
    expect(await screen.findByText("直播辅助中")).toBeInTheDocument();
  });

  it("AI 观众页可编辑观众组并保存到 Tauri 配置", async () => {
    await renderAt("/audience-groups");

    expect(await screen.findByRole("heading", { level: 1, name: "AI 观众" })).toBeInTheDocument();
    const nameInput = screen.getByLabelText("名称");
    await fireEvent.update(nameInput, "捧哏加强组");
    await fireEvent.click(screen.getByRole("button", { name: "保存观众组" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "save_live_assist_config",
        expect.objectContaining({
          config: expect.objectContaining({
            audienceGroups: expect.arrayContaining([
              expect.objectContaining({ name: "捧哏加强组" }),
            ]),
          }),
        }),
      );
    });
  });

  it("话题库、安全设置和弹幕记录读取同一份直播辅助配置", async () => {
    const view = await renderAt("/topics");

    expect(await screen.findByRole("heading", { level: 1, name: "话题库" })).toBeInTheDocument();
    expect(screen.getAllByText("为什么做 NaNaBigV").length).toBeGreaterThan(0);

    await view.router.push("/safety");
    expect(await screen.findByRole("heading", { level: 1, name: "安全设置" })).toBeInTheDocument();
    expect(screen.getByText("禁止伪造付费行为")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /仅提词/ }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "save_live_assist_config",
        expect.objectContaining({
          config: expect.objectContaining({
            safety: expect.objectContaining({ outputMode: "prompt_only" }),
          }),
        }),
      );
    });

    await view.router.push("/danmaku-records");
    expect(await screen.findByRole("heading", { level: 1, name: "弹幕记录" })).toBeInTheDocument();
    expect(screen.getByText("刚刚这个地方是不是可以展开讲讲？")).toBeInTheDocument();
    expect(screen.getByText("我刚充了舰长所以主播必须听我的。")).toBeInTheDocument();
  });

  it("旧路由兼容重定向到 MVP 页面", async () => {
    const view = await renderAt("/danmaku");
    expect(view.router.currentRoute.value.fullPath).toBe("/live");

    await view.router.push("/audience");
    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/audience-groups");
    });

    await view.router.push("/quota");
    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/settings?tab=provider");
    });

    await view.router.push("/review");
    await waitFor(() => {
      expect(view.router.currentRoute.value.fullPath).toBe("/danmaku-records");
    });
  });

  it("未知路由回到工作台", async () => {
    await renderAt("/missing");

    expect(await screen.findByRole("heading", { level: 1, name: "NaNaBigV" })).toBeInTheDocument();
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
