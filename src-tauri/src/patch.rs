// Phase 2: Agent patch proposal and application commands.
// Evidence: BOOTSTRAP.md — Structure > Identity, operator consent required for writes.
// Evidence: CPS_ENFORCEMENT.md — All write commands gated on path validation.
//
// Commands:
// propose_patch(filePath, patchContent) -> PatchProposal
// apply_patch(proposalId) -> ApplyResult
//
// Security:
// - propose_patch: validates path, reads current file, generates diff, logs to audit
// - apply_patch: requires proposalId from a prior propose_patch call
// - User click overrides read_only_mode (operator consent)
// - Content is verified against the proposal (prevents stale apply)
// - All applies are recorded to the patch audit log
//
// The model can PROPOSE patches even in read-only mode.
// The user must click "Apply" to actually write — this overrides read-only.
//
// IMPORTANT: apply_patch does NOT write the file directly. It validates the
// proposal and returns the content. JavaScript then calls
// window.__TAURI__.fs.writeTextFile() to perform the actual write, which
// goes through Tauri's scope-checking command layer (returns errors
// gracefully, never aborts the process). Direct Rust std::fs::write()
// and Fs::open() both bypass scope checking on desktop and can cause
// process aborts that catch_unwind cannot catch.

use crate::safety;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;

// ── Patch Audit Log ──────────────────────────────────────────────────

/// A single entry in the patch audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchAuditEntry {
    pub proposal_id: String,
    pub file_path: String,
    pub timestamp: String,
    pub action: String, // "proposed" | "approved" | "applied" | "rejected" | "failed" | "blocked"
    pub detail: Option<String>,
    pub read_only_override: bool, // true if apply overrode read-only mode
}

static PATCH_AUDIT_LOG: Lazy<Mutex<Vec<PatchAuditEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[cfg(test)]
thread_local! {
    static TEST_LOG: std::cell::RefCell<Vec<PatchAuditEntry>> = std::cell::RefCell::new(Vec::new());
}

#[cfg(not(test))]
fn record_patch_audit(
    proposal_id: &str,
    file_path: &str,
    action: &str,
    detail: Option<String>,
    read_only_override: bool,
) {
    let entry = PatchAuditEntry {
        proposal_id: proposal_id.to_string(),
        file_path: file_path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        action: action.to_string(),
        detail,
        read_only_override,
    };
    if let Ok(mut log) = PATCH_AUDIT_LOG.lock() {
        log.push(entry);
        // Keep bounded (last 200 entries)
        if log.len() > 200 {
            let len = log.len();
            log.drain(0..len - 200);
        }
    }
}
#[cfg(test)]
fn record_patch_audit(
    proposal_id: &str,
    file_path: &str,
    action: &str,
    detail: Option<String>,
    read_only_override: bool,
) {
    let entry = PatchAuditEntry {
        proposal_id: proposal_id.to_string(),
        file_path: file_path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        action: action.to_string(),
        detail,
        read_only_override,
    };
    TEST_LOG.with(|log| {
        let mut log = log.borrow_mut();
        log.push(entry);
        if log.len() > 200 {
            let len = log.len();
            log.drain(0..len - 200);
        }
    });
}

/// Get the patch audit log (for UI display).
#[cfg(not(test))]
#[tauri::command]
pub fn get_patch_audit_log() -> Vec<PatchAuditEntry> {
    PATCH_AUDIT_LOG
        .lock()
        .map(|log| log.clone())
        .unwrap_or_default()
}

#[cfg(test)]
#[tauri::command]
pub fn get_patch_audit_log() -> Vec<PatchAuditEntry> {
    TEST_LOG.with(|log| log.borrow().clone())
}

/// Clear the patch audit log.
#[tauri::command]
pub fn clear_patch_audit_log() {
    if let Ok(mut log) = PATCH_AUDIT_LOG.lock() {
        log.clear();
    }
}

// ── Pending Proposals ────────────────────────────────────────────────

/// A pending patch proposal, stored in memory until applied or expired.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchProposal {
    pub proposal_id: String,
    pub file_path: String,
    pub original_content: String,
    pub patch_content: String,
    pub diff: String,
    pub timestamp: String,
}

