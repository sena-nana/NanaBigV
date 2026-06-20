import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextEventInput, ContextWindowSnapshot } from "../src/features/context/types";
import type { ProviderError } from "../src/features/provider/types";
import type { AudienceProviderBatchGenerationResult } from "../src/features/workbench/audienceGeneration";
import type { AudienceBatchGenerationRequest } from "../src/features/workbench/audiencePlanner";
import { createLocalBlivechatQueue } from "../src/features/workbench/eventRuntime";
import {
  MOCK_SOURCE_INTERVAL_MS,
  isMockInteractionDeliverable,
  WorkbenchMockDataSource,
  type WorkbenchMockPlanTrace,
} from "../src/features/workbench/mockDataSource";
import type {
  MockSourceRecord,
  MockSourceStatus,
  RuntimeToggleState,
} from "../src/features/workbench/types";

describe("workbench mock data source", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T12:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts and triggers frames on the configured interval", async () => {
    const runtime = createRuntime();

    runtime.source.start();
    expect(runtime.status.state).toBe("running");
    expect(runtime.status.tickCount).toBe(0);

    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS);

    expect(runtime.status.tickCount).toBe(1);
    expect(runtime.records[0]).toMatchObject({
      frameLabel: "开场反馈",
      contextLabels: ["主播语音"],
      statusLabel: "已触发",
    });
    expect(runtime.records[0].interactionLabels.length).toBeGreaterThan(0);
    expect(deliveredCount(runtime.queue.snapshot().stats)).toBeGreaterThan(0);
    expect(runtime.simulationStatus.plannedIntentCount).toBeGreaterThan(0);
    expect(runtime.simulationStatus.shadowAudienceCount).toBe(240);
    expect(runtime.planTraces[0]).toMatchObject({
      frameLabel: "开场反馈",
    });
    expect(runtime.planTraces[0].generatedEvents.length).toBeGreaterThan(0);
    runtime.source.pause();
  });

  it("stops interval ticks after pause", async () => {
    const runtime = createRuntime();

    runtime.source.start();
    runtime.source.pause();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 2);

    expect(runtime.status.state).toBe("paused");
    expect(runtime.status.tickCount).toBe(0);
    expect(runtime.queue.snapshot().records).toEqual([]);
  });

  it("uses runtime toggles to throttle disabled dispatch channels", async () => {
    const dispatchRuntime = createRuntime(withToggle("dispatch", false));
    dispatchRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS);
    dispatchRuntime.source.pause();
    const stats = dispatchRuntime.queue.snapshot().stats;
    expect(deliveredCount(stats)).toBe(0);
    expect(throttledCount(stats)).toBeGreaterThan(0);
  });

  it("submits Echo-Live context while keeping vision reserved", async () => {
    const runtime = createRuntime();

    runtime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 3);
    runtime.source.pause();

    expect(runtime.submitted.map((event) => event.source)).toEqual(["voice", "echo_live", "vision"]);
    expect(runtime.contextWindow.events).toHaveLength(2);
    expect(runtime.contextWindow.events[0]).toMatchObject({
      source: "echo_live",
      summary: "外部场控提示隐藏路线",
    });
    expect(runtime.contextWindow.events[1]).toMatchObject({
      source: "voice",
      summary: "主播说明今晚流程",
    });
    expect(runtime.records[0].contextLabels).toEqual(["视觉上下文 预留未写入窗口"]);
    expect(runtime.records[1].contextLabels).toEqual(["Echo-Live"]);
  });

  it("uses provider generation when available and falls back locally on provider errors", async () => {
    const providerRuntime = createRuntime(defaultToggles(), async (request) => ({
      ok: true,
      events: [
        {
          type: request.intents[0].interactionType,
          audienceName: request.intents[0].audienceName,
          content: "provider 生成内容",
        },
      ],
      latencyMs: 88,
      model: "gpt-4.1-mini",
    }));
    providerRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 6);
    providerRuntime.source.pause();

    const providerTrace = providerRuntime.planTraces.find(
      (trace) => trace.generationSource === "provider",
    );
    expect(providerTrace).toMatchObject({
      generationSource: "provider",
      providerLatencyMs: 88,
      providerModel: "gpt-4.1-mini",
    });
    expect(
      providerRuntime.queue.snapshot().records.some(
        (record) => record.event.content === "provider 生成内容",
      ),
    ).toBe(true);

    const providerError: ProviderError = {
      kind: "http_status",
      message: "provider 返回 HTTP 401",
      statusCode: 401,
    };
    const fallbackRuntime = createRuntime(defaultToggles(), async () => ({
      ok: false,
      error: providerError,
    }));
    fallbackRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 6);
    fallbackRuntime.source.pause();

    const fallbackTrace = fallbackRuntime.planTraces.find(
      (trace) => trace.generationSource === "local_fallback" && trace.generationError,
    );
    expect(fallbackTrace).toMatchObject({
      generationSource: "local_fallback",
      generationError: providerError,
    });
    expect(fallbackTrace?.generatedEvents[0].content).not.toBe("provider 生成内容");
    expect(deliveredCount(fallbackRuntime.queue.snapshot().stats)).toBeGreaterThan(0);
  });

});

