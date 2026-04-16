// Evidence: BOOTSTRAP.md:53 — constraints loaded at session start
// Evidence: AGENTS.md: updated path ensures bootstrap is reachable.
// This module creates a legacy ``.global`` directory with symlinks to the actual
// governance files so that any code still referencing the old ``S:/.global``
// namespace continues to function without modification.

use std::path::Path;

pub fn ensure_shim() {
    let repo_root = std::env::current_dir().unwrap();
    let global_path = repo_root.join(".global");
    if !global_path.exists() {
        std::fs::create_dir(&global_path).ok();
        // Helper to create a symlink/junction depending on platform.
        #[cfg(unix)]
        fn link(src: &Path, dst: &Path) {
            std::os::unix::fs::symlink(src, dst).ok();
        }
        #[cfg(windows)]
        fn link(src: &Path, dst: &Path) {
            // On Windows a symlink to a file requires developer mode or admin rights.
            // Fall back to a hard copy if creation fails.
            if std::os::windows::fs::symlink_file(src, dst).is_err() {
                std::fs::copy(src, dst).ok();
            }
        }
        let files = [
            "BOOTSTRAP.md",
            "CHECKPOINTS.md",
            "CPS_ENFORCEMENT.md",
            "USER_DRIFT_SCORING.md",
            "COVENANT.md",
            "GOVERNANCE.md",
            "VERIFICATION_LANES.md",
        ];
        for name in &files {
            let src = repo_root.join(name);
            let dst = global_path.join(name);
            if src.exists() && !dst.exists() {
                link(&src, &dst);
            }
        }
    }
}