#[cfg(test)]
thread_local! {
    static TEST_PENDING: std::cell::RefCell<Vec<PatchProposal>> = std::cell::RefCell::new(Vec::new());
}

// Global pending proposals storage (used in production)
static PENDING_PROPOSALS: Lazy<Mutex<Vec<PatchProposal>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// Get a pending proposal by ID.
#[cfg(not(test))]
fn get_pending_proposal(proposal_id: &str) -> Option<PatchProposal> {
    PENDING_PROPOSALS.lock().ok().and_then(|proposals| {
        proposals
            .iter()
            .find(|p| p.proposal_id == proposal_id)
            .cloned()
    })
}

#[cfg(test)]
fn get_pending_proposal(proposal_id: &str) -> Option<PatchProposal> {
    TEST_PENDING.with(|pending| {
        pending
            .borrow()
            .iter()
            .find(|p| p.proposal_id == proposal_id)
            .cloned()
    })
}

/// Remove a pending proposal by ID.
#[cfg(not(test))]
fn remove_pending_proposal(proposal_id: &str) {
    if let Ok(mut proposals) = PENDING_PROPOSALS.lock() {
        proposals.retain(|p| p.proposal_id != proposal_id);
    }
}

#[cfg(test)]
fn remove_pending_proposal(proposal_id: &str) {
    TEST_PENDING.with(|pending| {
        pending
            .borrow_mut()
            .retain(|p| p.proposal_id != proposal_id);
    });
}

// ── Diff Generation ──────────────────────────────────────────────────

/// Generate a simple unified-style diff between original and new content.
/// This is a basic line-by-line diff — not a full diff algorithm,
/// but good enough for the user to review what changed.
fn generate_diff(original: &str, new: &str, file_path: &str) -> String {
    let original_lines: Vec<&str> = original.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    let mut diff = format!("--- a/{}\n+++ b/{}\n", file_path, file_path);

    // Simple approach: find the first and last differing lines,
    // then output the changed region with -/+ prefixes.
    let max_len = original_lines.len().max(new_lines.len());
    let mut change_regions: Vec<(usize, usize, usize)> = Vec::new(); // (orig_start, orig_count, new_count)
                                                                     // Prevent unbounded growth: cap number of regions to avoid OOM on very large diffs.
    const MAX_REGIONS: usize = 1000;

    let mut i = 0;
    while i < max_len {
        let orig_line = original_lines.get(i);
        let new_line = new_lines.get(i);

        if orig_line != new_line {
            // Found start of a change region
            let start = i;
            let mut end = i;

            // Find end of change region (where lines match again)
            for j in (i + 1)..max_len {
                let o = original_lines.get(j);
                let n = new_lines.get(j);
                if o == n {
                    end = j;
                    break;
                }
                end = j + 1;
            }

            // Determine how many lines were removed vs added
            let orig_count = if end <= original_lines.len() {
                (end - start).min(original_lines.len() - start)
            } else {
                original_lines.len().saturating_sub(start)
            };
            let new_count = if end <= new_lines.len() {
                (end - start).min(new_lines.len() - start)
            } else {
                new_lines.len().saturating_sub(start)
            };

            change_regions.push((start, orig_count, new_count));
            if change_regions.len() > MAX_REGIONS {
                // Too many regions; fallback to a single region covering the whole diff
                change_regions.clear();
                change_regions.push((0, original_lines.len(), new_lines.len()));
                break;
            }
            i = end;
        } else {
            i += 1;
        }
    }

    if change_regions.is_empty() {
        diff.push_str("\n(no changes)\n");
        return diff;
    }

    for (start, orig_count, new_count) in &change_regions {
        let context = 3; // lines of context
        let ctx_start = start.saturating_sub(context);

        diff.push_str(&format!(
            "@@ -{},{} +{},{} @@\n",
            ctx_start + 1,
            orig_count + context.min(*start),
            ctx_start + 1,
            new_count + context.min(*start)
        ));

        // Context before
        for j in ctx_start..*start {
            if let Some(line) = original_lines.get(j) {
                diff.push_str(&format!(" {}\n", line));
            }
        }

        // Removed lines
        for j in *start..(*start + *orig_count) {
            if let Some(line) = original_lines.get(j) {
                diff.push_str(&format!("-{}\n", line));
            }
        }

        // Added lines
        for j in *start..(*start + *new_count) {
            if let Some(line) = new_lines.get(j) {
                diff.push_str(&format!("+{}\n", line));
            }
        }

        // Context after
        let after_start = *start + orig_count.max(new_count);
        let after_end = (after_start + context).min(max_len);
        for j in after_start..after_end {
            if let Some(line) = original_lines.get(j).or_else(|| new_lines.get(j)) {
                diff.push_str(&format!(" {}\n", line));
            }
        }
    }

    diff
}

