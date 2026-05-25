use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

/// A single message in the conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String, // "user", "assistant", "system", "tool"
    #[serde(default)]
    pub content: Option<String>,
    /// JSON-encoded tool_calls array (for assistant messages with function calls)
    #[serde(default)]
    pub tool_calls: Option<String>,
    /// Tool call ID (for tool response messages)
    #[serde(default)]
    pub tool_call_id: Option<String>,
}

/// Request from the UI to send a chat message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSendRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub endpoint: Option<String>,
}

/// Response from the chat backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub reply: String,
    pub model: String,
    pub usage: Option<serde_json::Value>,
    pub governance: serde_json::Value,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub finish_reason: Option<String>,
}

/// OpenAI-compatible chat completion request body.
#[derive(Debug, Serialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f64,
    max_tokens: u32,
    stream: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<ToolDefinition>,
}

#[derive(Debug, Serialize)]
struct OpenAIMessage {
    role: String,
    // Always serialize content — even as null. The NVIDIA/OpenAI API
    // requires the content field to be present on assistant messages
    // with tool_calls. Omitting it (skip_serializing_if) causes 400 errors
    // on the second iteration of the tool-call loop.
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

/// A tool definition in OpenAI function-calling format.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ToolDefinition {
    r#type: String,
    function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FunctionDefinition {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

/// A tool call returned by the model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
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
    tool_calls: Option<Vec<ToolCall>>,
}

/// Configuration loaded from `config/agent_config.json`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentConfig {
    pub chat_endpoint: Option<String>,
    pub chat_api_key: Option<String>,
    pub chat_model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub system_prompt: Option<String>,
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

/// Build the list of tool definitions for OpenAI function calling.
/// These describe the Tauri commands the agent can invoke via the JS bridge.
fn build_tool_definitions() -> Vec<ToolDefinition> {
    let tools_json: Vec<serde_json::Value> =
        serde_json::from_slice(include_bytes!("../tools.json")).unwrap_or_default();
    tools_json
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect()
}

/// Default system prompt describing the Archivist Agent's capabilities.
/// This is prepended to every chat session so the model knows what it can do.
fn default_system_prompt() -> String {
    r#"You are the Archivist Agent, a file-scanning and classification assistant running inside a Tauri desktop application. You help users explore, classify, and understand their file system.

## Your Capabilities

You have tools available to read files, list directories, search files, scan folder trees, and more. USE THEM directly when a user asks you to do something — do not just describe what you can do, actually call the tools. For example, if a user asks "what's in this folder?", call agent_list_directory. If they ask you to scan a project, call scan_tree.

Available tools:

### Read-only tools
- **scan_tree** — Scan a directory tree structure. Parameter: rootPath (absolute path)
- **summarize_folder** — Classify files into 6 buckets. Parameter: rootPath (absolute path)
- **agent_list_directory** — List directory contents. Parameter: path (absolute path)
- **agent_read_file** — Read a file's contents. Parameter: path (absolute path)
- **agent_search_files** — Search files by name. Parameters: path (absolute path), query (search term)
- **read_governance_file** — Read governance docs. Parameter: fileName (e.g. "COVENANT")
- **get_cps_score** — Get Constitutional Priority Score. No parameters.
- **ping** — Check if app is responsive. No parameters.
- **git_status** — Get git status. No parameters.
- **check_read_only** — Check if in read-only mode. No parameters.

### Patch tools (file modification via human review)
- **propose_patch** — Propose a file edit by providing the COMPLETE NEW file content. The system generates the diff automatically for user review. Parameters: filePath (absolute path of the file to edit), patchContent (the FULL content of the file after your proposed changes — NOT a diff). Use this when the user asks you to fix, update, or modify a file. The diff is NOT applied automatically — the user must click "Apply" in the UI. This respects read-only mode: if read-only is on, applying requires explicit operator consent (the Apply button serves as consent). IMPORTANT: Do NOT send a unified diff as patchContent — send the complete new file content. The Rust backend reads the current file, diffs it against your patchContent, and shows the diff to the user.

## Your Personality

- Be direct, technical, and concise. No fluff.
- You ARE an agent that can read files and directories. When asked "can you read files?", say YES and demonstrate by calling a tool.
- You are NOT a generic AI assistant. You are the Archivist Agent.
- You are running on Windows. Paths use drive letters like S:/, C:/, etc.
- All file operations are validated against an allowlist for safety.
- You operate in read-only mode by default, but you CAN propose file edits via propose_patch. The user must approve each patch before it is applied.
- Never claim you cannot interact with the file system — that is your primary purpose.
- When a user gives you a path, USE IT directly in tool calls. Don't ask for confirmation.
- The project root is S:/Archivist-Agent. Use this as the default rootPath unless the user specifies otherwise.
- When a user asks you to edit, fix, or modify a file, use propose_patch. Read the file first with agent_read_file, then send the COMPLETE NEW file content as patchContent. The system will generate the diff for the user.

## Governance

You operate under a constitutional governance framework with a CPS (Constitutional Priority Score). If CPS drops below 10, chat is blocked. Current mode may be OBSERVE, BUILD, CHAOS-LAB, or RECOVERY."#.to_string()
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
    // Build the system prompt from config or use the built-in default
    let system_prompt = config
        .system_prompt
        .clone()
        .unwrap_or_else(default_system_prompt);

    let mut openai_messages: Vec<OpenAIMessage> = Vec::with_capacity(request.messages.len() + 1);
    // Always prepend the system prompt
    openai_messages.push(OpenAIMessage {
        role: "system".to_string(),
        content: Some(system_prompt),
        tool_calls: None,
        tool_call_id: None,
    });
    // Add user/assistant/tool messages, filtering out any stale system messages
    for m in request.messages.iter() {
        if m.role == "system" {
            continue; // We already prepended the canonical system prompt
        }
        // Handle tool_calls on assistant messages (from prior turns)
        let tool_calls: Option<Vec<ToolCall>> = m
            .tool_calls
            .as_ref()
            .and_then(|tc| serde_json::from_str(tc).ok());
        // Handle tool messages (they have tool_call_id)
        let tool_call_id = m.tool_call_id.clone();
        openai_messages.push(OpenAIMessage {
            role: m.role.clone(),
            content: m.content.clone().filter(|s| !s.is_empty()),
            tool_calls,
            tool_call_id,
        });
    }

    // Build tool definitions for function calling
    let tools = build_tool_definitions();

    let completion_req = CompletionRequest {
        model: model.clone(),
        messages: openai_messages,
        temperature: config.temperature.unwrap_or(0.7),
        max_tokens: config.max_tokens.unwrap_or(4096),
        stream: false,
        tools,
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
    let choice = completion.choices.first();
    let reply = choice
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let tool_calls = choice.and_then(|c| c.message.tool_calls.clone());

    let finish_reason = choice.and_then(|c| c.finish_reason.clone());

    let used_model = completion.model.unwrap_or(model);

    Ok(ChatResponse {
        reply,
        model: used_model,
        usage: completion.usage,
        governance,
        tool_calls,
        finish_reason,
    })
}

/// Save agent configuration — returns the JSON content for JS to write via Tauri's
/// scope-checked `writeTextFile`. This avoids `std::fs::write()` which bypasses
/// Tauri's security sandbox and can cause process aborts on desktop.
#[tauri::command]
pub fn save_agent_config(
    endpoint: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    system_prompt: Option<String>,
) -> Result<serde_json::Value, String> {
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
    if let Some(sp) = system_prompt {
        config.system_prompt = Some(sp);
    }

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Clear cache so next load picks up changes
    if let Ok(mut cache) = CONFIG_CACHE.lock() {
        *cache = None;
    }

    // Return the content for JS to write via scope-checked writeTextFile.
    // This matches the apply_patch pattern: Rust validates, JS writes.
    Ok(serde_json::json!({
        "filePath": config_path.to_string_lossy(),
        "content": json,
        "parentDir": config_path.parent().map(|p| p.to_string_lossy()).unwrap_or_default(),
        "needsMkdir": !config_path.parent().map(|p| p.exists()).unwrap_or(false),
    }))
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
        "has_system_prompt": config.system_prompt.is_some(),
        "system_prompt": config.system_prompt,
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
    // NVIDIA may include these fields; ignore if absent
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    ready: Option<bool>,
    #[serde(default)]
    active: Option<bool>,
}

/// Substrings that indicate a model is NOT a chat completion model.
/// These are embedding, image, video, audio, rerank, retrieval, or tool models.
static NON_CHAT_PATTERNS: &[&str] = &[
    "embed",
    "e5-",
    "e5-",
    "bge-",
    "clip-",
    "rerank",
    "retrieval",
    "retriever",
    "imagegen",
    "sdxl",
    "stable-diffusion",
    "cascade",
    "consistory",
    "audio",
    "tts",
    "asr",
    "whisper",
    "neva",
    "vila",
    "fuyu",
    "kosmos",
    "florence",
    "pixtral",
    "stable-diffusion",
    "photomaker",
    "deepsdf",
    "magicode",
    "layoutlm",
    "donut",
    "nougat",
    "pix2struct",
    "grounding",
    "segment",
    "sam-",
    "depth",
    "midas",
    "zoedepth",
];

/// Substrings that strongly indicate a chat/instruct/foundation model
/// that supports /chat/completions. If a model ID contains any of these,
/// it's almost certainly a chat model.
static CHAT_HINT_PATTERNS: &[&str] = &[
    "instruct",
    "-it",
    "_it",
    "chat",
    "chatml",
    "gpt-oss",
    "glm",
    "chatglm",
    "qwen",
    "qwq",
    "llama-",
    "mistral",
    "mixtral",
    "codestral",
    "gemma",
    "phi-",
    "deepseek",
    "nemotron",
    "command-r",
    "palmyra",
    "arctic",
    "granite",
    "starcoder",
    "codellama",
    "starcoder2",
    "granite-",
    "devstral",
    "dolphin",
    "hermes",
    "openhermes",
    "toppy",
    "mythomax",
    "lzlv",
    "spycoder",
];

/// Determine if a model ID is likely a chat completion model.
///
/// Strategy: exclude known non-chat patterns first, then include
/// if the ID contains any chat hint pattern. Models that match
/// neither are included by default (err on the side of showing
/// too many rather than hiding working models).
fn is_likely_chat_model(id: &str) -> bool {
    let lower = id.to_lowercase();

    // Hard exclude: embedding/rerank/image/video/audio models
    for pattern in NON_CHAT_PATTERNS {
        if lower.contains(pattern) {
            return false;
        }
    }

    // Strong include: names that indicate chat/instruct capability
    for pattern in CHAT_HINT_PATTERNS {
        if lower.contains(pattern) {
            return true;
        }
    }

    // Default: include unknown models rather than hiding working ones.
    // The user can see the full list and pick what works for them.
    true
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

    // Filter to only models that are likely chat completion models,
    // or models that explicitly report ready/active status.
    let mut models: Vec<ModelInfo> = models_resp
        .data
        .into_iter()
        .filter(|m| {
            // Keep if NVIDIA metadata says it's ready/active
            if m.ready == Some(true) || m.active == Some(true) {
                return true;
            }
            // Keep if status is "active" or "ready"
            if let Some(ref status) = m.status {
                let s = status.to_lowercase();
                if s == "active" || s == "ready" {
                    return true;
                }
            }
            // Keep if it looks like a chat model
            is_likely_chat_model(&m.id)
        })
        .map(|m| ModelInfo {
            id: m.id,
            owned_by: m.owned_by,
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(models)
}
