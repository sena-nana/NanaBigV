use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const MEMORY_STORE_FILE: &str = "memory.json";
const MEMORY_STORE_KEY: &str = "memory";
const MAX_RETRIEVAL_LIMIT: usize = 40;
const MAX_WRITE_RECORDS: usize = 80;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryLayer {
    HostProfile,
    LongTermFact,
    AudienceProfile,
    SessionRecap,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryStability {
    SingleObservation,
    Repeated,
    StreamerConfirmed,
    ExplicitRule,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryWriteStatus {
    Accepted,
    Quarantined,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPreference {
    pub label: String,
    pub detail: String,
    pub strength: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRecord {
    pub id: String,
    pub layer: MemoryLayer,
    pub summary: String,
    pub confidence: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub risk_flags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict_with: Option<String>,
    #[serde(default)]
    pub quarantined: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryBehaviorRecord {
    pub id: String,
    pub happened_at: String,
    pub interaction_type: String,
    pub detail: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HostProfileMemory {
    pub streamer_name: String,
    pub persona_summary: String,
    pub language_style: String,
    pub stream_traits: Vec<String>,
    pub stable_topics: Vec<String>,
    pub taboo_topics: Vec<String>,
    pub updated_at: String,
    pub memories: Vec<MemoryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudienceProfileMemory {
    pub id: String,
    pub name: String,
    pub tag_line: String,
    pub summary: String,
    pub role_tags: Vec<String>,
    pub activity_level: String,
    pub activity_label: String,
    pub spending_tier: String,
    pub spending_label: String,
    pub relationship: String,
    pub relationship_label: String,
    pub appearance_frequency: String,
    pub language_style: String,
    pub preferences: Vec<MemoryPreference>,
    pub memories: Vec<MemoryRecord>,
    pub recent_behaviors: Vec<MemoryBehaviorRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecapMemory {
    pub id: String,
    pub date_label: String,
    pub title: String,
    pub rhythm_label: String,
    pub summary: String,
    pub peak_moment: String,
    pub memory_writes: usize,
    pub memories: Vec<MemoryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HighlightMemory {
    pub id: String,
    pub happened_at: String,
    pub title: String,
    pub detail: String,
    pub impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionMemory {
    pub id: String,
    pub category: String,
    pub title: String,
    pub detail: String,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWriteRecord {
    pub id: String,
    pub layer: MemoryLayer,
    pub status: MemoryWriteStatus,
    pub summary: String,
    pub reason: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub risk_flags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict_with: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStoreSnapshot {
    pub host_profile: HostProfileMemory,
    pub long_term_facts: Vec<MemoryRecord>,
    pub audience_profiles: Vec<AudienceProfileMemory>,
    pub session_recaps: Vec<SessionRecapMemory>,
    pub highlights: Vec<HighlightMemory>,
    pub suggestions: Vec<SuggestionMemory>,
    pub write_records: Vec<MemoryWriteRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRetrieveRequest {
    #[serde(default)]
    pub layers: Vec<MemoryLayer>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRetrieveResult {
    pub items: Vec<MemoryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWriteInput {
    pub layer: MemoryLayer,
    pub summary: String,
    pub source: String,
    #[serde(default)]
    pub evidence: Vec<String>,
    pub confidence: f64,
    pub stability: MemoryStability,
    #[serde(default)]
    pub pollution_risks: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict_with: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWriteResult {
    pub status: MemoryWriteStatus,
    pub record: MemoryWriteRecord,
    pub snapshot: MemoryStoreSnapshot,
}

fn load_memory_snapshot_from_store(app: &AppHandle) -> Result<MemoryStoreSnapshot, String> {
    let store = app
        .store(MEMORY_STORE_FILE)
        .map_err(|error| format!("failed to open memory store: {error}"))?;
    let Some(value) = store.get(MEMORY_STORE_KEY) else {
        let snapshot = default_memory_snapshot();
        let value = serde_json::to_value(&snapshot).map_err(|error| error.to_string())?;
        store.set(MEMORY_STORE_KEY, value);
        store
            .save()
            .map_err(|error| format!("failed to save memory store: {error}"))?;
        return Ok(snapshot);
    };

    serde_json::from_value::<MemoryStoreSnapshot>(value).or_else(|_| Ok(default_memory_snapshot()))
}

fn save_memory_snapshot_to_store(
    app: &AppHandle,
    snapshot: &MemoryStoreSnapshot,
) -> Result<(), String> {
    let store = app
        .store(MEMORY_STORE_FILE)
        .map_err(|error| format!("failed to open memory store: {error}"))?;
    let value = serde_json::to_value(snapshot).map_err(|error| error.to_string())?;
    store.set(MEMORY_STORE_KEY, value);
    store
        .save()
        .map_err(|error| format!("failed to save memory store: {error}"))
}

fn retrieve_memory_from_snapshot(
    snapshot: &MemoryStoreSnapshot,
    request: MemoryRetrieveRequest,
) -> MemoryRetrieveResult {
    let mut items = collect_memory_records(snapshot);
    if !request.layers.is_empty() {
        items.retain(|item| request.layers.contains(&item.layer));
    }
    if let Some(audience_id) = request.audience_id.as_deref().map(str::trim) {
        if !audience_id.is_empty() {
            items.retain(|item| item.audience_id.as_deref() == Some(audience_id));
        }
    }
    if let Some(query) = request.query.as_deref().map(normalize_query) {
        if !query.is_empty() {
            items.retain(|item| memory_matches(item, &query));
        }
    }

    let limit = request.limit.unwrap_or(12).clamp(1, MAX_RETRIEVAL_LIMIT);
    items.truncate(limit);
    MemoryRetrieveResult { items }
}

fn collect_memory_records(snapshot: &MemoryStoreSnapshot) -> Vec<MemoryRecord> {
    let mut items = Vec::new();
    items.extend(snapshot.host_profile.memories.clone());
    items.extend(snapshot.long_term_facts.clone());
    for audience in &snapshot.audience_profiles {
        items.extend(audience.memories.clone());
    }
    for session in &snapshot.session_recaps {
        items.extend(session.memories.clone());
    }
    items
}

fn memory_matches(item: &MemoryRecord, query: &str) -> bool {
    let mut haystack = format!(
        "{} {} {} {}",
        item.id, item.summary, item.confidence, item.updated_at
    );
    if let Some(audience_id) = &item.audience_id {
        haystack.push(' ');
        haystack.push_str(audience_id);
    }
    normalize_query(&haystack).contains(query)
}

fn normalize_query(value: &str) -> String {
    value.trim().to_lowercase()
}

fn apply_memory_write(
    mut snapshot: MemoryStoreSnapshot,
    input: MemoryWriteInput,
    now_label: &str,
) -> MemoryWriteResult {
    let summary = input.summary.trim().to_string();
    let (status, reason) = evaluate_memory_write(&snapshot, &input, &summary);
    let write_seq = snapshot.write_records.len() + 1;
    let record = MemoryWriteRecord {
        id: write_id("write", now_label, write_seq),
        layer: input.layer,
        status,
        summary: if summary.is_empty() {
            "(空写回候选)".to_string()
        } else {
            summary.clone()
        },
        reason,
        updated_at: now_label.to_string(),
        audience_id: input.audience_id.clone(),
        risk_flags: input.pollution_risks.clone(),
        conflict_with: input.conflict_with.clone(),
    };

    if status == MemoryWriteStatus::Accepted {
        let memory = MemoryRecord {
            id: write_id("mem-write", now_label, write_seq),
            layer: input.layer,
            summary,
            confidence: confidence_label(input.confidence),
            updated_at: now_label.to_string(),
            audience_id: input.audience_id.clone(),
            evidence: input.evidence.clone(),
            risk_flags: input.pollution_risks.clone(),
            conflict_with: input.conflict_with.clone(),
            quarantined: false,
        };
        accept_memory(&mut snapshot, input, memory);
    }

    snapshot.write_records.insert(0, record.clone());
    if snapshot.write_records.len() > MAX_WRITE_RECORDS {
        snapshot.write_records.truncate(MAX_WRITE_RECORDS);
    }

    MemoryWriteResult {
        status,
        record,
        snapshot,
    }
}

fn write_id(prefix: &str, now_label: &str, sequence: usize) -> String {
    format!("{prefix}-{}-{sequence}", now_label.replace([' ', ':'], "-"))
}

fn evaluate_memory_write(
    snapshot: &MemoryStoreSnapshot,
    input: &MemoryWriteInput,
    summary: &str,
) -> (MemoryWriteStatus, String) {
    if summary.is_empty() {
        return (
            MemoryWriteStatus::Rejected,
            "写回内容为空，已拒绝。".to_string(),
        );
    }
    if input
        .conflict_with
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        return (
            MemoryWriteStatus::Quarantined,
            "候选内容与既有记忆冲突，进入待确认状态，不覆盖稳定数据。".to_string(),
        );
    }

    match input.layer {
        MemoryLayer::SessionRecap => (
            MemoryWriteStatus::Accepted,
            "场次摘要承接短期事实，已写入单场摘要层。".to_string(),
        ),
        MemoryLayer::LongTermFact => {
            let stable = matches!(
                input.stability,
                MemoryStability::Repeated | MemoryStability::StreamerConfirmed
            );
            if !stable || input.confidence < 0.7 {
                return (
                    MemoryWriteStatus::Rejected,
                    "长期互动事实只接受重复出现或主播确认且置信度足够的内容。".to_string(),
                );
            }
            if !input.pollution_risks.is_empty() {
                return (
                    MemoryWriteStatus::Rejected,
                    "候选内容存在污染风险，未写入长期互动事实。".to_string(),
                );
            }
            (
                MemoryWriteStatus::Accepted,
                "稳定事实通过阈值，已写入长期互动事实。".to_string(),
            )
        }
        MemoryLayer::AudienceProfile => {
            let Some(audience_id) = input.audience_id.as_deref() else {
                return (
                    MemoryWriteStatus::Rejected,
                    "观众画像写回必须指定 audienceId。".to_string(),
                );
            };
            if !snapshot
                .audience_profiles
                .iter()
                .any(|profile| profile.id == audience_id)
            {
                return (
                    MemoryWriteStatus::Rejected,
                    "观众画像写回目标不存在，已拒绝。".to_string(),
                );
            }
            if input.evidence.is_empty() {
                return (
                    MemoryWriteStatus::Rejected,
                    "观众画像写回必须保留证据来源。".to_string(),
                );
            }
            if !input.pollution_risks.is_empty() || input.confidence < 0.55 {
                return (
                    MemoryWriteStatus::Quarantined,
                    "画像候选置信度不足或存在污染风险，进入待确认状态。".to_string(),
                );
            }
            (
                MemoryWriteStatus::Accepted,
                "画像候选具备证据且风险可控，已追加为画像记忆。".to_string(),
            )
        }
        MemoryLayer::HostProfile => {
            let allowed = matches!(
                input.stability,
                MemoryStability::StreamerConfirmed | MemoryStability::ExplicitRule
            );
            if !allowed || input.confidence < 0.75 {
                return (
                    MemoryWriteStatus::Rejected,
                    "主播设定只接受主播确认或显式规则来源的高置信内容。".to_string(),
                );
            }
            if !input.pollution_risks.is_empty() {
                return (
                    MemoryWriteStatus::Rejected,
                    "主播设定候选存在污染风险，已拒绝。".to_string(),
                );
            }
            (
                MemoryWriteStatus::Accepted,
                "主播设定候选来源明确，已追加到主播设定记忆。".to_string(),
            )
        }
    }
}

fn accept_memory(
    snapshot: &mut MemoryStoreSnapshot,
    input: MemoryWriteInput,
    memory: MemoryRecord,
) {
    match input.layer {
        MemoryLayer::HostProfile => {
            snapshot.host_profile.memories.insert(0, memory);
            snapshot.host_profile.updated_at = "刚刚".to_string();
        }
        MemoryLayer::LongTermFact => {
            snapshot.long_term_facts.insert(0, memory);
        }
        MemoryLayer::AudienceProfile => {
            if let Some(audience_id) = input.audience_id.as_deref() {
                if let Some(profile) = snapshot
                    .audience_profiles
                    .iter_mut()
                    .find(|profile| profile.id == audience_id)
                {
                    profile.memories.insert(0, memory);
                }
            }
        }
        MemoryLayer::SessionRecap => {
            let title = input
                .title
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("写回候选摘要");
            snapshot.session_recaps.insert(
                0,
                SessionRecapMemory {
                    id: format!("session-write-{}", snapshot.session_recaps.len() + 1),
                    date_label: "本场".to_string(),
                    title: title.to_string(),
                    rhythm_label: "待复盘".to_string(),
                    summary: memory.summary.clone(),
                    peak_moment: "由受控写回入口追加，后续复盘时合并。".to_string(),
                    memory_writes: 1,
                    memories: vec![memory],
                },
            );
        }
    }
}

fn confidence_label(value: f64) -> String {
    if value >= 0.8 {
        "高置信".to_string()
    } else if value >= 0.55 {
        "中置信".to_string()
    } else {
        "低置信".to_string()
    }
}

fn default_memory_snapshot() -> MemoryStoreSnapshot {
    MemoryStoreSnapshot {
        host_profile: HostProfileMemory {
            streamer_name: "主播：青栀".to_string(),
            persona_summary: "反应快、愿意把思路讲给观众听，擅长把调试过程讲成互动内容。".to_string(),
            language_style: "快语速、口头禅稳定，适合高频短弹幕和少量建议型 SC。".to_string(),
            stream_traits: vec![
                "擅长临场接梗".to_string(),
                "调试过程可直播化".to_string(),
                "高峰时段更适合轻吐槽互动".to_string(),
            ],
            stable_topics: vec![
                "玩法点评".to_string(),
                "开发现场".to_string(),
                "翻车复盘".to_string(),
                "观众接梗".to_string(),
            ],
            taboo_topics: vec![
                "长时间纯静音调试".to_string(),
                "连续高额消费暗示".to_string(),
                "未经确认的现实人设扩写".to_string(),
            ],
            updated_at: "今天 19:58".to_string(),
            memories: vec![MemoryRecord {
                id: "host-memory-1".to_string(),
                layer: MemoryLayer::HostProfile,
                summary: "主播确认过调试段落需要讲清目标和结果，不能长时间沉默。".to_string(),
                confidence: "高置信".to_string(),
                updated_at: "今天 19:58".to_string(),
                audience_id: None,
                evidence: vec!["主播语音确认".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            }],
        },
        long_term_facts: vec![
            MemoryRecord {
                id: "fact-a-li-chain".to_string(),
                layer: MemoryLayer::LongTermFact,
                summary: "当主播开始念弹幕时，阿黎经常第一时间起头制造连锁互动。".to_string(),
                confidence: "高置信".to_string(),
                updated_at: "昨天 23:14".to_string(),
                audience_id: Some("a-li".to_string()),
                evidence: vec!["多场弹幕记录".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            },
            MemoryRecord {
                id: "fact-jing-dao-close".to_string(),
                layer: MemoryLayer::LongTermFact,
                summary: "镜岛常在收尾阶段帮助主播回收节奏，适合做收束型互动。".to_string(),
                confidence: "高置信".to_string(),
                updated_at: "5 天前".to_string(),
                audience_id: Some("jing-dao".to_string()),
                evidence: vec!["历史收尾场次".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            },
        ],
        audience_profiles: default_audience_profiles(),
        session_recaps: default_session_recaps(),
        highlights: vec![
            HighlightMemory {
                id: "highlight-1".to_string(),
                happened_at: "20:46".to_string(),
                title: "翻车讲解触发连锁互动".to_string(),
                detail: "主播主动拆解错误原因后，熟客型观众连续接梗，互动密度迅速抬升。".to_string(),
                impact: "证明“讲思路”比“闷头修”更能带起实时观众反应。".to_string(),
            },
            HighlightMemory {
                id: "highlight-2".to_string(),
                happened_at: "21:08".to_string(),
                title: "剧情点评吸引建议型观众".to_string(),
                detail: "当直播进入明确主题讨论时，建议型观众更愿意发长弹幕或 SC。".to_string(),
                impact: "适合在高峰段安排可讨论议题，提升高质量发言比例。".to_string(),
            },
            HighlightMemory {
                id: "highlight-3".to_string(),
                happened_at: "20:32".to_string(),
                title: "调试目标公开后恢复节奏".to_string(),
                detail: "明确告诉观众“现在在修什么”后，空场时间明显缩短。".to_string(),
                impact: "说明需要把上下文窗口中的目标状态更清晰地暴露给前端工作台。".to_string(),
            },
        ],
        suggestions: vec![
            SuggestionMemory {
                id: "suggestion-1".to_string(),
                category: "直播节奏".to_string(),
                title: "把调试段落拆成“目标 -> 过程 -> 结论”三段".to_string(),
                detail: "当前高活跃观众能接受调试，但需要明确每段要解决什么，否则会触发节流和掉线式沉默。".to_string(),
                priority: "高优先级".to_string(),
            },
            SuggestionMemory {
                id: "suggestion-2".to_string(),
                category: "互动编排".to_string(),
                title: "在高峰前 5 分钟预热熟客型短弹幕".to_string(),
                detail: "阿黎、镜岛这类观众更适合做开场与收尾的节奏桥梁，不建议一上来就放高价值互动。".to_string(),
                priority: "中优先级".to_string(),
            },
            SuggestionMemory {
                id: "suggestion-3".to_string(),
                category: "记忆策略".to_string(),
                title: "只把稳定偏好写入长期层，新观众先停留在场次摘要".to_string(),
                detail: "糖霜六号这类画像仍不稳定，先保留为场次观察记录，避免过早固化。".to_string(),
                priority: "高优先级".to_string(),
            },
        ],
        write_records: vec![],
    }
}

fn default_audience_profiles() -> Vec<AudienceProfileMemory> {
    vec![
        AudienceProfileMemory {
            id: "a-li".to_string(),
            name: "阿黎".to_string(),
            tag_line: "高活跃 / 熟客 / 轻度付费".to_string(),
            summary: "偏吐槽型熟客，喜欢接主播口癖和场面梗，常承担冷场启动。".to_string(),
            role_tags: vec![
                "接梗快".to_string(),
                "高活跃".to_string(),
                "轻吐槽".to_string(),
            ],
            activity_level: "high".to_string(),
            activity_label: "高活跃".to_string(),
            spending_tier: "medium".to_string(),
            spending_label: "中消费".to_string(),
            relationship: "core".to_string(),
            relationship_label: "核心熟客".to_string(),
            appearance_frequency: "几乎每场都在".to_string(),
            language_style: "短句吐槽 + 轻微阴阳，但不会越界。".to_string(),
            preferences: vec![
                MemoryPreference {
                    label: "互动偏好".to_string(),
                    detail: "喜欢主播自嘲、翻车补救和节奏拉扯。".to_string(),
                    strength: "强".to_string(),
                },
                MemoryPreference {
                    label: "礼物倾向".to_string(),
                    detail: "更偏好低额礼物和集中刷屏配合。".to_string(),
                    strength: "中".to_string(),
                },
                MemoryPreference {
                    label: "回避项".to_string(),
                    detail: "不喜欢长时间技术调试和空镜头。".to_string(),
                    strength: "强".to_string(),
                },
            ],
            memories: vec![MemoryRecord {
                id: "profile-a-li-humor".to_string(),
                layer: MemoryLayer::AudienceProfile,
                summary: "对主播的自黑式幽默容忍度高，但不喜欢硬切商务口播。".to_string(),
                confidence: "中置信".to_string(),
                updated_at: "3 天前".to_string(),
                audience_id: Some("a-li".to_string()),
                evidence: vec!["多轮互动表现".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            }],
            recent_behaviors: vec![
                MemoryBehaviorRecord {
                    id: "behavior-1".to_string(),
                    happened_at: "20:41".to_string(),
                    interaction_type: "danmaku".to_string(),
                    detail: "在主播改设置时发起“别修了快开播”的吐槽。".to_string(),
                    result: "带动 6 条跟风弹幕".to_string(),
                },
                MemoryBehaviorRecord {
                    id: "behavior-2".to_string(),
                    happened_at: "20:33".to_string(),
                    interaction_type: "gift".to_string(),
                    detail: "配合主播解释 bug 起因送出荧光棒。".to_string(),
                    result: "提升互动密度".to_string(),
                },
            ],
        },
        AudienceProfileMemory {
            id: "bei-jie-zhou".to_string(),
            name: "北街舟".to_string(),
            tag_line: "中活跃 / 老观众 / 稳定消费".to_string(),
            summary: "更像氛围维护者，愿意在合适时机打赏，但讨厌刷屏和过度表演。".to_string(),
            role_tags: vec![
                "氛围维护".to_string(),
                "稳定消费".to_string(),
                "节奏保守".to_string(),
            ],
            activity_level: "medium".to_string(),
            activity_label: "中活跃".to_string(),
            spending_tier: "high".to_string(),
            spending_label: "高消费".to_string(),
            relationship: "regular".to_string(),
            relationship_label: "稳定观众".to_string(),
            appearance_frequency: "每周 3 到 4 场".to_string(),
            language_style: "完整句子、语气平和，偏建议型表达。".to_string(),
            preferences: vec![
                MemoryPreference {
                    label: "互动偏好".to_string(),
                    detail: "偏好主播讲解思路、复盘失败原因。".to_string(),
                    strength: "强".to_string(),
                },
                MemoryPreference {
                    label: "礼物倾向".to_string(),
                    detail: "偶尔中额礼物，不喜欢连续高额消费。".to_string(),
                    strength: "中".to_string(),
                },
                MemoryPreference {
                    label: "回避项".to_string(),
                    detail: "排斥太刻意的人设演出。".to_string(),
                    strength: "中".to_string(),
                },
            ],
            memories: vec![MemoryRecord {
                id: "profile-bei-review".to_string(),
                layer: MemoryLayer::AudienceProfile,
                summary: "当主播进入复盘模式时，北街舟更可能发送长弹幕或建议型 SC。".to_string(),
                confidence: "高置信".to_string(),
                updated_at: "今天 10:02".to_string(),
                audience_id: Some("bei-jie-zhou".to_string()),
                evidence: vec!["复盘场互动".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            }],
            recent_behaviors: vec![
                MemoryBehaviorRecord {
                    id: "behavior-3".to_string(),
                    happened_at: "20:36".to_string(),
                    interaction_type: "gift".to_string(),
                    detail: "在主播解释系统边界时送出中额礼物。".to_string(),
                    result: "强化正向反馈".to_string(),
                },
                MemoryBehaviorRecord {
                    id: "behavior-4".to_string(),
                    happened_at: "20:18".to_string(),
                    interaction_type: "super_chat".to_string(),
                    detail: "建议下一轮把视觉摘要权重下调。".to_string(),
                    result: "被记为调优建议".to_string(),
                },
            ],
        },
        AudienceProfileMemory {
            id: "tang-shuang".to_string(),
            name: "糖霜六号".to_string(),
            tag_line: "低活跃 / 新观众 / 谨慎消费".to_string(),
            summary: "偶发高价值表达，但稳定性不足，适合作为新观众观察样本。".to_string(),
            role_tags: vec![
                "新观众".to_string(),
                "偶发高价值".to_string(),
                "不稳定".to_string(),
            ],
            activity_level: "low".to_string(),
            activity_label: "低活跃".to_string(),
            spending_tier: "high".to_string(),
            spending_label: "高消费".to_string(),
            relationship: "new".to_string(),
            relationship_label: "新观众".to_string(),
            appearance_frequency: "近两场新出现".to_string(),
            language_style: "比较直接，经常给出目标导向建议。".to_string(),
            preferences: vec![
                MemoryPreference {
                    label: "互动偏好".to_string(),
                    detail: "偏好有明确主题和目标的直播段落。".to_string(),
                    strength: "中".to_string(),
                },
                MemoryPreference {
                    label: "礼物倾向".to_string(),
                    detail: "更可能用 SC 提建议，而不是刷普通弹幕。".to_string(),
                    strength: "强".to_string(),
                },
                MemoryPreference {
                    label: "回避项".to_string(),
                    detail: "不喜欢长时间无结果的调试过程。".to_string(),
                    strength: "强".to_string(),
                },
            ],
            memories: vec![MemoryRecord {
                id: "profile-tang-unstable".to_string(),
                layer: MemoryLayer::AudienceProfile,
                summary: "当前画像波动较大，仍需更多场次确认其稳定表达方式。".to_string(),
                confidence: "低置信".to_string(),
                updated_at: "今天 20:05".to_string(),
                audience_id: Some("tang-shuang".to_string()),
                evidence: vec!["近两场观察".to_string()],
                risk_flags: vec!["新观众样本不足".to_string()],
                conflict_with: None,
                quarantined: false,
            }],
            recent_behaviors: vec![MemoryBehaviorRecord {
                id: "behavior-5".to_string(),
                happened_at: "20:40".to_string(),
                interaction_type: "super_chat".to_string(),
                detail: "建议主播快速切回剧情点评。".to_string(),
                result: "因 SC 通道关闭被节流".to_string(),
            }],
        },
        AudienceProfileMemory {
            id: "jing-dao".to_string(),
            name: "镜岛".to_string(),
            tag_line: "中活跃 / 熟客 / 低消费".to_string(),
            summary: "偏陪伴型观众，更关注直播氛围完整性和主播个人状态。".to_string(),
            role_tags: vec![
                "陪伴型".to_string(),
                "熟客".to_string(),
                "低消费".to_string(),
            ],
            activity_level: "medium".to_string(),
            activity_label: "中活跃".to_string(),
            spending_tier: "low".to_string(),
            spending_label: "低消费".to_string(),
            relationship: "regular".to_string(),
            relationship_label: "稳定观众".to_string(),
            appearance_frequency: "常出现在收尾时段".to_string(),
            language_style: "更柔和，经常发安抚型短句。".to_string(),
            preferences: vec![
                MemoryPreference {
                    label: "互动偏好".to_string(),
                    detail: "偏好主播聊状态、收尾总结和日常碎片。".to_string(),
                    strength: "中".to_string(),
                },
                MemoryPreference {
                    label: "礼物倾向".to_string(),
                    detail: "更可能触发 membership 而不是直接打赏。".to_string(),
                    strength: "低".to_string(),
                },
                MemoryPreference {
                    label: "回避项".to_string(),
                    detail: "不喜欢明显攻击性的观众互喷。".to_string(),
                    strength: "强".to_string(),
                },
            ],
            memories: vec![],
            recent_behaviors: vec![MemoryBehaviorRecord {
                id: "behavior-6".to_string(),
                happened_at: "20:39".to_string(),
                interaction_type: "membership".to_string(),
                detail: "舰长欢迎语排队中，尚未进入真实平台链路。".to_string(),
                result: "等待投递队列处理".to_string(),
            }],
        },
    ]
}

fn default_session_recaps() -> Vec<SessionRecapMemory> {
    vec![
        SessionRecapMemory {
            id: "session-1".to_string(),
            date_label: "06-17".to_string(),
            title: "玩法试玩 + 调试并行".to_string(),
            rhythm_label: "中段升温明显".to_string(),
            summary: "主播把一次配置失败转成了临场讲解，互动密度在 15 分钟后明显拉升。".to_string(),
            peak_moment: "20:46 主播自嘲配置翻车，弹幕接梗形成连续 18 条互动。".to_string(),
            memory_writes: 3,
            memories: vec![MemoryRecord {
                id: "session-memory-1".to_string(),
                layer: MemoryLayer::SessionRecap,
                summary: "上场直播在高峰段主动提醒主播回收话题，效果良好。".to_string(),
                confidence: "中置信".to_string(),
                updated_at: "昨天 00:12".to_string(),
                audience_id: Some("bei-jie-zhou".to_string()),
                evidence: vec!["场次复盘".to_string()],
                risk_flags: vec![],
                conflict_with: None,
                quarantined: false,
            }],
        },
        SessionRecapMemory {
            id: "session-2".to_string(),
            date_label: "06-15".to_string(),
            title: "剧情点评场".to_string(),
            rhythm_label: "稳定平缓".to_string(),
            summary: "观众更偏向长弹幕和建议型发言，礼物和 SC 占比降低。".to_string(),
            peak_moment: "21:08 对结局展开争论，适合放大熟客型观众表达。".to_string(),
            memory_writes: 2,
            memories: vec![],
        },
        SessionRecapMemory {
            id: "session-3".to_string(),
            date_label: "06-12".to_string(),
            title: "系统调优预演".to_string(),
            rhythm_label: "前冷后热".to_string(),
            summary: "前半段技术细节过重，后半段通过主播讲述调优目标才恢复互动。".to_string(),
            peak_moment: "20:32 明确目标后，观众开始集中提建议。".to_string(),
            memory_writes: 4,
            memories: vec![],
        },
    ]
}

#[tauri::command]
pub fn load_memory_snapshot(app: AppHandle) -> Result<MemoryStoreSnapshot, String> {
    load_memory_snapshot_from_store(&app)
}

#[tauri::command]
pub fn retrieve_memory(
    app: AppHandle,
    request: MemoryRetrieveRequest,
) -> Result<MemoryRetrieveResult, String> {
    let snapshot = load_memory_snapshot_from_store(&app)?;
    Ok(retrieve_memory_from_snapshot(&snapshot, request))
}

#[tauri::command]
pub fn submit_memory_write(
    app: AppHandle,
    input: MemoryWriteInput,
) -> Result<MemoryWriteResult, String> {
    let snapshot = load_memory_snapshot_from_store(&app)?;
    let result = apply_memory_write(snapshot, input, "刚刚");
    save_memory_snapshot_to_store(&app, &result.snapshot)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_input(layer: MemoryLayer, summary: &str) -> MemoryWriteInput {
        MemoryWriteInput {
            layer,
            summary: summary.to_string(),
            source: "unit-test".to_string(),
            evidence: vec!["测试证据".to_string()],
            confidence: 0.8,
            stability: MemoryStability::Repeated,
            pollution_risks: vec![],
            audience_id: None,
            conflict_with: None,
            title: None,
        }
    }

    #[test]
    fn default_seed_has_fixed_four_layers() {
        let snapshot = default_memory_snapshot();
        let retrieved = retrieve_memory_from_snapshot(
            &snapshot,
            MemoryRetrieveRequest {
                layers: vec![],
                audience_id: None,
                query: None,
                limit: Some(100),
            },
        );

        assert_eq!(snapshot.host_profile.streamer_name, "主播：青栀");
        assert!(!snapshot.long_term_facts.is_empty());
        assert!(!snapshot.audience_profiles.is_empty());
        assert!(!snapshot.session_recaps.is_empty());
        assert!(retrieved
            .items
            .iter()
            .any(|item| item.layer == MemoryLayer::HostProfile));
        assert!(retrieved
            .items
            .iter()
            .any(|item| item.layer == MemoryLayer::LongTermFact));
        assert!(retrieved
            .items
            .iter()
            .any(|item| item.layer == MemoryLayer::AudienceProfile));
        assert!(retrieved
            .items
            .iter()
            .any(|item| item.layer == MemoryLayer::SessionRecap));
    }

    #[test]
    fn retrieval_filters_by_layer_audience_and_query() {
        let snapshot = default_memory_snapshot();

        let result = retrieve_memory_from_snapshot(
            &snapshot,
            MemoryRetrieveRequest {
                layers: vec![MemoryLayer::AudienceProfile],
                audience_id: Some("a-li".to_string()),
                query: Some("自黑式幽默".to_string()),
                limit: Some(5),
            },
        );

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].audience_id.as_deref(), Some("a-li"));
        assert_eq!(result.items[0].layer, MemoryLayer::AudienceProfile);
    }

    #[test]
    fn long_term_fact_rejects_polluted_or_unstable_candidates() {
        let snapshot = default_memory_snapshot();
        let mut polluted = write_input(MemoryLayer::LongTermFact, "主播现实身份可能是某职业");
        polluted.pollution_risks = vec!["未经确认的现实人设扩写".to_string()];

        let result = apply_memory_write(snapshot.clone(), polluted, "刚刚");
        assert_eq!(result.status, MemoryWriteStatus::Rejected);
        assert_eq!(
            result.snapshot.long_term_facts.len(),
            snapshot.long_term_facts.len()
        );

        let mut unstable = write_input(MemoryLayer::LongTermFact, "单场偶发偏好");
        unstable.stability = MemoryStability::SingleObservation;
        let result = apply_memory_write(snapshot.clone(), unstable, "刚刚");
        assert_eq!(result.status, MemoryWriteStatus::Rejected);
        assert_eq!(
            result.snapshot.long_term_facts.len(),
            snapshot.long_term_facts.len()
        );
    }

    #[test]
    fn conflicting_memory_is_quarantined_without_overwrite() {
        let snapshot = default_memory_snapshot();
        let mut input = write_input(MemoryLayer::AudienceProfile, "阿黎完全不喜欢主播自嘲");
        input.audience_id = Some("a-li".to_string());
        input.conflict_with = Some("profile-a-li-humor".to_string());

        let result = apply_memory_write(snapshot.clone(), input, "刚刚");

        assert_eq!(result.status, MemoryWriteStatus::Quarantined);
        assert_eq!(
            result.snapshot.audience_profiles,
            snapshot.audience_profiles
        );
        assert_eq!(
            result.snapshot.write_records[0].conflict_with.as_deref(),
            Some("profile-a-li-humor")
        );
    }

    #[test]
    fn session_recap_accepts_short_term_fact() {
        let snapshot = default_memory_snapshot();
        let mut input = write_input(MemoryLayer::SessionRecap, "本场调试前 10 分钟互动密度偏低");
        input.stability = MemoryStability::SingleObservation;
        input.confidence = 0.4;
        input.pollution_risks = vec!["单场观察".to_string()];
        input.title = Some("调试冷场观察".to_string());

        let result = apply_memory_write(snapshot.clone(), input, "刚刚");

        assert_eq!(result.status, MemoryWriteStatus::Accepted);
        assert_eq!(
            result.snapshot.session_recaps.len(),
            snapshot.session_recaps.len() + 1
        );
        assert_eq!(result.snapshot.session_recaps[0].title, "调试冷场观察");
        assert_eq!(
            result.snapshot.write_records[0].status,
            MemoryWriteStatus::Accepted
        );
    }
}
