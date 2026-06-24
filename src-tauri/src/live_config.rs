use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const LIVE_ASSIST_STORE_FILE: &str = "live-assist.json";
const LIVE_ASSIST_STORE_KEY: &str = "liveAssistConfig";
const MAX_GENERATION_RECORDS: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveAssistConfig {
    pub current_plan_id: String,
    pub plans: Vec<LivePlan>,
    pub audience_groups: Vec<AudienceGroupConfig>,
    pub topic_cards: Vec<TopicCard>,
    pub outline: StreamOutline,
    pub meme_library: MemeLibrary,
    pub safety: SafetyConfig,
    #[serde(default)]
    pub generation_records: Vec<DanmakuGenerationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LivePlan {
    pub id: String,
    pub stream_type: String,
    pub title: String,
    pub theme: String,
    pub banned_topics: Vec<String>,
    pub focus_topics: Vec<String>,
    pub host_state: String,
    pub audience_group_ids: Vec<String>,
    pub topic_card_ids: Vec<String>,
    pub output_mode: OutputMode,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OutputMode {
    PromptOnly,
    ManualReview,
    AutoAssist,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudienceGroupConfig {
    pub id: String,
    pub name: String,
    pub color: String,
    pub enabled: bool,
    pub use_case: String,
    pub frequency: u8,
    pub average_length: String,
    pub question_rate: u8,
    pub praise_rate: u8,
    pub meme_rate: u8,
    pub roast_rate: u8,
    pub topic_rate: u8,
    pub silence_trigger_rate: u8,
    pub language_styles: Vec<String>,
    pub boundary_rules: Vec<String>,
    pub memory_scope: MemoryScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub advanced_prompt: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryScope {
    HostProfile,
    RoomMemes,
    LastSession,
    CurrentSessionOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamOutline {
    pub opening: String,
    pub main_content: String,
    pub interaction_points: Vec<String>,
    pub closing: String,
    pub forbidden_detours: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopicCard {
    pub id: String,
    pub title: String,
    pub stage: TopicStage,
    pub recommended_danmaku: Vec<String>,
    pub host_talking_point: String,
    pub unsuitable_content: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TopicStage {
    Opening,
    Middle,
    Cold,
    Peak,
    Closing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemeLibrary {
    pub room_memes: Vec<String>,
    pub catchphrases: Vec<String>,
    pub fan_names: Vec<String>,
    pub disabled_memes: Vec<String>,
    pub recent_memes: Vec<String>,
    pub expired_memes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SafetyConfig {
    pub output_mode: OutputMode,
    pub require_manual_confirmation: bool,
    pub basic_rules: Vec<SafetyRule>,
    pub quality_filters: Vec<QualityFilter>,
    pub max_generated_per_minute: u8,
    pub max_consecutive_per_topic: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SafetyRule {
    pub id: String,
    pub label: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QualityFilter {
    pub id: String,
    pub label: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DanmakuGenerationRecord {
    pub id: String,
    pub happened_at: String,
    pub content: String,
    pub audience_group_id: String,
    pub audience_group_name: String,
    pub trigger_reason: String,
    pub status: GenerationRecordStatus,
    pub risk_tags: Vec<String>,
    pub similarity: u8,
    pub user_feedback: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GenerationRecordStatus {
    Adopted,
    Ignored,
    Blocked,
    Rewritten,
    Pending,
}

fn load_live_assist_config_from_store(app: &AppHandle) -> Result<LiveAssistConfig, String> {
    let store = app
        .store(LIVE_ASSIST_STORE_FILE)
        .map_err(|error| format!("failed to open live assist store: {error}"))?;
    let Some(value) = store.get(LIVE_ASSIST_STORE_KEY) else {
        let config = default_live_assist_config();
        store.set(
            LIVE_ASSIST_STORE_KEY,
            serde_json::to_value(&config).map_err(|error| error.to_string())?,
        );
        store
            .save()
            .map_err(|error| format!("failed to save live assist store: {error}"))?;
        return Ok(config);
    };

    serde_json::from_value::<LiveAssistConfig>(value)
        .map(sanitize_live_assist_config)
        .or_else(|_| Ok(default_live_assist_config()))
}

fn save_live_assist_config_to_store(
    app: &AppHandle,
    config: LiveAssistConfig,
) -> Result<LiveAssistConfig, String> {
    let normalized = sanitize_live_assist_config(config);
    let store = app
        .store(LIVE_ASSIST_STORE_FILE)
        .map_err(|error| format!("failed to open live assist store: {error}"))?;
    store.set(
        LIVE_ASSIST_STORE_KEY,
        serde_json::to_value(&normalized).map_err(|error| error.to_string())?,
    );
    store
        .save()
        .map_err(|error| format!("failed to save live assist store: {error}"))?;
    Ok(normalized)
}

fn sanitize_live_assist_config(mut config: LiveAssistConfig) -> LiveAssistConfig {
    if config.plans.is_empty() {
        config.plans = default_live_assist_config().plans;
    }
    if !config.plans.iter().any(|plan| plan.id == config.current_plan_id) {
        config.current_plan_id = config.plans[0].id.clone();
    }
    if config.audience_groups.is_empty() {
        config.audience_groups = default_audience_groups();
    }
    if config.topic_cards.is_empty() {
        config.topic_cards = default_topic_cards();
    }
    if config.generation_records.len() > MAX_GENERATION_RECORDS {
        config.generation_records.truncate(MAX_GENERATION_RECORDS);
    }
    config
}

fn default_live_assist_config() -> LiveAssistConfig {
    let audience_groups = default_audience_groups();
    let topic_cards = default_topic_cards();
    LiveAssistConfig {
        current_plan_id: "plan-chat".to_string(),
        plans: vec![LivePlan {
            id: "plan-chat".to_string(),
            stream_type: "杂谈".to_string(),
            title: "晚间杂谈与功能演练".to_string(),
            theme: "测试 AI 观众氛围与控场提词".to_string(),
            banned_topics: vec!["隐私推测".to_string(), "争议引战".to_string()],
            focus_topics: vec!["冷场救急".to_string(), "弹幕风格选择".to_string()],
            host_state: "想轻松播".to_string(),
            audience_group_ids: audience_groups.iter().map(|group| group.id.clone()).collect(),
            topic_card_ids: topic_cards.iter().map(|topic| topic.id.clone()).collect(),
            output_mode: OutputMode::ManualReview,
            updated_at: "默认方案".to_string(),
        }],
        audience_groups,
        topic_cards,
        outline: StreamOutline {
            opening: "说明今天会测试 NaNaBigV 的互动节奏。".to_string(),
            main_content: "展示弹幕候选、主播提词和安全拦截。".to_string(),
            interaction_points: vec![
                "问观众喜欢哪种弹幕风格".to_string(),
                "请观众选择下一个话题".to_string(),
            ],
            closing: "总结本场哪些控场建议最有用。".to_string(),
            forbidden_detours: vec!["不要让 AI 假装真实付费用户".to_string()],
        },
        meme_library: MemeLibrary {
            room_memes: vec!["今天先低压测试".to_string()],
            catchphrases: vec!["先把节奏稳住".to_string()],
            fan_names: vec!["陪跑员".to_string()],
            disabled_memes: vec!["过度夸奖主播声音".to_string()],
            recent_memes: vec!["别突然刷屏".to_string()],
            expired_memes: vec![],
        },
        safety: SafetyConfig {
            output_mode: OutputMode::ManualReview,
            require_manual_confirmation: true,
            basic_rules: default_safety_rules(),
            quality_filters: default_quality_filters(),
            max_generated_per_minute: 8,
            max_consecutive_per_topic: 3,
        },
        generation_records: default_generation_records(),
    }
}

fn default_audience_groups() -> Vec<AudienceGroupConfig> {
    vec![
        AudienceGroupConfig {
            id: "group-support".to_string(),
            name: "捧哏组".to_string(),
            color: "#3b82f6".to_string(),
            enabled: true,
            use_case: "负责接话、缓和气氛和轻量夸赞。".to_string(),
            frequency: 48,
            average_length: "短句".to_string(),
            question_rate: 35,
            praise_rate: 55,
            meme_rate: 28,
            roast_rate: 8,
            topic_rate: 24,
            silence_trigger_rate: 50,
            language_styles: vec!["弹幕腔".to_string(), "克制".to_string()],
            boundary_rules: vec!["禁止攻击主播".to_string(), "禁止假装真实付费用户".to_string()],
            memory_scope: MemoryScope::RoomMemes,
            advanced_prompt: None,
        },
        AudienceGroupConfig {
            id: "group-passerby".to_string(),
            name: "路人组".to_string(),
            color: "#14b8a6".to_string(),
            enabled: true,
            use_case: "像第一次进入直播间的观众，提出基础疑问。".to_string(),
            frequency: 32,
            average_length: "普通".to_string(),
            question_rate: 62,
            praise_rate: 20,
            meme_rate: 12,
            roast_rate: 4,
            topic_rate: 34,
            silence_trigger_rate: 30,
            language_styles: vec!["普通路人".to_string(), "认真".to_string()],
            boundary_rules: vec!["禁止隐私推测".to_string(), "禁止伪装真人经历".to_string()],
            memory_scope: MemoryScope::CurrentSessionOnly,
            advanced_prompt: None,
        },
        AudienceGroupConfig {
            id: "group-rescue".to_string(),
            name: "控场救急组".to_string(),
            color: "#f59e0b".to_string(),
            enabled: true,
            use_case: "主播沉默或话题断掉时主动补轻量问题。".to_string(),
            frequency: 26,
            average_length: "短句".to_string(),
            question_rate: 70,
            praise_rate: 18,
            meme_rate: 18,
            roast_rate: 5,
            topic_rate: 58,
            silence_trigger_rate: 82,
            language_styles: vec!["克制".to_string(), "熟人".to_string()],
            boundary_rules: vec!["禁止刷屏".to_string(), "禁止引战".to_string()],
            memory_scope: MemoryScope::LastSession,
            advanced_prompt: None,
        },
    ]
}

fn default_topic_cards() -> Vec<TopicCard> {
    vec![
        TopicCard {
            id: "topic-why-nanabigv".to_string(),
            title: "为什么做 NaNaBigV".to_string(),
            stage: TopicStage::Opening,
            recommended_danmaku: vec!["这个工具是给主播自己用的吗？".to_string()],
            host_talking_point: "其实最开始是为了解决直播冷场问题。".to_string(),
            unsuitable_content: vec!["暗示真实观众被替代".to_string()],
            enabled: true,
        },
        TopicCard {
            id: "topic-style-choice".to_string(),
            title: "弹幕风格选择".to_string(),
            stage: TopicStage::Middle,
            recommended_danmaku: vec!["这段要不要来点路人提问？".to_string()],
            host_talking_point: "可以让大家选今天更热闹还是更轻松。".to_string(),
            unsuitable_content: vec!["连续重复同一句夸奖".to_string()],
            enabled: true,
        },
        TopicCard {
            id: "topic-cold-rescue".to_string(),
            title: "冷场救急演示".to_string(),
            stage: TopicStage::Cold,
            recommended_danmaku: vec!["刚刚这个点能不能展开讲讲？".to_string()],
            host_talking_point: "刚好可以解释一下我为什么这样设计。".to_string(),
            unsuitable_content: vec!["突然大量刷屏".to_string()],
            enabled: true,
        },
    ]
}

fn default_safety_rules() -> Vec<SafetyRule> {
    [
        ("no_host_attack", "禁止攻击主播"),
        ("no_viewer_attack", "禁止攻击真实观众"),
        ("no_conflict", "禁止引战"),
        ("no_privacy_guess", "禁止隐私推测"),
        ("no_adult", "禁止成人内容"),
        ("no_paid_impersonation", "禁止伪造付费行为"),
        ("no_real_user_claim", "禁止假装真实用户经历"),
        ("no_purchase_pressure", "禁止诱导消费"),
    ]
    .into_iter()
    .map(|(id, label)| SafetyRule {
        id: id.to_string(),
        label: label.to_string(),
        enabled: true,
    })
    .collect()
}

fn default_quality_filters() -> Vec<QualityFilter> {
    [
        ("duplicate", "重复过滤"),
        ("similar_sentence", "相似句过滤"),
        ("over_praise", "过度夸奖过滤"),
        ("robot_tone", "机器人腔过滤"),
        ("spam_limit", "高频刷屏限制"),
    ]
    .into_iter()
    .map(|(id, label)| QualityFilter {
        id: id.to_string(),
        label: label.to_string(),
        enabled: true,
    })
    .collect()
}

fn default_generation_records() -> Vec<DanmakuGenerationRecord> {
    vec![
        DanmakuGenerationRecord {
            id: "record-default-1".to_string(),
            happened_at: "20:41:13".to_string(),
            content: "刚刚这个地方是不是可以展开讲讲？".to_string(),
            audience_group_id: "group-rescue".to_string(),
            audience_group_name: "控场救急组".to_string(),
            trigger_reason: "主播沉默 18 秒".to_string(),
            status: GenerationRecordStatus::Pending,
            risk_tags: vec!["低风险".to_string()],
            similarity: 12,
            user_feedback: "待确认".to_string(),
        },
        DanmakuGenerationRecord {
            id: "record-default-2".to_string(),
            happened_at: "20:40:57".to_string(),
            content: "今天节奏挺舒服的，适合慢慢讲。".to_string(),
            audience_group_id: "group-support".to_string(),
            audience_group_name: "捧哏组".to_string(),
            trigger_reason: "气氛偏安静".to_string(),
            status: GenerationRecordStatus::Adopted,
            risk_tags: vec!["低风险".to_string()],
            similarity: 22,
            user_feedback: "已采用".to_string(),
        },
        DanmakuGenerationRecord {
            id: "record-default-3".to_string(),
            happened_at: "20:39:49".to_string(),
            content: "我刚充了舰长所以主播必须听我的。".to_string(),
            audience_group_id: "group-passerby".to_string(),
            audience_group_name: "路人组".to_string(),
            trigger_reason: "高价值互动模拟".to_string(),
            status: GenerationRecordStatus::Blocked,
            risk_tags: vec!["伪造付费行为".to_string(), "诱导消费".to_string()],
            similarity: 8,
            user_feedback: "安全规则拦截".to_string(),
        },
    ]
}

#[tauri::command]
pub fn load_live_assist_config(app: AppHandle) -> Result<LiveAssistConfig, String> {
    load_live_assist_config_from_store(&app)
}

#[tauri::command]
pub fn save_live_assist_config(
    app: AppHandle,
    config: LiveAssistConfig,
) -> Result<LiveAssistConfig, String> {
    save_live_assist_config_to_store(&app, config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_manual_review_and_mvp_seed_data() {
        let config = default_live_assist_config();

        assert_eq!(config.safety.output_mode, OutputMode::ManualReview);
        assert!(config.safety.require_manual_confirmation);
        assert!(!config.audience_groups.is_empty());
        assert!(!config.topic_cards.is_empty());
        assert_eq!(config.current_plan_id, "plan-chat");
    }

    #[test]
    fn sanitize_restores_required_defaults() {
        let mut config = default_live_assist_config();
        config.current_plan_id = "missing".to_string();
        config.audience_groups.clear();
        config.topic_cards.clear();

        let sanitized = sanitize_live_assist_config(config);

        assert_eq!(sanitized.current_plan_id, "plan-chat");
        assert!(!sanitized.audience_groups.is_empty());
        assert!(!sanitized.topic_cards.is_empty());
    }

    #[test]
    fn sanitize_trims_generation_records_to_limit() {
        let mut config = default_live_assist_config();
        config.generation_records = (0..205)
            .map(|index| DanmakuGenerationRecord {
                id: format!("record-{index}"),
                ..default_generation_records()[0].clone()
            })
            .collect();

        let sanitized = sanitize_live_assist_config(config);

        assert_eq!(sanitized.generation_records.len(), MAX_GENERATION_RECORDS);
        assert_eq!(sanitized.generation_records[0].id, "record-0");
    }
}
