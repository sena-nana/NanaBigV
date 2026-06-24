import { computed, ref } from "vue";
import { loadLiveAssistConfig, saveLiveAssistConfig } from "./api";
import type {
  AudienceGroupConfig,
  DanmakuGenerationRecord,
  LiveAssistConfig,
  LivePlan,
  OutputMode,
  TopicCard,
} from "./types";

const MAX_GENERATION_RECORDS = 200;

const fallbackConfig: LiveAssistConfig = {
  currentPlanId: "plan-chat",
  plans: [
    {
      id: "plan-chat",
      streamType: "杂谈",
      title: "晚间杂谈与功能演练",
      theme: "测试 AI 观众氛围与控场提词",
      bannedTopics: ["隐私推测", "争议引战"],
      focusTopics: ["冷场救急", "弹幕风格选择"],
      hostState: "想轻松播",
      audienceGroupIds: ["group-support", "group-passerby", "group-rescue"],
      topicCardIds: ["topic-why-nanabigv", "topic-style-choice", "topic-cold-rescue"],
      outputMode: "manual_review",
      updatedAt: "默认方案",
    },
  ],
  audienceGroups: [
    {
      id: "group-support",
      name: "捧哏组",
      color: "#3b82f6",
      enabled: true,
      useCase: "负责接话、缓和气氛和轻量夸赞。",
      frequency: 48,
      averageLength: "短句",
      questionRate: 35,
      praiseRate: 55,
      memeRate: 28,
      roastRate: 8,
      topicRate: 24,
      silenceTriggerRate: 50,
      languageStyles: ["弹幕腔", "克制"],
      boundaryRules: ["禁止攻击主播", "禁止假装真实付费用户"],
      memoryScope: "room_memes",
    },
    {
      id: "group-passerby",
      name: "路人组",
      color: "#14b8a6",
      enabled: true,
      useCase: "像第一次进入直播间的观众，提出基础疑问。",
      frequency: 32,
      averageLength: "普通",
      questionRate: 62,
      praiseRate: 20,
      memeRate: 12,
      roastRate: 4,
      topicRate: 34,
      silenceTriggerRate: 30,
      languageStyles: ["普通路人", "认真"],
      boundaryRules: ["禁止隐私推测", "禁止伪装真人经历"],
      memoryScope: "current_session_only",
    },
    {
      id: "group-rescue",
      name: "控场救急组",
      color: "#f59e0b",
      enabled: true,
      useCase: "主播沉默或话题断掉时主动补轻量问题。",
      frequency: 26,
      averageLength: "短句",
      questionRate: 70,
      praiseRate: 18,
      memeRate: 18,
      roastRate: 5,
      topicRate: 58,
      silenceTriggerRate: 82,
      languageStyles: ["克制", "熟人"],
      boundaryRules: ["禁止刷屏", "禁止引战"],
      memoryScope: "last_session",
    },
  ],
  topicCards: [
    {
      id: "topic-why-nanabigv",
      title: "为什么做 NaNaBigV",
      stage: "opening",
      recommendedDanmaku: ["这个工具是给主播自己用的吗？"],
      hostTalkingPoint: "其实最开始是为了解决直播冷场问题。",
      unsuitableContent: ["暗示真实观众被替代"],
      enabled: true,
    },
    {
      id: "topic-style-choice",
      title: "弹幕风格选择",
      stage: "middle",
      recommendedDanmaku: ["这段要不要来点路人提问？"],
      hostTalkingPoint: "可以让大家选今天更热闹还是更轻松。",
      unsuitableContent: ["连续重复同一句夸奖"],
      enabled: true,
    },
    {
      id: "topic-cold-rescue",
      title: "冷场救急演示",
      stage: "cold",
      recommendedDanmaku: ["刚刚这个点能不能展开讲讲？"],
      hostTalkingPoint: "刚好可以解释一下我为什么这样设计。",
      unsuitableContent: ["突然大量刷屏"],
      enabled: true,
    },
  ],
  outline: {
    opening: "说明今天会测试 NaNaBigV 的互动节奏。",
    mainContent: "展示弹幕候选、主播提词和安全拦截。",
    interactionPoints: ["问观众喜欢哪种弹幕风格", "请观众选择下一个话题"],
    closing: "总结本场哪些控场建议最有用。",
    forbiddenDetours: ["不要让 AI 假装真实付费用户"],
  },
  memeLibrary: {
    roomMemes: ["今天先低压测试"],
    catchphrases: ["先把节奏稳住"],
    fanNames: ["陪跑员"],
    disabledMemes: ["过度夸奖主播声音"],
    recentMemes: ["别突然刷屏"],
    expiredMemes: [],
  },
  safety: {
    outputMode: "manual_review",
    requireManualConfirmation: true,
    basicRules: [
      "禁止攻击主播",
      "禁止攻击真实观众",
      "禁止引战",
      "禁止隐私推测",
      "禁止成人内容",
      "禁止伪造付费行为",
      "禁止假装真实用户经历",
      "禁止诱导消费",
    ].map((label, index) => ({
      id: `rule-${index}`,
      label,
      enabled: true,
    })),
    qualityFilters: ["重复过滤", "相似句过滤", "过度夸奖过滤", "机器人腔过滤", "高频刷屏限制"].map(
      (label, index) => ({
        id: `filter-${index}`,
        label,
        enabled: true,
      }),
    ),
    maxGeneratedPerMinute: 8,
    maxConsecutivePerTopic: 3,
  },
  generationRecords: [
    {
      id: "record-default-1",
      happenedAt: "20:41:13",
      content: "刚刚这个地方是不是可以展开讲讲？",
      audienceGroupId: "group-rescue",
      audienceGroupName: "控场救急组",
      triggerReason: "主播沉默 18 秒",
      status: "pending",
      riskTags: ["低风险"],
      similarity: 12,
      userFeedback: "待确认",
    },
    {
      id: "record-default-2",
      happenedAt: "20:40:57",
      content: "今天节奏挺舒服的，适合慢慢讲。",
      audienceGroupId: "group-support",
      audienceGroupName: "捧哏组",
      triggerReason: "气氛偏安静",
      status: "adopted",
      riskTags: ["低风险"],
      similarity: 22,
      userFeedback: "已采用",
    },
    {
      id: "record-default-3",
      happenedAt: "20:39:49",
      content: "我刚充了舰长所以主播必须听我的。",
      audienceGroupId: "group-passerby",
      audienceGroupName: "路人组",
      triggerReason: "高价值互动模拟",
      status: "blocked",
      riskTags: ["伪造付费行为", "诱导消费"],
      similarity: 8,
      userFeedback: "安全规则拦截",
    },
  ],
};

