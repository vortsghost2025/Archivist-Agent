use serde::Serialize;
use std::fs;
use std::path::PathBuf;

use crate::governance::resolve_project_root_static;

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
}
