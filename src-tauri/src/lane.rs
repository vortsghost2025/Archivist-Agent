use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::governance::resolve_project_root_static;

/// Canonical lane roots — maps lane_id to its actual repo root on disk.
/// Source of truth: docs/ops/LANE_MESSAGE_INDEX.md §1.
const LANE_ROOTS: &[(&str, &str)] = &[
    ("archivist", "S:/Archivist-Agent"),
    ("kernel", "S:/kernel-lane"),
    ("swarmmind", "S:/SwarmMind"),
    ("library", "S:/self-organizing-library"),
    ("authority", "S:/Archivist-Agent"),
    ("kucoin", "S:/kucoin-lane"),
];

/// Resolve the filesystem root for a given lane_id.
fn lane_root(lane_id: &str) -> Option<PathBuf> {
    LANE_ROOTS
        .iter()
        .find(|(id, _)| id == &lane_id)
        .map(|(_, root)| PathBuf::from(root))
}

/// Status report for a single lane, returned to the JS frontend.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaneStatus {
    pub lane_id: String,
    pub healthy: bool,
    pub inbox_count: usize,
    pub outbox_count: usize,
    pub quarantine_count: usize,
    pub action_required_count: usize,
    pub last_heartbeat: Option<String>,
}

/// A single message file found in an inbox/outbox directory.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaneMessageFile {
    pub name: String,
    pub timestamp: Option<String>,
}

/// A journal entry summary (first 200 chars of content, plus filename).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaneJournalEntry {
    pub file_name: String,
    pub preview: String,
}

/// Comprehensive read-only detail for a lane, returned by `switch_lane`.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaneDetail {
    pub lane_id: String,
    pub repo_root: Option<String>,
    pub repo_exists: bool,
    pub git_branch: Option<String>,
    pub git_head: Option<String>,
    pub git_clean: Option<bool>,
    pub git_modified: Option<usize>,
    pub git_untracked: Option<usize>,
    pub git_staged: Option<usize>,
    pub inbox_messages: Vec<LaneMessageFile>,
    pub outbox_messages: Vec<LaneMessageFile>,
    pub quarantine_messages: Vec<LaneMessageFile>,
    pub action_required_messages: Vec<LaneMessageFile>,
    pub journal_entries: Vec<LaneJournalEntry>,
    pub trust_store_entry: Option<serde_json::Value>,
    pub lane_state: Option<String>,
}

/// Count non-directory JSON files (excluding heartbeats) in a directory.
/// Returns 0 if the directory does not exist.
fn count_messages(dir: &PathBuf) -> usize {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    name.ends_with(".json") && !name.starts_with("heartbeat")
                })
                .count()
        })
        .unwrap_or(0)
}

/// Extract the most recent heartbeat timestamp from a directory.
/// Heartbeat files are named `heartbeat-{laneId}.json`.
fn latest_heartbeat(dir: &PathBuf) -> Option<String> {
    let entries = fs::read_dir(dir).ok()?;
    let mut latest: Option<String> = None;
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("heartbeat") && name.ends_with(".json") {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ts) = json.get("timestamp").and_then(|v| v.as_str()) {
                        let ts = ts.to_string();
                        if latest.as_ref().map_or(true, |l| &ts > l) {
                            latest = Some(ts);
                        }
                    }
                }
            }
        }
    }
    latest
}

/// Tauri command: returns lane status by reading its directory structure on disk.
///
/// A lane is considered "healthy" if its base directory exists.
/// Counts message files in `inbox/` and `outbox/`, quarantine items in
/// `inbox/quarantine/`, and action-required items in `inbox/action-required/`.
#[tauri::command]
pub fn get_lane_status(lane_id: String) -> Result<LaneStatus, String> {
    let root = resolve_project_root_static()?;
    let lane_dir = root.join("lanes").join(&lane_id);

    if !lane_dir.exists() {
        return Ok(LaneStatus {
            lane_id,
            healthy: false,
            inbox_count: 0,
            outbox_count: 0,
            quarantine_count: 0,
            action_required_count: 0,
            last_heartbeat: None,
        });
    }

    let inbox_dir = lane_dir.join("inbox");
    let outbox_dir = lane_dir.join("outbox");
    let quarantine_dir = inbox_dir.join("quarantine");
    let action_required_dir = inbox_dir.join("action-required");

    let inbox_count = count_messages(&inbox_dir);
    let outbox_count = count_messages(&outbox_dir);
    let quarantine_count = count_messages(&quarantine_dir);
    let action_required_count = count_messages(&action_required_dir);
    let last_heartbeat = latest_heartbeat(&inbox_dir).or_else(|| latest_heartbeat(&lane_dir));

    Ok(LaneStatus {
        lane_id,
        healthy: true,
        inbox_count,
        outbox_count,
        quarantine_count,
        action_required_count,
        last_heartbeat,
    })
}

