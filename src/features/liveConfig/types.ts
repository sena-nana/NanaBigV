export type OutputMode = "prompt_only" | "manual_review" | "auto_assist";
export type MemoryScope =
  | "host_profile"
  | "room_memes"
  | "last_session"
  | "current_session_only";
export type TopicStage = "opening" | "middle" | "cold" | "peak" | "closing";
export type GenerationRecordStatus =
  | "adopted"
  | "ignored"
  | "blocked"
  | "rewritten"
  | "pending";

export interface LiveAssistConfig {
  currentPlanId: string;
  plans: LivePlan[];
  audienceGroups: AudienceGroupConfig[];
  topicCards: TopicCard[];
  outline: StreamOutline;
  memeLibrary: MemeLibrary;
  safety: SafetyConfig;
  generationRecords: DanmakuGenerationRecord[];
}

export interface LivePlan {
  id: string;
  streamType: string;
  title: string;
  theme: string;
  bannedTopics: string[];
  focusTopics: string[];
  hostState: string;
  audienceGroupIds: string[];
  topicCardIds: string[];
  outputMode: OutputMode;
  updatedAt: string;
}

export interface AudienceGroupConfig {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  useCase: string;
  frequency: number;
  averageLength: string;
  questionRate: number;
  praiseRate: number;
  memeRate: number;
  roastRate: number;
  topicRate: number;
  silenceTriggerRate: number;
  languageStyles: string[];
  boundaryRules: string[];
  memoryScope: MemoryScope;
  advancedPrompt?: string;
}

export interface StreamOutline {
  opening: string;
  mainContent: string;
  interactionPoints: string[];
  closing: string;
  forbiddenDetours: string[];
}

export interface TopicCard {
  id: string;
  title: string;
  stage: TopicStage;
  recommendedDanmaku: string[];
  hostTalkingPoint: string;
  unsuitableContent: string[];
  enabled: boolean;
}

export interface MemeLibrary {
  roomMemes: string[];
  catchphrases: string[];
  fanNames: string[];
  disabledMemes: string[];
  recentMemes: string[];
  expiredMemes: string[];
}

export interface SafetyConfig {
  outputMode: OutputMode;
  requireManualConfirmation: boolean;
  basicRules: SafetyRule[];
  qualityFilters: QualityFilter[];
  maxGeneratedPerMinute: number;
  maxConsecutivePerTopic: number;
}

export interface SafetyRule {
  id: string;
  label: string;
  enabled: boolean;
}

export interface QualityFilter {
  id: string;
  label: string;
  enabled: boolean;
}

export interface DanmakuGenerationRecord {
  id: string;
  happenedAt: string;
  content: string;
  audienceGroupId: string;
  audienceGroupName: string;
  triggerReason: string;
  status: GenerationRecordStatus;
  riskTags: string[];
  similarity: number;
  userFeedback: string;
}
