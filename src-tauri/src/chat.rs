use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

/// A single message in the conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user", "assistant", "system"
    pub content: String,
}

/// Request from the UI to send a chat message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSendRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub endpoint: Option<String>,
}

/// Response from the chat backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub reply: String,
    pub model: String,
    pub usage: Option<serde_json::Value>,
    pub governance: serde_json::Value,
}

/// OpenAI-compatible chat completion request body.
#[derive(Debug, Serialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f64,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

/// OpenAI-compatible chat completion response body.
#[derive(Debug, Deserialize)]
struct CompletionResponse {
    #[allow(dead_code)]
    id: Option<String>,
    #[allow(dead_code)]
    object: Option<String>,
    choices: Vec<Choice>,
    #[allow(dead_code)]
    usage: Option<serde_json::Value>,
    #[allow(dead_code)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChoiceMessage,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    #[allow(dead_code)]
    role: String,
    content: Option<String>,
}

/// Configuration loaded from `config/agent_config.json`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentConfig {
    pub chat_endpoint: Option<String>,
    pub chat_api_key: Option<String>,
    pub chat_model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
}

// Thread-safe in-memory config cache.
static CONFIG_CACHE: once_cell::sync::Lazy<Mutex<Option<AgentConfig>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

/// Load agent config from file, caching it for the session.
pub fn load_agent_config(root: &Path) -> AgentConfig {
    // Check cache first
    if let Ok(cache) = CONFIG_CACHE.lock() {
        if let Some(ref config) = *cache {
            return config.clone();
        }
    }

    // Load from file
    let config_path = root.join("config/agent_config.json");
    let config = if config_path.exists() {
        std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<AgentConfig>(&s).ok())
            .unwrap_or_default()
    } else {
        AgentConfig::default()
    };

    // Cache it
    if let Ok(mut cache) = CONFIG_CACHE.lock() {
        *cache = Some(config.clone());
    }

    config
}

/// Resolve the effective API key: arg > config file > env var.
fn resolve_api_key(arg: Option<String>, config: &AgentConfig) -> Option<String> {
    if let Some(key) = arg {
        if !key.is_empty() {
            return Some(key);
        }
    }
    if let Some(ref key) = config.chat_api_key {
        if !key.is_empty() {
            return Some(key.clone());
        }
    }
    std::env::var("NVIDIA_API_KEY")
        .or_else(|_| std::env::var("LANE_AGENT_API_KEY"))
        .ok()
        .filter(|s| !s.is_empty())
}

/// Resolve the effective endpoint: arg > config file > default.
fn resolve_endpoint(arg: Option<String>, config: &AgentConfig) -> String {
    if let Some(ep) = arg {
        if !ep.is_empty() {
            return ep;
        }
    }
    if let Some(ref ep) = config.chat_endpoint {
        if !ep.is_empty() {
            return ep.clone();
        }
    }
    "https://integrate.api.nvidia.com/v1".to_string()
}

/// Resolve the effective model: arg > config file > default.
fn resolve_model(arg: Option<String>, config: &AgentConfig) -> String {
    if let Some(m) = arg {
        if !m.is_empty() {
            return m;
        }
    }
    if let Some(ref m) = config.chat_model {
        if !m.is_empty() {
            return m.clone();
        }
    }
    "meta/llama-3.3-70b-instruct".to_string()
}

/// Run governance checks before allowing a chat interaction.
fn governance_check() -> Result<serde_json::Value, String> {
    let mut report = serde_json::json!({
        "cps_passing": false,
        "mode": "unknown",
        "chat_allowed": false,
        "warnings": [],
    });

    // Check CPS score
    let constraints = crate::constitution::load_constraints();
    let cps_score = crate::constitution::compute_cps_score(&constraints);
    let threshold = 10;
    if cps_score >= threshold {
        report["cps_passing"] = serde_json::Value::Bool(true);
    } else {
        return Err(format!(
            "CPS score {} is below threshold {}. Chat is blocked.",
            cps_score, threshold
        ));
    }

    // Check current mode (read from active-mode.json)
    if let Ok(root) = crate::governance::resolve_project_root_static() {
        let mode_path = root.join("lanes/broadcast/active-mode.json");
        if mode_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&mode_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    let mode = json
                        .get("mode")
                        .and_then(|v| v.as_str())
                        .unwrap_or("OBSERVE");
                    report["mode"] = serde_json::Value::String(mode.to_string());

                    match mode {
                        "OBSERVE" => {
                            // Allow chat but add a warning
                            report["chat_allowed"] = serde_json::Value::Bool(true);
                            if let Some(warnings) = report["warnings"].as_array_mut() {
                                warnings.push(serde_json::Value::String(
                                    "Mode is OBSERVE — chat is allowed but no mutations will be executed."
                                        .to_string(),
                                ));
                            }
                        }
                        "BUILD" | "CHAOS-LAB" => {
                            report["chat_allowed"] = serde_json::Value::Bool(true);
                        }
                        "RECOVERY" => {
                            report["chat_allowed"] = serde_json::Value::Bool(true);
                            if let Some(warnings) = report["warnings"].as_array_mut() {
                                warnings.push(serde_json::Value::String(
                                    "Mode is RECOVERY — only recovery-related operations recommended."
                                        .to_string(),
                                ));
                            }
                        }
                        _ => {
                            report["chat_allowed"] = serde_json::Value::Bool(true);
                        }
                    }
                }
            }
        }
    }

    // If we got here without setting chat_allowed, default to allowed
    if report["chat_allowed"].as_bool().is_none() {
        report["chat_allowed"] = serde_json::Value::Bool(true);
    }

    Ok(report)
}

