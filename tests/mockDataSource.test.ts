import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextEventInput, ContextWindowSnapshot } from "../src/features/context/types";
import { createLocalBlivechatQueue } from "../src/features/workbench/eventRuntime";
import {
  MOCK_SOURCE_INTERVAL_MS,
  isMockInteractionDeliverable,
  WorkbenchMockDataSource,
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
      interactionLabels: ["弹幕"],
      statusLabel: "已触发",
    });
    expect(runtime.queue.snapshot().stats.find((stat) => stat.type === "danmaku")).toMatchObject({
      delivered: 1,
      throttled: 0,
    });
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

  it("uses runtime toggles to throttle dispatch, gift, and super chat channels", async () => {
    const dispatchRuntime = createRuntime(withToggle("dispatch", false));
    dispatchRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS);
    dispatchRuntime.source.pause();
    expect(dispatchRuntime.queue.snapshot().stats.find((stat) => stat.type === "danmaku")).toMatchObject({
      delivered: 0,
      throttled: 1,
    });

    const giftRuntime = createRuntime(withToggle("gifts", false));
    giftRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 2);
    giftRuntime.source.pause();
    expect(giftRuntime.queue.snapshot().stats.find((stat) => stat.type === "gift")).toMatchObject({
      delivered: 0,
      throttled: 1,
    });

    const superChatRuntime = createRuntime(withToggle("super-chat", false));
    superChatRuntime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 3);
    superChatRuntime.source.pause();
    expect(superChatRuntime.queue.snapshot().stats.find((stat) => stat.type === "super_chat")).toMatchObject({
      delivered: 0,
      throttled: 1,
    });
  });

  it("submits reserved context sources without adding them to context events", async () => {
    const runtime = createRuntime();

    runtime.source.start();
    await vi.advanceTimersByTimeAsync(MOCK_SOURCE_INTERVAL_MS * 3);
    runtime.source.pause();

    expect(runtime.submitted.map((event) => event.source)).toEqual(["voice", "echo_live", "vision"]);
    expect(runtime.contextWindow.events).toHaveLength(1);
    expect(runtime.contextWindow.events[0]).toMatchObject({
      source: "voice",
      summary: "主播说明今晚流程",
    });
    expect(runtime.records[0].contextLabels).toEqual(["视觉上下文 预留未写入窗口"]);
    expect(runtime.records[1].contextLabels).toEqual(["Echo-Live 预留未写入窗口"]);
  });
});

function createRuntime(toggles: RuntimeToggleState[] = defaultToggles()) {
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

  const source = new WorkbenchMockDataSource({
    queue,
    async submitContextEvent(event) {
      submitted.push(event);
      if (event.source === "voice") {
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
}
