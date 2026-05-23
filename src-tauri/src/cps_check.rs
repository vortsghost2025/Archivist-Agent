// Evidence: BOOTSTRAP.md:53 — CPS score is used for runtime enforcement
// Evidence: ISOLATION_VIOLATION_FIX.md — Thread-local state for test isolation
// Evidence: CPS_ENFORCEMENT.md §3.2 — "Log event to cps_log.jsonl" on BLOCK
// Evidence: CPS_ENFORCEMENT.md §4.1 — "IF CPS < threshold: BLOCK"
// This module provides a checkpoint that reads the session‑level CPS_SCORE static
// and decides whether the system is allowed to proceed based on a threshold.

use crate::constitution::CPS_SCORE;
use crate::constitution::{compute_cps_score, load_constraints};

use std::path::PathBuf;

fn cps_log_path() -> Option<PathBuf> {
    #[cfg(test)]
    {
        if let Some(custom) = crate::test_env::get_cps_log_path() {
            return Some(custom);
        }
    }
    let crate_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let repo_root = crate_dir.parent()?;
    let log_path = repo_root.join("context-buffer").join("cps_log.jsonl");
    if repo_root.join("context-buffer").exists() {
        return Some(log_path);
    }
    None
}

fn append_cps_block_event(score: i32, threshold: i32, caller: &str) {
    let log_path = match cps_log_path() {
        Some(p) => p,
        None => {
            eprintln!("[CPS] cps_log.jsonl path not found — block event not logged");
            return;
        }
    };
    let timestamp = chrono::Utc::now().to_rfc3339();
    let entry = serde_json::json!({
        "timestamp": timestamp,
        "event": "BLOCK",
        "cps_score": score,
        "threshold": threshold,
        "caller": caller,
        "components": {},
    });
    let line = match serde_json::to_string(&entry) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[CPS] failed to serialize block event: {}", e);
            return;
        }
    };
    use std::io::Write;
    if let Err(e) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut f| writeln!(f, "{}", line))
    {
        eprintln!("[CPS] failed to append to cps_log.jsonl: {}", e);
    }
}

/// Returns true if the current CPS score meets or exceeds the provided threshold.
/// When the check fails (BLOCK), the event is logged to context-buffer/cps_log.jsonl
/// per CPS_ENFORCEMENT.md §3.2.
pub fn cps_threshold_check(threshold: i32) -> bool {
    #[cfg(test)]
    {
        use crate::test_env;
        if test_env::should_force_recompute() {
            let constraints = load_constraints();
            let score = compute_cps_score(&constraints);
            if score < threshold {
                append_cps_block_event(score, threshold, "cps_threshold_check(test_recompute)");
                return false;
            }
            return true;
        }
    }

    #[cfg(not(test))]
    {
        use std::env;
        if env::var_os("CPS_FORCE_RECOMPUTE").is_some() {
            let constraints = load_constraints();
            let score = compute_cps_score(&constraints);
            if score < threshold {
                append_cps_block_event(score, threshold, "cps_threshold_check(force_recompute)");
                return false;
            }
            return true;
        }
    }

    let score = *CPS_SCORE;
    if score < threshold {
        append_cps_block_event(score, threshold, "cps_threshold_check");
        false
    } else {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_constraints(content: &str) -> NamedTempFile {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(content.as_bytes()).expect("write failed");
        test_env::set_constraints_path(tmp.path().to_path_buf());
        test_env::set_force_recompute(true);
        tmp
    }

    fn cleanup(tmp: NamedTempFile) {
        test_env::clear_constraints_path();
        test_env::clear_force_recompute();
        drop(tmp);
    }

    #[test]
    fn test_cps_threshold_passes() {
        let tmp = write_constraints("- name: TEST\n  description: dummy\n  weight: 10\n");
        assert!(cps_threshold_check(5));
        cleanup(tmp);
    }

    #[test]
    fn test_cps_threshold_fails() {
        let tmp = write_constraints("- name: TEST\n  description: dummy\n  weight: 2\n");
        assert!(!cps_threshold_check(5));
        cleanup(tmp);
    }

    #[test]
    fn test_cps_block_event_logged() {
        let tmp = write_constraints("- name: LOW\n  description: low\n  weight: 2\n");
        let log_tmp = NamedTempFile::new().expect("temp log file creation failed");
        let log_path = log_tmp.path().to_path_buf();
        test_env::set_cps_log_path(log_path.clone());
        let _result = cps_threshold_check(5);
        let content = std::fs::read_to_string(&log_path).unwrap_or_default();
        let last_line = content
            .lines()
            .rfind(|l| !l.trim().is_empty())
            .unwrap_or("")
            .to_string();
        let parsed: serde_json::Value = serde_json::from_str(&last_line)
            .unwrap_or_else(|e| panic!("Failed to parse JSONL line '{}': {}", last_line, e));
        assert_eq!(parsed["event"], "BLOCK");
        assert_eq!(parsed["cps_score"], 2);
        assert_eq!(parsed["threshold"], 5);
        test_env::clear_cps_log_path();
        cleanup(tmp);
    }
}
