import type { MemoryWriteInput } from "../memory/types";
import type { BlivechatQueueRecord } from "./eventRuntime";

export function deliveredMemoryWriteCandidates(
  candidates: MemoryWriteInput[],
  queueRecords: BlivechatQueueRecord[],
): MemoryWriteInput[] {
  const deliveredAudienceIds = new Set(
    queueRecords
      .filter((record) => record.action === "deliver")
      .map((record) => record.event.audienceId)
      .filter((audienceId): audienceId is string => Boolean(audienceId)),
  );

  return candidates.filter((candidate) =>
    candidate.audienceId ? deliveredAudienceIds.has(candidate.audienceId) : false,
  );
}
