use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const PROVIDER_SETTINGS_STORE_FILE: &str = "provider-settings.json";
const PROVIDER_SETTINGS_KEY: &str = "provider";
const RESPONSE_SNIPPET_LIMIT: usize = 240;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
    pub top_p: f64,
    pub timeout_seconds: u64,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            model: String::new(),
            temperature: 0.7,
            top_p: 1.0,
            timeout_seconds: 30,
        }
    }
}

impl ProviderConfig {
    fn normalized(&self, require_credentials: bool) -> Result<Self, ProviderError> {
        let base_url = self.base_url.trim();
        if base_url.is_empty() {
            return Err(ProviderError::invalid_config("Base URL 不能为空", None));
        }

        let parsed = Url::parse(base_url).map_err(|error| {
            ProviderError::invalid_config(format!("Base URL 无效：{error}"), None)
        })?;
        let scheme = parsed.scheme();
        if scheme != "http" && scheme != "https" {
            return Err(ProviderError::invalid_config(
                "Base URL 必须是 http 或 https 绝对地址",
                None,
            ));
        }

        if !(0.0..=2.0).contains(&self.temperature) {
            return Err(ProviderError::invalid_config(
                "temperature 必须在 0 到 2 之间",
                None,
            ));
        }
        if !(0.0..=1.0).contains(&self.top_p) {
            return Err(ProviderError::invalid_config(
                "top_p 必须在 0 到 1 之间",
                None,
            ));
        }
        if !(1..=300).contains(&self.timeout_seconds) {
            return Err(ProviderError::invalid_config(
                "超时必须是 1 到 300 秒之间的整数",
                None,
            ));
        }

        let normalized = Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: self.api_key.trim().to_string(),
            model: self.model.trim().to_string(),
            temperature: self.temperature,
            top_p: self.top_p,
            timeout_seconds: self.timeout_seconds,
        };

        if require_credentials && normalized.api_key.is_empty() {
            return Err(ProviderError::invalid_config("API Key 不能为空", None));
        }
        if require_credentials && normalized.model.is_empty() {
            return Err(ProviderError::invalid_config("模型名不能为空", None));
        }

