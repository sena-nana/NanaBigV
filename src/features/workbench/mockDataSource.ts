import type { ContextEventInput, ContextSourceKind, ContextWindowSnapshot } from "../context/types";
import type { BlivechatEventInput, BlivechatEventQueue } from "./eventRuntime";
import type {
  InteractionType,
  MockSourceRecord,
  MockSourceStatus,
  RuntimeToggleState,
  StatusTone,
} from "./types";

export const MOCK_SOURCE_INTERVAL_MS = 2_500;

interface MockDataFrame {
  id: string;
  label: string;
  contextEvents: ContextEventInput[];
  interactionEvents: BlivechatEventInput[];
}

interface MockDataScenario {
  id: string;
  label: string;
  frames: MockDataFrame[];
}

interface WorkbenchMockDataSourceOptions {
  queue: BlivechatEventQueue;
  submitContextEvent: (event: ContextEventInput) => Promise<ContextWindowSnapshot>;
  updateContextWindow: (snapshot: ContextWindowSnapshot) => void;
  canDeliverInteraction: (type: InteractionType) => boolean;
  onChange: (status: MockSourceStatus, records: MockSourceRecord[]) => void;
  now?: () => number;
}

const SOURCE_LABELS: Record<ContextSourceKind, string> = {
  voice: "主播语音",
  echo_live: "Echo-Live",
  vision: "视觉上下文",
};

const INTERACTION_LABELS: Record<InteractionType, string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

const DEFAULT_SCENARIO: MockDataScenario = {
  id: "local-live-loop",
  label: "本地直播循环",
  frames: [
    {
      id: "opening-reaction",
      label: "开场反馈",
      contextEvents: [
        {
          source: "voice",
          content: "主播刚说明今天会先试玩新关卡，再回头看观众建议。",
          summary: "主播说明今晚流程",
          confidence: 0.94,
        },
      ],
      interactionEvents: [
        {
          type: "danmaku",
          audienceName: "阿黎",
          content: "这个开场节奏挺稳，可以先把新关卡机制讲清楚。",
        },
      ],
    },
    {
      id: "echo-live-pulse",
      label: "Echo-Live 预留输入",
      contextEvents: [
        {
          source: "echo_live",
          content: "Echo-Live 捕获到外部场控提示：当前评论区集中讨论隐藏路线。",
          summary: "外部场控提示隐藏路线",
          confidence: 0.82,
        },
      ],
      interactionEvents: [
        {
          type: "gift",
          audienceName: "北街舟",
          content: "送出荧光棒 x2，想看主播试隐藏路线。",
          amountLabel: "¥20",
        },
      ],
    },
    {
      id: "vision-pulse",
      label: "视觉上下文预留输入",
      contextEvents: [
        {
          source: "vision",
          content: "视觉摘要：画面停留在角色装备页，主播正在对比两套配置。",
          summary: "画面处于装备对比",
          confidence: 0.76,
        },
      ],
      interactionEvents: [
        {
          type: "super_chat",
          audienceName: "糖霜六号",
          content: "建议下一段切回剧情点评，不要一直卡在设置界面。",
          amountLabel: "¥30",
        },
      ],
    },
    {
      id: "membership-entry",
      label: "舰长入场",
      contextEvents: [
        {
          source: "voice",
          content: "主播回应弹幕说会先打一局完整流程，再整理刚才的路线建议。",
          summary: "主播承诺先打一局完整流程",
          confidence: 0.91,
        },
      ],
      interactionEvents: [
        {
          type: "membership",
          audienceName: "镜岛",
          content: "触发舰长入场欢迎，等待本地投递队列放行。",
        },
      ],
    },
  ],
};

export function createInitialMockSourceStatus(): MockSourceStatus {
  return {
    state: "idle",
    scenarioLabel: DEFAULT_SCENARIO.label,
    tickCount: 0,
    intervalMs: MOCK_SOURCE_INTERVAL_MS,
  };
}

export function isMockInteractionDeliverable(type: InteractionType, toggles: RuntimeToggleState[]) {
  const dispatchEnabled = findToggleEnabled(toggles, "dispatch");
  if (!dispatchEnabled) return false;
  if ((type === "gift" || type === "membership") && !findToggleEnabled(toggles, "gifts")) {
    return false;
  }
  return type !== "super_chat" || findToggleEnabled(toggles, "super-chat");
}

