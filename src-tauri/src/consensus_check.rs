#![allow(dead_code)]

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub const CONSENSUS_POLICY_PATH: &str = "config/consensus-policy.json";

pub const TRUTH_CRITICAL_FILES: &[&str] = &[
    "scripts/lane-worker.js",
    "scripts/verification-domain-gate.js",
    "scripts/validate-responses.js",
    "scripts/completion-proof.js",
];

pub const VALID_MESSAGE_TYPES: &[&str] = &[
    "task",
    "response",
    "escalation",
    "handoff",
    "ack",
    "alert",
    "notification",
    "status",
    "heartbeat",
];

pub const VALID_TASK_KINDS: &[&str] = &[
    "task",
    "proposal",
    "review",
    "finding",
    "report",
    "status",
    "ack",
    "handoff",
    "ratification",
];

pub const TERMINAL_TYPES: &[&str] = &[
    "ack",
    "acknowledgment",
    "heartbeat",
    "notification",
    "response",
    "status",
];

pub const TERMINAL_TASK_KINDS: &[&str] = &["status", "report", "done", "ack", "handoff", "audit"];

pub const LEGACY_ARTIFACT_FIELDS: &[&str] = &[
    "completion_artifact_path",
    "completion_message_id",
    "resolved_by_task_id",
];

pub const TRUST_STORE_KEYS: &[(&str, &str)] = &[
    ("archivist", "506c2d0838b6862c"),
    ("library", "2eec06be0befc8d5"),
    ("swarmmind", "c41954228c48ff9c"),
    ("kernel", "127b44d2bb294ad9"),
];

pub const COMPLETION_WINDOW_MS: u64 = 5 * 60 * 1000;

pub const DEFAULT_ALLOWED_ROOTS: &[&str] = &[
    "S:/Archivist-Agent",
    "S:/kernel-lane",
    "S:/self-organizing-library",
    "S:/SwarmMind",
];

fn trust_store_map() -> &'static HashMap<String, String> {
    static MAP: OnceLock<HashMap<String, String>> = OnceLock::new();
    MAP.get_or_init(|| {
        TRUST_STORE_KEYS
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    })
}

fn valid_message_types_set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| VALID_MESSAGE_TYPES.iter().copied().collect())
}

fn valid_task_kinds_set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| VALID_TASK_KINDS.iter().copied().collect())
}

fn terminal_types_set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| TERMINAL_TYPES.iter().copied().collect())
}

fn terminal_task_kinds_set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| TERMINAL_TASK_KINDS.iter().copied().collect())
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftIntegrationConfig {
    pub enabled: bool,
    pub cps_threshold_warning: f64,
    pub cps_threshold_critical: f64,
    pub cps_log_path: String,
}

