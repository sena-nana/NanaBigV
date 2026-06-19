import type {
  AudienceActivityLevel,
  AudienceRelationship,
  AudienceSpendingTier,
} from "../workbench/types";

export type MemoryLayer =
  | "host_profile"
  | "long_term_fact"
  | "audience_profile"
  | "session_recap";

export type MemoryStability =
  | "single_observation"
  | "repeated"
  | "streamer_confirmed"
  | "explicit_rule";

export type MemoryWriteStatus = "accepted" | "quarantined" | "rejected";

export interface MemoryPreference {
  label: string;
  detail: string;
  strength: string;
}

export interface MemoryRecord {
  id: string;
  layer: MemoryLayer;
  summary: string;
  confidence: string;
  updatedAt: string;
  audienceId?: string;
  evidence?: string[];
  riskFlags?: string[];
  conflictWith?: string;
  quarantined?: boolean;
}

export interface MemoryBehaviorRecord {
  id: string;
  happenedAt: string;
  interactionType: string;
  detail: string;
  result: string;
}

export interface HostProfileMemory {
  streamerName: string;
  personaSummary: string;
  languageStyle: string;
  streamTraits: string[];
  stableTopics: string[];
  tabooTopics: string[];
  updatedAt: string;
  memories: MemoryRecord[];
}

export interface AudienceProfileMemory {
  id: string;
  name: string;
  tagLine: string;
  summary: string;
  roleTags: string[];
  activityLevel: AudienceActivityLevel;
  activityLabel: string;
  spendingTier: AudienceSpendingTier;
  spendingLabel: string;
  relationship: AudienceRelationship;
  relationshipLabel: string;
  appearanceFrequency: string;
  languageStyle: string;
  preferences: MemoryPreference[];
  memories: MemoryRecord[];
  recentBehaviors: MemoryBehaviorRecord[];
}

export interface SessionRecapMemory {
  id: string;
  dateLabel: string;
  title: string;
  rhythmLabel: string;
  summary: string;
  peakMoment: string;
  memoryWrites: number;
  memories: MemoryRecord[];
}

export interface HighlightMemory {
  id: string;
  happenedAt: string;
  title: string;
  detail: string;
  impact: string;
}

export interface SuggestionMemory {
  id: string;
  category: string;
  title: string;
  detail: string;
  priority: string;
}

export interface MemoryWriteRecord {
  id: string;
  layer: MemoryLayer;
  status: MemoryWriteStatus;
  summary: string;
  reason: string;
  updatedAt: string;
  audienceId?: string;
  riskFlags?: string[];
  conflictWith?: string;
}

export interface MemoryStoreSnapshot {
  hostProfile: HostProfileMemory;
  longTermFacts: MemoryRecord[];
  audienceProfiles: AudienceProfileMemory[];
  sessionRecaps: SessionRecapMemory[];
  highlights: HighlightMemory[];
  suggestions: SuggestionMemory[];
  writeRecords: MemoryWriteRecord[];
}

export interface MemoryRetrieveRequest {
  layers?: MemoryLayer[];
  audienceId?: string;
  query?: string;
  limit?: number;
}

export interface MemoryRetrieveResult {
  items: MemoryRecord[];
}

export interface MemoryWriteInput {
  layer: MemoryLayer;
  summary: string;
  source: string;
  evidence?: string[];
  confidence: number;
  stability: MemoryStability;
  pollutionRisks?: string[];
  audienceId?: string;
  conflictWith?: string;
  title?: string;
}

export interface MemoryWriteResult {
  status: MemoryWriteStatus;
  record: MemoryWriteRecord;
  snapshot: MemoryStoreSnapshot;
}