const config = ref<LiveAssistConfig>(cloneLiveConfigValue(fallbackConfig));
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
let loadPromise: Promise<boolean> | null = null;
let loadedOnce = false;

const currentPlan = computed(
  () => config.value.plans.find((plan) => plan.id === config.value.currentPlanId) ?? config.value.plans[0],
);
const enabledAudienceGroups = computed(() =>
  config.value.audienceGroups.filter((group) => group.enabled),
);
const enabledTopicCards = computed(() => config.value.topicCards.filter((topic) => topic.enabled));

export function cloneLiveConfigValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toErrorMessage(errorValue: unknown) {
  return errorValue instanceof Error ? errorValue.message : String(errorValue);
}

function replaceConfig(next: LiveAssistConfig) {
  config.value = normalizeConfig(next);
}

function normalizeConfig(next: LiveAssistConfig): LiveAssistConfig {
  const normalized = {
    ...cloneLiveConfigValue(fallbackConfig),
    ...next,
    plans: next.plans?.length ? next.plans : fallbackConfig.plans,
    audienceGroups: next.audienceGroups?.length ? next.audienceGroups : fallbackConfig.audienceGroups,
    topicCards: next.topicCards?.length ? next.topicCards : fallbackConfig.topicCards,
    generationRecords: (next.generationRecords ?? []).slice(0, MAX_GENERATION_RECORDS),
  };
  if (!normalized.plans.some((plan) => plan.id === normalized.currentPlanId)) {
    normalized.currentPlanId = normalized.plans[0].id;
  }
  return normalized;
}