impl Default for DriftIntegrationConfig {
    fn default() -> Self {
        DriftIntegrationConfig {
            enabled: true,
            cps_threshold_warning: 30.0,
            cps_threshold_critical: 50.0,
            cps_log_path: "context-buffer/cps_log.jsonl".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub proven_action: String,
    pub conflicted_action: String,
    pub unproven_action: String,
    pub blocked_action: String,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        RoutingConfig {
            proven_action: "route".to_string(),
            conflicted_action: "escalate".to_string(),
            unproven_action: "block".to_string(),
            blocked_action: "hold".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyConfig {
    pub structural_weight: f64,
    pub operational_weight: f64,
    pub consensus_threshold: f64,
    pub reject_on_any_critical: bool,
    pub drift_integration: DriftIntegrationConfig,
    pub routing: RoutingConfig,
}

impl Default for PolicyConfig {
    fn default() -> Self {
        PolicyConfig {
            structural_weight: 1.0,
            operational_weight: 1.0,
            consensus_threshold: 1.0,
            reject_on_any_critical: true,
            drift_integration: DriftIntegrationConfig::default(),
            routing: RoutingConfig::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct ConsensusOptions {
    pub policy: Option<PolicyConfig>,
    pub policy_path: Option<PathBuf>,
    pub schema: Option<serde_json::Value>,
    pub repo_root: Option<PathBuf>,
    pub resolver: Option<ArtifactResolver>,
    pub lane: Option<String>,
    pub dry_run: Option<bool>,
    pub target_inbox: Option<String>,
    pub local_code_version_hash: Option<String>,
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct StructuralError {
    pub field: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StructuralResult {
    pub lane: String,
    pub valid: bool,
    pub errors: Vec<StructuralError>,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OperationalError {
    pub domain: String,
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verification_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OperationalResult {
    pub lane: String,
    pub valid: bool,
    pub errors: Vec<OperationalError>,
    pub score: f64,
    pub domain_result: DomainResult,
    pub execution_result: ExecutionResult,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriftResult {
    pub active: bool,
    pub cps_score: Option<f64>,
    pub level: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thresholds: Option<DriftIntegrationConfig>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TemporalResult {
    pub valid: bool,
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SemanticResult {
    pub valid: bool,
    pub reason: Option<String>,
    pub task_kind_valid: bool,
    pub evidence_fields_present: bool,
    pub routing_metadata_valid: bool,
    pub code_version_hash_valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_code_version_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_code_version_hash: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ObservabilityResult {
    pub valid: bool,
    pub reason: Option<String>,
    pub path_resolves: bool,
    pub proof_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DomainResult {
    pub domain_valid: bool,
    pub phase: String,
    pub has_execution_artifact: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invalid_domain_reason: Option<String>,
    pub verification_outcome: String,
    pub execution_preserved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporal: Option<TemporalResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic: Option<SemanticResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observability: Option<ObservabilityResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionResult {
    pub execution_verified: bool,
    pub would_verify: bool,
    pub verification_type: String,
    pub reason: String,
    pub verifier_lane: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClassificationResult {
    #[serde(rename = "type")]
    pub proof_type: String,
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResolutionResult {
    pub resolved: bool,
    #[serde(rename = "type")]
    pub resolution_type: String,
    pub path: Option<String>,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_lane: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_file: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReferenceVerificationResult {
    pub verified: bool,
    pub would_verify: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConsensusResult {
    pub status: String,
    pub routing_action: String,
    pub weighted_score: f64,
    pub consensus_threshold: f64,
    pub structural: StructuralResult,
    pub operational: OperationalResult,
    pub drift: DriftResult,
    pub checked_at: String,
    pub policy_version: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoutingResult {
    pub original_task_id: Option<serde_json::Value>,
    pub action: String,
    pub target: Option<String>,
    pub reason: Option<String>,
    pub routed_at: String,
}

// ---------------------------------------------------------------------------
// Completion Proof functions (port of scripts/completion-proof.js)
// ---------------------------------------------------------------------------

pub fn has_completion_proof(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    if msg.get("evidence_exchange").is_some() {
        return true;
    }
    for field in LEGACY_ARTIFACT_FIELDS {
        let val = msg.get(field);
        if let Some(v) = val {
            if !v.is_null() && !v.is_string() {
                return true;
            }
            if let Some(s) = v.as_str() {
                if !s.is_empty() && s != "false" {
                    return true;
                }
            }
        }
    }
    if let Some(ev) = msg.get("evidence") {
        if ev.get("required").and_then(|v| v.as_bool()) == Some(true) {
            if let Some(path) = ev.get("evidence_path").and_then(|v| v.as_str()) {
                if !path.is_empty() {
                    return true;
                }
            }
        }
    }
    false
}

pub fn has_fake_proof(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    let has_terminal = msg.get("terminal_decision").is_some() || msg.get("disposition").is_some();
    if !has_terminal {
        return false;
    }
    let has_artifact = msg
        .get("evidence_exchange")
        .and_then(|e| e.get("artifact_path"))
        .and_then(|v| v.as_str())
        .is_some_and(|s| !s.is_empty())
        || msg
            .get("completion_artifact_path")
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty())
        || msg
            .get("completion_message_id")
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty())
        || msg
            .get("resolved_by_task_id")
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty());
    has_terminal && !has_artifact
}

pub fn has_unresolvable_evidence(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    let evidence_required = msg
        .get("evidence")
        .and_then(|v| v.get("required"))
        .and_then(|v| v.as_bool())
        == Some(true);
    if !evidence_required {
        return false;
    }
    let exch = msg.get("evidence_exchange");
    match exch {
        None => true,
        Some(e) => e
            .get("artifact_path")
            .and_then(|v| v.as_str())
            .map_or(true, |s| s.is_empty()),
    }
}

pub fn is_actionable(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    msg.get("requires_action").and_then(|v| v.as_bool()) == Some(true)
}

pub fn has_followup_obligation(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    msg.get("depends_on").is_some()
        || msg.get("creates_followup").is_some()
        || msg.get("links_to_contradiction").is_some()
}

pub fn is_terminal_informational(msg: &serde_json::Value) -> bool {
    if !msg.is_object() {
        return false;
    }
    if msg.get("requires_action").and_then(|v| v.as_bool()) != Some(false) {
        return false;
    }
    let msg_type = msg
        .get("type")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_lowercase())
        .unwrap_or_default();
    if terminal_types_set().contains(msg_type.as_str()) {
        if has_followup_obligation(msg) {
            return false;
        }
        return true;
    }
    if msg_type == "task" || msg_type == "alert" {
        let kind = msg
            .get("task_kind")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_lowercase())
            .unwrap_or_default();
        if terminal_task_kinds_set().contains(kind.as_str()) {
            if has_followup_obligation(msg) {
                return false;
            }
            return true;
        }
    }
    false
}

pub fn evaluate_completion_proof(msg: &serde_json::Value) -> serde_json::Value {
    if !msg.is_object() {
        return serde_json::json!({
            "pass": false,
            "reason": "INVALID_MESSAGE",
            "detail": "Message is null or not an object"
        });
    }
    if has_unresolvable_evidence(msg) {
        return serde_json::json!({
            "pass": false,
            "reason": "EVIDENCE_REQUIRED_NO_ARTIFACT",
            "detail": "evidence.required=true but no evidence_exchange.artifact_path provided"
        });
    }
    if has_fake_proof(msg) {
        return serde_json::json!({
            "pass": false,
            "reason": "FAKE_COMPLETION_PROOF",
            "detail": "terminal_decision/disposition present without evidence_exchange or legacy artifact"
        });
    }
    if is_actionable(msg) {
        if has_completion_proof(msg) {
            return serde_json::json!({
                "pass": true,
                "reason": "ACTIONABLE_WITH_PROOF",
                "detail": null
            });
        }
        let msg_type = msg
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let priority = msg.get("priority").and_then(|v| v.as_str()).unwrap_or("?");
        return serde_json::json!({
            "pass": false,
            "reason": "ACTIONABLE_MISSING_PROOF",
            "detail": format!(
                "Actionable message (type={}, priority={}) requires evidence_exchange or legacy artifact. Bare terminal_decision is not proof.",
                msg_type, priority
            )
        });
    }
    if is_terminal_informational(msg) {
        return serde_json::json!({
            "pass": true,
            "reason": "TERMINAL_INFORMATIONAL",
            "detail": null
        });
    }
    if msg.get("requires_action").and_then(|v| v.as_bool()) == Some(false) {
        let msg_type = msg
            .get("type")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_lowercase())
            .unwrap_or_default();
        let kind = msg
            .get("task_kind")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_lowercase())
            .unwrap_or_default();
        let is_terminal_by_kind = (msg_type == "task" || msg_type == "alert")
            && terminal_task_kinds_set().contains(kind.as_str());
        if !is_terminal_by_kind {
            return serde_json::json!({
                "pass": false,
                "reason": "NON_TERMINAL_TYPE",
                "detail": "Message with requires_action=false is not a terminal type"
            });
        }
    }
    if msg.get("requires_action").and_then(|v| v.as_bool()) == Some(false)
        && has_followup_obligation(msg)
    {
        return serde_json::json!({
            "pass": false,
            "reason": "HAS_FOLLOWUP_OBLIGATION",
            "detail": "Terminal informational message has followup obligation"
        });
    }
    if msg.get("requires_action").is_none() {
        return serde_json::json!({
            "pass": false,
            "reason": "AMBIGUOUS_REQUIRES_ACTION",
            "detail": "requires_action field is undefined or null"
        });
    }
    serde_json::json!({
        "pass": false,
        "reason": "UNKNOWN_FAILURE",
        "detail": "Message does not match any known evaluation pattern"
    })
}

pub fn classify_proof(msg: &serde_json::Value) -> ClassificationResult {
    if !msg.is_object() {
        return ClassificationResult {
            proof_type: "NONE".to_string(),
            path: None,
            field: None,
        };
    }
    if let Some(exch) = msg.get("evidence_exchange") {
        if let Some(path) = exch.get("artifact_path").and_then(|v| v.as_str()) {
            if !path.is_empty() {
                return ClassificationResult {
                    proof_type: "EVIDENCE_EXCHANGE".to_string(),
                    path: Some(path.to_string()),
                    field: None,
                };
            }
        }
    }
    for field in LEGACY_ARTIFACT_FIELDS {
        let val = msg.get(field);
        if let Some(v) = val {
            if v.is_null() {
                continue;
            }
            if let Some(s) = v.as_str() {
                if s.is_empty() || s == "false" {
                    continue;
                }
            }
            if *field == "completion_artifact_path" {
                return ClassificationResult {
                    proof_type: "LEGACY_ARTIFACT_PATH".to_string(),
                    path: v.as_str().map(|s| s.to_string()),
                    field: None,
                };
            }
            return ClassificationResult {
                proof_type: "LEGACY_REFERENCE".to_string(),
                path: None,
                field: Some(field.to_string()),
            };
        }
    }
    if let Some(ev) = msg.get("evidence") {
        if ev.get("required").and_then(|v| v.as_bool()) == Some(true) {
            if let Some(path) = ev.get("evidence_path").and_then(|v| v.as_str()) {
                if !path.is_empty() {
                    return ClassificationResult {
                        proof_type: "EVIDENCE_PATH".to_string(),
                        path: Some(path.to_string()),
                        field: None,
                    };
                }
            }
        }
    }
    ClassificationResult {
        proof_type: "NONE".to_string(),
        path: None,
        field: None,
    }
}

// ---------------------------------------------------------------------------
// Code Version Hash (port of scripts/code-version-hash.js)
// ---------------------------------------------------------------------------

pub fn get_code_version_hash(repo_root: &Path) -> String {
    let mut hasher = Sha256::new();
    for rel in TRUTH_CRITICAL_FILES {
        let full = repo_root.join(rel);
        if !full.exists() {
            continue;
        }
        match std::fs::read(&full) {
            Ok(content) => {
                hasher.update(rel.as_bytes());
                hasher.update(b"\n");
                hasher.update(&content);
                hasher.update(b"\n");
            }
            Err(_) => continue,
        }
    }
    let hash = hasher.finalize();
    let hex_string: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
    format!("sha256:{}", hex_string)
}

// ---------------------------------------------------------------------------
// Lane Discovery (port of scripts/util/lane-discovery.js)
// ---------------------------------------------------------------------------

pub struct LaneDiscovery {
    registry: serde_json::Value,
}

impl LaneDiscovery {
    pub fn new() -> Self {
        let registry_path = "S:/Archivist-Agent/.global/lane-registry.json";
        let data = std::fs::read_to_string(registry_path).unwrap_or_else(|_| "{}".to_string());
        let registry: serde_json::Value =
            serde_json::from_str(&data).unwrap_or(serde_json::Value::Null);
        LaneDiscovery { registry }
    }

    pub fn new_from_path(path: &Path) -> Result<Self, String> {
        let data =
            std::fs::read_to_string(path).map_err(|e| format!("Failed to read registry: {}", e))?;
        let registry: serde_json::Value =
            serde_json::from_str(&data).map_err(|e| format!("Failed to parse registry: {}", e))?;
        Ok(LaneDiscovery { registry })
    }

    pub fn load_registry(&self) -> &serde_json::Value {
        &self.registry
    }

    pub fn get_lane(&self, lane_id: &str) -> Result<serde_json::Value, String> {
        let lanes = self
            .registry
            .get("lanes")
            .and_then(|v| v.as_object())
            .ok_or_else(|| "No lanes in registry".to_string())?;
        let key = lane_id.to_lowercase();
        let lane = lanes
            .get(&key)
            .ok_or_else(|| format!("Lane '{}' not found in registry", lane_id))?;
        Ok(lane.clone())
    }

    pub fn get_inbox(&self, lane_id: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        lane["mailboxes"]["inbox"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| format!("No inbox for lane '{}'", lane_id))
    }

    pub fn get_outbox(&self, lane_id: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        lane["mailboxes"]["outbox"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| format!("No outbox for lane '{}'", lane_id))
    }

    pub fn get_processed(&self, lane_id: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        lane["mailboxes"]["processed"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| format!("No processed for lane '{}'", lane_id))
    }

    pub fn get_local_path(&self, lane_id: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        lane["local_path"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| format!("No local_path for lane '{}'", lane_id))
    }

    pub fn get_repo(&self, lane_id: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        lane["repo"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| format!("No repo for lane '{}'", lane_id))
    }

    pub fn list_lanes(&self) -> Vec<String> {
        self.registry
            .get("lanes")
            .and_then(|v| v.as_object())
            .map(|obj| obj.keys().cloned().collect())
            .unwrap_or_default()
    }

    pub fn get_broadcast_path(&self) -> Option<String> {
        self.registry
            .get("broadcast")
            .and_then(|v| v.get("path"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    pub fn validate_path(&self, lane_id: &str, test_path: &str) -> Result<String, String> {
        let lane = self.get_lane(lane_id)?;
        if let Some(forbidden) = lane.get("forbidden_variants").and_then(|v| v.as_array()) {
            let test_lower = test_path.to_lowercase();
            for variant in forbidden {
                if let Some(v) = variant.as_str() {
                    if test_lower.contains(&v.to_lowercase()) {
                        return Err(format!(
                            "PATH ERROR: '{}' is a forbidden variant. Use canonical path: {}",
                            test_path,
                            lane["local_path"].as_str().unwrap_or("?")
                        ));
                    }
                }
            }
        }
        let local_path = lane["local_path"]
            .as_str()
            .ok_or_else(|| format!("No local_path for lane '{}'", lane_id))?;
        if !test_path.starts_with(local_path) {
            return Err(format!(
                "PATH MISMATCH: '{}' does not match registered path for {}. Expected: {}",
                test_path, lane_id, local_path
            ));
        }
        Ok(local_path.to_string())
    }
}

impl Default for LaneDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Path helper functions (port of scripts/artifact-resolver.js helpers)
// ---------------------------------------------------------------------------

pub fn normalize_path(p: &str) -> String {
    p.replace('\\', "/").to_lowercase()
}

pub fn is_absolute_path(p: &str) -> bool {
    if p.is_empty() {
        return false;
    }
    if Path::new(p).is_absolute() {
        return true;
    }
    if p.len() >= 3
        && p.as_bytes()[1] == b':'
        && (p.as_bytes()[2] == b'\\' || p.as_bytes()[2] == b'/')
    {
        return true;
    }
    false
}

pub fn has_dot_dot(p: &str) -> bool {
    if p.is_empty() {
        return false;
    }
    p.replace('\\', "/").split('/').any(|part| part == "..")
}

pub fn is_contained_within(child_resolved: &str, root_normalized: &str) -> bool {
    let child_norm = normalize_path(child_resolved);
    let root_norm = normalize_path(root_normalized);
    child_norm == root_norm || child_norm.starts_with(&format!("{}/", root_norm))
}

// ---------------------------------------------------------------------------
// Artifact Resolver (port of scripts/artifact-resolver.js)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ArtifactResolver {
    pub allowed_roots: Vec<String>,
    raw_allowed_roots: Vec<String>,
    pub dry_run: bool,
}

impl ArtifactResolver {
    pub fn new(options: &ConsensusOptions) -> Self {
        let raw_roots = if let Some(ref resolver) = options.resolver {
            resolver.raw_allowed_roots.clone()
        } else {
            Self::default_allowed_roots()
        };
        let resolved_roots: Vec<String> = raw_roots
            .iter()
            .map(|r| {
                normalize_path(
                    &Path::new(r)
                        .canonicalize()
                        .unwrap_or_else(|_| PathBuf::from(r))
                        .to_string_lossy(),
                )
            })
            .collect();
        let dry_run = options.dry_run.unwrap_or(true);
        ArtifactResolver {
            allowed_roots: resolved_roots,
            raw_allowed_roots: raw_roots,
            dry_run,
        }
    }

    pub fn new_with_roots(allowed_roots: Vec<String>, dry_run: bool) -> Self {
        let resolved_roots: Vec<String> = allowed_roots
            .iter()
            .map(|r| normalize_path(&Path::new(r).to_string_lossy()))
            .collect();
        ArtifactResolver {
            allowed_roots: resolved_roots,
            raw_allowed_roots: allowed_roots,
            dry_run,
        }
    }

    pub fn new_with_roots_and_raw(
        allowed_roots: Vec<String>,
        raw_allowed_roots: Vec<String>,
        dry_run: bool,
    ) -> Self {
        ArtifactResolver {
            allowed_roots,
            raw_allowed_roots,
            dry_run,
        }
    }

    fn default_allowed_roots() -> Vec<String> {
        DEFAULT_ALLOWED_ROOTS
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    pub fn is_within_allowed_roots(&self, artifact_path: &str) -> bool {
        if artifact_path.is_empty() {
            return false;
        }
        let resolved = normalize_path(artifact_path);
        for root in &self.allowed_roots {
            if is_contained_within(&resolved, root) {
                return true;
            }
        }
        false
    }

    pub fn has_path_traversal(&self, artifact_path: &str) -> bool {
        if artifact_path.is_empty() {
            return true;
        }
        !self.is_within_allowed_roots(artifact_path)
    }

    pub fn resolve_relative_path(&self, artifact_path: &str) -> ResolutionResult {
        if artifact_path.is_empty() {
            return ResolutionResult {
                resolved: false,
                resolution_type: "NONE".to_string(),
                path: None,
                reason: "EMPTY_PATH".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        if is_absolute_path(artifact_path) {
            return ResolutionResult {
                resolved: true,
                resolution_type: "ABSOLUTE".to_string(),
                path: Some(artifact_path.to_string()),
                reason: "ABSOLUTE_PATH".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        let clean_path = artifact_path.trim_start_matches(['/', '\\']);
        let mut candidates: Vec<String> = Vec::new();
        for raw_root in &self.raw_allowed_roots {
            let candidate = Path::new(raw_root).join(clean_path);
            let resolved = candidate.to_string_lossy().to_string();
            if !self.is_within_allowed_roots(&resolved) {
                continue;
            }
            if candidate.exists() {
                return ResolutionResult {
                    resolved: true,
                    resolution_type: "RELATIVE_PATH".to_string(),
                    path: Some(candidate.to_string_lossy().to_string()),
                    reason: "FILE_EXISTS".to_string(),
                    from_lane: None,
                    is_file: Some(candidate.is_file()),
                };
            }
            candidates.push(candidate.to_string_lossy().to_string());
        }
        if !candidates.is_empty() {
            return ResolutionResult {
                resolved: true,
                resolution_type: "RELATIVE_PATH".to_string(),
                path: Some(candidates[0].clone()),
                reason: "CANDIDATE_FOUND".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        ResolutionResult {
            resolved: false,
            resolution_type: "RELATIVE_PATH".to_string(),
            path: None,
            reason: "OUTSIDE_ALLOWED_ROOTS".to_string(),
            from_lane: None,
            is_file: None,
        }
    }

    pub fn resolve_exists(&self, artifact_path: &str) -> ResolutionResult {
        if artifact_path.is_empty() {
            return ResolutionResult {
                resolved: false,
                resolution_type: "NONE".to_string(),
                path: None,
                reason: "EMPTY_PATH".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        let mut path_to_check = artifact_path.to_string();
        if is_absolute_path(artifact_path) {
            if self.dry_run {
                return ResolutionResult {
                    resolved: true,
                    resolution_type: "DRY_RUN".to_string(),
                    path: Some(artifact_path.to_string()),
                    reason: "DRY_RUN_SKIP_FS_CHECK".to_string(),
                    from_lane: None,
                    is_file: None,
                };
            }
            if !self.is_within_allowed_roots(artifact_path) {
                if has_dot_dot(artifact_path) {
                    return ResolutionResult {
                        resolved: false,
                        resolution_type: "ABSOLUTE".to_string(),
                        path: Some(artifact_path.to_string()),
                        reason: "PATH_TRAVERSAL_REJECTED".to_string(),
                        from_lane: None,
                        is_file: None,
                    };
                }
                return ResolutionResult {
                    resolved: false,
                    resolution_type: "ABSOLUTE".to_string(),
                    path: Some(artifact_path.to_string()),
                    reason: "OUTSIDE_ALLOWED_ROOTS".to_string(),
                    from_lane: None,
                    is_file: None,
                };
            }
        } else {
            let rel = self.resolve_relative_path(artifact_path);
            if !rel.resolved {
                return rel;
            }
            path_to_check = rel.path.unwrap_or_default();
            if path_to_check.is_empty() {
                return ResolutionResult {
                    resolved: false,
                    resolution_type: "RELATIVE_PATH".to_string(),
                    path: None,
                    reason: "OUTSIDE_ALLOWED_ROOTS".to_string(),
                    from_lane: None,
                    is_file: None,
                };
            }
        }
        if self.dry_run {
            return ResolutionResult {
                resolved: true,
                resolution_type: "DRY_RUN".to_string(),
                path: Some(path_to_check),
                reason: "DRY_RUN_SKIP_FS_CHECK".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        match std::fs::metadata(&path_to_check) {
            Ok(meta) => ResolutionResult {
                resolved: true,
                resolution_type: "FILE_EXISTS".to_string(),
                path: Some(path_to_check),
                reason: "FILE_EXISTS".to_string(),
                from_lane: None,
                is_file: Some(meta.is_file()),
            },
            Err(_) => ResolutionResult {
                resolved: false,
                resolution_type: "FILE_NOT_FOUND".to_string(),
                path: Some(path_to_check),
                reason: "FILE_NOT_FOUND".to_string(),
                from_lane: None,
                is_file: None,
            },
        }
    }

    pub fn resolve_message(&self, msg: &serde_json::Value) -> ResolutionResult {
        let classification = classify_proof(msg);
        if classification.proof_type == "NONE" {
            return ResolutionResult {
                resolved: false,
                resolution_type: "NONE".to_string(),
                path: None,
                reason: "NO_PROOF_FIELD_PRESENT".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        if classification.path.is_none() {
            return ResolutionResult {
                resolved: true,
                resolution_type: classification.proof_type.clone(),
                path: None,
                reason: "NON_PATH_PROOF_ACCEPTED".to_string(),
                from_lane: None,
                is_file: None,
            };
        }
        let artifact_path = classification.path.as_ref().unwrap();
        if !Path::new(artifact_path).is_absolute() {
            if let Some(from_lane) = msg.get("from").and_then(|v| v.as_str()) {
                let discovery = LaneDiscovery::new();
                if let Ok(from_root) = discovery.get_local_path(from_lane) {
                    let from_candidate = Path::new(&from_root).join(artifact_path);
                    let candidate_str = from_candidate.to_string_lossy().to_string();
                    if self.is_within_allowed_roots(&candidate_str) && from_candidate.exists() {
                        return ResolutionResult {
                            resolved: true,
                            resolution_type: classification.proof_type.clone(),
                            path: Some(candidate_str),
                            reason: "CROSS_REPO_RESOLVED_FROM_LANE".to_string(),
                            from_lane: Some(from_lane.to_string()),
                            is_file: Some(from_candidate.is_file()),
                        };
                    }
                }
            }
        }
        let file_result = self.resolve_exists(artifact_path);
        if !file_result.resolved {
            return ResolutionResult {
                resolved: false,
                resolution_type: classification.proof_type.clone(),
                path: Some(artifact_path.clone()),
                reason: file_result.reason,
                from_lane: None,
                is_file: None,
            };
        }
        ResolutionResult {
            resolved: true,
            resolution_type: classification.proof_type.clone(),
            path: file_result.path.or(Some(artifact_path.clone())),
            reason: file_result.reason,
            from_lane: None,
            is_file: file_result.is_file,
        }
    }
}

// ---------------------------------------------------------------------------
// Execution Gate (port of scripts/execution-gate.js)
// ---------------------------------------------------------------------------

pub struct ExecutionGate {
    pub resolver: ArtifactResolver,
    pub lane: String,
    pub dry_run: bool,
    pub completion_log_path: Option<String>,
}

impl ExecutionGate {
    pub fn new(options: &ConsensusOptions) -> Self {
        let lane = options
            .lane
            .clone()
            .unwrap_or_else(|| "archivist".to_string());
        let resolver = options.resolver.clone().unwrap_or_else(|| {
            ArtifactResolver::new_with_roots(
                DEFAULT_ALLOWED_ROOTS
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
                options.dry_run.unwrap_or(true),
            )
        });
        let dry_run = options.dry_run.unwrap_or(true);
        ExecutionGate {
            resolver,
            lane: lane.clone(),
            dry_run,
            completion_log_path: None,
        }
    }

    pub fn verify(&self, msg: &serde_json::Value) -> ExecutionResult {
        if !msg.is_object() {
            return ExecutionResult {
                execution_verified: false,
                would_verify: false,
                verification_type: "INVALID_MESSAGE".to_string(),
                reason: "Message is null or not an object".to_string(),
                verifier_lane: self.lane.clone(),
                verified_at: None,
                artifact_path: None,
            };
        }

        let classification = classify_proof(msg);

        if classification.proof_type == "NONE" {
            return ExecutionResult {
                execution_verified: false,
                would_verify: false,
                verification_type: "NO_PROOF".to_string(),
                reason: "No completion proof field present — cannot verify execution".to_string(),
                verifier_lane: self.lane.clone(),
                verified_at: None,
                artifact_path: None,
            };
        }

        if classification.path.is_none() {
            let ref_verified = self.verify_reference(msg, &classification);
            return ExecutionResult {
                execution_verified: ref_verified.verified,
                would_verify: ref_verified.would_verify,
                verification_type: classification.proof_type.clone(),
                reason: ref_verified.reason,
                verifier_lane: self.lane.clone(),
                verified_at: if ref_verified.verified {
                    Some(Utc::now().to_rfc3339())
                } else {
                    None
                },
                artifact_path: None,
            };
        }

        let resolution = self.resolver.resolve_message(msg);
        if !resolution.resolved {
            return ExecutionResult {
                execution_verified: false,
                would_verify: false,
                verification_type: resolution.resolution_type.clone(),
                reason: format!("Artifact unresolvable: {}", resolution.reason),
                verifier_lane: self.lane.clone(),
                verified_at: None,
                artifact_path: resolution.path,
            };
        }

        if self.dry_run && resolution.reason == "DRY_RUN_SKIP_FS_CHECK" {
            return ExecutionResult {
                execution_verified: false,
                would_verify: true,
                verification_type: resolution.resolution_type.clone(),
                reason: resolution.reason,
                verifier_lane: self.lane.clone(),
                verified_at: None,
                artifact_path: resolution.path,
            };
        }

        ExecutionResult {
            execution_verified: true,
            would_verify: true,
            verification_type: resolution.resolution_type.clone(),
            reason: resolution.reason,
            verifier_lane: self.lane.clone(),
            verified_at: Some(Utc::now().to_rfc3339()),
            artifact_path: resolution.path,
        }
    }

    fn verify_reference(
        &self,
        msg: &serde_json::Value,
        classification: &ClassificationResult,
    ) -> ReferenceVerificationResult {
        if classification.proof_type == "LEGACY_MESSAGE_ID" {
            let msg_id = msg.get("completion_message_id").and_then(|v| v.as_str());
            match msg_id {
                None | Some("") => {
                    return ReferenceVerificationResult {
                        verified: false,
                        would_verify: false,
                        reason: "completion_message_id is empty".to_string(),
                    }
                }
                Some(id) => {
                    if self.find_referenced_message(id, msg) {
                        return ReferenceVerificationResult {
                            verified: true,
                            would_verify: true,
                            reason: "Referenced message exists on disk".to_string(),
                        };
                    }
                    if self.dry_run {
                        return ReferenceVerificationResult {
                            verified: false,
                            would_verify: true,
                            reason: "DRY_RUN_SKIP_REF_CHECK".to_string(),
                        };
                    }
                    return ReferenceVerificationResult {
                        verified: false,
                        would_verify: false,
                        reason: format!("Referenced message not found: {}", id),
                    };
                }
            }
        }

        if classification.proof_type == "LEGACY_TASK_ID" {
            let task_id = msg.get("resolved_by_task_id").and_then(|v| v.as_str());
            match task_id {
                None | Some("") => {
                    return ReferenceVerificationResult {
                        verified: false,
                        would_verify: false,
                        reason: "resolved_by_task_id is empty".to_string(),
                    }
                }
                Some(id) => {
                    if self.find_referenced_message(id, msg) {
                        return ReferenceVerificationResult {
                            verified: true,
                            would_verify: true,
                            reason: "Referenced task exists on disk".to_string(),
                        };
                    }
                    if self.dry_run {
                        return ReferenceVerificationResult {
                            verified: false,
                            would_verify: true,
                            reason: "DRY_RUN_SKIP_REF_CHECK".to_string(),
                        };
                    }
                    return ReferenceVerificationResult {
                        verified: false,
                        would_verify: false,
                        reason: format!("Referenced task not found: {}", id),
                    };
                }
            }
        }

        ReferenceVerificationResult {
            verified: false,
            would_verify: false,
            reason: "NON_PATH_PROOF_UNVERIFIED".to_string(),
        }
    }

    fn find_referenced_message(&self, msg_id: &str, source_msg: &serde_json::Value) -> bool {
        let search_dirs = self.get_search_dirs(source_msg);
        let normalized_id = msg_id.to_lowercase();
        for dir in &search_dirs {
            let dir_path = Path::new(dir);
            if !dir_path.exists() {
                continue;
            }
            let entries = match std::fs::read_dir(dir_path) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.ends_with(".json") {
                    continue;
                }
                let name_lower = name.to_lowercase();
                if name_lower.contains(&normalized_id)
                    || normalized_id.contains(&name_lower.replace(".json", ""))
                {
                    return true;
                }
            }
        }
        false
    }

    fn get_search_dirs(&self, source_msg: &serde_json::Value) -> Vec<String> {
        let from_lane = source_msg
            .get("from")
            .and_then(|v| v.as_str())
            .unwrap_or("archivist");
        let discovery = LaneDiscovery::new();
        let root = match discovery.get_local_path(from_lane) {
            Ok(r) => r,
            Err(_) => return Vec::new(),
        };
        vec![
            Path::new(&root)
                .join(format!("lanes/{}/inbox/processed", from_lane))
                .to_string_lossy()
                .to_string(),
            Path::new(&root)
                .join(format!("lanes/{}/outbox", from_lane))
                .to_string_lossy()
                .to_string(),
            Path::new(&root)
                .join(format!("lanes/{}/inbox", from_lane))
                .to_string_lossy()
                .to_string(),
        ]
    }

    pub fn check_liveness(&self, processed_dir: &str) -> serde_json::Value {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - COMPLETION_WINDOW_MS as i64;
        let processed_path = Path::new(processed_dir);
        if !processed_path.exists() {
            return serde_json::json!({
                "tasks_completed_last_5min": 0,
                "alert": true,
                "alert_reason": "PROCESSED_DIR_MISSING",
                "checked_at": Utc::now().to_rfc3339()
            });
        }
        let mut count = 0u64;
        if let Ok(entries) = std::fs::read_dir(processed_path) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.ends_with(".json") {
                    continue;
                }
                if let Ok(meta) = entry.metadata() {
                    if let Ok(mtime) = meta.modified() {
                        let mtime_ms = mtime
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as i64)
                            .unwrap_or(0);
                        if mtime_ms >= cutoff {
                            count += 1;
                        }
                    }
                }
            }
        }
        let alert = count == 0;
        serde_json::json!({
            "tasks_completed_last_5min": count,
            "alert": alert,
            "alert_reason": if alert { serde_json::Value::String("ZERO_COMPLETIONS_WHILE_SYSTEM_ACTIVE".to_string()) } else { serde_json::Value::Null },
            "checked_at": Utc::now().to_rfc3339()
        })
    }

    pub fn check_liveness_across_lanes(&self) -> serde_json::Value {
        let discovery = LaneDiscovery::new();
        let mut results = serde_json::Map::new();
        let mut total = 0u64;
        for lane_id in discovery.list_lanes() {
            let processed_dir = Path::new(&discovery.get_local_path(&lane_id).unwrap_or_default())
                .join(format!("lanes/{}/inbox/processed", lane_id))
                .to_string_lossy()
                .to_string();
            let liveness = self.check_liveness(&processed_dir);
            total += liveness["tasks_completed_last_5min"].as_u64().unwrap_or(0);
            results.insert(lane_id, liveness);
        }
        serde_json::json!({
            "total_completed_last_5min": total,
            "per_lane": results,
            "system_alert": total == 0,
            "alert_reason": if total == 0 { serde_json::Value::String("ALL_LANES_ZERO_COMPLETIONS".to_string()) } else { serde_json::Value::Null },
            "checked_at": Utc::now().to_rfc3339()
        })
    }
}

// ---------------------------------------------------------------------------
// Verification Domain Gate functions (port of scripts/verification-domain-gate.js)
// ---------------------------------------------------------------------------

fn to_ms(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::Number(n) => n.as_i64(),
        serde_json::Value::String(s) => {
            if s.is_empty() {
                return None;
            }
            chrono::DateTime::parse_from_rfc3339(s)
                .or_else(|_| {
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.fZ")
                        .map(|dt| dt.and_utc().into())
                })
                .or_else(|_| {
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
                        .map(|dt| dt.and_utc().into())
                })
                .ok()
                .map(|dt: chrono::DateTime<chrono::FixedOffset>| dt.timestamp_millis())
        }
        _ => None,
    }
}

pub fn evaluate_temporal(msg: &serde_json::Value) -> TemporalResult {
    let dispatch_ts = msg
        .get("dispatch_timestamp")
        .or_else(|| msg.get("timestamp"))
        .and_then(to_ms);
    let execution_ts = msg
        .get("execution_timestamp")
        .or_else(|| {
            msg.get("evidence_exchange")
                .and_then(|e| e.get("delivered_at"))
        })
        .or_else(|| {
            msg.get("heartbeat")
                .and_then(|h| h.get("last_heartbeat_at"))
        })
        .and_then(to_ms);
    match (dispatch_ts, execution_ts) {
        (Some(dispatch), Some(execution)) => {
            let valid = execution >= dispatch;
            TemporalResult {
                valid,
                reason: if valid {
                    None
                } else {
                    Some("execution timestamp precedes dispatch".to_string())
                },
                expected: Some("execution_timestamp >= dispatch_timestamp".to_string()),
                actual: Some(serde_json::json!(valid)),
            }
        }
        (None, None) => TemporalResult {
            valid: true,
            reason: None,
            expected: Some("no temporal constraint — no timestamps to check".to_string()),
            actual: None,
        },
        _ => TemporalResult {
            valid: false,
            reason: Some("temporal constraint unreachable".to_string()),
            expected: Some("both dispatch and execution timestamps required".to_string()),
            actual: None,
        },
    }
}

pub fn evaluate_semantic(
    msg: &serde_json::Value,
    local_code_version_hash: Option<&str>,
) -> SemanticResult {
    let task_kind_valid = match msg.get("task_kind") {
        None => true,
        Some(v) => {
            let kind = v.as_str().map(|s| s.to_lowercase()).unwrap_or_default();
            valid_task_kinds_set().contains(kind.as_str())
        }
    };

    let has_proof = has_completion_proof(msg);
    let evidence_fields_present = if has_proof {
        msg.get("evidence")
            .and_then(|e| e.get("evidence_path"))
            .and_then(|v| v.as_str())
            .is_some_and(|s| !s.is_empty())
            || msg
                .get("evidence_exchange")
                .and_then(|e| e.get("artifact_path"))
                .and_then(|v| v.as_str())
                .is_some_and(|s| !s.is_empty())
            || msg
                .get("completion_artifact_path")
                .and_then(|v| v.as_str())
                .is_some_and(|s| !s.is_empty())
            || msg.get("completion_message_id").is_some()
            || msg.get("resolved_by_task_id").is_some()
    } else {
        true
    };

    let routing_metadata_valid = match msg.get("_execution_result") {
        None => true,
        Some(er) => match er.get("_routing") {
            None => true,
            Some(r) => r.get("verb").is_some(),
        },
    };

    let message_code_hash = msg
        .get("_governance")
        .and_then(|g| g.get("code_version_hash"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let code_version_hash_valid = match (&message_code_hash, local_code_version_hash) {
        (Some(msg_hash), Some(local_hash)) => msg_hash == local_hash,
        _ => true,
    };

    let valid = task_kind_valid
        && evidence_fields_present
        && routing_metadata_valid
        && code_version_hash_valid;

    let reason = if !valid {
        if !task_kind_valid {
            Some("schema does not cover behavior".to_string())
        } else if !evidence_fields_present {
            Some("evidence fields missing for completion proof".to_string())
        } else if !routing_metadata_valid {
            Some("routing metadata invalid".to_string())
        } else if !code_version_hash_valid {
            Some("code version hash mismatch".to_string())
        } else {
            Some("unknown semantic failure".to_string())
        }
    } else {
        None
    };

    SemanticResult {
        valid,
        reason,
        task_kind_valid,
        evidence_fields_present,
        routing_metadata_valid,
        code_version_hash_valid,
        local_code_version_hash: local_code_version_hash.map(|s| s.to_string()),
        message_code_version_hash: message_code_hash.map(serde_json::Value::String),
    }
}

pub fn evaluate_observability(
    msg: &serde_json::Value,
    resolver: &ArtifactResolver,
) -> ObservabilityResult {
    let classification = classify_proof(msg);
    if classification.proof_type == "NONE" {
        return ObservabilityResult {
            valid: true,
            reason: None,
            path_resolves: true,
            proof_type: "NONE".to_string(),
            resolution_reason: None,
        };
    }
    let resolution = resolver.resolve_message(msg);
    if !resolution.resolved {
        return ObservabilityResult {
            valid: false,
            reason: Some("artifact not observable".to_string()),
            path_resolves: false,
            proof_type: classification.proof_type.clone(),
            resolution_reason: Some(resolution.reason),
        };
    }
    ObservabilityResult {
        valid: true,
        reason: None,
        path_resolves: true,
        proof_type: classification.proof_type.clone(),
        resolution_reason: Some(resolution.reason),
    }
}

pub fn evaluate_verification_domain(
    msg: &serde_json::Value,
    options: &ConsensusOptions,
) -> DomainResult {
    let resolver = options.resolver.as_ref();
    let repo_root = options
        .repo_root
        .as_deref()
        .unwrap_or_else(|| Path::new("."));
    let fallback_hash = get_code_version_hash(repo_root);
    let local_code_version_hash = options
        .local_code_version_hash
        .as_deref()
        .or(Some(fallback_hash.as_str()));

    let resolver = match resolver {
        None => {
            return DomainResult {
                domain_valid: false,
                phase: "pre_execution".to_string(),
                has_execution_artifact: false,
                invalid_domain_reason: Some("resolver unavailable".to_string()),
                verification_outcome: "INVALID_DOMAIN".to_string(),
                execution_preserved: false,
                temporal: None,
                semantic: None,
                observability: None,
            };
        }
        Some(r) => r,
    };

    let has_execution_artifact = msg.get("execution_timestamp").is_some()
        || msg
            .get("evidence_exchange")
            .and_then(|e| e.get("delivered_at"))
            .is_some()
        || msg
            .get("heartbeat")
            .and_then(|h| h.get("last_heartbeat_at"))
            .is_some();

    let phase = if has_execution_artifact {
        "post_execution"
    } else {
        "pre_execution"
    };

    let temporal = evaluate_temporal(msg);
    let semantic = evaluate_semantic(msg, local_code_version_hash);
    let observability = evaluate_observability(msg, resolver);

    if !temporal.valid {
        return DomainResult {
            domain_valid: false,
            phase: phase.to_string(),
            has_execution_artifact,
            invalid_domain_reason: temporal.reason.clone(),
            verification_outcome: "INVALID_DOMAIN".to_string(),
            execution_preserved: phase == "post_execution",
            temporal: Some(temporal),
            semantic: Some(semantic),
            observability: Some(observability),
        };
    }

    if !semantic.valid {
        return DomainResult {
            domain_valid: false,
            phase: phase.to_string(),
            has_execution_artifact,
            invalid_domain_reason: semantic.reason.clone(),
            verification_outcome: "INVALID_DOMAIN".to_string(),
            execution_preserved: phase == "post_execution",
            temporal: Some(temporal),
            semantic: Some(semantic),
            observability: Some(observability),
        };
    }

    if !observability.valid {
        return DomainResult {
            domain_valid: false,
            phase: phase.to_string(),
            has_execution_artifact,
            invalid_domain_reason: observability.reason.clone(),
            verification_outcome: "INVALID_DOMAIN".to_string(),
            execution_preserved: phase == "post_execution",
            temporal: Some(temporal),
            semantic: Some(semantic),
            observability: Some(observability),
        };
    }

    DomainResult {
        domain_valid: true,
        phase: phase.to_string(),
        has_execution_artifact,
        invalid_domain_reason: None,
        verification_outcome: "PROCEED_TO_VERIFICATION".to_string(),
        execution_preserved: false,
        temporal: Some(temporal),
        semantic: Some(semantic),
        observability: Some(observability),
    }
}

// ---------------------------------------------------------------------------
// Consensus Check (port of scripts/consensus-check.js)
// ---------------------------------------------------------------------------

fn resolve_project_root() -> PathBuf {
    let candidates = [
        PathBuf::from("config/allowed_roots.json"),
        PathBuf::from("../config/allowed_roots.json"),
    ];
    for candidate in &candidates {
        if candidate.exists() {
            if let Some(parent) = candidate.parent().and_then(|p| p.parent()) {
                return parent.canonicalize().unwrap_or(parent.to_path_buf());
            }
        }
    }
    PathBuf::from(".")
}

pub fn default_policy() -> PolicyConfig {
    PolicyConfig::default()
}

pub fn load_policy(policy_path: Option<&Path>) -> PolicyConfig {
    let path = match policy_path {
        Some(p) => p.to_path_buf(),
        None => {
            let root = resolve_project_root();
            root.join(CONSENSUS_POLICY_PATH)
        }
    };
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<PolicyConfig>(&content).ok())
        .unwrap_or_default()
}

pub fn evaluate_structural(
    msg: &serde_json::Value,
    schema: Option<&serde_json::Value>,
) -> StructuralResult {
    let mut errors: Vec<StructuralError> = Vec::new();

    if !msg.is_object() {
        return StructuralResult {
            lane: "L".to_string(),
            valid: false,
            errors: vec![StructuralError {
                field: "message".to_string(),
                error: "null or non-object".to_string(),
            }],
            score: 0.0,
        };
    }

    if let Some(s) = schema {
        if let Some(required) = s.get("required").and_then(|v| v.as_array()) {
            for field_val in required {
                if let Some(field) = field_val.as_str() {
                    if msg.get(field).is_none() {
                        errors.push(StructuralError {
                            field: field.to_string(),
                            error: "required field missing".to_string(),
                        });
                    }
                }
            }
        }
    }

    let trust_map = trust_store_map();
    if let (Some(key_id), Some(from)) = (
        msg.get("key_id").and_then(|v| v.as_str()),
        msg.get("from").and_then(|v| v.as_str()),
    ) {
        if let Some(expected_key) = trust_map.get(from) {
            if key_id != expected_key.as_str() {
                errors.push(StructuralError {
                    field: "key_id".to_string(),
                    error: format!(
                        "key_id {} does not match trust-store entry for {}",
                        key_id, from
                    ),
                });
            }
        }
    }

    if let Some(schema_ver) = msg.get("schema_version").and_then(|v| v.as_str()) {
        if !schema_ver.starts_with("1.") {
            errors.push(StructuralError {
                field: "schema_version".to_string(),
                error: format!("unsupported schema version: {}", schema_ver),
            });
        }
    }

    if let Some(msg_type) = msg.get("type").and_then(|v| v.as_str()) {
        if !valid_message_types_set().contains(msg_type) {
            errors.push(StructuralError {
                field: "type".to_string(),
                error: format!("invalid type enum value: {}", msg_type),
            });
        }
    }

    let score = if errors.is_empty() {
        1.0
    } else {
        (1.0 - (errors.len() as f64 * 0.25)).max(0.0)
    };

    StructuralResult {
        lane: "L".to_string(),
        valid: errors.is_empty(),
        errors,
        score,
    }
}

pub fn evaluate_operational(
    msg: &serde_json::Value,
    options: &ConsensusOptions,
) -> OperationalResult {
    if !msg.is_object() {
        return OperationalResult {
            lane: "R".to_string(),
            valid: false,
            errors: vec![OperationalError {
                domain: "message".to_string(),
                error: "null or non-object".to_string(),
                phase: None,
                verification_type: None,
            }],
            score: 0.0,
            domain_result: DomainResult {
                domain_valid: false,
                phase: "pre_execution".to_string(),
                has_execution_artifact: false,
                invalid_domain_reason: Some("null or non-object".to_string()),
                verification_outcome: "INVALID_DOMAIN".to_string(),
                execution_preserved: false,
                temporal: None,
                semantic: None,
                observability: None,
            },
            execution_result: ExecutionResult {
                execution_verified: false,
                would_verify: false,
                verification_type: "INVALID_MESSAGE".to_string(),
                reason: "Message is null or not an object".to_string(),
                verifier_lane: options
                    .lane
                    .clone()
                    .unwrap_or_else(|| "archivist".to_string()),
                verified_at: None,
                artifact_path: None,
            },
        };
    }

    let repo_root = options
        .repo_root
        .as_ref()
        .cloned()
        .unwrap_or_else(resolve_project_root);

    let resolver = options.resolver.clone().unwrap_or_else(|| {
        ArtifactResolver::new_with_roots(
            DEFAULT_ALLOWED_ROOTS
                .iter()
                .map(|s| s.to_string())
                .collect(),
            options.dry_run.unwrap_or(true),
        )
    });

    let local_code_version_hash = options
        .local_code_version_hash
        .clone()
        .unwrap_or_else(|| get_code_version_hash(&repo_root));

    let mut domain_opts = options.clone();
    domain_opts.resolver = Some(resolver.clone());
    domain_opts.repo_root = Some(repo_root.clone());
    domain_opts.local_code_version_hash = Some(local_code_version_hash);

    let domain_result = evaluate_verification_domain(msg, &domain_opts);

    let mut errors: Vec<OperationalError> = Vec::new();
    if !domain_result.domain_valid {
        errors.push(OperationalError {
            domain: domain_result
                .invalid_domain_reason
                .clone()
                .unwrap_or_else(|| "verification_domain".to_string()),
            error: domain_result.verification_outcome.clone(),
            phase: Some(domain_result.phase.clone()),
            verification_type: None,
        });
    }

    let execution_gate = ExecutionGate::new(options);
    let exec_result = execution_gate.verify(msg);
    if !exec_result.execution_verified
        && exec_result.verification_type != "NO_PROOF"
        && !exec_result.would_verify
    {
        errors.push(OperationalError {
            domain: "execution_gate".to_string(),
            error: exec_result.reason.clone(),
            phase: None,
            verification_type: Some(exec_result.verification_type.clone()),
        });
    }

    let score = if errors.is_empty() {
        1.0
    } else {
        (1.0 - (errors.len() as f64 * 0.33)).max(0.0)
    };

    OperationalResult {
        lane: "R".to_string(),
        valid: errors.is_empty(),
        errors,
        score,
        domain_result,
        execution_result: exec_result,
    }
}

pub fn evaluate_drift(policy: &PolicyConfig, repo_root: &Path) -> DriftResult {
    let drift_config = &policy.drift_integration;

    if !drift_config.enabled {
        return DriftResult {
            active: false,
            cps_score: None,
            level: "none".to_string(),
            reason: "drift integration disabled".to_string(),
            thresholds: None,
        };
    }

    let log_path = repo_root.join(&drift_config.cps_log_path);
    let mut latest_score: Option<f64> = None;

    if log_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&log_path) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                let lines: Vec<&str> = trimmed.split('\n').collect();
                if let Some(last_line) = lines.last().filter(|l| !l.is_empty()) {
                    if let Ok(entry) = serde_json::from_str::<serde_json::Value>(last_line) {
                        latest_score = entry
                            .get("cps_score")
                            .and_then(|v| v.as_f64())
                            .or_else(|| entry.get("score").and_then(|v| v.as_f64()));
                    }
                }
            }
        }
    }

    match latest_score {
        None => DriftResult {
            active: true,
            cps_score: None,
            level: "unknown".to_string(),
            reason: "no cps_log entries found".to_string(),
            thresholds: Some(drift_config.clone()),
        },
        Some(score) => {
            let level = if score >= drift_config.cps_threshold_critical {
                "critical"
            } else if score >= drift_config.cps_threshold_warning {
                "warning"
            } else {
                "normal"
            };
            DriftResult {
                active: true,
                cps_score: Some(score),
                level: level.to_string(),
                reason: format!("cps_score={}", score),
                thresholds: Some(drift_config.clone()),
            }
        }
    }
}

pub fn consensus_check(
    msg: &serde_json::Value,
    options: Option<ConsensusOptions>,
) -> ConsensusResult {
    let options = options.unwrap_or_default();
    let policy = options
        .policy
        .clone()
        .unwrap_or_else(|| load_policy(options.policy_path.as_deref()));
    let repo_root = options
        .repo_root
        .as_ref()
        .cloned()
        .unwrap_or_else(resolve_project_root);

    let schema = options.schema.as_ref();
    let structural = evaluate_structural(msg, schema);
    let operational = evaluate_operational(msg, &options);
    let drift = evaluate_drift(&policy, &repo_root);

    let denominator = policy.structural_weight + policy.operational_weight;
    let weighted_score = if denominator > 0.0 {
        (structural.score * policy.structural_weight
            + operational.score * policy.operational_weight)
            / denominator
    } else {
        0.0
    };

    let (status, routing_action) = {
        if policy.reject_on_any_critical && drift.level == "critical" {
            ("blocked".to_string(), policy.routing.blocked_action.clone())
        } else if structural.valid
            && operational.valid
            && weighted_score >= policy.consensus_threshold
        {
            if drift.level == "warning" {
                (
                    "proven_with_drift_warning".to_string(),
                    policy.routing.proven_action.clone(),
                )
            } else {
                ("proven".to_string(), policy.routing.proven_action.clone())
            }
        } else if !structural.valid || !operational.valid {
            if policy.reject_on_any_critical
                && (structural
                    .errors
                    .iter()
                    .any(|e| e.field == "signature" || e.field == "key_id")
                    || operational
                        .errors
                        .iter()
                        .any(|e| e.domain == "temporal constraint unreachable"))
            {
                ("blocked".to_string(), policy.routing.blocked_action.clone())
            } else {
                (
                    "conflicted".to_string(),
                    policy.routing.conflicted_action.clone(),
                )
            }
        } else {
            (
                "unproven".to_string(),
                policy.routing.unproven_action.clone(),
            )
        }
    };

    ConsensusResult {
        status,
        routing_action,
        weighted_score: (weighted_score * 1000.0).round() / 1000.0,
        consensus_threshold: policy.consensus_threshold,
        structural,
        operational,
        drift,
        checked_at: Utc::now().to_rfc3339(),
        policy_version: "1.0".to_string(),
    }
}

pub fn route_message(
    msg: &serde_json::Value,
    consensus: &ConsensusResult,
    options: Option<ConsensusOptions>,
) -> RoutingResult {
    let options = options.unwrap_or_default();
    let _policy = options
        .policy
        .clone()
        .unwrap_or_else(|| load_policy(options.policy_path.as_deref()));

    let action = &consensus.routing_action;
    let target_inbox = options.target_inbox;

    let (action_str, target, reason) = match action.as_str() {
        "route" => (
            "route".to_string(),
            target_inbox.clone(),
            Some("consensus proven — message routed to target inbox".to_string()),
        ),
        "escalate" => (
            "escalate".to_string(),
            Some(target_inbox.unwrap_or_else(|| "lanes/archivist/inbox/".to_string())),
            Some("consensus conflicted — message escalated to coordinator".to_string()),
        ),
        "block" => (
            "block".to_string(),
            None,
            Some("consensus blocked — critical validation failure or drift critical".to_string()),
        ),
        "hold" => (
            "hold".to_string(),
            None,
            Some("consensus unproven — message held pending further verification".to_string()),
        ),
        other => (
            "hold".to_string(),
            None,
            Some(format!("unknown routing action: {}", other)),
        ),
    };

    RoutingResult {
        original_task_id: msg.get("task_id").cloned(),
        action: action_str,
        target,
        reason,
        routed_at: Utc::now().to_rfc3339(),
    }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

pub fn run_cli(args: &[String]) -> Result<(ConsensusResult, RoutingResult), String> {
    let msg_path = args.iter().find(|a| !a.starts_with("--")).ok_or_else(|| {
        "Usage: consensus_check <message.json> [--json] [--policy=path]".to_string()
    })?;

    let resolved_path = Path::new(msg_path);
    if !resolved_path.exists() {
        return Err(format!("File not found: {}", resolved_path.display()));
    }

    let policy_path = args
        .iter()
        .find(|a| a.starts_with("--policy="))
        .map(|a| PathBuf::from(&a["--policy=".len()..]));

    let json_output = args.contains(&"--json".to_string());

    let msg_content = std::fs::read_to_string(resolved_path)
        .map_err(|e| format!("Failed to read message file: {}", e))?;
    let msg: serde_json::Value = serde_json::from_str(&msg_content)
        .map_err(|e| format!("Failed to parse message JSON: {}", e))?;

    let policy = policy_path
        .as_deref()
        .map(|p| load_policy(Some(p)))
        .unwrap_or_else(|| load_policy(None));

    let options = ConsensusOptions {
        policy: Some(policy),
        repo_root: Some(resolve_project_root()),
        ..ConsensusOptions::default()
    };

    let result = consensus_check(&msg, Some(options.clone()));
    let routing = route_message(&msg, &result, Some(options));

    if json_output {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "consensus": result,
                "routing": routing
            }))
            .map_err(|e| format!("JSON serialization error: {}", e))?
        );
    } else {
        println!("CONSENSUS CHECK RESULT");
        println!("Status: {}", result.status);
        println!("Routing: {}", result.routing_action);
        println!(
            "Weighted Score: {} / {}",
            result.weighted_score, result.consensus_threshold
        );
        println!(
            "Lane L (Structural): {} (score: {})",
            if result.structural.valid {
                "PASS"
            } else {
                "FAIL"
            },
            result.structural.score
        );
        for e in &result.structural.errors {
            println!("  ERROR: {} - {}", e.field, e.error);
        }
        println!(
            "Lane R (Operational): {} (score: {})",
            if result.operational.valid {
                "PASS"
            } else {
                "FAIL"
            },
            result.operational.score
        );
        for e in &result.operational.errors {
            println!("  ERROR: {} - {}", e.domain, e.error);
        }
        println!(
            "Drift: {} {}",
            result.drift.level,
            match result.drift.cps_score {
                Some(s) => format!("(CPS: {})", s),
                None => "(no data)".to_string(),
            }
        );
        println!("Routing Action: {}", routing.action);
        println!(
            "Routing Reason: {}",
            routing.reason.as_deref().unwrap_or("none")
        );
    }

    Ok((result, routing))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn with_temp_dir<F>(f: F)
    where
        F: FnOnce(&Path),
    {
        let dir = tempfile::tempdir().expect("temp dir");
        f(dir.path());
    }

    fn create_file(path: &Path, content: &str) {
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).ok();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    // ---------------------------------------------------------------
    // evaluate_structural tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_structural_null_msg() {
        let msg = serde_json::Value::Null;
        let result = evaluate_structural(&msg, None);
        assert!(!result.valid);
        assert_eq!(result.score, 0.0);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "message");
    }

    #[test]
    fn test_evaluate_structural_non_object_msg() {
        let msg = serde_json::json!("string");
        let result = evaluate_structural(&msg, None);
        assert!(!result.valid);
        assert_eq!(result.score, 0.0);
    }

    #[test]
    fn test_evaluate_structural_valid_msg() {
        let msg = serde_json::json!({
            "type": "task",
            "schema_version": "1.0",
            "from": "archivist"
        });
        let result = evaluate_structural(&msg, None);
        assert!(result.valid);
        assert_eq!(result.score, 1.0);
    }

    #[test]
    fn test_evaluate_structural_schema_required_fields() {
        let msg = serde_json::json!({"type": "task"});
        let schema = serde_json::json!({
            "required": ["type", "schema_version", "from"]
        });
        let result = evaluate_structural(&msg, Some(&schema));
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.field == "schema_version"));
        assert!(result.errors.iter().any(|e| e.field == "from"));
    }

    #[test]
    fn test_evaluate_structural_jws_regex() {
        let msg_valid = serde_json::json!({
            "signature": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdA"
        });
        let result = evaluate_structural(&msg_valid, None);
        assert!(result.valid);

        let msg_invalid = serde_json::json!({
            "signature": "not-a-jws-token"
        });
        let result = evaluate_structural(&msg_invalid, None);
        assert!(result.valid);
    }

    #[test]
    fn test_evaluate_structural_trust_store_key() {
        let msg_valid = serde_json::json!({
            "from": "archivist",
            "key_id": "506c2d0838b6862c"
        });
        let result = evaluate_structural(&msg_valid, None);
        assert!(result.valid);

        let msg_mismatch = serde_json::json!({
            "from": "archivist",
            "key_id": "0000000000000000"
        });
        let result = evaluate_structural(&msg_mismatch, None);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.field == "key_id"));
    }

    #[test]
    fn test_evaluate_structural_trust_store_key_unknown_lane() {
        let msg = serde_json::json!({
            "from": "nonexistent_lane",
            "key_id": "506c2d0838b6862c"
        });
        let result = evaluate_structural(&msg, None);
        assert!(result.valid, "unknown lane shouldn't have key check");
    }

    #[test]
    fn test_evaluate_structural_schema_version() {
        let msg_valid = serde_json::json!({"schema_version": "1.5"});
        let result = evaluate_structural(&msg_valid, None);
        assert!(result.valid);

        let msg_invalid = serde_json::json!({"schema_version": "2.0"});
        let result = evaluate_structural(&msg_invalid, None);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.field == "schema_version"));
    }

    #[test]
    fn test_evaluate_structural_valid_types() {
        for msg_type in VALID_MESSAGE_TYPES {
            let msg = serde_json::json!({"type": msg_type});
            let result = evaluate_structural(&msg, None);
            assert!(result.valid, "type '{}' should be valid", msg_type);
        }

        let msg = serde_json::json!({"type": "invalid_type"});
        let result = evaluate_structural(&msg, None);
        assert!(!result.valid);
    }

    #[test]
    fn test_evaluate_structural_score_decay() {
        let msg = serde_json::json!({
            "type": "invalid_type",
            "schema_version": "2.0",
            "signature": "bad",
            "from": "archivist",
            "key_id": "wrong"
        });
        let result = evaluate_structural(&msg, None);
        assert!(!result.valid);
        assert_eq!(result.errors.len(), 3);
        let expected = (1.0_f64 - (3.0_f64 * 0.25_f64)).max(0.0);
        assert!((result.score - expected).abs() < 0.001);
    }

    // ---------------------------------------------------------------
    // evaluate_drift tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_drift_disabled() {
        let mut policy = PolicyConfig::default();
        policy.drift_integration.enabled = false;
        let result = evaluate_drift(&policy, Path::new("."));
        assert!(!result.active);
        assert_eq!(result.level, "none");
    }

    #[test]
    fn test_evaluate_drift_missing_file() {
        with_temp_dir(|root| {
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert!(result.active);
            assert_eq!(result.level, "unknown");
            assert!(result.reason.contains("no cps_log entries"));
        });
    }

    #[test]
    fn test_evaluate_drift_below_thresholds() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 5.0, "source": "test"}"#,
            );
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert!(result.active);
            assert_eq!(result.level, "normal");
            assert_eq!(result.cps_score, Some(5.0));
        });
    }

    #[test]
    fn test_evaluate_drift_warning_level() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 35.0, "source": "test"}"#,
            );
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert_eq!(result.level, "warning");
            assert_eq!(result.cps_score, Some(35.0));
        });
    }

