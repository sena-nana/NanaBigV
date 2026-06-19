import { describe, expect, it } from "vitest";
import {
  createLocalBlivechatQueue,
  EventEmitter,
  type BlivechatQueueSnapshot,
} from "../src/features/workbench/eventRuntime";

describe("local blivechat event runtime", () => {
  it("emits events and removes listeners", () => {
    const emitter = new EventEmitter<{ ping: number }>();
    const values: number[] = [];
    const unsubscribe = emitter.on("ping", (value) => values.push(value));

    emitter.emit("ping", 1);
    unsubscribe();
    emitter.emit("ping", 2);

    expect(values).toEqual([1]);
  });

  it("records enqueue and deliver actions into queue stats and timeline events", () => {
    const queue = createLocalBlivechatQueue(() => 1_000);
    const snapshots: BlivechatQueueSnapshot[] = [];
    queue.onSnapshot((snapshot) => snapshots.push(snapshot));

    queue.enqueue(
      {
        type: "danmaku",
        audienceName: "阿黎",
        content: "本地模拟弹幕",
      },
      1_000,
    );
    queue.deliverNext(() => true, 1_200);

    const snapshot = queue.snapshot();
    const danmaku = snapshot.stats.find((stat) => stat.type === "danmaku");

    expect(snapshots).toHaveLength(2);
    expect(danmaku).toMatchObject({ queued: 0, delivered: 1, throttled: 0 });
    expect(snapshot.records.map((record) => record.action)).toEqual(["deliver", "enqueue"]);
    expect(snapshot.recentEvents[0]).toMatchObject({
      type: "danmaku",
      statusLabel: "已投递",
      tone: "ok",
      content: "本地模拟弹幕",
    });
  });

  it("records throttle actions when a channel cannot deliver", () => {
    const queue = createLocalBlivechatQueue(() => 1_000);

    queue.enqueue(
      {
        type: "super_chat",
        audienceName: "糖霜六号",
        content: "本地 SC",
        amountLabel: "¥30",
      },
      1_000,
    );
    queue.deliverNext(() => false, 1_200);

    const snapshot = queue.snapshot();
    const superChat = snapshot.stats.find((stat) => stat.type === "super_chat");

    expect(superChat).toMatchObject({ queued: 0, delivered: 0, throttled: 1 });
    expect(snapshot.recentEvents[0]).toMatchObject({
      type: "super_chat",
      statusLabel: "被节流",
      tone: "warn",
      amountLabel: "¥30",
    });
    expect(snapshot.records[0].reason).toBe("通道关闭或自动投递暂停");
  });

  it("resets pending events, records, stats, and emits a snapshot", () => {
    const queue = createLocalBlivechatQueue(() => 1_000);
    const snapshots: BlivechatQueueSnapshot[] = [];
    queue.onSnapshot((snapshot) => snapshots.push(snapshot));

    queue.enqueue(
      {
        type: "gift",
        audienceName: "北街舟",
        content: "本地礼物",
      },
      1_000,
    );
    queue.deliverNext(() => true, 1_200);
    queue.reset();

    const snapshot = queue.snapshot();

    expect(snapshots).toHaveLength(3);
    expect(snapshot.pending).toEqual([]);
    expect(snapshot.records).toEqual([]);
    expect(snapshot.recentEvents).toEqual([]);
    expect(snapshot.stats).toEqual([
      { type: "danmaku", label: "弹幕", queued: 0, delivered: 0, throttled: 0 },
      { type: "gift", label: "礼物", queued: 0, delivered: 0, throttled: 0 },
      { type: "super_chat", label: "SC", queued: 0, delivered: 0, throttled: 0 },
      { type: "membership", label: "舰长", queued: 0, delivered: 0, throttled: 0 },
    ]);
  });
});
