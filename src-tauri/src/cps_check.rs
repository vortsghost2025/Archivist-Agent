// Evidence: BOOTSTRAP.md:53 — CPS score is used for runtime enforcement
// Evidence: ISOLATION_VIOLATION_FIX.md — Thread-local state for test isolation
// This module provides a checkpoint that reads the session‑level CPS_SCORE static
// and decides whether the system is allowed to proceed based on a threshold.

use crate::constitution::CPS_SCORE;
use crate::constitution::{compute_cps_score, load_constraints};

/// Returns true if the current CPS score meets or exceeds the provided threshold.
/// In production (no test override) the static `CPS_SCORE` computed at session
/// start is used. Tests use thread-local flags to force recomputation.
pub fn cps_threshold_check(threshold: i32) -> bool {
    #[cfg(test)]
    {
        use crate::test_env;
        if test_env::should_force_recompute() {
            let constraints = load_constraints();
            let score = compute_cps_score(&constraints);
            return score >= threshold;
        }
    }

    #[cfg(not(test))]
    {
        use std::env;
        if env::var_os("CPS_FORCE_RECOMPUTE").is_some() {
            let constraints = load_constraints();
            let score = compute_cps_score(&constraints);
            return score >= threshold;
        }
    }

    *CPS_SCORE >= threshold
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
}