export class WorkbenchMockDataSource {
  private readonly scenario = DEFAULT_SCENARIO;
  private status = createInitialMockSourceStatus();
  private records: MockSourceRecord[] = [];
  private timer: number | null = null;
  private frameIndex = 0;
  private nextRecordSeq = 0;
  private contextInFlight = false;

  constructor(private readonly options: WorkbenchMockDataSourceOptions) {}

  start() {
    if (this.timer !== null) return;
    this.status = { ...this.status, state: "running", error: undefined };
    this.timer = window.setInterval(() => {
      void this.runNextFrame();
    }, this.status.intervalMs);
    this.notify();
  }

  pause() {
    this.clearTimer();
    this.status = { ...this.status, state: "paused" };
    this.notify();
  }

  async step() {
    await this.runNextFrame();
  }

  reset() {
    this.clearTimer();
    this.options.queue.reset();
    this.frameIndex = 0;
    this.nextRecordSeq = 0;
    this.contextInFlight = false;
    this.records = [];
    this.status = createInitialMockSourceStatus();
    this.notify();
  }

  private async runNextFrame() {
    if (this.contextInFlight) {
      this.pushRecord("上一帧未完成", [], [], "已跳过", "warn");
      this.status = {
        ...this.status,
        lastEventLabel: "上一帧上下文提交未完成，已跳过本次 tick",
      };
      this.notify();
      return;
    }

    const frame = this.scenario.frames[this.frameIndex];
    this.frameIndex = (this.frameIndex + 1) % this.scenario.frames.length;
    this.contextInFlight = true;

    try {
      for (const event of frame.contextEvents) {
        const snapshot = await this.options.submitContextEvent({
          ...event,
          occurredAt: event.occurredAt ?? this.now(),
        });
        this.options.updateContextWindow(snapshot);
      }

      const interactionLabels: string[] = [];
      for (const [index, event] of frame.interactionEvents.entries()) {
        const happenedAt = this.now() + index * 150;
        this.options.queue.enqueue(event, happenedAt);
        this.options.queue.deliverNext(
          (queuedEvent) => this.options.canDeliverInteraction(queuedEvent.type),
          happenedAt + 500,
        );
        interactionLabels.push(INTERACTION_LABELS[event.type]);
      }

      const contextLabels = frame.contextEvents.map((event) =>
        event.source === "voice"
          ? SOURCE_LABELS[event.source]
          : `${SOURCE_LABELS[event.source]} 预留未写入窗口`,
      );
      this.status = {
        ...this.status,
        tickCount: this.status.tickCount + 1,
        lastEventLabel: `${frame.label} · ${[...contextLabels, ...interactionLabels].join(" / ")}`,
        error: undefined,
      };
      this.pushRecord(frame.label, contextLabels, interactionLabels, "已触发", "ok");
    } catch (error) {
      this.clearTimer();
      const message = error instanceof Error ? error.message : String(error);
      this.status = {
        ...this.status,
        state: "error",
        error: message,
        lastEventLabel: "mock 数据源触发失败",
      };
      this.pushRecord(frame.label, [], [], "触发失败", "error");
    } finally {
      this.contextInFlight = false;
      this.notify();
    }
  }

  private pushRecord(
    frameLabel: string,
    contextLabels: string[],
    interactionLabels: string[],
    statusLabel: string,
    tone: StatusTone,
  ) {
    const happenedAt = this.now();
    this.records.unshift({
      id: `mock-source-${happenedAt}-${++this.nextRecordSeq}`,
      frameLabel,
      contextLabels,
      interactionLabels,
      statusLabel,
      tone,
      happenedAt: formatTime(happenedAt),
    });
    if (this.records.length > 12) this.records.length = 12;
  }

  private clearTimer() {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private notify() {
    this.options.onChange({ ...this.status }, this.records.map((record) => ({ ...record })));
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }
}

function findToggleEnabled(toggles: RuntimeToggleState[], key: string) {
  return toggles.find((toggle) => toggle.key === key)?.enabled !== false;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
