import type {
  AudienceMemoryRecord,
  AudienceProfile,
  AudienceViewModel,
  HostProfileSnapshot,
  InteractionType,
  ReviewMemoryWriteRecord,
  ReviewMemoryWriteSummary,
  ReviewViewModel,
} from "../workbench/types";
import type {
  AudienceProfileMemory,
  MemoryLayer,
  MemoryRecord,
  MemoryStoreSnapshot,
  MemoryWriteRecord,
} from "./types";

const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  host_profile: "主播设定",
  long_term_fact: "长期互动事实",
  audience_profile: "观众画像",
  session_recap: "场次摘要",
};

const EMPTY_WRITE_SUMMARY: ReviewMemoryWriteSummary = {
  accepted: 0,
  quarantined: 0,
  rejected: 0,
};

const MEMORY_WRITE_STATUS_TONES = {
  accepted: "ok",
  quarantined: "warn",
  rejected: "error",
} satisfies Record<ReviewMemoryWriteRecord["status"], ReviewMemoryWriteRecord["tone"]>;

const EMPTY_HOST_PROFILE: HostProfileSnapshot = {
  streamerName: "",
  personaSummary: "",
  languageStyle: "",
  streamTraits: [],
  stableTopics: [],
  tabooTopics: [],
  updatedAt: "",
};

export const EMPTY_MEMORY_AUDIENCE_VIEW: AudienceViewModel = {
  defaultAudienceId: "",
  audiences: [],
};

export const EMPTY_MEMORY_REVIEW_VIEW: ReviewViewModel = {
  hostProfile: EMPTY_HOST_PROFILE,
  sessionRecaps: [],
  highlights: [],
  suggestions: [],
  writeRecords: [],
  writeSummary: EMPTY_WRITE_SUMMARY,
};

export function deriveAudienceViewFromMemory(
  snapshot: MemoryStoreSnapshot | null,
): AudienceViewModel {
  if (!snapshot) return EMPTY_MEMORY_AUDIENCE_VIEW;
  const audiences = snapshot.audienceProfiles.map((profile) =>
    toAudienceProfile(profile, snapshot.longTermFacts),
  );

  return {
    defaultAudienceId: audiences[0]?.id ?? "",
    audiences,
  };
}

export function deriveReviewViewFromMemory(
  snapshot: MemoryStoreSnapshot | null,
): ReviewViewModel {
  if (!snapshot) return EMPTY_MEMORY_REVIEW_VIEW;
  const audienceNames = new Map(
    snapshot.audienceProfiles.map((profile) => [profile.id, profile.name]),
  );
  const writeRecords = snapshot.writeRecords.map((record) =>
    toReviewMemoryWriteRecord(record, audienceNames),
  );
  const writeSummary = { ...EMPTY_WRITE_SUMMARY };
  for (const record of writeRecords) {
    writeSummary[record.status] += 1;
  }

  return {
    hostProfile: snapshot.hostProfile,
    sessionRecaps: snapshot.sessionRecaps,
    highlights: snapshot.highlights,
    suggestions: snapshot.suggestions,
    writeRecords,
    writeSummary,
  };
}

function toReviewMemoryWriteRecord(
  record: MemoryWriteRecord,
  audienceNames: Map<string, string>,
): ReviewMemoryWriteRecord {
  const riskFlags = [...(record.riskFlags ?? [])];
  if (record.conflictWith) riskFlags.push(`冲突：${record.conflictWith}`);

  return {
    id: record.id,
    layerLabel: MEMORY_LAYER_LABELS[record.layer],
    status: record.status,
    tone: MEMORY_WRITE_STATUS_TONES[record.status],
    summary: record.summary,
    reason: record.reason,
    updatedAt: record.updatedAt,
    audienceName: record.audienceId
      ? (audienceNames.get(record.audienceId) ?? record.audienceId)
      : "未绑定观众",
    riskFlags,
  };
}

function toAudienceProfile(
  profile: AudienceProfileMemory,
  longTermFacts: MemoryRecord[],
): AudienceProfile {
  const memories = [
    ...longTermFacts.filter((memory) => memory.audienceId === profile.id),
    ...profile.memories,
  ].map(toAudienceMemoryRecord);

  return {
    ...profile,
    memories,
    recentBehaviors: profile.recentBehaviors.map((behavior) => ({
      id: behavior.id,
      happenedAt: behavior.happenedAt,
      type: toInteractionType(behavior.interactionType),
      detail: behavior.detail,
      result: behavior.result,
    })),
  };
}

function toAudienceMemoryRecord(memory: MemoryRecord): AudienceMemoryRecord {
  return {
    id: memory.id,
    layer: MEMORY_LAYER_LABELS[memory.layer],
    summary: memory.summary,
    confidence: memory.quarantined ? `${memory.confidence} / 待确认` : memory.confidence,
    updatedAt: memory.updatedAt,
  };
}

function toInteractionType(value: string): InteractionType {
  if (
    value === "danmaku" ||
    value === "gift" ||
    value === "super_chat" ||
    value === "membership"
  ) {
    return value;
  }
  return "danmaku";
}