async function load(force = false) {
  if (!force && loadPromise) return loadPromise;
  if (!force && loadedOnce && !error.value) return true;
  loading.value = true;
  error.value = null;
  loadPromise = (async () => {
    try {
      replaceConfig(await loadLiveAssistConfig());
      loadedOnce = true;
      return true;
    } catch (loadError) {
      error.value = `读取直播辅助配置失败：${toErrorMessage(loadError)}`;
      replaceConfig(fallbackConfig);
      return false;
    } finally {
      loading.value = false;
      loadPromise = null;
    }
  })();
  return loadPromise;
}

async function persist(next = config.value) {
  saving.value = true;
  error.value = null;
  try {
    replaceConfig(await saveLiveAssistConfig(normalizeConfig(next)));
    return true;
  } catch (saveError) {
    error.value = `保存直播辅助配置失败：${toErrorMessage(saveError)}`;
    return false;
  } finally {
    saving.value = false;
  }
}

async function updateConfig(mutator: (draft: LiveAssistConfig) => void) {
  const draft = cloneLiveConfigValue(config.value);
  mutator(draft);
  replaceConfig(draft);
  return persist();
}

async function savePlan(plan: LivePlan) {
  return updateConfig((draft) => {
    const index = draft.plans.findIndex((item) => item.id === plan.id);
    if (index >= 0) {
      draft.plans[index] = plan;
    } else {
      draft.plans.unshift(plan);
    }
    draft.currentPlanId = plan.id;
    draft.safety.outputMode = plan.outputMode;
  });
}

async function updateAudienceGroup(group: AudienceGroupConfig) {
  return updateConfig((draft) => {
    const index = draft.audienceGroups.findIndex((item) => item.id === group.id);
    if (index >= 0) {
      draft.audienceGroups[index] = group;
    } else {
      draft.audienceGroups.push(group);
    }
  });
}

async function updateTopicCard(topic: TopicCard) {
  return updateConfig((draft) => {
    const index = draft.topicCards.findIndex((item) => item.id === topic.id);
    if (index >= 0) {
      draft.topicCards[index] = topic;
    } else {
      draft.topicCards.push(topic);
    }
  });
}

async function setOutputMode(outputMode: OutputMode) {
  return updateConfig((draft) => {
    draft.safety.outputMode = outputMode;
    draft.safety.requireManualConfirmation = outputMode !== "auto_assist";
    const plan = draft.plans.find((item) => item.id === draft.currentPlanId);
    if (plan) plan.outputMode = outputMode;
  });
}

async function appendGenerationRecord(record: DanmakuGenerationRecord) {
  return appendGenerationRecords([record]);
}

async function appendGenerationRecords(records: DanmakuGenerationRecord[]) {
  if (records.length === 0) return true;
  return updateConfig((draft) => {
    draft.generationRecords = [...records, ...draft.generationRecords].slice(0, MAX_GENERATION_RECORDS);
  });
}

async function updateGenerationRecord(
  recordId: string,
  patch: Partial<Omit<DanmakuGenerationRecord, "id">>,
) {
  let changed = false;
  const result = await updateConfig((draft) => {
    const record = draft.generationRecords.find((item) => item.id === recordId);
    if (record) {
      Object.assign(record, patch);
      changed = true;
    }
  });
  return changed && result;
}

export function useLiveAssistConfig() {
  return {
    config,
    currentPlan,
    enabledAudienceGroups,
    enabledTopicCards,
    loading,
    saving,
    error,
    load,
    persist,
    updateConfig,
    savePlan,
    updateAudienceGroup,
    updateTopicCard,
    setOutputMode,
    appendGenerationRecord,
    appendGenerationRecords,
    updateGenerationRecord,
  };
}