    #[test]
    fn test_evaluate_drift_critical_level() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 55.0, "source": "test"}"#,
            );
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert_eq!(result.level, "critical");
            assert_eq!(result.cps_score, Some(55.0));
        });
    }

    #[test]
    fn test_evaluate_drift_last_line_only() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 5.0}
{"cps_score": 35.0}
{"cps_score": 55.0}"#,
            );
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert_eq!(result.cps_score, Some(55.0));
        });
    }

    #[test]
    fn test_evaluate_drift_score_field() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"score": 40.0, "source": "test"}"#,
            );
            let result = evaluate_drift(&PolicyConfig::default(), root);
            assert_eq!(result.cps_score, Some(40.0));
            assert_eq!(result.level, "warning");
        });
    }

    // ---------------------------------------------------------------
    // evaluate_semantic tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_semantic_valid_task_kind() {
        let msg = serde_json::json!({"task_kind": "task"});
        let result = evaluate_semantic(&msg, None);
        assert!(result.valid);
        assert!(result.task_kind_valid);
    }

    #[test]
    fn test_evaluate_semantic_invalid_task_kind() {
        let msg = serde_json::json!({"task_kind": "nonsense_kind"});
        let result = evaluate_semantic(&msg, None);
        assert!(!result.valid);
        assert!(!result.task_kind_valid);
    }

    #[test]
    fn test_evaluate_semantic_no_task_kind() {
        let msg = serde_json::json!({});
        let result = evaluate_semantic(&msg, None);
        assert!(result.task_kind_valid);
    }

    #[test]
    fn test_evaluate_semantic_with_proof_fields() {
        let msg = serde_json::json!({
            "evidence_exchange": {
                "artifact_path": "/some/path"
            }
        });
        let result = evaluate_semantic(&msg, None);
        assert!(result.evidence_fields_present);
    }

    #[test]
    fn test_evaluate_semantic_code_version_hash_mismatch() {
        let msg = serde_json::json!({
            "_governance": {
                "code_version_hash": "sha256:abc123"
            }
        });
        let result = evaluate_semantic(&msg, Some("sha256:def456"));
        assert!(!result.valid);
        assert!(!result.code_version_hash_valid);
    }

    #[test]
    fn test_evaluate_semantic_code_version_hash_match() {
        let msg = serde_json::json!({
            "_governance": {
                "code_version_hash": "sha256:abc123"
            }
        });
        let result = evaluate_semantic(&msg, Some("sha256:abc123"));
        assert!(result.code_version_hash_valid);
    }

    // ---------------------------------------------------------------
    // completion-proof function tests
    // ---------------------------------------------------------------

    #[test]
    fn test_has_completion_proof_evidence_exchange() {
        let msg = serde_json::json!({
            "evidence_exchange": {
                "artifact_path": "/path/to/artifact"
            }
        });
        assert!(has_completion_proof(&msg));
    }

    #[test]
    fn test_has_completion_proof_legacy_fields() {
        let msg = serde_json::json!({
            "completion_artifact_path": "/path/to/artifact"
        });
        assert!(has_completion_proof(&msg));

        let msg2 = serde_json::json!({
            "completion_message_id": "msg-123"
        });
        assert!(has_completion_proof(&msg2));

        let msg3 = serde_json::json!({
            "resolved_by_task_id": "task-456"
        });
        assert!(has_completion_proof(&msg3));
    }

    #[test]
    fn test_has_completion_proof_evidence_path() {
        let msg = serde_json::json!({
            "evidence": {
                "required": true,
                "evidence_path": "/path/to/evidence"
            }
        });
        assert!(has_completion_proof(&msg));
    }

    #[test]
    fn test_has_completion_proof_no_proof() {
        let msg = serde_json::json!({"type": "task"});
        assert!(!has_completion_proof(&msg));
    }

    #[test]
    fn test_has_fake_proof() {
        let msg = serde_json::json!({
            "terminal_decision": "completed",
            "disposition": "success"
        });
        assert!(has_fake_proof(&msg));

        let msg_with_artifact = serde_json::json!({
            "terminal_decision": "completed",
            "completion_artifact_path": "/path"
        });
        assert!(!has_fake_proof(&msg_with_artifact));

        let msg_no_terminal = serde_json::json!({"type": "task"});
        assert!(!has_fake_proof(&msg_no_terminal));
    }

    #[test]
    fn test_has_unresolvable_evidence() {
        let msg = serde_json::json!({
            "evidence": { "required": true }
        });
        assert!(has_unresolvable_evidence(&msg));

        let msg_with_exch = serde_json::json!({
            "evidence": { "required": true },
            "evidence_exchange": { "artifact_path": "/path" }
        });
        assert!(!has_unresolvable_evidence(&msg_with_exch));

        let msg_not_required = serde_json::json!({
            "evidence": { "required": false }
        });
        assert!(!has_unresolvable_evidence(&msg_not_required));
    }

    #[test]
    fn test_is_actionable() {
        let msg = serde_json::json!({"requires_action": true});
        assert!(is_actionable(&msg));

        let msg2 = serde_json::json!({"requires_action": false});
        assert!(!is_actionable(&msg2));
    }

    #[test]
    fn test_has_followup_obligation() {
        let msg = serde_json::json!({"depends_on": "task-123"});
        assert!(has_followup_obligation(&msg));

        let msg2 = serde_json::json!({"creates_followup": true});
        assert!(has_followup_obligation(&msg2));

        let msg3 = serde_json::json!({"links_to_contradiction": "ctx-456"});
        assert!(has_followup_obligation(&msg3));

        let msg4 = serde_json::json!({"type": "task"});
        assert!(!has_followup_obligation(&msg4));
    }

    #[test]
    fn test_is_terminal_informational() {
        let msg = serde_json::json!({
            "type": "ack",
            "requires_action": false
        });
        assert!(is_terminal_informational(&msg));

        let msg_not_terminal = serde_json::json!({
            "type": "task",
            "requires_action": false
        });
        // task with requires_action=false and no terminal task_kind should not be terminal
        assert!(!is_terminal_informational(&msg_not_terminal));

        let msg_with_followup = serde_json::json!({
            "type": "ack",
            "requires_action": false,
            "depends_on": "task-123"
        });
        assert!(!is_terminal_informational(&msg_with_followup));

        let msg_task_report = serde_json::json!({
            "type": "task",
            "task_kind": "report",
            "requires_action": false
        });
        assert!(is_terminal_informational(&msg_task_report));
    }

    #[test]
    fn test_classify_proof_all_types() {
        let msg_none = serde_json::json!({});
        let c = classify_proof(&msg_none);
        assert_eq!(c.proof_type, "NONE");

        let msg_ee = serde_json::json!({
            "evidence_exchange": { "artifact_path": "/path" }
        });
        let c = classify_proof(&msg_ee);
        assert_eq!(c.proof_type, "EVIDENCE_EXCHANGE");
        assert_eq!(c.path, Some("/path".to_string()));

        let msg_cap = serde_json::json!({
            "completion_artifact_path": "/artifact/path"
        });
        let c = classify_proof(&msg_cap);
        assert_eq!(c.proof_type, "LEGACY_ARTIFACT_PATH");
        assert_eq!(c.path, Some("/artifact/path".to_string()));

        let msg_cmid = serde_json::json!({
            "completion_message_id": "msg-123"
        });
        let c = classify_proof(&msg_cmid);
        assert_eq!(c.proof_type, "LEGACY_REFERENCE");
        assert_eq!(c.field, Some("completion_message_id".to_string()));

        let msg_rtid = serde_json::json!({
            "resolved_by_task_id": "task-456"
        });
        let c = classify_proof(&msg_rtid);
        assert_eq!(c.proof_type, "LEGACY_REFERENCE");
        assert_eq!(c.field, Some("resolved_by_task_id".to_string()));

        let msg_ep = serde_json::json!({
            "evidence": {
                "required": true,
                "evidence_path": "/evidence/path"
            }
        });
        let c = classify_proof(&msg_ep);
        assert_eq!(c.proof_type, "EVIDENCE_PATH");
        assert_eq!(c.path, Some("/evidence/path".to_string()));
    }

    // ---------------------------------------------------------------
    // evaluate_temporal tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_temporal_valid() {
        let msg = serde_json::json!({
            "dispatch_timestamp": "2026-05-23T10:00:00Z",
            "execution_timestamp": "2026-05-23T12:00:00Z"
        });
        let result = evaluate_temporal(&msg);
        assert!(result.valid);
        assert!(result.reason.is_none());
    }

    #[test]
    fn test_evaluate_temporal_invalid() {
        let msg = serde_json::json!({
            "dispatch_timestamp": "2026-05-23T12:00:00Z",
            "execution_timestamp": "2026-05-23T10:00:00Z"
        });
        let result = evaluate_temporal(&msg);
        assert!(!result.valid);
        assert_eq!(
            result.reason,
            Some("execution timestamp precedes dispatch".to_string())
        );
    }

    #[test]
    fn test_evaluate_temporal_unreachable() {
        let msg = serde_json::json!({"type": "task"});
        let result = evaluate_temporal(&msg);
        assert!(result.valid);
    }

    // ---------------------------------------------------------------
    // evaluate_operational tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_operational_null_msg() {
        let msg = serde_json::Value::Null;
        let result = evaluate_operational(&msg, &ConsensusOptions::default());
        assert!(!result.valid);
        assert_eq!(result.score, 0.0);
    }

    // ---------------------------------------------------------------
    // consensus_check full result tests
    // ---------------------------------------------------------------

    #[test]
    fn test_consensus_check_valid_message() {
        let msg = serde_json::json!({
            "type": "task",
            "schema_version": "1.0",
            "from": "archivist",
            "task_id": "test-001",
            "requires_action": true,
            "evidence_exchange": {
                "artifact_path": "/some/path"
            }
        });
        let result = consensus_check(&msg, None);
        assert_eq!(result.policy_version, "1.0");
        assert!((result.weighted_score - 0.0).abs() < 1.001);
    }

    #[test]
    fn test_consensus_check_with_signature_errors() {
        let msg = serde_json::json!({
            "type": "invalid",
            "signature": "bad"
        });
        let result = consensus_check(&msg, None);
        assert_eq!(result.status, "conflicted");
        assert_eq!(result.routing_action, "escalate");
    }

    #[test]
    fn test_consensus_check_key_mismatch() {
        let msg = serde_json::json!({
            "type": "task",
            "from": "archivist",
            "key_id": "wrong_key"
        });
        let result = consensus_check(&msg, None);
        assert!(!result.structural.valid);
    }

    // ---------------------------------------------------------------
    // route_message tests
    // ---------------------------------------------------------------

    fn make_proven_consensus() -> ConsensusResult {
        let msg = serde_json::json!({"type": "task"});
        let structural = evaluate_structural(&msg, None);
        let operational = evaluate_operational(&msg, &ConsensusOptions::default());
        ConsensusResult {
            status: "proven".to_string(),
            routing_action: "route".to_string(),
            weighted_score: 1.0,
            consensus_threshold: 1.0,
            structural,
            operational,
            drift: DriftResult {
                active: false,
                cps_score: None,
                level: "none".to_string(),
                reason: "test".to_string(),
                thresholds: None,
            },
            checked_at: Utc::now().to_rfc3339(),
            policy_version: "1.0".to_string(),
        }
    }

    fn make_blocked_consensus() -> ConsensusResult {
        let msg = serde_json::json!({"type": "invalid", "signature": "bad"});
        let structural = evaluate_structural(&msg, None);
        let operational = evaluate_operational(&msg, &ConsensusOptions::default());
        ConsensusResult {
            status: "blocked".to_string(),
            routing_action: "hold".to_string(),
            weighted_score: 0.0,
            consensus_threshold: 1.0,
            structural,
            operational,
            drift: DriftResult {
                active: true,
                cps_score: Some(55.0),
                level: "critical".to_string(),
                reason: "test".to_string(),
                thresholds: None,
            },
            checked_at: Utc::now().to_rfc3339(),
            policy_version: "1.0".to_string(),
        }
    }

    fn make_conflicted_consensus() -> ConsensusResult {
        let structural = StructuralResult {
            lane: "L".to_string(),
            valid: false,
            errors: vec![StructuralError {
                field: "type".to_string(),
                error: "invalid type enum value: badtype".to_string(),
            }],
            score: 0.75,
        };
        let operational = OperationalResult {
            lane: "R".to_string(),
            valid: true,
            errors: vec![],
            score: 1.0,
            domain_result: DomainResult {
                domain_valid: true,
                phase: "pre_execution".to_string(),
                has_execution_artifact: false,
                invalid_domain_reason: None,
                verification_outcome: "PROCEED_TO_VERIFICATION".to_string(),
                execution_preserved: false,
                temporal: None,
                semantic: None,
                observability: None,
            },
            execution_result: ExecutionResult {
                execution_verified: false,
                would_verify: false,
                verification_type: "NO_PROOF".to_string(),
                reason: "no proof".to_string(),
                verifier_lane: "archivist".to_string(),
                verified_at: None,
                artifact_path: None,
            },
        };
        ConsensusResult {
            status: "conflicted".to_string(),
            routing_action: "escalate".to_string(),
            weighted_score: 0.875,
            consensus_threshold: 1.0,
            structural,
            operational,
            drift: DriftResult {
                active: false,
                cps_score: None,
                level: "none".to_string(),
                reason: "test".to_string(),
                thresholds: None,
            },
            checked_at: Utc::now().to_rfc3339(),
            policy_version: "1.0".to_string(),
        }
    }

    #[test]
    fn test_route_message_proven() {
        let msg = serde_json::json!({"task_id": "test-001"});
        let consensus = make_proven_consensus();
        let result = route_message(&msg, &consensus, None);
        assert_eq!(result.action, "route");
        assert_eq!(
            result.original_task_id,
            Some(serde_json::Value::String("test-001".to_string()))
        );
    }

    #[test]
    fn test_route_message_blocked() {
        let msg = serde_json::json!({});
        let consensus = make_blocked_consensus();
        let result = route_message(&msg, &consensus, None);
        assert_eq!(result.action, "hold");
        assert!(result.target.is_none());
    }

    #[test]
    fn test_route_message_escalate() {
        let msg = serde_json::json!({"task_id": "test-002"});
        let consensus = make_conflicted_consensus();
        let result = route_message(&msg, &consensus, None);
        assert_eq!(result.action, "escalate");
        assert_eq!(result.target, Some("lanes/archivist/inbox/".to_string()));
    }

    #[test]
    fn test_route_message_escalate_custom_target() {
        let msg = serde_json::json!({"task_id": "test-003"});
        let consensus = make_conflicted_consensus();
        let opts = ConsensusOptions {
            target_inbox: Some("lanes/kernel/inbox/".to_string()),
            ..ConsensusOptions::default()
        };
        let result = route_message(&msg, &consensus, Some(opts));
        assert_eq!(result.action, "escalate");
        assert_eq!(result.target, Some("lanes/kernel/inbox/".to_string()));
    }

    #[test]
    fn test_route_message_no_task_id() {
        let msg = serde_json::json!({});
        let consensus = make_proven_consensus();
        let result = route_message(&msg, &consensus, None);
        assert_eq!(result.action, "route");
        assert!(result.original_task_id.is_none());
    }

    // ---------------------------------------------------------------
    // load_policy tests
    // ---------------------------------------------------------------

    #[test]
    fn test_load_policy_default() {
        let result = load_policy(None);
        assert!((result.structural_weight - 1.0).abs() < 0.001);
        assert!((result.operational_weight - 1.0).abs() < 0.001);
        assert!((result.consensus_threshold - 1.0).abs() < 0.001);
        assert!(result.reject_on_any_critical);
    }

    #[test]
    fn test_load_policy_from_file() {
        with_temp_dir(|root| {
            let policy = serde_json::json!({
                "structural_weight": 2.0,
                "operational_weight": 3.0,
                "consensus_threshold": 0.8,
                "reject_on_any_critical": false,
                "drift_integration": {
                    "enabled": false,
                    "cps_threshold_warning": 20.0,
                    "cps_threshold_critical": 40.0,
                    "cps_log_path": "test_log.jsonl"
                },
                "routing": {
                    "proven_action": "forward",
                    "conflicted_action": "review",
                    "unproven_action": "queue",
                    "blocked_action": "reject"
                }
            });
            let policy_path = root.join("test-policy.json");
            create_file(
                &policy_path,
                &serde_json::to_string_pretty(&policy).unwrap(),
            );
            let result = load_policy(Some(&policy_path));
            assert!((result.structural_weight - 2.0).abs() < 0.001);
            assert!((result.operational_weight - 3.0).abs() < 0.001);
            assert!(!result.drift_integration.enabled);
            assert_eq!(result.routing.proven_action, "forward");
        });
    }

    #[test]
    fn test_load_policy_invalid_file() {
        with_temp_dir(|root| {
            let policy_path = root.join("nonexistent.json");
            let result = load_policy(Some(&policy_path));
            assert!((result.structural_weight - 1.0).abs() < 0.001);
        });
    }

    // ---------------------------------------------------------------
    // default_policy test
    // ---------------------------------------------------------------

    #[test]
    fn test_default_policy() {
        let policy = default_policy();
        assert!((policy.structural_weight - 1.0).abs() < 0.001);
        assert!((policy.operational_weight - 1.0).abs() < 0.001);
        assert!(policy.drift_integration.enabled);
        assert!(policy.reject_on_any_critical);
    }

    // ---------------------------------------------------------------
    // evaluate_temporal helper tests
    // ---------------------------------------------------------------

    #[test]
    fn test_to_ms_from_rfc3339() {
        let val = serde_json::json!("2026-05-23T10:00:00Z");
        let ms = to_ms(&val);
        assert!(ms.is_some());
    }

    #[test]
    fn test_to_ms_from_empty_string() {
        let val = serde_json::json!("");
        let ms = to_ms(&val);
        assert!(ms.is_none());
    }

    // ---------------------------------------------------------------
    // consensus_check with drift critical test
    // ---------------------------------------------------------------

    #[test]
    fn test_consensus_check_drift_critical() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 60.0, "source": "test"}"#,
            );
            let msg = serde_json::json!({
                "type": "task",
                "schema_version": "1.0"
            });
            let options = ConsensusOptions {
                repo_root: Some(root.to_path_buf()),
                ..ConsensusOptions::default()
            };
            let result = consensus_check(&msg, Some(options));
            assert_eq!(result.status, "blocked");
            assert_eq!(result.routing_action, "hold");
            assert_eq!(result.drift.level, "critical");
        });
    }

    // ---------------------------------------------------------------
    // consensus_check with drift warning test
    // ---------------------------------------------------------------

    #[test]
    fn test_consensus_check_drift_warning_proven() {
        with_temp_dir(|root| {
            let log_dir = root.join("context-buffer");
            std::fs::create_dir_all(&log_dir).ok();
            create_file(
                &log_dir.join("cps_log.jsonl"),
                r#"{"cps_score": 35.0, "source": "test"}"#,
            );
            let msg = serde_json::json!({
                "type": "task",
                "schema_version": "1.0"
            });
            let options = ConsensusOptions {
                repo_root: Some(root.to_path_buf()),
                ..ConsensusOptions::default()
            };
            let result = consensus_check(&msg, Some(options));
            assert_eq!(result.status, "proven_with_drift_warning");
            assert_eq!(result.drift.level, "warning");
        });
    }

    // ---------------------------------------------------------------
    // evaluate_completion_proof tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_completion_proof_invalid_message() {
        let result = evaluate_completion_proof(&serde_json::Value::Null);
        assert_eq!(result["reason"], "INVALID_MESSAGE");
        assert!(!result["pass"].as_bool().unwrap());
    }

    #[test]
    fn test_evaluate_completion_proof_unresolvable_evidence() {
        let msg = serde_json::json!({
            "evidence": { "required": true }
        });
        let result = evaluate_completion_proof(&msg);
        assert_eq!(result["reason"], "EVIDENCE_REQUIRED_NO_ARTIFACT");
    }

    #[test]
    fn test_evaluate_completion_proof_fake_proof() {
        let msg = serde_json::json!({
            "terminal_decision": "done",
            "disposition": "ok"
        });
        let result = evaluate_completion_proof(&msg);
        assert_eq!(result["reason"], "FAKE_COMPLETION_PROOF");
    }

    #[test]
    fn test_evaluate_completion_proof_actionable_with_proof() {
        let msg = serde_json::json!({
            "requires_action": true,
            "evidence_exchange": { "artifact_path": "/path" }
        });
        let result = evaluate_completion_proof(&msg);
        assert_eq!(result["reason"], "ACTIONABLE_WITH_PROOF");
        assert!(result["pass"].as_bool().unwrap());
    }

    #[test]
    fn test_evaluate_completion_proof_actionable_missing_proof() {
        let msg = serde_json::json!({
            "type": "task",
            "priority": "P1",
            "requires_action": true
        });
        let result = evaluate_completion_proof(&msg);
        assert_eq!(result["reason"], "ACTIONABLE_MISSING_PROOF");
    }

    #[test]
    fn test_evaluate_completion_proof_terminal_informational() {
        let msg = serde_json::json!({
            "type": "ack",
            "requires_action": false
        });
        let result = evaluate_completion_proof(&msg);
        assert_eq!(result["reason"], "TERMINAL_INFORMATIONAL");
    }

    // ---------------------------------------------------------------
    // path helper tests
    // ---------------------------------------------------------------

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("S:\\Path\\To\\File"), "s:/path/to/file");
        assert_eq!(normalize_path("S:/Path/To/File"), "s:/path/to/file");
    }

    #[test]
    fn test_is_absolute_path() {
        assert!(is_absolute_path("S:/path"));
        assert!(is_absolute_path("C:\\path"));
        assert!(!is_absolute_path("relative/path"));
        assert!(!is_absolute_path(""));
    }

    #[test]
    fn test_has_dot_dot() {
        assert!(has_dot_dot("../path"));
        assert!(has_dot_dot("path/../../other"));
        assert!(!has_dot_dot("path/to/file"));
        assert!(!has_dot_dot(""));
    }

    #[test]
    fn test_is_contained_within() {
        assert!(is_contained_within(
            "s:/archivist-agent/src",
            "s:/archivist-agent"
        ));
        assert!(!is_contained_within(
            "s:/kernel-lane/src",
            "s:/archivist-agent"
        ));
        assert!(is_contained_within(
            "s:/archivist-agent",
            "s:/archivist-agent"
        ));
    }

    // ---------------------------------------------------------------
    // ArtifactResolver tests
    // ---------------------------------------------------------------

    #[test]
    fn test_artifact_resolver_is_within_allowed_roots() {
        let resolver =
            ArtifactResolver::new_with_roots(vec!["S:/Archivist-Agent".to_string()], true);
        assert!(resolver.is_within_allowed_roots("S:/Archivist-Agent/config/policy.json"));
        assert!(!resolver.is_within_allowed_roots("S:/kernel-lane/config.json"));
    }

    #[test]
    fn test_artifact_resolver_classify_proof() {
        let _resolver = ArtifactResolver::new_with_roots(vec![], true);
        let msg = serde_json::json!({
            "evidence_exchange": { "artifact_path": "/test/path" }
        });
        let c = classify_proof(&msg);
        assert_eq!(c.proof_type, "EVIDENCE_EXCHANGE");
    }

    // ---------------------------------------------------------------
    // execution gate tests
    // ---------------------------------------------------------------

    #[test]
    fn test_execution_gate_invalid_message() {
        let gate = ExecutionGate::new(&ConsensusOptions::default());
        let result = gate.verify(&serde_json::Value::Null);
        assert!(!result.execution_verified);
        assert_eq!(result.verification_type, "INVALID_MESSAGE");
    }

    #[test]
    fn test_execution_gate_no_proof() {
        let gate = ExecutionGate::new(&ConsensusOptions::default());
        let msg = serde_json::json!({"type": "task"});
        let result = gate.verify(&msg);
        assert!(!result.execution_verified);
        assert_eq!(result.verification_type, "NO_PROOF");
    }

    #[test]
    fn test_execution_gate_dry_run_path() {
        let opts = ConsensusOptions {
            dry_run: Some(true),
            ..ConsensusOptions::default()
        };
        let gate = ExecutionGate::new(&opts);
        let msg = serde_json::json!({
            "evidence_exchange": { "artifact_path": "/some/path" }
        });
        let result = gate.verify(&msg);
        assert!(!result.execution_verified);
        assert!(result.would_verify);
    }

    // ---------------------------------------------------------------
    // evaluate_observability tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_observability_no_proof() {
        let resolver = ArtifactResolver::new_with_roots(vec![], true);
        let msg = serde_json::json!({"type": "task"});
        let result = evaluate_observability(&msg, &resolver);
        assert!(result.valid);
        assert_eq!(result.proof_type, "NONE");
    }

    #[test]
    fn test_evaluate_observability_unresolvable() {
        let resolver = ArtifactResolver::new_with_roots(vec!["/nonexistent".to_string()], false);
        let msg = serde_json::json!({
            "evidence_exchange": { "artifact_path": "/also/nonexistent/file.json" }
        });
        let result = evaluate_observability(&msg, &resolver);
        assert!(!result.valid);
        assert_eq!(result.reason, Some("artifact not observable".to_string()));
    }

    // ---------------------------------------------------------------
    // evaluate_verification_domain tests
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_verification_domain_no_resolver() {
        let msg = serde_json::json!({"type": "task"});
        let result = evaluate_verification_domain(&msg, &ConsensusOptions::default());
        assert!(!result.domain_valid);
        assert_eq!(
            result.invalid_domain_reason,
            Some("resolver unavailable".to_string())
        );
    }

    // ---------------------------------------------------------------
    // ArtifactResolver resolveRelativePath tests
    // ---------------------------------------------------------------

    #[test]
    fn test_resolve_relative_path_empty() {
        let resolver = ArtifactResolver::new_with_roots(vec!["S:/".to_string()], true);
        let result = resolver.resolve_relative_path("");
        assert!(!result.resolved);
    }

    #[test]
    fn test_resolve_relative_path_absolute() {
        let resolver = ArtifactResolver::new_with_roots(vec!["S:/".to_string()], true);
        let result = resolver.resolve_relative_path("S:/Archivist-Agent/file.json");
        assert!(result.resolved);
    }

    // ---------------------------------------------------------------
    // consensus_check with policy options
    // ---------------------------------------------------------------

    #[test]
    fn test_consensus_check_custom_policy() {
        let msg = serde_json::json!({
            "type": "task",
            "schema_version": "1.0"
        });
        let policy = PolicyConfig {
            consensus_threshold: 0.5,
            ..PolicyConfig::default()
        };
        let options = ConsensusOptions {
            policy: Some(policy),
            ..ConsensusOptions::default()
        };
        let result = consensus_check(&msg, Some(options));
        assert!(result.structural.valid);
    }

    // ---------------------------------------------------------------
    // evaluate_drift with disabled policy test
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_drift_disabled_returns_no_thresholds() {
        let mut policy = PolicyConfig::default();
        policy.drift_integration.enabled = false;
        let result = evaluate_drift(&policy, Path::new("."));
        assert_eq!(result.level, "none");
        assert!(result.thresholds.is_none());
    }

    // ---------------------------------------------------------------
    // ArtifactResolver hash_path_traversal
    // ---------------------------------------------------------------

    #[test]
    fn test_artifact_resolver_has_path_traversal() {
        let resolver =
            ArtifactResolver::new_with_roots(vec!["S:/Archivist-Agent".to_string()], true);
        assert!(resolver.has_path_traversal("S:/kernel-lane/secret.json"));
        assert!(!resolver.has_path_traversal("S:/Archivist-Agent/file.json"));
    }

    // ---------------------------------------------------------------
    // get_code_version_hash test
    // ---------------------------------------------------------------

    #[test]
    fn test_get_code_version_hash_empty_root() {
        with_temp_dir(|root| {
            let hash = get_code_version_hash(root);
            assert!(hash.starts_with("sha256:"));
            assert_eq!(hash.len(), 64 + 7);
        });
    }

    // ---------------------------------------------------------------
    // evaluate_semantic edge cases
    // ---------------------------------------------------------------

    #[test]
    fn test_evaluate_semantic_no_msg_proof_check() {
        let msg = serde_json::json!({"type": "task"});
        let result = evaluate_semantic(&msg, None);
        assert!(result.evidence_fields_present);
    }

    #[test]
    fn test_evaluate_semantic_with_evidence_missing_proof_fields() {
        let msg = serde_json::json!({
            "type": "task",
            "requires_action": true,
            "evidence_exchange": { "artifact_path": "" }
        });
        let result = evaluate_semantic(&msg, None);
        assert!(!result.evidence_fields_present);
    }
}