        Ok(normalized)
    }

    fn endpoint_url(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderResponseFormat {
    Text,
    JsonObject,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorKind {
    InvalidConfig,
    Timeout,
    Transport,
    HttpStatus,
    InvalidResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderError {
    pub kind: ProviderErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_body_snippet: Option<String>,
}

impl ProviderError {
    fn invalid_config(message: impl Into<String>, snippet: Option<String>) -> Self {
        Self {
            kind: ProviderErrorKind::InvalidConfig,
            message: message.into(),
            status_code: None,
            response_body_snippet: snippet,
        }
    }

    fn timeout(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::Timeout,
            message: message.into(),
            status_code: None,
            response_body_snippet: None,
        }
    }

    fn transport(message: impl Into<String>) -> Self {
        Self {
            kind: ProviderErrorKind::Transport,
            message: message.into(),
            status_code: None,
            response_body_snippet: None,
        }
    }

    fn http_status(status: StatusCode, body: &str) -> Self {
        Self {
            kind: ProviderErrorKind::HttpStatus,
            message: format!("provider 返回 HTTP {}", status.as_u16()),
            status_code: Some(status.as_u16()),
            response_body_snippet: snippet(body),
        }
    }

    fn invalid_response(message: impl Into<String>, snippet: Option<String>) -> Self {
        Self {
            kind: ProviderErrorKind::InvalidResponse,
            message: message.into(),
            status_code: None,
            response_body_snippet: snippet,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProbeResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ProviderError>,
}

impl ProviderProbeResult {
    fn success(latency_ms: u64, model: String, message: impl Into<String>) -> Self {
        Self {
            ok: true,
            latency_ms: Some(latency_ms),
            model: Some(model),
            message: Some(message.into()),
            error: None,
        }
    }

    fn failure(error: ProviderError) -> Self {
        Self {
            ok: false,
            latency_ms: None,
            model: None,
            message: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderRequest {
    messages: Vec<ProviderMessage>,
    response_format: ProviderResponseFormat,
}

struct ProviderClient {
    config: ProviderConfig,
    http: Client,
}

impl ProviderClient {
    fn new(config: ProviderConfig) -> Result<Self, ProviderError> {
        let config = config.normalized(true)?;
        let http = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|error| ProviderError::transport(format!("创建 HTTP 客户端失败：{error}")))?;

        Ok(Self { config, http })
    }

    fn build_probe_request(&self) -> ProviderRequest {
        ProviderRequest {
            messages: vec![
                ProviderMessage {
                    role: "system".to_string(),
                    content: "You are a connectivity probe. Reply with JSON only.".to_string(),
                },
                ProviderMessage {
                    role: "user".to_string(),
                    content: "Return exactly this JSON object: {\"status\":\"ok\"}".to_string(),
                },
            ],
            response_format: ProviderResponseFormat::JsonObject,
        }
    }

    fn build_request_body(&self, request: &ProviderRequest) -> Value {
        let mut body = json!({
            "model": &self.config.model,
            "messages": request.messages.iter().map(|message| {
                json!({
                    "role": &message.role,
                    "content": &message.content,
                })
            }).collect::<Vec<_>>(),
            "temperature": self.config.temperature,
            "top_p": self.config.top_p,
        });

        if request.response_format == ProviderResponseFormat::JsonObject {
            body["response_format"] = json!({ "type": "json_object" });
        }

        body
    }

    async fn execute(&self, request: &ProviderRequest) -> Result<(Value, u64), ProviderError> {
        let started_at = Instant::now();
        let response = self
            .http
            .post(self.config.endpoint_url())
            .bearer_auth(&self.config.api_key)
            .json(&self.build_request_body(request))
            .send()
            .await
            .map_err(|error| map_transport_error(error.is_timeout(), error.to_string()))?;
        let latency_ms = started_at.elapsed().as_millis().min(u64::MAX as u128) as u64;
        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| map_transport_error(error.is_timeout(), error.to_string()))?;

        if !status.is_success() {
            return Err(ProviderError::http_status(status, &body));
        }

        let json = serde_json::from_str::<Value>(&body).map_err(|error| {
            ProviderError::invalid_response(
                format!("provider 返回的响应不是合法 JSON：{error}"),
                snippet(&body),
            )
        })?;

        Ok((json, latency_ms))
    }

    async fn probe(&self) -> ProviderProbeResult {
        let request = self.build_probe_request();
        let (response_body, latency_ms) = match self.execute(&request).await {
            Ok(result) => result,
            Err(error) => return ProviderProbeResult::failure(error),
        };

        if let Err(error) = validate_probe_response(&response_body) {
            return ProviderProbeResult::failure(error);
        }

        let model = response_body
            .get("model")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| self.config.model.clone());

        ProviderProbeResult::success(latency_ms, model, "已通过 chat/completions 连通性测试")
    }
}

fn load_provider_config_from_store(app: &AppHandle) -> Result<ProviderConfig, String> {
    let store = app
        .store(PROVIDER_SETTINGS_STORE_FILE)
        .map_err(|error| format!("failed to open provider settings store: {error}"))?;
    let Some(value) = store.get(PROVIDER_SETTINGS_KEY) else {
        return Ok(ProviderConfig::default());
    };

    match serde_json::from_value::<ProviderConfig>(value) {
        Ok(config) => Ok(config
            .normalized(false)
            .unwrap_or_else(|_| ProviderConfig::default())),
        Err(_) => Ok(ProviderConfig::default()),
    }
}

fn save_provider_config_to_store(
    app: &AppHandle,
    config: ProviderConfig,
) -> Result<ProviderConfig, String> {
    let normalized = config
        .normalized(false)
        .map_err(|error| error.message.clone())?;
    let store = app
        .store(PROVIDER_SETTINGS_STORE_FILE)
        .map_err(|error| format!("failed to open provider settings store: {error}"))?;
    let value = serde_json::to_value(&normalized).map_err(|error| error.to_string())?;

    store.set(PROVIDER_SETTINGS_KEY, value);
    store
        .save()
        .map_err(|error| format!("failed to save provider settings: {error}"))?;

    Ok(normalized)
}

fn validate_probe_response(response_body: &Value) -> Result<(), ProviderError> {
    let content = response_body
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ProviderError::invalid_response(
                "provider 响应缺少 choices[0].message.content",
                snippet(&response_body.to_string()),
            )
        })?;

    let payload = serde_json::from_str::<Value>(content).map_err(|error| {
        ProviderError::invalid_response(
            format!("provider content 不是合法 JSON：{error}"),
            snippet(content),
        )
    })?;

    if payload.as_object().is_none() {
        return Err(ProviderError::invalid_response(
            "provider content 必须是 JSON 对象",
            snippet(content),
        ));
    }

    if payload.get("status").and_then(Value::as_str) != Some("ok") {
        return Err(ProviderError::invalid_response(
            "provider content 未返回预期的 status=ok",
            snippet(content),
        ));
    }

    Ok(())
}

fn map_transport_error(is_timeout: bool, message: String) -> ProviderError {
    if is_timeout {
        ProviderError::timeout(format!("provider 请求超时：{message}"))
    } else {
        ProviderError::transport(format!("provider 请求失败：{message}"))
    }
}

fn snippet(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let snippet: String = trimmed.chars().take(RESPONSE_SNIPPET_LIMIT).collect();
    Some(snippet)
}

#[tauri::command]
pub fn load_provider_config(app: AppHandle) -> Result<ProviderConfig, String> {
    load_provider_config_from_store(&app)
}

#[tauri::command]
pub fn save_provider_config(
    app: AppHandle,
    config: ProviderConfig,
) -> Result<ProviderConfig, String> {
    save_provider_config_to_store(&app, config)
}

#[tauri::command]
pub async fn test_provider_connection(app: AppHandle) -> ProviderProbeResult {
    let config = match load_provider_config_from_store(&app) {
        Ok(config) => config,
        Err(error) => {
            return ProviderProbeResult::failure(ProviderError::invalid_config(
                format!("读取 Provider 配置失败：{error}"),
                None,
            ));
        }
    };

    let client = match ProviderClient::new(config) {
        Ok(client) => client,
        Err(error) => return ProviderProbeResult::failure(error),
    };

    client.probe().await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> ProviderConfig {
        ProviderConfig {
            api_key: "sk-test".to_string(),
            model: "gpt-4.1-mini".to_string(),
            ..ProviderConfig::default()
        }
    }

    #[test]
    fn provider_config_defaults_match_stage_two_contract() {
        assert_eq!(
            ProviderConfig::default(),
            ProviderConfig {
                base_url: "https://api.openai.com/v1".to_string(),
                api_key: String::new(),
                model: String::new(),
                temperature: 0.7,
                top_p: 1.0,
                timeout_seconds: 30,
            }
        );
    }

    #[test]
    fn provider_config_rejects_invalid_ranges_and_url() {
        let invalid_url = ProviderConfig {
            base_url: "ftp://example.com".to_string(),
            ..ProviderConfig::default()
        };
        let invalid_temperature = ProviderConfig {
            temperature: 3.0,
            ..ProviderConfig::default()
        };
        let invalid_top_p = ProviderConfig {
            top_p: 2.0,
            ..ProviderConfig::default()
        };
        let invalid_timeout = ProviderConfig {
            timeout_seconds: 0,
            ..ProviderConfig::default()
        };

        assert_eq!(
            invalid_url.normalized(false).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig
        );
        assert_eq!(
            invalid_temperature.normalized(false).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig
        );
        assert_eq!(
            invalid_top_p.normalized(false).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig
        );
        assert_eq!(
            invalid_timeout.normalized(false).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig
        );
    }

    #[test]
    fn endpoint_url_appends_chat_completions_once() {
        let config = ProviderConfig {
            base_url: "https://example.com/v1/".to_string(),
            ..ProviderConfig::default()
        };
        let normalized = config.normalized(false).unwrap();

        assert_eq!(
            normalized.endpoint_url(),
            "https://example.com/v1/chat/completions"
        );
    }

    #[test]
    fn request_body_contains_sampling_and_response_format() {
        let client = ProviderClient::new(sample_config()).unwrap();
        let body = client.build_request_body(&client.build_probe_request());

        assert_eq!(body["model"], json!("gpt-4.1-mini"));
        assert_eq!(body["temperature"], json!(0.7));
        assert_eq!(body["top_p"], json!(1.0));
        assert_eq!(body["response_format"]["type"], json!("json_object"));
    }

    #[test]
    fn timeout_transport_error_maps_to_timeout_kind() {
        let error = map_transport_error(true, "deadline reached".to_string());

        assert_eq!(error.kind, ProviderErrorKind::Timeout);
        assert!(error.message.contains("deadline reached"));
    }

    #[test]
    fn http_status_error_keeps_status_and_snippet() {
        let error = ProviderError::http_status(StatusCode::UNAUTHORIZED, "{\"error\":\"bad key\"}");

        assert_eq!(error.kind, ProviderErrorKind::HttpStatus);
        assert_eq!(error.status_code, Some(401));
        assert_eq!(
            error.response_body_snippet,
            Some("{\"error\":\"bad key\"}".to_string())
        );
    }

    #[test]
    fn invalid_probe_content_reports_json_error() {
        let response = json!({
            "choices": [
                {
                    "message": {
                        "content": "not-json"
                    }
                }
            ]
        });

        let error = validate_probe_response(&response).unwrap_err();

        assert_eq!(error.kind, ProviderErrorKind::InvalidResponse);
        assert!(error.message.contains("合法 JSON"));
    }

    #[test]
    fn missing_probe_content_reports_invalid_response() {
        let response = json!({
            "choices": [
                {
                    "message": {}
                }
            ]
        });

        let error = validate_probe_response(&response).unwrap_err();

        assert_eq!(error.kind, ProviderErrorKind::InvalidResponse);
        assert!(error.message.contains("choices[0].message.content"));
    }
}
