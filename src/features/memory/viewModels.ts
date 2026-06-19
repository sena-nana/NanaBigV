import type {
  AudienceMemoryRecord,
  AudienceProfile,
  AudienceViewModel,
  HostProfileSnapshot,
  InteractionType,
  ReviewViewModel,
} from "../workbench/types";
import type {
  AudienceProfileMemory,
  MemoryLayer,
  MemoryRecord,
  MemoryStoreSnapshot,
} from "./types";

const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  host_profile: "主播设定",
  long_term_fact: "长期互动事实",
  audience_profile: "观众画像",
  session_recap: "场次摘要",
};

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
  return {
    hostProfile: snapshot.hostProfile,
    sessionRecaps: snapshot.sessionRecaps,
    highlights: snapshot.highlights,
    suggestions: snapshot.suggestions,
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
