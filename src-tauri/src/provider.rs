use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const PROVIDER_SETTINGS_STORE_FILE: &str = "provider-settings.json";
const PROVIDER_SETTINGS_KEY: &str = "provider";
const RESPONSE_SNIPPET_LIMIT: usize = 240;
const PROVIDER_HTTP_TIMEOUT_SECONDS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            model: String::new(),
        }
    }
}

impl ProviderConfig {
    fn normalized(
        &self,
        require_api_key: bool,
        require_model: bool,
    ) -> Result<Self, ProviderError> {
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

        let normalized = Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: self.api_key.trim().to_string(),
            model: self.model.trim().to_string(),
        };

        if require_api_key && normalized.api_key.is_empty() {
            return Err(ProviderError::invalid_config("API Key 不能为空", None));
        }
        if require_model && normalized.model.is_empty() {
            return Err(ProviderError::invalid_config("请先获取并选择模型", None));
        }

        Ok(normalized)
    }

    fn endpoint_url(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }

    fn models_url(&self) -> String {
        format!("{}/models", self.base_url)
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModelListResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ProviderError>,
}

impl ProviderModelListResult {
    fn success(models: Vec<String>) -> Self {
        Self {
            ok: true,
            models: Some(models),
            error: None,
        }
    }

    fn failure(error: ProviderError) -> Self {
        Self {
            ok: false,
            models: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderJsonGenerationResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ProviderError>,
}

impl ProviderJsonGenerationResult {
    fn success(content: String, latency_ms: u64, model: String) -> Self {
        Self {
            ok: true,
            content: Some(content),
            latency_ms: Some(latency_ms),
            model: Some(model),
            error: None,
        }
    }

    fn failure(error: ProviderError) -> Self {
        Self {
            ok: false,
            content: None,
            latency_ms: None,
            model: None,
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
        Self::from_config(config, true)
    }

    fn new_for_model_list(config: ProviderConfig) -> Result<Self, ProviderError> {
        Self::from_config(config, false)
    }

    fn from_config(config: ProviderConfig, require_model: bool) -> Result<Self, ProviderError> {
        let config = config.normalized(true, require_model)?;
        let http = Client::builder()
            .timeout(Duration::from_secs(PROVIDER_HTTP_TIMEOUT_SECONDS))
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

    fn build_json_generation_request(&self, prompt: String) -> ProviderRequest {
        ProviderRequest {
            messages: vec![
                ProviderMessage {
                    role: "system".to_string(),
                    content: "你是 BigV 的本地单直播间互动生成层。只返回符合用户约束的 JSON，不要输出解释。"
                        .to_string(),
                },
                ProviderMessage {
                    role: "user".to_string(),
                    content: prompt,
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

        ProviderProbeResult::success(latency_ms, model, "Provider 连通性测试通过")
    }

    async fn list_models(&self) -> ProviderModelListResult {
        let response_body = match self.fetch_models().await {
            Ok(response_body) => response_body,
            Err(error) => return ProviderModelListResult::failure(error),
        };

        match parse_models_response(&response_body) {
            Ok(models) => ProviderModelListResult::success(models),
            Err(error) => ProviderModelListResult::failure(error),
        }
    }

    async fn generate_json(&self, prompt: String) -> ProviderJsonGenerationResult {
        if prompt.trim().is_empty() {
            return ProviderJsonGenerationResult::failure(ProviderError::invalid_config(
                "生成提示词不能为空",
                None,
            ));
        }

        let request = self.build_json_generation_request(prompt);
        let (response_body, latency_ms) = match self.execute(&request).await {
            Ok(result) => result,
            Err(error) => return ProviderJsonGenerationResult::failure(error),
        };

        let content = match extract_chat_content(&response_body) {
            Ok(content) => content,
            Err(error) => return ProviderJsonGenerationResult::failure(error),
        };
        let model = response_body
            .get("model")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| self.config.model.clone());

        ProviderJsonGenerationResult::success(content.to_string(), latency_ms, model)
    }

    async fn fetch_models(&self) -> Result<Value, ProviderError> {
        let response = self
            .http
            .get(self.config.models_url())
            .bearer_auth(&self.config.api_key)
            .send()
            .await
            .map_err(|error| map_transport_error(error.is_timeout(), error.to_string()))?;
        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| map_transport_error(error.is_timeout(), error.to_string()))?;

        if !status.is_success() {
            return Err(ProviderError::http_status(status, &body));
        }

        serde_json::from_str::<Value>(&body).map_err(|error| {
            ProviderError::invalid_response(
                format!("provider 返回的模型列表不是合法 JSON：{error}"),
                snippet(&body),
            )
        })
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
            .normalized(false, false)
            .unwrap_or_else(|_| ProviderConfig::default())),
        Err(_) => Ok(ProviderConfig::default()),
    }
}

fn save_provider_config_to_store(
    app: &AppHandle,
    config: ProviderConfig,
) -> Result<ProviderConfig, String> {
    let normalized = config
        .normalized(false, false)
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

fn load_provider_client_from_store(app: &AppHandle) -> Result<ProviderClient, ProviderError> {
    let config = load_provider_config_from_store(app).map_err(|error| {
        ProviderError::invalid_config(format!("读取 Provider 配置失败：{error}"), None)
    })?;

    ProviderClient::new(config)
}

fn parse_models_response(response_body: &Value) -> Result<Vec<String>, ProviderError> {
    let data = response_body
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            ProviderError::invalid_response(
                "provider 模型列表缺少 data 数组",
                snippet(&response_body.to_string()),
            )
        })?;

    let mut models = data
        .iter()
        .filter_map(|item| {
            item.get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect::<Vec<_>>();

    models.sort();
    models.dedup();

    if models.is_empty() {
        return Err(ProviderError::invalid_response(
            "provider 模型列表未包含可用模型",
            snippet(&response_body.to_string()),
        ));
    }

    Ok(models)
}

fn validate_probe_response(response_body: &Value) -> Result<(), ProviderError> {
    let content = extract_chat_content(response_body)?;

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

fn extract_chat_content(response_body: &Value) -> Result<&str, ProviderError> {
    response_body
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
        })
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
    let client = match load_provider_client_from_store(&app) {
        Ok(client) => client,
        Err(error) => return ProviderProbeResult::failure(error),
    };

    client.probe().await
}

#[tauri::command]
pub async fn list_provider_models(config: ProviderConfig) -> ProviderModelListResult {
    let client = match ProviderClient::new_for_model_list(config) {
        Ok(client) => client,
        Err(error) => return ProviderModelListResult::failure(error),
    };

    client.list_models().await
}

#[tauri::command]
pub async fn generate_provider_json(
    app: AppHandle,
    prompt: String,
) -> ProviderJsonGenerationResult {
    let client = match load_provider_client_from_store(&app) {
        Ok(client) => client,
        Err(error) => return ProviderJsonGenerationResult::failure(error),
    };

    client.generate_json(prompt).await
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
            }
        );
    }

    #[test]
    fn provider_config_rejects_invalid_url_and_missing_model() {
        let invalid_url = ProviderConfig {
            base_url: "ftp://example.com".to_string(),
            ..ProviderConfig::default()
        };

        assert_eq!(
            invalid_url.normalized(false, false).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig
        );
        let missing_model = ProviderConfig::default();
        assert_eq!(
            missing_model.normalized(false, true).unwrap_err().kind,
            ProviderErrorKind::InvalidConfig,
        );
    }

    #[test]
    fn endpoint_url_appends_chat_completions_once() {
        let config = ProviderConfig {
            base_url: "https://example.com/v1/".to_string(),
            ..ProviderConfig::default()
        };
        let normalized = config.normalized(false, false).unwrap();

        assert_eq!(
            normalized.endpoint_url(),
            "https://example.com/v1/chat/completions"
        );
    }

    #[test]
    fn request_body_contains_model_messages_and_response_format() {
        let client = ProviderClient::new(sample_config()).unwrap();
        let body = client.build_request_body(&client.build_probe_request());

        assert_eq!(body["model"], json!("gpt-4.1-mini"));
        assert!(body.get("temperature").is_none());
        assert!(body.get("top_p").is_none());
        assert_eq!(body["response_format"]["type"], json!("json_object"));
    }

    #[test]
    fn json_generation_request_uses_json_mode_and_user_prompt() {
        let client = ProviderClient::new(sample_config()).unwrap();
        let body = client.build_request_body(
            &client.build_json_generation_request("{\"items\":[]}".to_string()),
        );

        assert_eq!(body["model"], json!("gpt-4.1-mini"));
        assert_eq!(body["response_format"]["type"], json!("json_object"));
        assert_eq!(body["messages"][1]["role"], json!("user"));
        assert_eq!(body["messages"][1]["content"], json!("{\"items\":[]}"));
    }

    #[test]
    fn models_response_keeps_model_ids_sorted_and_unique() {
        let response = json!({
            "data": [
                { "id": "gpt-4.1-mini", "owned_by": "openai" },
                { "id": "gpt-4.1" },
                { "id": "gpt-4.1-mini" },
                { "object": "model" }
            ]
        });

        let models = parse_models_response(&response).unwrap();

        assert_eq!(
            models,
            vec!["gpt-4.1".to_string(), "gpt-4.1-mini".to_string()],
        );
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

    #[test]
    fn extract_chat_content_reads_openai_compatible_message() {
        let response = json!({
            "choices": [
                {
                    "message": {
                        "content": "{\"items\":[]}"
                    }
                }
            ]
        });

        assert_eq!(extract_chat_content(&response).unwrap(), "{\"items\":[]}");
    }
}
