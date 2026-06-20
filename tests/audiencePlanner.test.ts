import { describe, expect, it } from "vitest";
import type { ContextWindowSnapshot } from "../src/features/context/types";
import {
  AudiencePlanner,
  buildAudienceBatchGenerationPrompt,
  buildAudienceBatchGenerationRequest,
  createAudienceMemoryWriteCandidates,
  parseAudienceBatchGenerationResult,
  type PlannerAudienceProfile,
} from "../src/features/workbench/audiencePlanner";
import type { AudienceInteractionIntent } from "../src/features/workbench/types";
import { createMemorySnapshot } from "./memoryFixtures";

describe("audience planner", () => {
  it("produces deterministic intents for the same seed and context", () => {
    const input = {
      contextWindow: contextWindow("主播说下一段会拆隐藏路线，这里是关键节点。"),
      memorySnapshot: createMemorySnapshot(),
      now: 10_000,
    };

    const left = new AudiencePlanner("stable-seed").plan(input);
    const right = new AudiencePlanner("stable-seed").plan(input);

    expect(left.intents).toEqual(right.intents);
    expect(left.events).toEqual(right.events);
    expect(left.status.memoryAudienceCount).toBe(4);
    expect(left.status.shadowAudienceCount).toBe(240);
  });

  it("uses cooldown to prevent one audience from speaking continuously", () => {
    const planner = new AudiencePlanner("cooldown-seed", 1);
    const input = {
      contextWindow: contextWindow("主播刚说明今天会先试玩新关卡，再回头看观众建议。"),
      now: 20_000,
    };

    const first = planner.plan(input);
    const second = planner.plan({ ...input, now: 21_000 });

    expect(first.intents).toHaveLength(1);
    expect(second.intents).toHaveLength(0);
    expect(second.status.cooldownRejectCount).toBeGreaterThan(0);
  });

  it("changes output density across cold and peak rhythm states", () => {
    const cold = new AudiencePlanner("rhythm-seed").plan({
      contextWindow: emptyContextWindow(),
      now: 30_000,
    });
    const peak = new AudiencePlanner("rhythm-seed").plan({
      contextWindow: contextWindow("主播说这里是高能关键节点，隐藏路线马上要冲过去。"),
      now: 30_000,
    });

    expect(cold.status.rhythmState).toBe("cold");
    expect(peak.status.rhythmState).toBe("peak");
    expect(peak.intents.length).toBeGreaterThan(cold.intents.length);
  });

  it("tracks planner-level throttling when channels are unavailable", () => {
    const result = new AudiencePlanner("throttle-seed", 4).plan({
      contextWindow: contextWindow("主播说明今晚流程，弹幕开始集中提问。"),
      now: 40_000,
      canDeliverInteraction: () => false,
    });

    expect(result.intents).toEqual([]);
    expect(result.status.throttleRejectCount).toBeGreaterThan(0);
  });

  it("keeps batch generation prompts compact and validates provider output", () => {
    const request = buildAudienceBatchGenerationRequest(
      contextWindow("主播说这里要复盘翻车原因，想听观众建议。"),
      shadowAudiencePool(),
      [shadowIntent()],
    )!;
    const prompt = buildAudienceBatchGenerationPrompt(request);

    expect(request.activeAudienceProfiles.length).toBeLessThanOrEqual(request.intents.length);
    expect(request.activeAudienceProfiles.length).toBeLessThanOrEqual(16);
    expect(prompt).toContain("activeAudienceProfiles");
    expect(prompt).toContain("items");
    expect(prompt).not.toContain("shadow-200");

    const valid = parseAudienceBatchGenerationResult(
      JSON.stringify({
        items: [
          {
            audienceId: request.intents[0].audienceId,
            type: request.intents[0].interactionType,
            content: "这一段建议先讲清楚目标再推进。",
          },
        ],
      }),
      { ...request, maxOutputCount: 1, intents: [request.intents[0]] },
    );
    expect(valid.ok).toBe(true);

    const invalid = parseAudienceBatchGenerationResult(
      JSON.stringify([{ audienceId: "unknown", type: "danmaku", content: "x" }]),
      request,
    );
    expect(invalid).toMatchObject({ ok: false });
  });

  it("does not create long-term write candidates for shadow audience interactions", () => {
    const shadow = shadowIntent({ reactionKind: "advice", intensity: 5, needsGeneration: false });
    const memoryIntent: AudienceInteractionIntent = {
      ...shadow,
      audienceId: "a-li",
      audienceName: "阿黎",
      audienceKind: "memory_profile",
    };

    expect(createAudienceMemoryWriteCandidates([shadow])).toEqual([]);
    expect(createAudienceMemoryWriteCandidates([memoryIntent])[0]).toMatchObject({
      layer: "session_recap",
      source: "audience-planner",
      stability: "single_observation",
      audienceId: "a-li",
    });
  });

  it("builds generation requests only for activated audiences", () => {
    const intent = shadowIntent();

    const request = buildAudienceBatchGenerationRequest(contextWindow("主播语音"), shadowAudiencePool(), [intent]);

    expect(request?.activeAudienceProfiles).toHaveLength(1);
    expect(request?.activeAudienceProfiles[0].audienceId).toBe("shadow-1");
  });
});

function contextWindow(content: string): ContextWindowSnapshot {
  return {
    windowStartedAt: 0,
    windowSeconds: 300,
    events: [
      {
        id: "ctx-1",
        source: "voice",
        content,
        summary: content,
        occurredAt: 1_000,
        receivedAt: 1_000,
        confidence: 0.92,
        status: "accepted",
      },
    ],
    sourceStatuses: [],
  };
}

function shadowAudiencePool(count = 240): PlannerAudienceProfile[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `shadow-${index + 1}`,
    name: `影子${index + 1}`,
    kind: "shadow_profile",
    activityLevel: "low",
    spendingTier: "low",
    relationship: "new",
    languageStyle: "短句",
    styleHints: ["短句"],
    archetype: "影子观众",
  }));
}

function shadowIntent(
  overrides: Partial<AudienceInteractionIntent> = {},
): AudienceInteractionIntent {
  return {
    audienceId: "shadow-1",
    audienceName: "影子1",
    audienceKind: "shadow_profile",
    interactionType: "danmaku",
    reactionKind: "question",
    intensity: 2,
    styleHints: ["短句"],
    contextRefs: ["主播语音"],
    needsGeneration: true,
    ...overrides,
  };
}

function emptyContextWindow(): ContextWindowSnapshot {
  return {
    windowStartedAt: 0,
    windowSeconds: 300,
    events: [],
    sourceStatuses: [],
  };
}