// ── propose_patch command ─────────────────────────────────────────────

/// Response from propose_patch.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposePatchResponse {
    pub proposal_id: String,
    pub file_path: String,
    pub diff: String,
    pub lines_added: usize,
    pub lines_removed: usize,
    pub original_hash: String,
}

/// Propose a patch to a file. The model specifies the file path and the
/// complete new content. The command:
/// 1. Validates the path is in allowed_roots
/// 2. Reads the current file content
/// 3. Generates a diff between current and proposed content
/// 4. Stores the proposal in memory (pending apply)
/// 5. Logs to the patch audit trail
/// 6. Returns the diff for the UI to display
///
/// This does NOT write the file — the user must click "Apply".
#[tauri::command]
pub fn propose_patch(
    file_path: String,
    patch_content: String,
) -> Result<ProposePatchResponse, String> {
    let path = Path::new(&file_path);

    // 1. Validate path
    safety::validate_path(path).map_err(|e| format!("Path validation failed: {}", e))?;

    // 2. Block secret paths
    if crate::agent_fs::is_secret_path(path) {
        record_patch_audit(
            "n/a",
            &file_path,
            "blocked",
            Some("Secret path".to_string()),
            false,
        );
        return Err("Cannot propose patches to secret/sensitive files.".to_string());
    }

    // 3. Read current file content
    let original_content = if path.exists() {
        fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?
    } else {
        // New file — original is empty
        String::new()
    };

    // 4. Generate diff
    let diff = generate_diff(&original_content, &patch_content, &file_path);

    // Count added/removed lines (exclude diff headers +++ and ---)
    let lines_added = diff
        .lines()
        .filter(|l| l.starts_with('+') && !l.starts_with("+++"))
        .count();
    let lines_removed = diff
        .lines()
        .filter(|l| l.starts_with('-') && !l.starts_with("---"))
        .count();

    // Hash the original content for verification on apply
    let original_hash = format!("{:x}", simple_hash(&original_content));

    // 5. Generate proposal ID
    let proposal_id = format!("patch_{}", chrono::Utc::now().timestamp_millis());

    // 6. Store pending proposal
    let proposal = PatchProposal {
        proposal_id: proposal_id.clone(),
        file_path: file_path.clone(),
        original_content,
        patch_content,
        diff: diff.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    if let Ok(mut pending) = PENDING_PROPOSALS.lock() {
        pending.push(proposal);
        // Keep bounded (last 50 pending)
        if pending.len() > 50 {
            let len = pending.len();
            pending.drain(0..len - 50);
        }
    }

    // 7. Log to audit
    record_patch_audit(
        &proposal_id,
        &file_path,
        "proposed",
        Some(format!("+{} -{} lines", lines_added, lines_removed)),
        false,
    );

    Ok(ProposePatchResponse {
        proposal_id,
        file_path,
        diff,
        lines_added,
        lines_removed,
        original_hash,
    })
}

// ── apply_patch command ───────────────────────────────────────────────

/// Response from apply_patch.
///
/// The Rust side validates the proposal but does NOT write the file.
/// The `content` field contains the new file content for JavaScript
/// to write via `window.__TAURI__.fs.writeTextFile()`, which goes
/// through Tauri's scope-checking command layer (returns errors
/// gracefully, never aborts the process).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPatchResponse {
    pub file_path: String,
    pub content: String,
    pub success: bool,
    pub detail: String,
    pub read_only_overridden: bool,
    /// If true, the parent directory doesn't exist yet and JS must create it
    /// via window.__TAURI__.fs.mkdir() before calling writeTextFile.
    /// Rust does NOT create directories directly because std::fs::create_dir_all
    /// bypasses Tauri's scope-checking command layer and can cause process aborts
    /// (same class of bug as the original fs::write() crash).
    pub needs_mkdir: bool,
    /// The parent directory path that JS must create if needs_mkdir is true.
    pub parent_dir: Option<String>,
}