/// Send a message to the AI backend and get a response.
///
/// Governance checks run before every call:
///   - CPS score must be >= threshold
///   - Mode warnings if in OBSERVE or RECOVERY
///
/// API key resolution: arg > config/agent_config.json > env var
/// Endpoint resolution: arg > config > default NVIDIA endpoint
/// Model resolution: arg > config > default llama-3.3-70b
#[tauri::command]
pub async fn chat_send(request: ChatSendRequest) -> Result<ChatResponse, String> {
    // ---- Governance check ----
    let governance = governance_check()?;

    // ---- Resolve settings ----
    let root = crate::governance::resolve_project_root_static()
        .map_err(|e| format!("Cannot resolve project root: {}", e))?;
    let config = load_agent_config(&root);

    let api_key = resolve_api_key(request.api_key, &config)
        .ok_or_else(|| "No API key available. Set NVIDIA_API_KEY env var, configure config/agent_config.json, or pass it in the request.".to_string())?;

    let endpoint = resolve_endpoint(request.endpoint, &config);
    let model = resolve_model(request.model, &config);

    // ---- Build API request ----
    let openai_messages: Vec<OpenAIMessage> = request
        .messages
        .iter()
        .map(|m| OpenAIMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    let completion_req = CompletionRequest {
        model: model.clone(),
        messages: openai_messages,
        temperature: config.temperature.unwrap_or(0.7),
        stream: false,
    };

    // ---- Call API ----
    let client = reqwest::Client::new();
    let api_url = format!("{}{}", endpoint.trim_end_matches('/'), "/chat/completions");

    let http_response = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&completion_req)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !http_response.status().is_success() {
        let status = http_response.status();
        let body = http_response
            .text()
            .await
            .unwrap_or_else(|_| "(no body)".to_string());
        return Err(format!("API returned {}: {}", status, body));
    }

    let completion: CompletionResponse = http_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // ---- Extract reply ----
    let reply = completion
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_else(|| "(empty response)".to_string());

    let used_model = completion.model.unwrap_or(model);

    Ok(ChatResponse {
        reply,
        model: used_model,
        usage: completion.usage,
        governance,
    })
}

/// Save agent configuration to file for future sessions.
#[tauri::command]
pub fn save_agent_config(
    endpoint: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let root = crate::governance::resolve_project_root_static().map_err(|e| e.to_string())?;
    let config_path = root.join("config/agent_config.json");

    let mut config = if config_path.exists() {
        std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<AgentConfig>(&s).ok())
            .unwrap_or_default()
    } else {
        AgentConfig::default()
    };

    if let Some(ep) = endpoint {
        config.chat_endpoint = Some(ep);
    }
    if let Some(key) = api_key {
        config.chat_api_key = Some(key);
    }
    if let Some(m) = model {
        config.chat_model = Some(m);
    }
    if let Some(t) = temperature {
        config.temperature = Some(t);
    }
    if let Some(t) = max_tokens {
        config.max_tokens = Some(t);
    }

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, &json).map_err(|e| format!("Failed to write config: {}", e))?;

    // Clear cache so next load picks up changes
    if let Ok(mut cache) = CONFIG_CACHE.lock() {
        *cache = None;
    }

    Ok(format!("Config saved to {}", config_path.display()))
}

/// Load the current agent configuration (without exposing the API key value).
#[tauri::command]
pub fn load_agent_config_cmd() -> Result<serde_json::Value, String> {
    let root = crate::governance::resolve_project_root_static().map_err(|e| e.to_string())?;
    let config = load_agent_config(&root);

    Ok(serde_json::json!({
        "chat_endpoint": config.chat_endpoint,
        "chat_model": config.chat_model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "has_api_key": config.chat_api_key.is_some() && config.chat_api_key.as_deref() != Some(""),
    }))
}

/// A model listed by the /v1/models endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub owned_by: Option<String>,
}

/// Response from the OpenAI-compatible /v1/models endpoint.
#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
    owned_by: Option<String>,
}

/// Fetch available models from the configured endpoint.
///
/// Uses the same resolution chain as `chat_send`:
///   API key: arg > config > env var
///   Endpoint: arg > config > default NVIDIA
///
/// Returns a sorted list of `{ id, owned_by }` objects.
#[tauri::command]
pub async fn fetch_models(
    endpoint: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<ModelInfo>, String> {
    let root = crate::governance::resolve_project_root_static()
        .map_err(|e| format!("Cannot resolve project root: {}", e))?;
    let config = load_agent_config(&root);

    let resolved_key = resolve_api_key(api_key, &config)
        .ok_or_else(|| "No API key available. Set NVIDIA_API_KEY env var, configure config/agent_config.json, or pass it in the request.".to_string())?;

    let resolved_endpoint = resolve_endpoint(endpoint, &config);

    let models_url = format!("{}/models", resolved_endpoint.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let http_response = client
        .get(&models_url)
        .header("Authorization", format!("Bearer {}", resolved_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !http_response.status().is_success() {
        let status = http_response.status();
        let body = http_response
            .text()
            .await
            .unwrap_or_else(|_| "(no body)".to_string());
        return Err(format!(
            "API returned {} when fetching models: {}",
            status, body
        ));
    }

    let models_resp: ModelsResponse = http_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    let mut models: Vec<ModelInfo> = models_resp
        .data
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id,
            owned_by: m.owned_by,
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(models)
}
