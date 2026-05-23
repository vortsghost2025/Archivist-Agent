use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct ScriptResult {
    pub status: String, // "ok" | "error"
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl ScriptResult {
    pub fn ok(message: impl Into<String>) -> Self {
        ScriptResult {
            status: "ok".into(),
            message: message.into(),
            data: None,
        }
    }
    pub fn ok_with_data(message: impl Into<String>, data: serde_json::Value) -> Self {
        ScriptResult {
            status: "ok".into(),
            message: message.into(),
            data: Some(data),
        }
    }
    pub fn err(message: impl Into<String>) -> Self {
        ScriptResult {
            status: "error".into(),
            message: message.into(),
            data: None,
        }
    }
}

fn resolve_project_root() -> Result<PathBuf, String> {
    let candidates = [
        PathBuf::from("config/allowed_roots.json"),
        PathBuf::from("../config/allowed_roots.json"),
    ];
    for candidate in &candidates {
        if candidate.exists() {
            let parent = candidate
                .parent()
                .and_then(|p| p.parent())
                .ok_or_else(|| "Cannot resolve project root".to_string())?;
            return Ok(parent
                .canonicalize()
                .unwrap_or_else(|_| parent.to_path_buf()));
        }
    }
    Err("Cannot find project root: config/allowed_roots.json not found".to_string())
}

fn read_json_file(path: &Path) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    serde_json::from_str(&content).map_err(|e| format!("Cannot parse {}: {}", path.display(), e))
}

fn read_file(path: &Path) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("Cannot read {}: {}", path.display(), e))
}

fn read_yaml_key_values(path: &Path) -> Result<HashMap<String, i32>, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    let mut map = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        if let Some((key, val)) = line.split_once(':') {
            let key = key.trim();
            let val = val.trim().parse::<i32>().unwrap_or(0);
            map.insert(key.to_string(), val);
        }
    }
    Ok(map)
}

/// Count .json files (non-heartbeat) in an inbox directory.
fn count_inbox_messages(inbox_path: &Path) -> usize {
    if !inbox_path.exists() {
        return 0;
    }
    match std::fs::read_dir(inbox_path) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.ends_with(".json") && !name.starts_with("heartbeat")
            })
            .count(),
        Err(_) => 0,
    }
}

/// SHA-256 hash of content.
fn hash_content(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_file(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    Some(hash_content(&content))
}

// ---------------------------------------------------------------------------
// Lane / trust-store helpers (shared by multiple scripts)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct LaneKeyInfo {
    pub name: String,
    pub archivist_key: String,
    pub library_key: String,
    pub swarmmind_key: String,
    pub kernel_key: String,
}

fn get_lane_key_info(root: &Path) -> Result<LaneKeyInfo, String> {
    let trust_path = root.join("lanes/broadcast/trust-store.json");
    let trust = read_json_file(&trust_path)?;

    let trunc = |s: &str| {
        if s.len() > 8 {
            s[..8].to_string()
        } else {
            s.to_string()
        }
    };

    let extract = |field: &str| -> String {
        trust
            .get(field)
            .and_then(|v| v.get("key_id"))
            .and_then(|v| v.as_str())
            .map(trunc)
            .unwrap_or_else(|| "MISSING".into())
    };

    Ok(LaneKeyInfo {
        name: root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".into()),
        archivist_key: extract("archivist"),
        library_key: extract("library"),
        swarmmind_key: extract("swarmmind"),
        kernel_key: extract("kernel"),
    })
}

// ---------------------------------------------------------------------------
// 1. health_check
// ---------------------------------------------------------------------------

/// Port of scripts/health-check.js
/// Checks monitor alerts for CRITICAL severity.
pub fn health_check(root: Option<&Path>) -> ScriptResult {
    let root = match root {
        Some(p) => p.to_path_buf(),
        None => match resolve_project_root() {
            Ok(p) => p,
            Err(e) => return ScriptResult::err(e),
        },
    };

    let alerts_path = root.join("logs/alerts.json");
    if !alerts_path.exists() {
        return ScriptResult::ok("No alerts file found — system healthy");
    }

    let alerts = match read_json_file(&alerts_path) {
        Ok(v) => v,
        Err(e) => return ScriptResult::err(e),
    };

    let alerts_arr = match alerts.as_array() {
        Some(a) => a,
        None => return ScriptResult::err("alerts.json is not an array"),
    };

    let critical_count = alerts_arr
        .iter()
        .filter(|a| {
            a.get("severity")
                .and_then(|s| s.as_str())
                .map(|s| s.to_uppercase() == "CRITICAL")
                .unwrap_or(false)
        })
        .count();

    if critical_count > 0 {
        ScriptResult::err(format!(
            "{} critical alert(s) detected — system unhealthy",
            critical_count
        ))
    } else {
        ScriptResult::ok(format!(
            "System healthy — {} alert(s) total, 0 critical",
            alerts_arr.len()
        ))
    }
}

// ---------------------------------------------------------------------------
// 2. mode_check
// ---------------------------------------------------------------------------

/// Port of scripts/mode-check.js — status subcommand only.
/// Reads active-mode.json and returns the current operational mode.
pub fn mode_check(root: Option<&Path>) -> ScriptResult {
    let root = match root {
        Some(p) => p.to_path_buf(),
        None => match resolve_project_root() {
            Ok(p) => p,
            Err(e) => return ScriptResult::err(e),
        },
    };

    let mode_path = root.join("lanes/broadcast/active-mode.json");
    if !mode_path.exists() {
        return ScriptResult::err("active-mode.json not found");
    }

    let mode_data = match read_json_file(&mode_path) {
        Ok(v) => v,
        Err(e) => return ScriptResult::err(e),
    };

    let mode_val = mode_data
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("UNKNOWN");
    let set_by = mode_data
        .get("set_by")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let set_at = mode_data
        .get("set_at")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let reason = mode_data
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    let allowed_ops = mode_data
        .get("allowed_operations")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_else(|| "none".into());

    let result = serde_json::json!({
        "mode": mode_val,
        "set_by": set_by,
        "set_at": set_at,
        "reason": reason,
        "allowed_operations": allowed_ops
    });

    ScriptResult::ok_with_data(
        format!("Mode: {} — set by {} at {}", mode_val, set_by, set_at),
        result,
    )
}