/// List JSON message files in a directory (excluding heartbeats).
/// Returns filename + extracted timestamp if present.
fn list_message_files(dir: &PathBuf) -> Vec<LaneMessageFile> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    let mut files: Vec<LaneMessageFile> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.ends_with(".json") && !name.starts_with("heartbeat")
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let timestamp = fs::read_to_string(e.path()).ok().and_then(|content| {
                serde_json::from_str::<serde_json::Value>(&content)
                    .ok()
                    .and_then(|v| {
                        v.get("timestamp")
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string())
                    })
            });
            LaneMessageFile { name, timestamp }
        })
        .collect();
    // Sort by timestamp descending (most recent first), untimestamped at end.
    files.sort_by(|a, b| match (&a.timestamp, &b.timestamp) {
        (Some(at), Some(bt)) => bt.cmp(at),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.cmp(&b.name),
    });
    // Cap at 50 to avoid overwhelming the frontend.
    files.truncate(50);
    files
}

/// List journal entries from a lane's journal directory.
/// Looks for .jsonl, .json, and .md files; returns filename + first 200 chars preview.
fn list_journal_entries(dir: &PathBuf) -> Vec<LaneJournalEntry> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    let mut journals: Vec<LaneJournalEntry> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.ends_with(".jsonl") || name.ends_with(".json") || name.ends_with(".md")
        })
        .map(|e| {
            let file_name = e.file_name().to_string_lossy().to_string();
            let preview = fs::read_to_string(e.path())
                .map(|c| c.chars().take(200).collect())
                .unwrap_or_default();
            LaneJournalEntry { file_name, preview }
        })
        .collect();
    // Sort by filename descending (newest first, assuming date-prefixed).
    journals.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    journals.truncate(20);
    journals
}

