use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const WINDOW_SECONDS: u64 = 300;
const ONLINE_SECONDS: u64 = 60;
const MAX_EVENTS: usize = 80;
const MAX_CONTENT_CHARS: usize = 2_000;
const SUMMARY_CHARS: usize = 120;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContextSourceKind {
    Voice,
    EchoLive,
    Vision,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextEventInput {
    pub source: ContextSourceKind,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextEvent {
    pub id: String,
    pub source: ContextSourceKind,
    pub content: String,
    pub summary: String,
    pub occurred_at: u64,
    pub received_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContextSourceStatus {
    pub source: ContextSourceKind,
    pub label: String,
    pub status_label: String,
    pub tone: String,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_event_at: Option<u64>,
    pub event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextWindowSnapshot {
    pub window_started_at: u64,
    pub window_seconds: u64,
    pub events: Vec<ContextEvent>,
    pub source_statuses: Vec<ContextSourceStatus>,
}

#[derive(Debug, Default)]
pub struct ContextWindowState {
    events: Vec<ContextEvent>,
    next_seq: u64,
}

impl ContextWindowState {
    fn submit(
        &mut self,
        input: ContextEventInput,
        now: u64,
    ) -> Result<ContextWindowSnapshot, String> {
        let trimmed = input.content.trim();
        if trimmed.is_empty() {
            return Err("主播语音文本不能为空".to_string());
        }

        self.prune(now);

        if input.source == ContextSourceKind::Voice {
            self.next_seq += 1;
            let content = limit_chars(trimmed, MAX_CONTENT_CHARS);
            let summary = input
                .summary
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| limit_chars(value, SUMMARY_CHARS))
                .unwrap_or_else(|| summarize(&content));
            let received_at = now;
            let occurred_at = input.occurred_at.unwrap_or(received_at);
            let event = ContextEvent {
                id: format!("ctx-{received_at}-{}", self.next_seq),
                source: input.source,
                content,
                summary,
                occurred_at,
                received_at,
                confidence: input.confidence,
                status: "accepted".to_string(),
            };

            self.events.insert(0, event);
            self.prune(now);
        }

        Ok(self.snapshot(now))
    }

    fn snapshot(&mut self, now: u64) -> ContextWindowSnapshot {
        self.prune(now);
        ContextWindowSnapshot {
            window_started_at: now.saturating_sub(WINDOW_SECONDS * 1_000),
            window_seconds: WINDOW_SECONDS,
            events: self.events.clone(),
            source_statuses: source_statuses(&self.events, now),
        }
    }

    fn clear(&mut self, now: u64) -> ContextWindowSnapshot {
        self.events.clear();
        self.snapshot(now)
    }

    fn prune(&mut self, now: u64) {
        let window_started_at = now.saturating_sub(WINDOW_SECONDS * 1_000);
        self.events
            .retain(|event| event.received_at >= window_started_at);
        self.events
            .sort_by(|left, right| right.received_at.cmp(&left.received_at));
        if self.events.len() > MAX_EVENTS {
            self.events.truncate(MAX_EVENTS);
        }
    }
}

fn source_statuses(events: &[ContextEvent], now: u64) -> Vec<ContextSourceStatus> {
    vec![
        voice_status(events, now),
        reserved_status(
            ContextSourceKind::EchoLive,
            "Echo-Live",
            "Echo-Live 输入适配器已预留，阶段 3 不接入真实事件。",
        ),
        reserved_status(
            ContextSourceKind::Vision,
            "视觉上下文",
            "视觉摘要输入接口已预留，阶段 3 不处理原始视频流。",
        ),
    ]
}

fn voice_status(events: &[ContextEvent], now: u64) -> ContextSourceStatus {
    let voice_events: Vec<&ContextEvent> = events
        .iter()
        .filter(|event| event.source == ContextSourceKind::Voice)
        .collect();
    let last_event_at = voice_events.first().map(|event| event.received_at);

    let (status_label, tone, summary) = match last_event_at {
        Some(value) if now.saturating_sub(value) <= ONLINE_SECONDS * 1_000 => (
            "在线",
            "ok",
            format!(
                "最近 60 秒内收到主播语音文本，当前窗口有 {} 条输入。",
                voice_events.len()
            ),
        ),
        Some(_) => (
            "空闲",
            "warn",
            format!(
                "最近 5 分钟窗口内有 {} 条主播语音文本，但 60 秒内没有新输入。",
                voice_events.len()
            ),
        ),
        None => (
            "待输入",
            "info",
            "等待本地 ASR 或手动面板提交主播语音文本。".to_string(),
        ),
    };

    ContextSourceStatus {
        source: ContextSourceKind::Voice,
        label: "主播语音".to_string(),
        status_label: status_label.to_string(),
        tone: tone.to_string(),
        summary,
        last_event_at,
        event_count: voice_events.len(),
    }
}

fn reserved_status(source: ContextSourceKind, label: &str, summary: &str) -> ContextSourceStatus {
    ContextSourceStatus {
        source,
        label: label.to_string(),
        status_label: "预留接口".to_string(),
        tone: "info".to_string(),
        summary: summary.to_string(),
        last_event_at: None,
        event_count: 0,
    }
}

fn summarize(value: &str) -> String {
    limit_chars(value, SUMMARY_CHARS)
}

fn limit_chars(value: &str, limit: usize) -> String {
    let mut output: String = value.chars().take(limit).collect();
    if value.chars().count() > limit {
        output.push('…');
    }
    output
}

fn now_ms() -> u64 {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    duration.as_millis() as u64
}

#[tauri::command]
pub fn submit_context_event(
    state: State<'_, Mutex<ContextWindowState>>,
    event: ContextEventInput,
) -> Result<ContextWindowSnapshot, String> {
    state
        .lock()
        .map_err(|_| "上下文窗口状态锁定失败".to_string())?
        .submit(event, now_ms())
}

#[tauri::command]
pub fn load_context_window(
    state: State<'_, Mutex<ContextWindowState>>,
) -> Result<ContextWindowSnapshot, String> {
    Ok(state
        .lock()
        .map_err(|_| "上下文窗口状态锁定失败".to_string())?
        .snapshot(now_ms()))
}

#[tauri::command]
pub fn clear_context_window(
    state: State<'_, Mutex<ContextWindowState>>,
) -> Result<ContextWindowSnapshot, String> {
    Ok(state
        .lock()
        .map_err(|_| "上下文窗口状态锁定失败".to_string())?
        .clear(now_ms()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn voice_input(content: &str) -> ContextEventInput {
        ContextEventInput {
            source: ContextSourceKind::Voice,
            content: content.to_string(),
            occurred_at: None,
            confidence: None,
            summary: None,
        }
    }

    #[test]
    fn blank_voice_input_is_rejected() {
        let mut state = ContextWindowState::default();

        let error = state.submit(voice_input("   "), 1_000).unwrap_err();

        assert_eq!(error, "主播语音文本不能为空");
    }

    #[test]
    fn voice_input_enters_window_as_latest_event() {
        let mut state = ContextWindowState::default();

        let snapshot = state
            .submit(voice_input("主播刚提到下一局换角色"), 10_000)
            .unwrap();

        assert_eq!(snapshot.events.len(), 1);
        assert_eq!(snapshot.events[0].source, ContextSourceKind::Voice);
        assert_eq!(snapshot.events[0].summary, "主播刚提到下一局换角色");
        assert_eq!(snapshot.source_statuses[0].status_label, "在线");
    }

    #[test]
    fn old_and_excess_events_are_pruned() {
        let mut state = ContextWindowState::default();
        let base = 1_000_000;

        state.submit(voice_input("过期输入"), base).unwrap();
        for index in 0..90 {
            state
                .submit(
                    voice_input(&format!("窗口输入 {index}")),
                    base + 301_000 + index,
                )
                .unwrap();
        }
        let snapshot = state.snapshot(base + 301_100);

        assert_eq!(snapshot.events.len(), MAX_EVENTS);
        assert!(snapshot
            .events
            .iter()
            .all(|event| event.content != "过期输入"));
        assert_eq!(snapshot.events[0].content, "窗口输入 89");
    }

    #[test]
    fn reserved_sources_serialize_but_do_not_enter_window() {
        let mut state = ContextWindowState::default();
        let input = ContextEventInput {
            source: ContextSourceKind::EchoLive,
            content: "外部状态".to_string(),
            occurred_at: None,
            confidence: Some(0.8),
            summary: Some("外部状态".to_string()),
        };

        let encoded = serde_json::to_string(&input).unwrap();
        assert!(encoded.contains("\"source\":\"echo_live\""));

        let snapshot = state.submit(input, 10_000).unwrap();

        assert!(snapshot.events.is_empty());
        assert_eq!(snapshot.source_statuses[1].status_label, "预留接口");
    }
}