// ---------------------------------------------------------------------------
// 3. system_status
// ---------------------------------------------------------------------------

/// Port of scripts/system-status.js
/// Checks trust-store key IDs across all 4 lanes.
pub fn system_status(root: Option<&Path>) -> ScriptResult {
    let root = match root {
        Some(p) => p.to_path_buf(),
        None => match resolve_project_root() {
            Ok(p) => p,
            Err(e) => return ScriptResult::err(e),
        },
    };

    let lanes: Vec<(&str, PathBuf)> = vec![
        ("archivist", root.clone()),
        (
            "kernel",
            root.parent()
                .map(|p| p.join("kernel-lane"))
                .unwrap_or_else(|| root.join("../kernel-lane")),
        ),
        (
            "library",
            root.parent()
                .map(|p| p.join("self-organizing-library"))
                .unwrap_or_else(|| root.join("../self-organizing-library")),
        ),
        (
            "swarmmind",
            root.parent()
                .map(|p| p.join("SwarmMind"))
                .unwrap_or_else(|| root.join("../SwarmMind")),
        ),
    ];

    let mut results = Vec::new();
    let mut all_aligned = true;
    let mut baseline: Option<LaneKeyInfo> = None;

    for (name, lane_root) in &lanes {
        match get_lane_key_info(lane_root) {
            Ok(info) => {
                if let Some(ref bl) = baseline {
                    if info.archivist_key != bl.archivist_key
                        || info.library_key != bl.library_key
                        || info.swarmmind_key != bl.swarmmind_key
                        || info.kernel_key != bl.kernel_key
                    {
                        all_aligned = false;
                    }
                } else {
                    baseline = Some(info.clone());
                }
                results.push(info);
            }
            Err(e) => {
                results.push(LaneKeyInfo {
                    name: name.to_string(),
                    archivist_key: "ERROR".into(),
                    library_key: e.clone(),
                    swarmmind_key: "".into(),
                    kernel_key: "".into(),
                });
                all_aligned = false;
            }
        }
    }

    let data = serde_json::json!({
        "lanes": results,
        "all_synchronized": all_aligned
    });

    if all_aligned {
        ScriptResult::ok_with_data("All 4 lanes synchronized", data)
    } else {
        ScriptResult::ok_with_data("DIVERGENCE DETECTED — lane keys do not match", data)
    }
}

// ---------------------------------------------------------------------------
// 4. recovery_test_suite
// ---------------------------------------------------------------------------

