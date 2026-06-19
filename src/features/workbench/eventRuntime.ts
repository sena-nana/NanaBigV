import type { DeliveryQueueStat, InteractionEvent, InteractionType, StatusTone } from "./types";

export type BlivechatQueueAction = "enqueue" | "deliver" | "throttle";

export interface BlivechatEventInput {
  type: InteractionType;
  audienceName: string;
  content: string;
  amountLabel?: string;
}

export interface BlivechatQueuedEvent extends BlivechatEventInput {
  id: string;
  protocol: "blivechat";
  source: "local_simulator";
  createdAt: number;
}

export interface BlivechatQueueRecord {
  id: string;
  eventId: string;
  action: BlivechatQueueAction;
  type: InteractionType;
  event: BlivechatQueuedEvent;
  happenedAt: number;
  reason?: string;
}

export interface BlivechatQueueSnapshot {
  pending: BlivechatQueuedEvent[];
  records: BlivechatQueueRecord[];
  stats: DeliveryQueueStat[];
  recentEvents: InteractionEvent[];
}

type Listener<Payload> = (payload: Payload) => void;

export class EventEmitter<EventMap extends object> {
  private listeners: Partial<{ [Key in keyof EventMap]: Set<Listener<EventMap[Key]>> }> = {};

  on<Key extends keyof EventMap>(eventName: Key, listener: Listener<EventMap[Key]>): () => void {
    const listeners = this.listeners[eventName] ?? new Set<Listener<EventMap[Key]>>();
    listeners.add(listener);
    this.listeners[eventName] = listeners;
    return () => this.off(eventName, listener);
  }

  off<Key extends keyof EventMap>(eventName: Key, listener: Listener<EventMap[Key]>) {
    this.listeners[eventName]?.delete(listener);
  }

  emit<Key extends keyof EventMap>(eventName: Key, payload: EventMap[Key]) {
    for (const listener of this.listeners[eventName] ?? []) listener(payload);
  }
}

interface BlivechatQueueEvents {
  record: BlivechatQueueRecord;
  snapshot: BlivechatQueueSnapshot;
}

const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  danmaku: "弹幕",
  gift: "礼物",
  super_chat: "SC",
  membership: "舰长",
};

const ACTION_LABELS: Record<BlivechatQueueAction, { label: string; tone: StatusTone }> = {
  enqueue: { label: "排队中", tone: "info" },
  deliver: { label: "已投递", tone: "ok" },
  throttle: { label: "被节流", tone: "warn" },
};

export class BlivechatEventQueue {
  private readonly emitter = new EventEmitter<BlivechatQueueEvents>();
  private readonly now: () => number;
  private pending: BlivechatQueuedEvent[] = [];
  private records: BlivechatQueueRecord[] = [];
  private nextEventSeq = 0;
  private nextRecordSeq = 0;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  onRecord(listener: Listener<BlivechatQueueRecord>) {
    return this.emitter.on("record", listener);
  }

  onSnapshot(listener: Listener<BlivechatQueueSnapshot>) {
    return this.emitter.on("snapshot", listener);
  }

  enqueue(input: BlivechatEventInput, happenedAt = this.now()) {
    const event: BlivechatQueuedEvent = {
      ...input,
      id: `blivechat-${happenedAt}-${++this.nextEventSeq}`,
      protocol: "blivechat",
      source: "local_simulator",
      createdAt: happenedAt,
    };
    this.pending.push(event);
    this.record("enqueue", event, happenedAt);
    return event;
  }

  deliverNext(canDeliver: (event: BlivechatQueuedEvent) => boolean, happenedAt = this.now()) {
    const event = this.pending.shift();
    if (!event) return null;
    if (!canDeliver(event)) {
      return this.record("throttle", event, happenedAt, "通道关闭或自动投递暂停");
    }
    return this.record("deliver", event, happenedAt);
  }

  throttlePending(
    shouldThrottle: (event: BlivechatQueuedEvent) => boolean,
    reason = "通道关闭或自动投递暂停",
    happenedAt = this.now(),
  ) {
    const remaining: BlivechatQueuedEvent[] = [];
    const throttled: BlivechatQueueRecord[] = [];
    for (const event of this.pending) {
      if (shouldThrottle(event)) {
        throttled.push(this.record("throttle", event, happenedAt, reason, false));
      } else {
        remaining.push(event);
      }
    }
    this.pending = remaining;
    this.emitSnapshot();
    return throttled;
  }

  snapshot(): BlivechatQueueSnapshot {
    const records = this.records.slice(0, 80);
    return {
      pending: [...this.pending],
      records,
      stats: buildStats(this.pending, this.records),
      recentEvents: records.map(recordToInteractionEvent),
    };
  }

  private record(
    action: BlivechatQueueAction,
    event: BlivechatQueuedEvent,
    happenedAt: number,
    reason?: string,
    emitSnapshot = true,
  ) {
    const record: BlivechatQueueRecord = {
      id: `blivechat-record-${happenedAt}-${++this.nextRecordSeq}`,
      eventId: event.id,
      action,
      type: event.type,
      event,
      happenedAt,
      reason,
    };
    this.records.unshift(record);
    if (this.records.length > 80) this.records.length = 80;
    this.emitter.emit("record", record);
    if (emitSnapshot) this.emitSnapshot();
    return record;
  }

  private emitSnapshot() {
    this.emitter.emit("snapshot", this.snapshot());
  }
}

export function createLocalBlivechatQueue(now?: () => number) {
  return new BlivechatEventQueue(now);
}

function buildStats(
  pending: BlivechatQueuedEvent[],
  records: BlivechatQueueRecord[],
): DeliveryQueueStat[] {
  return (Object.keys(INTERACTION_TYPE_LABELS) as InteractionType[]).map((type) => ({
    type,
    label: INTERACTION_TYPE_LABELS[type],
    queued: pending.filter((event) => event.type === type).length,
    delivered: records.filter((record) => record.type === type && record.action === "deliver").length,
    throttled: records.filter((record) => record.type === type && record.action === "throttle").length,
  }));
}

function recordToInteractionEvent(record: BlivechatQueueRecord): InteractionEvent {
  const action = ACTION_LABELS[record.action];
  const content =
    record.action === "enqueue"
      ? `进入本地队列：${record.event.content}`
      : record.event.content;
  return {
    id: record.id,
    type: record.type,
    audienceName: record.event.audienceName,
    content,
    amountLabel: record.event.amountLabel,
    statusLabel: action.label,
    tone: action.tone,
    happenedAt: formatTime(record.happenedAt),
  };
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