function createRuntime(
  toggles: RuntimeToggleState[] = defaultToggles(),
  generateAudienceBatch?: (
    request: AudienceBatchGenerationRequest,
  ) => Promise<AudienceProviderBatchGenerationResult>,
) {
  const queue = createLocalBlivechatQueue(() => Date.now());
  const submitted: ContextEventInput[] = [];
  let contextWindow: ContextWindowSnapshot = emptyContextWindow();
  let status: MockSourceStatus = {
    state: "idle",
    scenarioLabel: "本地直播循环",
    tickCount: 0,
    intervalMs: MOCK_SOURCE_INTERVAL_MS,
  };
  let records: MockSourceRecord[] = [];
  let planTraces: WorkbenchMockPlanTrace[] = [];
  let simulationStatus = {
    rhythmState: "cold",
    rhythmLabel: "冷场观察",
    activeAudienceCount: 0,
    plannedIntentCount: 0,
    llmBatchCallCount: 0,
    localGeneratedCount: 0,
    cooldownRejectCount: 0,
    throttleRejectCount: 0,
    budgetRejectCount: 0,
    memoryAudienceCount: 0,
    shadowAudienceCount: 0,
  };

  const source = new WorkbenchMockDataSource({
    queue,
    async submitContextEvent(event) {
      submitted.push(event);
      if (event.source !== "vision") {
        contextWindow = {
          ...contextWindow,
          events: [
            {
              id: `ctx-${submitted.length}`,
              source: event.source,
              content: event.content,
              summary: event.summary ?? event.content,
              occurredAt: event.occurredAt ?? Date.now(),
              receivedAt: Date.now(),
              confidence: event.confidence,
              status: "accepted",
            },
            ...contextWindow.events,
          ],
        };
      }
      return contextWindow;
    },
    updateContextWindow(next) {
      contextWindow = next;
    },
    canDeliverInteraction(type) {
      return isMockInteractionDeliverable(type, toggles);
    },
    onChange(nextStatus, nextRecords) {
      status = nextStatus;
      records = nextRecords;
    },
    onSimulationStatusChange(nextStatus) {
      simulationStatus = nextStatus;
    },
    onPlanTrace(trace) {
      planTraces = [trace, ...planTraces];
    },
    generateAudienceBatch,
    now: () => Date.now(),
  });

  return {
    queue,
    source,
    submitted,
    get contextWindow() {
      return contextWindow;
    },
    get status() {
      return status;
    },
    get records() {
      return records;
    },
    get planTraces() {
      return planTraces;
    },
    get simulationStatus() {
      return simulationStatus;
    },
  };
}

function defaultToggles(): RuntimeToggleState[] {
  return [
    { key: "dispatch", label: "自动投递", description: "", enabled: true },
    { key: "gifts", label: "礼物通道", description: "", enabled: true },
    { key: "super-chat", label: "SC 通道", description: "", enabled: true },
  ];
}

function withToggle(key: string, enabled: boolean) {
  return defaultToggles().map((toggle) =>
    toggle.key === key ? { ...toggle, enabled } : toggle,
  );
}

function deliveredCount(stats: Array<{ delivered: number }>) {
  return stats.reduce((total, stat) => total + stat.delivered, 0);
}

function throttledCount(stats: Array<{ throttled: number }>) {
  return stats.reduce((total, stat) => total + stat.throttled, 0);
}

function emptyContextWindow(): ContextWindowSnapshot {
  return {
    windowStartedAt: Date.now() - 300_000,
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
}