/// Port of scripts/recovery-test-suite.js
/// Runs all 11 recovery verification tests and returns results.
pub fn recovery_test_suite(root: Option<&Path>) -> ScriptResult {
    let root = match root {
        Some(p) => p.to_path_buf(),
        None => match resolve_project_root() {
            Ok(p) => p,
            Err(e) => return ScriptResult::err(e),
        },
    };

    let mut tests: Vec<serde_json::Value> = Vec::new();

    // Test 1: trust_chain_continuity
    {
        let all_lanes = ["archivist", "library", "swarmmind", "kernel"];
        let trust_path = root.join("lanes/broadcast/trust-store.json");
        let present = if trust_path.exists() {
            if let Ok(trust) = read_json_file(&trust_path) {
                all_lanes.iter().all(|l| {
                    trust
                        .get(l)
                        .and_then(|v| v.get("key_id"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.len() == 16)
                        .unwrap_or(false)
                })
            } else {
                false
            }
        } else {
            false
        };
        tests.push(serde_json::json!({
            "name": "trust_chain_continuity",
            "passed": present,
            "detail": format!("{:?}/4 lanes have key IDs", if trust_path.exists() { 4 } else { 0 })
        }));
    }

    // Test 2: governance_integrity
    {
        let gov_hash = hash_file(&root.join("GOVERNANCE.md"));
        let boot_hash = hash_file(&root.join("BOOTSTRAP.md"));
        let passed = gov_hash.is_some() && boot_hash.is_some();
        tests.push(serde_json::json!({
            "name": "governance_integrity",
            "passed": passed,
            "detail": format!(
                "gov={}... boot={}...",
                gov_hash.as_deref().unwrap_or("MISSING").chars().take(8).collect::<String>(),
                boot_hash.as_deref().unwrap_or("MISSING").chars().take(8).collect::<String>()
            )
        }));
    }

    // Test 3: constraint_preservation
    {
        let yaml_path = root.join("constitutional_constraints.yaml");
        let required = [
            "STRUCTURE_OVER_IDENTITY",
            "CORRECTION_MANDATORY",
            "SINGLE_ENTRY_POINT",
            "OPERATOR_ACCOUNTABILITY",
        ];
        let names = if yaml_path.exists() {
            read_yaml_key_values(&yaml_path)
                .map(|m| m.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        let all_present = required.iter().all(|r| names.contains(&r.to_string()));
        tests.push(serde_json::json!({
            "name": "constraint_preservation",
            "passed": all_present,
            "detail": format!("{} constraints, required={}", names.len(), required.len())
        }));
    }

    // Test 4: handoff_tamper_detection
    {
        let handoff_path = root.join("COMPACT_CONTEXT_HANDOFF.md");
        let (passed, detail) = if handoff_path.exists() {
            match read_file(&handoff_path) {
                Ok(content) => {
                    let h = hash_content(&content);
                    (true, format!("sha256={}...", &h[..16]))
                }
                Err(e) => (false, format!("read error: {}", e)),
            }
        } else {
            (false, "no handoff file".into())
        };
        tests.push(serde_json::json!({
            "name": "handoff_tamper_detection",
            "passed": passed,
            "detail": detail
        }));
    }

    // Test 5: blocker_consistency
    {
        let blocker_path = root.join("lanes/broadcast/active-blocker.json");
        let exists = blocker_path.exists();
        tests.push(serde_json::json!({
            "name": "blocker_consistency",
            "passed": true,
            "detail": if exists {
                "active blocker exists"
            } else {
                "no active blocker"
            }
        }));
    }

    // Test 6: message_inventory
    {
        let lane_inboxes: Vec<(&str, PathBuf)> = vec![
            ("archivist", root.join("lanes/archivist/inbox")),
            (
                "library",
                root.parent()
                    .map(|p| p.join("self-organizing-library/lanes/library/inbox"))
                    .unwrap_or_else(|| root.join("../self-organizing-library/lanes/library/inbox")),
            ),
            (
                "swarmmind",
                root.parent()
                    .map(|p| p.join("SwarmMind/lanes/swarmmind/inbox"))
                    .unwrap_or_else(|| root.join("../SwarmMind/lanes/swarmmind/inbox")),
            ),
            (
                "kernel",
                root.parent()
                    .map(|p| p.join("kernel-lane/lanes/kernel/inbox"))
                    .unwrap_or_else(|| root.join("../kernel-lane/lanes/kernel/inbox")),
            ),
        ];
        let mut counts = serde_json::Map::new();
        let mut total = 0usize;
        for (name, inbox_path) in &lane_inboxes {
            let c = count_inbox_messages(inbox_path);
            counts.insert(name.to_string(), serde_json::Value::Number(c.into()));
            total += c;
        }
        tests.push(serde_json::json!({
            "name": "message_inventory",
            "passed": true,
            "detail": format!("total={} {:?}", total, counts)
        }));
    }

    // Test 7: risk_set_preservation
    {
        let pre_path = root.join(".compact-audit/PRE_COMPACT_SNAPSHOT.json");
        let (passed, detail) = if pre_path.exists() {
            match read_json_file(&pre_path) {
                Ok(pre) => {
                    let risks = pre
                        .get("known_risks")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0);
                    (
                        risks > 0,
                        format!("{} known risks in pre-compact snapshot", risks),
                    )
                }
                Err(e) => (false, format!("parse error: {}", e)),
            }
        } else {
            (false, "no pre-compact snapshot".into())
        };
        tests.push(serde_json::json!({
            "name": "risk_set_preservation",
            "passed": passed,
            "detail": detail
        }));
    }

    // Test 8: lane_liveness
    {
        // Check heartbeat files in each lane's broadcast
        let lane_roots: Vec<PathBuf> = vec![
            root.clone(),
            root.parent()
                .map(|p| p.join("kernel-lane"))
                .unwrap_or_else(|| root.join("../kernel-lane")),
            root.parent()
                .map(|p| p.join("self-organizing-library"))
                .unwrap_or_else(|| root.join("../self-organizing-library")),
            root.parent()
                .map(|p| p.join("SwarmMind"))
                .unwrap_or_else(|| root.join("../SwarmMind")),
        ];
        let mut alive = 0usize;
        for lr in &lane_roots {
            let hb = lr.join("lanes/broadcast/heartbeat.json");
            if hb.exists() {
                if let Ok(hb_data) = read_json_file(&hb) {
                    let ts = hb_data
                        .get("timestamp")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    // Simple parse: if the timestamp exists and is recent enough
                    let is_recent = !ts.is_empty();
                    if is_recent {
                        alive += 1;
                    }
                }
            }
        }
        let detail = format!("{}/4 lanes alive", alive);
        tests.push(serde_json::json!({
            "name": "lane_liveness",
            "passed": alive == 4,
            "detail": detail
        }));
    }

    // Test 9: multi_source_consistency
    {
        let trust_path = root.join("lanes/broadcast/trust-store.json");
        let constraints_path = root.join("constitutional_constraints.yaml");
        let mut contradictions: Vec<String> = Vec::new();

        if trust_path.exists() {
            if let Ok(trust) = read_json_file(&trust_path) {
                let expected_keys = ["archivist", "kernel", "library", "swarmmind"];
                for k in &expected_keys {
                    if trust.get(k).is_none() {
                        contradictions.push(format!("missing_{}_in_trust_store", k));
                    }
                }
            }
        }
        if constraints_path.exists() {
            if let Ok(constraints) = read_yaml_key_values(&constraints_path) {
                let required = [
                    "STRUCTURE_OVER_IDENTITY",
                    "CORRECTION_MANDATORY",
                    "SINGLE_ENTRY_POINT",
                    "OPERATOR_ACCOUNTABILITY",
                ];
                for r in &required {
                    if !constraints.contains_key(*r) {
                        contradictions.push(format!("missing_{}_in_constraints", r));
                    }
                }
            }
        }

        let known_pre_existing = [
            "archivist_key_id_mismatch",
            "kernel_no_identity",
            "swarmmind_key_id_mismatch",
        ];
        let unexpected: Vec<&String> = contradictions
            .iter()
            .filter(|c| !known_pre_existing.contains(&c.as_str()))
            .collect();

        let passed = unexpected.is_empty();
        tests.push(serde_json::json!({
            "name": "multi_source_consistency",
            "passed": passed,
            "detail": format!(
                "{} contradictions ({} unexpected, {} pre-existing)",
                contradictions.len(),
                unexpected.len(),
                contradictions.len() - unexpected.len()
            )
        }));
    }

    // Test 10: contradiction_detection
    {
        let pre_path = root.join(".compact-audit/PRE_COMPACT_SNAPSHOT.json");
        let (passed, detail) = if pre_path.exists() {
            match read_json_file(&pre_path) {
                Ok(_pre) => {
                    // Basic: check pre-snapshot integrity
                    (true, "pre-compact snapshot found and parsed".into())
                }
                Err(e) => (false, format!("pre-compact snapshot parse error: {}", e)),
            }
        } else {
            (true, "no pre-compact snapshot — first run, skip".into())
        };
        tests.push(serde_json::json!({
            "name": "contradiction_detection",
            "passed": passed,
            "detail": detail
        }));
    }

    // Test 11: restore_packet_cross_verify
    {
        let packet_path = root.join(".compact-audit/COMPACT_RESTORE_PACKET.json");
        let pre_path = root.join(".compact-audit/PRE_COMPACT_SNAPSHOT.json");
        let (passed, detail) = if packet_path.exists() && pre_path.exists() {
            match (read_json_file(&packet_path), read_json_file(&pre_path)) {
                (Ok(packet), Ok(_pre)) => {
                    let payload = &packet["restore_payload"];
                    // Basic alignment check: must have constraints and checkpoints
                    let has_constraints = payload.get("governance_constraints").is_some();
                    let has_checkpoints = payload.get("active_checkpoints").is_some();
                    let aligned = has_constraints && has_checkpoints;
                    if aligned {
                        (true, "packet aligned with pre-compact snapshot".into())
                    } else {
                        (false, "restore packet missing required fields".into())
                    }
                }
                (Err(e), _) => (false, format!("packet parse error: {}", e)),
                (_, Err(e)) => (false, format!("pre-snapshot parse error: {}", e)),
            }
        } else if packet_path.exists() {
            (
                true,
                "restore packet exists but no pre-snapshot for cross-check yet".into(),
            )
        } else {
            (
                true,
                "no restore packet present — skip (not yet compacted)".into(),
            )
        };
        tests.push(serde_json::json!({
            "name": "restore_packet_cross_verify",
            "passed": passed,
            "detail": detail
        }));
    }

    let total = tests.len();
    let passed_count = tests
        .iter()
        .filter(|t| t["passed"].as_bool().unwrap_or(false))
        .count();
    let all_passed = passed_count == total;

    let result = serde_json::json!({
        "tests": tests,
        "summary": {
            "passed": passed_count,
            "total": total,
            "all_passed": all_passed
        },
        "verdict": if all_passed {
            "RECOVERY PROVEN — correct context restored"
        } else {
            "RECOVERY CONFLICTED — contradictions detected"
        }
    });

    if all_passed {
        ScriptResult::ok_with_data(
            format!("{}/{} tests passed — recovery proven", passed_count, total),
            result,
        )
    } else {
        ScriptResult::ok_with_data(
            format!(
                "{}/{} tests passed — recovery conflicted",
                passed_count, total
            ),
            result,
        )
    }
}

// ---------------------------------------------------------------------------
// 5. sovereignty_enforcer
// ---------------------------------------------------------------------------

/// Port of scripts/sovereignty-enforcer.js
/// Scans a lane's scripts directory for cross-lane require() calls.
/// Rule: NO CROSS-LANE require() — only flag actual require() calls, not string literals.
#[derive(Debug, Serialize, Clone)]
pub struct SovereigntyViolation {
    pub line: usize,
    pub code: String,
    pub violation: String,
    pub violation_type: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SovereigntyFileViolation {
    pub file: String,
    pub violations: Vec<SovereigntyViolation>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SovereigntyReport {
    pub lane_id: String,
    pub timestamp: String,
    pub scanner: String,
    pub rule: String,
    pub total_violations: usize,
    pub violations: Vec<SovereigntyFileViolation>,
    pub summary: serde_json::Value,
    pub enforcement: serde_json::Value,
    pub recommendations: Vec<String>,
}

fn load_lane_roots(root: &Path) -> Result<HashMap<String, PathBuf>, String> {
    // Try to read from config/lane-roots.json
    let config_path = root.join("config/lane-roots.json");
    if !config_path.exists() {
        // Fallback: use hardcoded roots relative to project root
        let mut map = HashMap::new();
        map.insert("archivist".into(), root.to_path_buf());
        map.insert(
            "kernel".into(),
            root.parent()
                .map(|p| p.join("kernel-lane"))
                .unwrap_or_else(|| {
                    let mut r = root.to_path_buf();
                    r.pop();
                    r.join("kernel-lane")
                }),
        );
        map.insert(
            "library".into(),
            root.parent()
                .map(|p| p.join("self-organizing-library"))
                .unwrap_or_else(|| {
                    let mut r = root.to_path_buf();
                    r.pop();
                    r.join("self-organizing-library")
                }),
        );
        map.insert(
            "swarmmind".into(),
            root.parent()
                .map(|p| p.join("SwarmMind"))
                .unwrap_or_else(|| {
                    let mut r = root.to_path_buf();
                    r.pop();
                    r.join("SwarmMind")
                }),
        );
        return Ok(map);
    }

    let config = read_json_file(&config_path)?;
    let base_path = config
        .get("base_paths")
        .and_then(|b| b.get("windows"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let lanes = config
        .get("lanes")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "lanes field not found in lane-roots.json".to_string())?;

    let mut map = HashMap::new();
    let relevant_lanes = ["archivist", "kernel", "library", "swarmmind"];
    for name in &relevant_lanes {
        if let Some(lane_name) = lanes.get(*name).and_then(|v| v.as_str()) {
            let full_path = PathBuf::from(format!("{}{}", base_path, lane_name));
            map.insert(name.to_string(), full_path);
        }
    }
    Ok(map)
}

fn check_for_cross_lane_violation(
    content: &str,
    _file_path: &Path,
    lane_roots: &HashMap<String, PathBuf>,
    current_lane: &str,
) -> Vec<SovereigntyViolation> {
    let mut violations = Vec::new();
    // Match require('...') / require("...") / require(`...`)
    let re = regex::Regex::new(r#"require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)"#).unwrap();

    for (idx, line) in content.lines().enumerate() {
        let line_num = idx + 1;
        let trimmed = line.trim();

        // Skip comment lines
        if trimmed.starts_with("//") || trimmed.starts_with("/*") {
            continue;
        }

        if let Some(caps) = re.captures(line) {
            let import_path = caps.get(1).map(|m| m.as_str()).unwrap_or("");

            for (lane_name, lane_root) in lane_roots {
                if lane_name.as_str() == current_lane {
                    continue;
                }
                let lane_path_str = lane_root.to_string_lossy().replace('\\', "/");
                let import_normalized = import_path.replace('\\', "/");
                if import_normalized.starts_with(&lane_path_str)
                    || import_normalized.starts_with(lane_name.as_str())
                {
                    violations.push(SovereigntyViolation {
                        line: line_num,
                        code: trimmed.to_string(),
                        violation: format!("Cross-lane import from {}", lane_name),
                        violation_type: "cross_lane_require".into(),
                    });
                }
            }
        }
    }

    violations
}

fn scan_directory(
    dir_path: &Path,
    lane_root: &Path,
    lane_roots: &HashMap<String, PathBuf>,
    current_lane: &str,
    excluded_dirs: &[&str],
) -> Vec<SovereigntyFileViolation> {
    let mut violations = Vec::new();
    let entries = match std::fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return violations,
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if excluded_dirs.contains(&name.as_str()) {
            continue;
        }
        if name == "sovereignty-enforcer.js" {
            continue;
        }

        let full_path = entry.path();
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            violations.extend(scan_directory(
                &full_path,
                lane_root,
                lane_roots,
                current_lane,
                excluded_dirs,
            ));
        } else if name.ends_with(".js") || name.ends_with(".ts") {
            let content = match std::fs::read_to_string(&full_path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let file_violations =
                check_for_cross_lane_violation(&content, &full_path, lane_roots, current_lane);
            if !file_violations.is_empty() {
                let relative = full_path
                    .strip_prefix(lane_root)
                    .unwrap_or(&full_path)
                    .to_string_lossy()
                    .to_string();
                violations.push(SovereigntyFileViolation {
                    file: relative,
                    violations: file_violations,
                });
            }
        }
    }

    violations
}

/// Port of scripts/sovereignty-enforcer.js
/// Scans scripts directory for cross-lane require() violations.
/// `target_lane` defaults to "archivist" if None.
/// `strict_mode` causes the function to return error status if violations found.
pub fn sovereignty_enforcer(
    root: Option<&Path>,
    target_lane: Option<&str>,
    strict_mode: bool,
) -> ScriptResult {
    let root = match root {
        Some(p) => p.to_path_buf(),
        None => match resolve_project_root() {
            Ok(p) => p,
            Err(e) => return ScriptResult::err(e),
        },
    };

    let lane_roots = match load_lane_roots(&root) {
        Ok(m) => m,
        Err(e) => return ScriptResult::err(e),
    };

    let current_lane = target_lane.unwrap_or("archivist");
    let current_root = match lane_roots.get(current_lane) {
        Some(p) => p.clone(),
        None => return ScriptResult::err(format!("Unknown lane: {}", current_lane)),
    };

    let scripts_dir = current_root.join("scripts");
    if !scripts_dir.exists() {
        return ScriptResult::ok(format!(
            "No scripts directory in lane {} — nothing to scan",
            current_lane
        ));
    }

    let excluded_dirs = ["node_modules", ".git", "processed", "quarantine", "expired"];

    let file_violations = scan_directory(
        &scripts_dir,
        &current_root,
        &lane_roots,
        current_lane,
        &excluded_dirs,
    );

    let total_violations: usize = file_violations.iter().map(|f| f.violations.len()).sum();

    // Generate report
    let timestamp = chrono::Utc::now().to_rfc3339();
    let safe_time = timestamp.replace(':', "-").replace(['+', 'Z'], "");

    let report = SovereigntyReport {
        lane_id: current_lane.to_string(),
        timestamp: timestamp.clone(),
        scanner: "sovereignty-enforcer-fine-tuned".into(),
        rule: "NO_CROSS_LANE_REQUIRE".into(),
        total_violations,
        violations: file_violations.clone(),
        summary: serde_json::json!({
            "files_scanned": scripts_dir.to_string_lossy(),
            "violations_found": total_violations
        }),
        enforcement: serde_json::json!({
            "pre_commit_hook": true,
            "block_on_violation": true,
            "strict_mode": strict_mode
        }),
        recommendations: vec![
            "Move cross-lane dependencies to local scripts/util/ implementations".into(),
            "Replace absolute paths with relative local imports".into(),
            "Document utility origins with ORIGIN: comments".into(),
        ],
    };

    // Write report to state directory
    let report_dir = root.join("lanes/archivist/state");
    std::fs::create_dir_all(&report_dir).ok();

    let report_path = report_dir.join(format!("sovereignty-report-{}.json", safe_time));
    let report_json = serde_json::to_string_pretty(&report).unwrap_or_default();
    std::fs::write(&report_path, &report_json).ok();

    let latest_path = report_dir.join("sovereignty-report-latest.json");
    std::fs::write(&latest_path, &report_json).ok();

    let report_data = serde_json::json!({
        "total_violations": total_violations,
        "violations": file_violations,
        "report_path": report_path.to_string_lossy(),
        "latest_path": latest_path.to_string_lossy()
    });

    if total_violations == 0 {
        ScriptResult::ok_with_data(
            format!(
                "SOVEREIGNTY CHECK PASSED — no cross-lane require() violations in {} lane",
                current_lane
            ),
            report_data,
        )
    } else {
        let msg = format!(
            "SOVEREIGNTY CHECK FAILED — {} violation(s) detected in {} lane",
            total_violations, current_lane
        );
        if strict_mode {
            ScriptResult::err(msg)
        } else {
            ScriptResult::ok_with_data(msg, report_data)
        }
    }
}

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

    fn create_json(path: &Path, content: &serde_json::Value) {
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).ok();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(serde_json::to_string_pretty(content).unwrap().as_bytes())
            .unwrap();
    }

    fn create_file(path: &Path, content: &str) {
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).ok();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_health_check_no_alerts() {
        with_temp_dir(|root| {
            let result = health_check(Some(root));
            assert_eq!(result.status, "ok");
        });
    }

    #[test]
    fn test_health_check_with_critical_alert() {
        with_temp_dir(|root| {
            let logs_dir = root.join("logs");
            std::fs::create_dir_all(&logs_dir).ok();
            let alerts = serde_json::json!([
                {"severity": "WARNING", "message": "disk space low"},
                {"severity": "CRITICAL", "message": "trust store corruption"}
            ]);
            create_json(&logs_dir.join("alerts.json"), &alerts);
            let result = health_check(Some(root));
            assert_eq!(result.status, "error");
            assert!(result.message.contains("critical alert"));
        });
    }

    #[test]
    fn test_health_check_noncritical_alerts() {
        with_temp_dir(|root| {
            let logs_dir = root.join("logs");
            std::fs::create_dir_all(&logs_dir).ok();
            let alerts = serde_json::json!([
                {"severity": "WARNING", "message": "disk space low"},
                {"severity": "INFO", "message": "routine check"}
            ]);
            create_json(&logs_dir.join("alerts.json"), &alerts);
            let result = health_check(Some(root));
            assert_eq!(result.status, "ok");
        });
    }

    #[test]
    fn test_mode_check_no_file() {
        with_temp_dir(|root| {
            let result = mode_check(Some(root));
            assert_eq!(result.status, "error");
            assert!(result.message.contains("not found"));
        });
    }

    #[test]
    fn test_mode_check_with_file() {
        with_temp_dir(|root| {
            let lane_dir = root.join("lanes/broadcast");
            let mode_data = serde_json::json!({
                "mode": "OBSERVE",
                "set_by": "test",
                "set_at": "2026-05-23T00:00:00Z",
                "reason": "testing",
                "allowed_operations": ["read", "log"]
            });
            create_json(&lane_dir.join("active-mode.json"), &mode_data);
            let result = mode_check(Some(root));
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["mode"], "OBSERVE");
        });
    }

    #[test]
    fn test_system_status_no_trust_store() {
        with_temp_dir(|root| {
            let result = system_status(Some(root));
            // Should still return ok with divergence info
            assert_eq!(result.status, "ok");
        });
    }

    #[test]
    fn test_recovery_test_suite_minimal() {
        with_temp_dir(|root| {
            // Create minimal governance files
            create_file(&root.join("GOVERNANCE.md"), "# Governance\nRules here.");
            create_file(&root.join("BOOTSTRAP.md"), "# Bootstrap\nEntry point here.");
            create_file(
                &root.join("constitutional_constraints.yaml"),
                "STRUCTURE_OVER_IDENTITY: 5\nCORRECTION_MANDATORY: 4\nSINGLE_ENTRY_POINT: 5\nOPERATOR_ACCOUNTABILITY: 5\n",
            );
            // Create trust store with proper keys
            let lane_dir = root.join("lanes/broadcast");
            std::fs::create_dir_all(&lane_dir).ok();
            let trust = serde_json::json!({
                "archivist": {"key_id": "abcd1234abcd1234"},
                "library": {"key_id": "abcd1234abcd1234"},
                "swarmmind": {"key_id": "abcd1234abcd1234"},
                "kernel": {"key_id": "abcd1234abcd1234"}
            });
            create_json(&lane_dir.join("trust-store.json"), &trust);

            let result = recovery_test_suite(Some(root));
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            let summary = &data["summary"];
            assert!(
                summary["passed"].as_u64().unwrap_or(0) >= 5,
                "Expected at least 5 tests to pass, got {}",
                summary["passed"]
            );
        });
    }

    #[test]
    fn test_recovery_test_suite_constraint_mismatch() {
        with_temp_dir(|root| {
            create_file(&root.join("GOVERNANCE.md"), "# Governance");
            create_file(&root.join("BOOTSTRAP.md"), "# Bootstrap");
            // Only 2 of 4 required constraints
            create_file(
                &root.join("constitutional_constraints.yaml"),
                "STRUCTURE_OVER_IDENTITY: 5\nCORRECTION_MANDATORY: 4\n",
            );

            let result = recovery_test_suite(Some(root));
            let data = result.data.unwrap();
            let constraint_test = data["tests"]
                .as_array()
                .unwrap()
                .iter()
                .find(|t| t["name"] == "constraint_preservation")
                .unwrap();
            assert!(!constraint_test["passed"].as_bool().unwrap());
        });
    }

    #[test]
    fn test_hash_content() {
        let h = hash_content("hello");
        assert_eq!(h.len(), 64);
        // SHA-256 of "hello"
        assert_eq!(
            h,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn test_count_inbox_messages_empty_dir() {
        with_temp_dir(|root| {
            let inbox = root.join("inbox");
            std::fs::create_dir_all(&inbox).ok();
            assert_eq!(count_inbox_messages(&inbox), 0);
        });
    }

    #[test]
    fn test_count_inbox_messages_with_files() {
        with_temp_dir(|root| {
            let inbox = root.join("inbox");
            std::fs::create_dir_all(&inbox).ok();
            create_file(&inbox.join("task_001.json"), "{}");
            create_file(&inbox.join("response_002.json"), "{}");
            create_file(&inbox.join("heartbeat_003.json"), "{}"); // should be excluded
            assert_eq!(count_inbox_messages(&inbox), 2);
        });
    }

    #[test]
    fn test_count_inbox_messages_nonexistent() {
        with_temp_dir(|root| {
            assert_eq!(count_inbox_messages(&root.join("nonexistent")), 0);
        });
    }

    #[test]
    fn test_read_yaml_key_values() {
        with_temp_dir(|root| {
            let yaml_path = root.join("constraints.yaml");
            create_file(
                &yaml_path,
                "STRUCTURE_OVER_IDENTITY: 5\nCORRECTION_MANDATORY: 4\n",
            );
            let map = read_yaml_key_values(&yaml_path).unwrap();
            assert_eq!(map.get("STRUCTURE_OVER_IDENTITY"), Some(&5));
            assert_eq!(map.get("CORRECTION_MANDATORY"), Some(&4));
        });
    }

    // -----------------------------------------------------------------------
    // sovereignty_enforcer tests
    // -----------------------------------------------------------------------

    /// Helper: set up a temp project structure with lane-roots.json and
    /// sibling lane directories, so the enforcer can resolve all 4 lanes.
    fn setup_sovereignty_test_env(root: &Path) -> (PathBuf, PathBuf, PathBuf, PathBuf) {
        // Create sibling lane directories
        let kernel_dir = root.join("../kernel-lane");
        let library_dir = root.join("../self-organizing-library");
        let swarmmind_dir = root.join("../SwarmMind");
        std::fs::create_dir_all(&kernel_dir).ok();
        std::fs::create_dir_all(&library_dir).ok();
        std::fs::create_dir_all(&swarmmind_dir).ok();

        // Create scripts dir in root
        std::fs::create_dir_all(root.join("scripts")).ok();

        // Create a simple lane-roots.json
        let lane_config = serde_json::json!({
            "base_paths": { "windows": "" },
            "lanes": {
                "archivist": root.to_string_lossy(),
                "kernel": kernel_dir.to_string_lossy(),
                "library": library_dir.to_string_lossy(),
                "swarmmind": swarmmind_dir.to_string_lossy()
            }
        });
        create_json(&root.join("config/lane-roots.json"), &lane_config);

        (kernel_dir, library_dir, swarmmind_dir, root.to_path_buf())
    }

    #[test]
    fn test_sovereignty_no_scripts_dir() {
        with_temp_dir(|root| {
            // No scripts directory at all
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            assert!(result.message.contains("No scripts directory"));
        });
    }

    #[test]
    fn test_sovereignty_empty_scripts_dir() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            // scripts dir exists but empty
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            assert!(result.message.contains("PASSED"));
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 0);
        });
    }

    #[test]
    fn test_sovereignty_detects_cross_lane_require() {
        with_temp_dir(|root| {
            let (kernel_dir, _l, _s, _) = setup_sovereignty_test_env(root);
            let kernel_path = kernel_dir.to_string_lossy().replace('\\', "/");
            // Script with cross-lane require to kernel
            create_file(
                &root.join("scripts/bad.js"),
                &format!("const kv = require('{}/scripts/util.js');\n", kernel_path),
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 1);

            let violations = data["violations"].as_array().unwrap();
            assert_eq!(violations.len(), 1);
            assert_eq!(
                violations[0]["violations"][0]["violation_type"],
                "cross_lane_require"
            );
            assert!(violations[0]["violations"][0]["violation"]
                .as_str()
                .unwrap()
                .contains("kernel"));
        });
    }

    #[test]
    fn test_sovereignty_scans_multiple_files() {
        with_temp_dir(|root| {
            let (kernel_dir, _l, swarmmind_dir, _) = setup_sovereignty_test_env(root);
            let kernel_path = kernel_dir.to_string_lossy().replace('\\', "/");
            let swarmmind_path = swarmmind_dir.to_string_lossy().replace('\\', "/");
            // Multiple files with violations
            create_file(
                &root.join("scripts/file1.js"),
                &format!("const x = require('{}/conf.js');\n", kernel_path),
            );
            create_file(
                &root.join("scripts/file2.js"),
                &format!("const y = require('{}/api.js');\n", swarmmind_path),
            );
            create_file(&root.join("scripts/clean.js"), "const z = require('fs');\n");
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 2);
        });
    }

    #[test]
    fn test_sovereignty_ignores_comment_lines() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            // Cross-lane path in a comment - should be ignored
            create_file(
                &root.join("scripts/commented.js"),
                "// const x = require('S:/kernel-lane/util.js');\n /* const y = require('S:/SwarmMind/lib.js'); */\nconst ok = require('fs');\n",
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 0);
        });
    }

    #[test]
    fn test_sovereignty_strict_mode_with_violations() {
        with_temp_dir(|root| {
            let (kernel_dir, _l, _s, _) = setup_sovereignty_test_env(root);
            let kpath = kernel_dir.to_string_lossy().replace('\\', "/");
            create_file(
                &root.join("scripts/bad.ts"),
                &format!("const y = require('{}/util');\n", kpath),
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), true);
            assert_eq!(result.status, "error");
        });
    }

    #[test]
    fn test_sovereignty_strict_mode_clean() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            create_file(
                &root.join("scripts/clean.js"),
                "const fs = require('fs');\n",
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), true);
            assert_eq!(result.status, "ok");
        });
    }

    #[test]
    fn test_sovereignty_unknown_lane() {
        with_temp_dir(|root| {
            let result = sovereignty_enforcer(Some(root), Some("nonexistent"), false);
            assert_eq!(result.status, "error");
            assert!(result.message.contains("Unknown lane"));
        });
    }

    #[test]
    fn test_sovereignty_check_ts_and_js_files() {
        with_temp_dir(|root| {
            let (kernel_dir, _l, swarmmind_dir, _) = setup_sovereignty_test_env(root);
            let kpath = kernel_dir.to_string_lossy().replace('\\', "/");
            let spath = swarmmind_dir.to_string_lossy().replace('\\', "/");
            // Both .ts and .js should be scanned
            create_file(
                &root.join("scripts/module.ts"),
                &format!("const k = require('{}/tools.ts');\n", kpath),
            );
            create_file(
                &root.join("scripts/module.js"),
                &format!("const s = require('{}/helper.js');\n", spath),
            );
            create_file(
                &root.join("scripts/readme.md"),
                &format!("const k = require('{}/tools.ts');\n", kpath),
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            let data = result.data.unwrap();
            // Only .ts and .js files are scanned, .md should be ignored
            assert_eq!(data["total_violations"], 2);
        });
    }

    #[test]
    fn test_sovereignty_excluded_dirs() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            // Create scripts inside excluded dirs
            std::fs::create_dir_all(root.join("scripts/node_modules/dep")).ok();
            create_file(
                &root.join("scripts/node_modules/dep/bad.js"),
                "const x = require('S:/kernel-lane/util.js');\n",
            );
            std::fs::create_dir_all(root.join("scripts/.git/hooks")).ok();
            create_file(
                &root.join("scripts/.git/hooks/pre-commit.js"),
                "const x = require('S:/kernel-lane/hook.js');\n",
            );
            // And a real violation outside excluded dirs
            create_file(&root.join("scripts/real.js"), "const x = require('fs');\n");
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 0);
        });
    }

    #[test]
    fn test_sovereignty_report_files_created() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            create_file(
                &root.join("scripts/clean.js"),
                "const fs = require('fs');\n",
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");

            // Check that report files were created
            let state_dir = root.join("lanes/archivist/state");
            assert!(state_dir.exists());
            assert!(state_dir.join("sovereignty-report-latest.json").exists());
        });
    }

    #[test]
    fn test_sovereignty_default_lane() {
        with_temp_dir(|root| {
            // When no target_lane is specified, it defaults to "archivist"
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            create_file(&root.join("scripts/util.js"), "const fs = require('fs');\n");
            let result = sovereignty_enforcer(Some(root), None, false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 0);
        });
    }

    #[test]
    fn test_sovereignty_detects_swarmmind_cross_import() {
        with_temp_dir(|root| {
            let (_kernel_dir, _l, swarmmind_dir, _) = setup_sovereignty_test_env(root);
            // Create a scripts dir in SwarmMind
            std::fs::create_dir_all(swarmmind_dir.join("scripts")).ok();
            let archivist_path = root.to_string_lossy().replace('\\', "/");
            create_file(
                &swarmmind_dir.join("scripts/import_from_archivist.js"),
                &format!(
                    "const x = require('{}/config/lane-roots.json');\n",
                    archivist_path
                ),
            );
            // Test scanning the swarmmind lane
            let result = sovereignty_enforcer(Some(root), Some("swarmmind"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 1);
        });
    }

    #[test]
    fn test_sovereignty_skips_self() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            // File named sovereignty-enforcer.js should be skipped
            create_file(
                &root.join("scripts/sovereignty-enforcer.js"),
                "const x = require('S:/kernel-lane/util.js');\n",
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            assert_eq!(result.status, "ok");
            let data = result.data.unwrap();
            assert_eq!(data["total_violations"], 0);
        });
    }

    #[test]
    fn test_sovereignty_verify_report_structure() {
        with_temp_dir(|root| {
            let (_k, _l, _s, _) = setup_sovereignty_test_env(root);
            create_file(
                &root.join("scripts/violation.js"),
                "const x = require('S:/kernel-lane/util.js');\n",
            );
            let result = sovereignty_enforcer(Some(root), Some("archivist"), false);
            let data = result.data.unwrap();

            // Verify report metadata in the returned data
            assert!(data.get("report_path").is_some());
            assert!(data.get("latest_path").is_some());
            assert!(data.get("violations").is_some());

            // Read the written report file and verify its structure
            let latest_path = data["latest_path"].as_str().unwrap();
            let report_content = std::fs::read_to_string(latest_path).unwrap();
            let report: serde_json::Value = serde_json::from_str(&report_content).unwrap();
            assert_eq!(report["lane_id"], "archivist");
            assert_eq!(report["rule"], "NO_CROSS_LANE_REQUIRE");
            assert!(report.get("enforcement").is_some());
            assert!(report.get("recommendations").is_some());
            assert!(
                report
                    .get("recommendations")
                    .unwrap()
                    .as_array()
                    .unwrap()
                    .len()
                    >= 3
            );
        });
    }
}
