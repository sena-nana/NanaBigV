import { describe, expect, it, vi } from "vitest";
import {
  loadMemorySnapshot,
  retrieveMemory,
  submitMemoryWrite,
} from "../src/features/memory/api";
import type { MemoryWriteResult } from "../src/features/memory/types";
import { createMemorySnapshot } from "./memoryFixtures";

const mockInvoke = vi.hoisted(() =>
  vi.fn<(command: string, payload?: Record<string, unknown>) => Promise<unknown>>(),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

describe("memory api", () => {
  it("loads memory snapshot through Tauri", async () => {
    const snapshot = createMemorySnapshot();
    mockInvoke.mockResolvedValueOnce(snapshot);

    await expect(loadMemorySnapshot()).resolves.toBe(snapshot);
    expect(mockInvoke).toHaveBeenCalledWith("load_memory_snapshot", undefined);
  });

  it("passes retrieval filters to Tauri", async () => {
    mockInvoke.mockResolvedValueOnce({ items: [] });

    await retrieveMemory({
      layers: ["audience_profile"],
      audienceId: "a-li",
      query: "自黑",
      limit: 3,
    });

    expect(mockInvoke).toHaveBeenCalledWith("retrieve_memory", {
      request: {
        layers: ["audience_profile"],
        audienceId: "a-li",
        query: "自黑",
        limit: 3,
      },
    });
  });

  it("passes controlled writeback input to Tauri", async () => {
    const result: MemoryWriteResult = {
      status: "accepted",
      record: {
        id: "write-1",
        layer: "session_recap",
        status: "accepted",
        summary: "本场前 10 分钟互动密度偏低。",
        reason: "写入场次摘要。",
        updatedAt: "刚刚",
      },
      snapshot: createMemorySnapshot(),
    };
    mockInvoke.mockResolvedValueOnce(result);

    await expect(
      submitMemoryWrite({
        layer: "session_recap",
        summary: "本场前 10 分钟互动密度偏低。",
        source: "unit-test",
        evidence: ["投递记录"],
        confidence: 0.4,
        stability: "single_observation",
        pollutionRisks: ["单场观察"],
      }),
    ).resolves.toBe(result);

    expect(mockInvoke).toHaveBeenCalledWith("submit_memory_write", {
      input: {
        layer: "session_recap",
        summary: "本场前 10 分钟互动密度偏低。",
        source: "unit-test",
        evidence: ["投递记录"],
        confidence: 0.4,
        stability: "single_observation",
        pollutionRisks: ["单场观察"],
      },
    });
  });
});