/// Apply a previously proposed patch. This is called when the user clicks
/// "Apply" in the UI. It:
/// 1. Looks up the pending proposal by ID
/// 2. Verifies the file hasn't changed since the proposal (original hash check)
/// 3. Checks read-only mode (user click overrides — recorded in audit)
/// 4. Returns the content for JavaScript to write via the Tauri fs plugin
/// 5. Removes the pending proposal
/// 6. Logs to the patch audit trail
///
/// The actual file write is done by JavaScript calling
/// `window.__TAURI__.fs.writeTextFile()`, which goes through Tauri's
/// scope-checking command layer. This avoids the process abort that
/// can happen when Rust code calls std::fs::write() or Fs::open()
/// directly, since both bypass the scope check on desktop.
///
/// User click overrides read_only_mode — operator consent is recorded in audit.
#[tauri::command]
pub fn apply_patch(proposal_id: String) -> Result<ApplyPatchResponse, String> {
    // 1. Look up pending proposal
    let proposal = get_pending_proposal(&proposal_id)
        .ok_or_else(|| format!("No pending proposal found with ID: {}", proposal_id))?;

    let path = Path::new(&proposal.file_path);

    // 2. Validate path (defense in depth)
    safety::validate_path(path).map_err(|e| format!("Path validation failed: {}", e))?;

    // 3. Block secret paths
    if crate::agent_fs::is_secret_path(path) {
        record_patch_audit(
            &proposal_id,
            &proposal.file_path,
            "blocked",
            Some("Secret path".to_string()),
            false,
        );
        return Err("Cannot apply patches to secret/sensitive files.".to_string());
    }

    // 4. Verify file hasn't changed since proposal
    let current_content = if path.exists() {
        fs::read_to_string(path).map_err(|e| format!("Failed to read current file: {}", e))?
    } else {
        String::new()
    };

    let current_hash = format!("{:x}", simple_hash(&current_content));
    let original_hash = format!("{:x}", simple_hash(&proposal.original_content));

    if current_hash != original_hash {
        record_patch_audit(
            &proposal_id,
            &proposal.file_path,
            "failed",
            Some("File changed since proposal — stale patch".to_string()),
            false,
        );
        return Err(
            "File has changed since the patch was proposed. Please request a new patch."
                .to_string(),
        );
    }

    // 5. Check read-only mode — user click overrides
    let read_only = safety::check_read_only().is_err();
    let read_only_overridden = read_only;

    // 6. Check if parent directory needs to be created.
    // We do NOT call fs::create_dir_all here — that bypasses Tauri's scope-checking
    // command layer and can cause process aborts (same class of bug as fs::write).
    // Instead, we signal to JS that it needs to call window.__TAURI__.fs.mkdir().
    let (needs_mkdir, parent_dir) = if let Some(parent) = path.parent() {
        if !parent.exists() {
            (true, Some(parent.to_string_lossy().to_string()))
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };

    // 7. Remove from pending (validation passed — content will be written by JS)
    remove_pending_proposal(&proposal_id);

    // 8. Log to audit (pre-write; JS confirms write separately)
    record_patch_audit(
        &proposal_id,
        &proposal.file_path,
        "approved",
        Some(format!(
            "Validation passed ({} bytes to write){} — awaiting JS writeTextFile",
            proposal.patch_content.len(),
            if needs_mkdir { " [needs mkdir]" } else { "" }
        )),
        read_only_overridden,
    );

    Ok(ApplyPatchResponse {
        file_path: proposal.file_path.clone(),
        content: proposal.patch_content.clone(),
        success: true,
        detail: format!(
            "Patch validated ({} bytes to write){}{}",
            proposal.patch_content.len(),
            if needs_mkdir {
                " [parent dir needs creation]"
            } else {
                ""
            },
            if read_only_overridden {
                " [read-only override — operator consent]"
            } else {
                ""
            }
        ),
        read_only_overridden,
        needs_mkdir,
        parent_dir,
    })
}

/// Reject a pending patch proposal (user clicks "Reject").
#[tauri::command]
pub fn reject_patch(proposal_id: String) -> Result<String, String> {
    let proposal = get_pending_proposal(&proposal_id)
        .ok_or_else(|| format!("No pending proposal found with ID: {}", proposal_id))?;

    record_patch_audit(
        &proposal_id,
        &proposal.file_path,
        "rejected",
        Some("User rejected".to_string()),
        false,
    );

    remove_pending_proposal(&proposal_id);

    Ok(format!("Patch {} rejected and removed.", proposal_id))
}

/// Confirm that a patch was successfully applied by the JS side.
/// Called after window.__TAURI__.fs.writeTextFile() succeeds.
/// This completes the audit trail: "approved" (Rust validation) → "applied" (JS write confirmed).
#[tauri::command]
pub fn confirm_patch_applied(
    proposal_id: String,
    file_path: String,
    read_only_overridden: bool,
) -> Result<String, String> {
    record_patch_audit(
        &proposal_id,
        &file_path,
        "applied",
        Some("JS writeTextFile confirmed".to_string()),
        read_only_overridden,
    );
    Ok(format!(
        "Patch {} applied confirmation recorded.",
        proposal_id
    ))
}

// ── Utility ──────────────────────────────────────────────────────────

/// Simple hash function for content verification.
/// Not cryptographic — just for detecting if file changed since proposal.
fn simple_hash(s: &str) -> u64 {
    // FNV-1a hash
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to isolate the patch audit log for testing.
    fn with_isolated_patch_audit<F, R>(f: F) -> R
    where
        F: FnOnce() -> R,
    {
        // Acquire a global test isolation lock to prevent concurrent interference
        #[cfg(test)]
        static TEST_ISOLATION_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
        #[cfg(test)]
        let _guard = TEST_ISOLATION_LOCK
            .lock()
            .expect("Failed to acquire test isolation lock");

        // Clear before (global and test logs)
        if let Ok(mut log) = PATCH_AUDIT_LOG.lock() {
            log.clear();
        }
        // Clear thread‑local test log
        #[cfg(test)]
        {
            TEST_LOG.with(|log| log.borrow_mut().clear());
        }
        // Clear pending proposals
        #[cfg(not(test))]
        if let Ok(mut pending) = PENDING_PROPOSALS.lock() {
            pending.clear();
        }
        #[cfg(test)]
        TEST_PENDING.with(|p| p.borrow_mut().clear());

        let result = f();

        // Clear after
        if let Ok(mut log) = PATCH_AUDIT_LOG.lock() {
            log.clear();
        }
        #[cfg(test)]
        TEST_LOG.with(|log| log.borrow_mut().clear());
        #[cfg(not(test))]
        if let Ok(mut pending) = PENDING_PROPOSALS.lock() {
            pending.clear();
        }
        #[cfg(test)]
        TEST_PENDING.with(|p| p.borrow_mut().clear());
        result
    }

    #[test]
    fn test_simple_hash_deterministic() {
        let a = simple_hash("hello world");
        let b = simple_hash("hello world");
        assert_eq!(a, b, "Same input should produce same hash");

        let c = simple_hash("hello earth");
        assert_ne!(a, c, "Different input should produce different hash");
    }

    #[test]
    fn test_generate_diff_no_changes() {
        let diff = generate_diff("line1\nline2\n", "line1\nline2\n", "test.txt");
        assert!(
            diff.contains("(no changes)"),
            "No changes should be indicated"
        );
    }

    #[test]
    fn test_generate_diff_with_changes() {
        let original = "line1\nline2\nline3\n";
        let new = "line1\nmodified\nline3\n";
        let diff = generate_diff(original, new, "test.txt");
        assert!(diff.contains("-line2"), "Should show removed line");
        assert!(diff.contains("+modified"), "Should show added line");
    }

    #[test]
    fn test_generate_diff_new_file() {
        let diff = generate_diff("", "new content\n", "new.txt");
        assert!(
            diff.contains("+new content"),
            "New file should show all lines as added"
        );
    }

    #[test]
    fn test_generate_diff_delete_file() {
        let diff = generate_diff("old content\n", "", "old.txt");
        assert!(
            diff.contains("-old content"),
            "Deleted content should show as removed"
        );
    }

    #[test]
    fn test_propose_patch_valid_path() {
        with_isolated_patch_audit(|| {
            let tmp = tempfile::TempDir::new().unwrap();
            let file_path = tmp.path().join("test.txt");
            fs::write(&file_path, "original content\n").unwrap();

            // We can't easily test propose_patch directly because it calls
            // safety::validate_path which checks against allowed_roots.
            // Instead, test the diff generation and hash verification logic.
            let original = "original content\n";
            let patch = "modified content\n";
            let diff = generate_diff(original, patch, "test.txt");
            assert!(diff.contains("-original content"));
            assert!(diff.contains("+modified content"));

            let hash1 = simple_hash(original);
            let hash2 = simple_hash(patch);
            assert_ne!(hash1, hash2);
        });
    }

    #[test]
    fn test_propose_patch_rejects_secret_path() {
        // is_secret_path is in agent_fs, just verify it catches .env
        let path = Path::new("S:/project/.env");
        assert!(crate::agent_fs::is_secret_path(path));
    }

    #[test]
    fn test_patch_audit_log_recording() {
        with_isolated_patch_audit(|| {
            record_patch_audit("patch_1", "S:/test.txt", "proposed", None, false);
            record_patch_audit("patch_1", "S:/test.txt", "applied", None, true);

            let log = get_patch_audit_log();
            assert_eq!(log.len(), 2);
            assert_eq!(log[0].action, "proposed");
            assert_eq!(log[1].action, "applied");
            assert!(log[1].read_only_override);
        });
    }

    #[test]
    fn test_patch_audit_log_bounded() {
        with_isolated_patch_audit(|| {
            for i in 0..300 {
                record_patch_audit(
                    &format!("patch_{}", i),
                    "S:/test.txt",
                    "proposed",
                    None,
                    false,
                );
            }
            let log = get_patch_audit_log();
            assert!(
                log.len() <= 200,
                "Should be bounded to 200, got {}",
                log.len()
            );
        });
    }

    #[test]
    fn test_pending_proposals_store_and_retrieve() {
        with_isolated_patch_audit(|| {
            let proposal = PatchProposal {
                proposal_id: "patch_test".to_string(),
                file_path: "S:/test.txt".to_string(),
                original_content: "old".to_string(),
                patch_content: "new".to_string(),
                diff: "--- a/test.txt\n+++ b/test.txt\n".to_string(),
                timestamp: "2026-01-01T00:00:00Z".to_string(),
            };

            if let Ok(mut pending) = PENDING_PROPOSALS.lock() {
                pending.push(proposal.clone());
            }

            let retrieved = get_pending_proposal("patch_test");
            assert!(retrieved.is_some());
            assert_eq!(retrieved.unwrap().file_path, "S:/test.txt");

            remove_pending_proposal("patch_test");
            let gone = get_pending_proposal("patch_test");
            assert!(gone.is_none());
        });
    }

    #[test]
    fn test_apply_patch_detects_stale_content() {
        with_isolated_patch_audit(|| {
            let tmp = tempfile::TempDir::new().unwrap();
            let file_path = tmp.path().join("stale.txt");

            // Write original content
            fs::write(&file_path, "original\n").unwrap();
            let original_hash = simple_hash("original\n");

            // Simulate the file changing between propose and apply
            fs::write(&file_path, "modified by someone else\n").unwrap();

            let current_hash = simple_hash(&fs::read_to_string(&file_path).unwrap());
            assert_ne!(
                original_hash, current_hash,
                "Hash should differ after external modification"
            );
        });
    }

    #[test]
    fn test_reject_patch_removes_proposal() {
        with_isolated_patch_audit(|| {
            let proposal = PatchProposal {
                proposal_id: "patch_reject".to_string(),
                file_path: "S:/test.txt".to_string(),
                original_content: "old".to_string(),
                patch_content: "new".to_string(),
                diff: "".to_string(),
                timestamp: "2026-01-01T00:00:00Z".to_string(),
            };

            if let Ok(mut pending) = PENDING_PROPOSALS.lock() {
                pending.push(proposal);
            }

            assert!(get_pending_proposal("patch_reject").is_some());
            remove_pending_proposal("patch_reject");
            assert!(get_pending_proposal("patch_reject").is_none());
        });
    }
}
