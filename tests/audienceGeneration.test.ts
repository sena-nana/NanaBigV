import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextWindowSnapshot } from "../src/features/context/types";
import { generateProviderJson } from "../src/features/provider/api";
import { buildAudienceBatchGenerationRequest, type PlannerAudienceProfile } from "../src/features/workbench/audiencePlanner";
import { generateAudienceBatch } from "../src/features/workbench/audienceGeneration";
import type { AudienceInteractionIntent } from "../src/features/workbench/types";

vi.mock("../src/features/provider/api", () => ({
  generateProviderJson: vi.fn(),
}));

const mockGenerateProviderJson = vi.mocked(generateProviderJson);

describe("audience provider generation", () => {
  beforeEach(() => {
    mockGenerateProviderJson.mockReset();
  });

  it("turns provider JSON items into blivechat events", async () => {
    const request = generationRequest();
    mockGenerateProviderJson.mockResolvedValue({
      ok: true,
      content: JSON.stringify({
        items: [
          {
            audienceId: "shadow-1",
            type: "danmaku",
            content: "这段可以先把隐藏路线拆开说。",
          },
        ],
      }),
      latencyMs: 120,
      model: "gpt-4.1-mini",
    });

    const result = await generateAudienceBatch(request);

    expect(result).toMatchObject({
      ok: true,
      latencyMs: 120,
      model: "gpt-4.1-mini",
      events: [
        {
          type: "danmaku",
          audienceName: "影子1",
          content: "这段可以先把隐藏路线拆开说。",
        },
      ],
    });
    expect(mockGenerateProviderJson).toHaveBeenCalledWith(expect.stringContaining("items"));
  });

  it("maps malformed provider content to the shared invalid_response error kind", async () => {
    mockGenerateProviderJson.mockResolvedValue({
      ok: true,
      content: "{\"items\":",
      latencyMs: 80,
      model: "gpt-4.1-mini",
    });

    const result = await generateAudienceBatch(generationRequest());

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "invalid_response",
      },
    });
  });

  it("maps unavailable provider commands to a diagnostic transport error", async () => {
    mockGenerateProviderJson.mockRejectedValue(new Error("unknown command"));

    const result = await generateAudienceBatch(generationRequest());

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "transport",
        message: expect.stringContaining("unknown command"),
      },
    });
  });
});

function generationRequest() {
  return buildAudienceBatchGenerationRequest(
    contextWindow("主播说这里要讲隐藏路线。"),
    [shadowAudience()],
    [shadowIntent()],
  )!;
}

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

function shadowAudience(): PlannerAudienceProfile {
  return {
    id: "shadow-1",
    name: "影子1",
    kind: "shadow_profile",
    activityLevel: "low",
    spendingTier: "low",
    relationship: "new",
    languageStyle: "短句",
    styleHints: ["短句"],
    archetype: "影子观众",
  };
}

function shadowIntent(): AudienceInteractionIntent {
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
  };
}
