import { describe, expect, it } from "vitest";
import type { MemoryWriteInput } from "../src/features/memory/types";
import { createLocalBlivechatQueue } from "../src/features/workbench/eventRuntime";
import { deliveredMemoryWriteCandidates } from "../src/features/workbench/memoryWriteback";

describe("workbench memory writeback", () => {
  it("keeps only candidates whose audience interaction was delivered", () => {
    const queue = createLocalBlivechatQueue(() => 1_000);
    queue.enqueue({
      type: "danmaku",
      audienceId: "a-li",
      audienceName: "阿黎",
      content: "建议先讲清楚目标。",
    });
    queue.deliverNext(() => true, 1_100);
    queue.enqueue({
      type: "danmaku",
      audienceId: "bei-jie-zhou",
      audienceName: "北街舟",
      content: "这一段可以先等等。",
    });
    queue.deliverNext(() => false, 1_200);

    const delivered = candidate("a-li");
    const throttled = candidate("bei-jie-zhou");
    const detached = { ...candidate(""), audienceId: undefined };

    expect(
      deliveredMemoryWriteCandidates(
        [delivered, throttled, detached],
        queue.snapshot().records,
      ),
    ).toEqual([delivered]);
  });
});

function candidate(audienceId: string): MemoryWriteInput {
  return {
    layer: "session_recap",
    summary: `${audienceId} 对本轮互动表现出稳定支持倾向。`,
    source: "audience-planner",
    evidence: ["主播说明今晚流程"],
    confidence: 0.62,
    stability: "single_observation",
    audienceId,
    pollutionRisks: ["单次互动观察，不直接写入长期观众画像"],
  };
}
