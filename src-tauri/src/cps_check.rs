// Evidence: BOOTSTRAP.md:53 — CPS score is used for runtime enforcement
// This module provides a checkpoint that reads the session‑level CPS_SCORE static
// and decides whether the system is allowed to proceed based on a threshold.

use crate::constitution::CPS_SCORE;
use crate::constitution::{load_constraints, compute_cps_score};
use std::env;

/// Returns true if the current CPS score meets or exceeds the provided threshold.
/// In production (no `CPS_FORCE_RECOMPUTE` env var) the static `CPS_SCORE`
/// computed at session start is used. Tests set `CPS_FORCE_RECOMPUTE` to force a
/// fresh recomputation after they inject a temporary constraints file.
pub fn cps_threshold_check(threshold: i32) -> bool {
    if env::var_os("CPS_FORCE_RECOMPUTE").is_some() {
        // Re‑compute on the fly for test isolation.
        let constraints = load_constraints();
        let score = compute_cps_score(&constraints);
        score >= threshold
    } else {
        *CPS_SCORE >= threshold
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::NamedTempFile;
    use std::io::Write;

    fn write_constraints(content: &str) -> NamedTempFile {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(content.as_bytes()).expect("write failed");
        env::set_var("CONSTRAINTS_PATH", tmp.path());
        // Force recompute on the next check.
        env::set_var("CPS_FORCE_RECOMPUTE", "1");
        tmp
    }

    fn cleanup(tmp: NamedTempFile) {
        env::remove_var("CONSTRAINTS_PATH");
        env::remove_var("CPS_FORCE_RECOMPUTE");
        drop(tmp); // tempfile will be deleted automatically
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
}

