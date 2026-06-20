import type { ContextEventInput, ContextSourceKind, ContextWindowSnapshot } from "../context/types";
import type { MemoryStoreSnapshot, MemoryWriteInput } from "../memory/types";
import type { ProviderError } from "../provider/types";
import type { AudienceProviderBatchGenerationResult } from "./audienceGeneration";
import {
  AudiencePlanner,
  type AudienceBatchGenerationRequest,
  createInitialAudienceSimulationStatus,
} from "./audiencePlanner";
import type { BlivechatEventInput, BlivechatEventQueue } from "./eventRuntime";
import type {
  AudienceSimulationStatus,
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
  getMemorySnapshot?: () => MemoryStoreSnapshot | null;
  onChange: (status: MockSourceStatus, records: MockSourceRecord[]) => void;
  onSimulationStatusChange?: (status: AudienceSimulationStatus) => void;
  onPlanTrace?: (trace: WorkbenchMockPlanTrace) => void;
  generateAudienceBatch?: (
    request: AudienceBatchGenerationRequest,
  ) => Promise<AudienceProviderBatchGenerationResult>;
  now?: () => number;
}

export type WorkbenchGenerationSource = "provider" | "local_fallback";

export interface WorkbenchMockPlanTrace {
  id: string;
  frameLabel: string;
  happenedAt: number;
  contextWindow: ContextWindowSnapshot;
  generationRequest: AudienceBatchGenerationRequest | null;
  generationSource: WorkbenchGenerationSource;
  generationError?: ProviderError;
  providerLatencyMs?: number;
  providerModel?: string;
  generatedEvents: BlivechatEventInput[];
  memoryWriteCandidates: MemoryWriteInput[];
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
  private readonly planner = new AudiencePlanner();
  private status = createInitialMockSourceStatus();
  private simulationStatus = createInitialAudienceSimulationStatus();
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
    if (this.timer === null && this.status.state === "idle") return;
    this.clearTimer();
    this.status = { ...this.status, state: "paused" };
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
    let contextSnapshot: ContextWindowSnapshot | null = null;

    try {
      for (const event of frame.contextEvents) {
        const snapshot = await this.options.submitContextEvent({
          ...event,
          occurredAt: event.occurredAt ?? this.now(),
        });
        this.options.updateContextWindow(snapshot);
        contextSnapshot = snapshot;
      }

      if (!contextSnapshot) {
        throw new Error("mock 数据源缺少上下文快照");
      }
      const plan = this.planner.plan({
        contextWindow: contextSnapshot,
        memorySnapshot: this.options.getMemorySnapshot?.(),
        queueSnapshot: this.options.queue.snapshot(),
        now: this.now(),
      });
      this.simulationStatus = plan.status;
      const generation = await this.generateEvents(plan.generationRequest, plan.events);
      this.options.onPlanTrace?.({
        id: `mock-plan-${this.status.tickCount + 1}-${frame.id}`,
        frameLabel: frame.label,
        happenedAt: this.now(),
        contextWindow: contextSnapshot,
        generationRequest: plan.generationRequest,
        generationSource: generation.source,
        generationError: generation.error,
        providerLatencyMs: generation.latencyMs,
        providerModel: generation.model,
        generatedEvents: generation.events,
        memoryWriteCandidates: plan.memoryWriteCandidates,
      });

      const interactionLabels: string[] = [];
      for (const [index, event] of generation.events.entries()) {
        const happenedAt = this.now() + index * 150;
        this.options.queue.enqueue(event, happenedAt);
        this.options.queue.deliverNext(
          (queuedEvent) => this.options.canDeliverInteraction(queuedEvent.type),
          happenedAt + 500,
        );
        interactionLabels.push(INTERACTION_LABELS[event.type]);
      }

      const contextLabels = frame.contextEvents.map((event) =>
        event.source !== "vision"
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

  private async generateEvents(
    request: AudienceBatchGenerationRequest | null,
    fallbackEvents: BlivechatEventInput[],
  ): Promise<{
    source: WorkbenchGenerationSource;
    events: BlivechatEventInput[];
    error?: ProviderError;
    latencyMs?: number;
    model?: string;
  }> {
    if (!request) {
      return { source: "local_fallback", events: fallbackEvents };
    }

    const generateAudienceBatch = this.options.generateAudienceBatch;
    if (!generateAudienceBatch) {
      return { source: "local_fallback", events: fallbackEvents };
    }

    let result: AudienceProviderBatchGenerationResult;
    try {
      result = await generateAudienceBatch(request);
    } catch (error) {
      return {
        source: "local_fallback",
        events: fallbackEvents,
        error: providerGenerationException(error),
      };
    }

    if (!result.ok) {
      return {
        source: "local_fallback",
        events: fallbackEvents,
        error: result.error,
      };
    }

    return {
      source: "provider",
      events: result.events,
      latencyMs: result.latencyMs,
      model: result.model,
    };
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
    this.options.onSimulationStatusChange?.({ ...this.simulationStatus });
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

function providerGenerationException(error: unknown): ProviderError {
  return {
    kind: "transport",
    message: `provider 生成调用失败：${error instanceof Error ? error.message : String(error)}`,
  };
}