/// Read trust-store.json and return the entry for a specific lane_id.
fn read_trust_store_entry(lane_id: &str, root: &Path) -> Option<serde_json::Value> {
    let trust_path = root.join("lanes/broadcast/trust-store.json");
    let content = fs::read_to_string(&trust_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get(lane_id).cloned()
}

/// Tauri command: returns comprehensive read-only detail for a lane.
///
/// This is the backend for "Phase 2: Active lane switch (read-only)".
/// Clicking a lane in the sidebar calls this command to populate the
/// center and evidence panels with that lane's state — repo info,
/// inbox/outbox messages, journal, and trust-store metadata.
/// No writes cross any lane boundary.
#[tauri::command]
pub fn switch_lane(lane_id: String) -> Result<LaneDetail, String> {
    let project_root = resolve_project_root_static()?;

    // Determine the lane's actual repo root.
    let repo_root = lane_root(&lane_id).or_else(|| {
        // Fallback: look for lane subdirectory under the project root.
        let candidate = project_root.join("lanes").join(&lane_id);
        if candidate.exists() {
            // The lane dir exists locally but we don't know the external repo root.
            // Use the project root as best guess.
            Some(project_root.clone())
        } else {
            None
        }
    });

    let repo_root_str = repo_root.as_ref().map(|p| p.to_string_lossy().to_string());
    let repo_exists = repo_root.as_ref().is_some_and(|p| p.exists());

    // Git status for the lane's repo root.
    let (git_branch, git_head, git_clean, git_modified, git_untracked, git_staged) = if repo_exists
    {
        let root = repo_root.as_ref().unwrap();

        let branch = Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(root)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string());

        let head = Command::new("git")
            .args(["rev-parse", "--short", "HEAD"])
            .current_dir(root)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string());

        let porcelain = Command::new("git")
            .args(["status", "--short"])
            .current_dir(root)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();

        let clean = porcelain.trim().is_empty();
        let modified = porcelain
            .lines()
            .filter(|l| l.len() >= 3 && l.as_bytes()[1] == b'M')
            .count();
        let untracked = porcelain.lines().filter(|l| l.starts_with('?')).count();
        let staged = porcelain
            .lines()
            .filter(|l| l.len() >= 3 && l.as_bytes()[0] != b' ' && l.as_bytes()[0] != b'?')
            .count();

        (
            branch,
            head,
            Some(clean),
            Some(modified),
            Some(untracked),
            Some(staged),
        )
    } else {
        (None, None, None, None, None, None)
    };

    // Determine the lane directory (under the project root for local lanes).
    let lane_dir = project_root.join("lanes").join(&lane_id);

    // Message lists from inbox/outbox subdirectories.
    let inbox_messages = list_message_files(&lane_dir.join("inbox"));
    let outbox_messages = list_message_files(&lane_dir.join("outbox"));
    let quarantine_messages = list_message_files(&lane_dir.join("inbox/quarantine"));
    let action_required_messages = list_message_files(&lane_dir.join("inbox/action-required"));

    // Journal entries.
    let journal_dir = lane_dir.join("journal");
    let journal_entries = if journal_dir.exists() {
        list_journal_entries(&journal_dir)
    } else {
        Vec::new()
    };

    // Trust-store entry and lane state.
    let trust_store_entry = read_trust_store_entry(&lane_id, &project_root);
    let lane_state = trust_store_entry
        .as_ref()
        .and_then(|v| v.get("lane_state"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(LaneDetail {
        lane_id,
        repo_root: repo_root_str,
        repo_exists,
        git_branch,
        git_head,
        git_clean,
        git_modified,
        git_untracked,
        git_staged,
        inbox_messages,
        outbox_messages,
        quarantine_messages,
        action_required_messages,
        journal_entries,
        trust_store_entry,
        lane_state,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_get_lane_status_archivist_exists() {
        // The archivist lane directory should always exist in the project.
        let result = get_lane_status("archivist".to_string());
        assert!(
            result.is_ok(),
            "get_lane_status should succeed for archivist"
        );
        let status = result.unwrap();
        assert_eq!(status.lane_id, "archivist");
        assert!(status.healthy, "archivist lane directory should exist");
    }

    #[test]
    fn test_get_lane_status_nonexistent_returns_not_healthy() {
        let result = get_lane_status("nonexistent-lane-xyz".to_string());
        assert!(
            result.is_ok(),
            "get_lane_status should not error for missing lanes"
        );
        let status = result.unwrap();
        assert_eq!(status.lane_id, "nonexistent-lane-xyz");
        assert!(!status.healthy);
        assert_eq!(status.inbox_count, 0);
        assert_eq!(status.outbox_count, 0);
    }

    #[test]
    fn test_count_messages_empty_dir() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        assert_eq!(count_messages(&path), 0);
    }

    #[test]
    fn test_count_messages_with_files() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        fs::write(path.join("msg1.json"), "{}").expect("write failed");
        fs::write(path.join("msg2.json"), "{}").expect("write failed");
        fs::write(path.join("heartbeat-test.json"), "{}").expect("write failed");
        fs::write(path.join("readme.txt"), "hi").expect("write failed");
        assert_eq!(
            count_messages(&path),
            2,
            "should count 2 non-heartbeat JSON files"
        );
    }

    #[test]
    fn test_latest_heartbeat_extracts_timestamp() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        fs::write(
            path.join("heartbeat-archivist.json"),
            r#"{"timestamp":"2026-05-25T04:00:00Z"}"#,
        )
        .expect("write failed");
        let result = latest_heartbeat(&path);
        assert_eq!(result, Some("2026-05-25T04:00:00Z".to_string()));
    }

    #[test]
    fn test_latest_heartbeat_no_heartbeat_files() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        fs::write(path.join("other.json"), "{}").expect("write failed");
        let result = latest_heartbeat(&path);
        assert!(result.is_none());
    }

    #[test]
    fn test_switch_lane_archivist() {
        let result = switch_lane("archivist".to_string());
        assert!(result.is_ok(), "switch_lane should succeed for archivist");
        let detail = result.unwrap();
        assert_eq!(detail.lane_id, "archivist");
        // Archivist repo always exists on S: drive in the dev environment.
        assert!(detail.repo_exists, "archivist repo should exist");
        // Should have git info since archivist is a git repo.
        assert!(
            detail.git_branch.is_some(),
            "archivist should have a git branch"
        );
        assert!(
            detail.git_head.is_some(),
            "archivist should have a git HEAD"
        );
    }

    #[test]
    fn test_switch_lane_unknown_lane() {
        let result = switch_lane("nonexistent-lane-xyz".to_string());
        assert!(
            result.is_ok(),
            "switch_lane should not error for unknown lanes"
        );
        let detail = result.unwrap();
        assert_eq!(detail.lane_id, "nonexistent-lane-xyz");
        assert!(
            !detail.repo_exists,
            "nonexistent lane repo should not exist"
        );
        assert!(
            detail.git_branch.is_none(),
            "nonexistent lane should have no git info"
        );
    }

    #[test]
    fn test_list_message_files_empty() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        let files = list_message_files(&path);
        assert!(
            files.is_empty(),
            "empty dir should produce no message files"
        );
    }

    #[test]
    fn test_list_message_files_with_entries() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        fs::write(
            path.join("20260525_task_from_kernel.json"),
            r#"{"timestamp":"2026-05-25T10:00:00Z","subject":"test"}"#,
        )
        .expect("write failed");
        fs::write(path.join("heartbeat-test.json"), "{}").expect("write failed");
        fs::write(path.join("readme.txt"), "hi").expect("write failed");
        let files = list_message_files(&path);
        assert_eq!(files.len(), 1, "should list 1 non-heartbeat JSON file");
        assert_eq!(files[0].name, "20260525_task_from_kernel.json");
        assert_eq!(files[0].timestamp, Some("2026-05-25T10:00:00Z".to_string()));
    }

    #[test]
    fn test_list_message_files_truncation() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        // Create 55 message files — should be truncated to 50.
        for i in 0..55 {
            let name = format!("msg_{:03}.json", i);
            fs::write(path.join(&name), r#"{"timestamp":"2026-05-25T10:00:00Z"}"#)
                .expect("write failed");
        }
        let files = list_message_files(&path);
        assert_eq!(files.len(), 50, "should truncate to 50 messages");
    }

    #[test]
    fn test_list_journal_entries_empty() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        let entries = list_journal_entries(&path);
        assert!(
            entries.is_empty(),
            "empty dir should produce no journal entries"
        );
    }

    #[test]
    fn test_list_journal_entries_with_files() {
        let dir = tempfile::tempdir().expect("temp dir creation failed");
        let path = dir.path().to_path_buf();
        fs::write(
            path.join("2026-05-25.jsonl"),
            r#"{"event":"test","detail":"hello world this is a long line that should be truncated at 200 characters to avoid overwhelming the frontend UI"}"#,
        )
        .expect("write failed");
        fs::write(path.join("2026-05-24.md"), "# Daily Summary\n\nSome notes.")
            .expect("write failed");
        fs::write(path.join("ignore.toml"), "not a journal").expect("write failed");
        let entries = list_journal_entries(&path);
        assert_eq!(entries.len(), 2, "should list 2 journal files (jsonl + md)");
        // Sorted descending by filename, so 2026-05-25 comes first.
        assert_eq!(entries[0].file_name, "2026-05-25.jsonl");
        assert_eq!(entries[1].file_name, "2026-05-24.md");
    }

    #[test]
    fn test_lane_root_known_lanes() {
        assert_eq!(
            lane_root("archivist"),
            Some(PathBuf::from("S:/Archivist-Agent"))
        );
        assert_eq!(lane_root("kernel"), Some(PathBuf::from("S:/kernel-lane")));
        assert_eq!(lane_root("swarmmind"), Some(PathBuf::from("S:/SwarmMind")));
        assert_eq!(
            lane_root("library"),
            Some(PathBuf::from("S:/self-organizing-library"))
        );
    }

    #[test]
    fn test_lane_root_unknown() {
        assert_eq!(lane_root("nonexistent-lane"), None);
    }
}
