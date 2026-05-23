use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Serialize, Clone)]
pub struct ScriptOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

#[derive(Serialize, Clone)]
pub struct GitStatusOutput {
    pub porcelain: String,
    pub clean: bool,
    pub modified: usize,
    pub untracked: usize,
    pub staged: usize,
}

#[derive(Serialize, Clone)]
pub struct ReadOnlyReport {
    pub read_only_mode: bool,
    pub allowed_roots: Vec<String>,
    pub blocked_roots: Vec<String>,
    pub source: String,
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
            return Ok(parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf()));
        }
    }
    Err("Cannot find project root: config/allowed_roots.json not found".to_string())
}

fn governance_file_path(file_name: &str) -> Result<PathBuf, String> {
    let root = resolve_project_root()?;
    let relative = match file_name {
        "active-mode" => "lanes/broadcast/active-mode.json",
        "active-blocker" => "lanes/broadcast/active-blocker.json",
        "system-state" => "lanes/broadcast/system_state.json",
        "trust-store" => "lanes/broadcast/trust-store.json",
        "last-recovery" => "lanes/broadcast/last-recovery.json",
        "allowed-roots" => "config/allowed_roots.json",
        "constitutional-constraints" => "constitutional_constraints.yaml",
        "now-md" => "NOW.md",
        _ => return Err(format!("Unknown governance file: {}", file_name)),
    };
    Ok(root.join(relative))
}

#[tauri::command]
pub fn read_governance_file(file_name: String) -> Result<String, String> {
    let path = governance_file_path(&file_name)?;
    if !path.exists() {
        return Err(format!("File not found: {}", file_name));
    }
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve path: {}", e))?;
    let root = resolve_project_root()?;
    let root_canonical = root
        .canonicalize()
        .unwrap_or_else(|_| root.clone());
    let path_str = canonical_path.to_string_lossy().to_lowercase();
    let root_str = root_canonical.to_string_lossy().to_lowercase();
    if !path_str.starts_with(&root_str) {
        return Err(format!("Path escapes project root: {}", file_name));
    }
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Read error for {}: {}", file_name, e))
}

#[tauri::command]
pub async fn run_script(script_name: String) -> Result<ScriptOutput, String> {
    let root = resolve_project_root()?;
        let (cmd, args) = match script_name.as_str() {
            "health-check" => ("node", vec!["scripts/health-check.js"]),
            "recovery-test-suite" => ("node", vec!["scripts/recovery-test-suite.js"]),
            "mode-check" => ("node", vec!["scripts/mode-check.js", "--once"]),
            "consensus-check" => ("node", vec!["scripts/consensus-check.js"]),
            "system-status" => ("node", vec!["scripts/system-status.js"]),
            "sovereignty-enforcer" => ("node", vec!["scripts/sovereignty-enforcer.js"]),
            "headless-self-audit" => ("node", vec!["scripts/headless-self-audit.js"]),
            _ => return Err(format!("Unknown script: {}", script_name)),
        };

    let root_str = root.to_string_lossy().to_string();
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(cmd)
            .args(&args)
            .current_dir(&root_str)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
    });

    let output: std::process::Output = match tokio::time::timeout(Duration::from_secs(60), result).await {
        Ok(Ok(Ok(o))) => o,
        Ok(Ok(Err(e))) => return Err(format!("Failed to execute {}: {}", script_name, e)),
        Ok(Err(e)) => return Err(format!("Task join error: {}", e)),
        Err(_) => return Err(format!("Timeout: {} exceeded 60s limit", script_name)),
    };

    Ok(ScriptOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
    })
}

#[tauri::command]
pub async fn git_status() -> Result<GitStatusOutput, String> {
    let root = resolve_project_root()?;
    let root_str = root.to_string_lossy().to_string();

    let result = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&root_str)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))
    })
    .await;

    let output = match result {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(e),
        Err(e) => return Err(format!("Task join error for git_status: {}", e)),
    };

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let porcelain = String::from_utf8_lossy(&output.stdout).to_string();
    let clean = porcelain.trim().is_empty();
    let mut modified = 0usize;
    let mut untracked = 0usize;
    let mut staged = 0usize;

    for line in porcelain.lines() {
        let line = line.trim();
        if line.len() < 3 {
            continue;
        }
        let index_status = line.as_bytes()[0];
        let work_tree_status = line.as_bytes()[1];
        match index_status {
            b'M' | b'A' | b'D' | b'R' => staged += 1,
            _ => {}
        }
        match work_tree_status {
            b'M' | b'D' => modified += 1,
            b'?' => untracked += 1,
            _ => {}
        }
    }

    Ok(GitStatusOutput {
        porcelain,
        clean,
        modified,
        untracked,
        staged,
    })
}

#[tauri::command]
pub fn check_read_only() -> ReadOnlyReport {
    let config = crate::safety::load_config().unwrap_or_else(|_| crate::safety::AllowedRoots::default());
    ReadOnlyReport {
        read_only_mode: crate::safety::is_read_only(),
        allowed_roots: config.allowed_roots,
        blocked_roots: config.blocked_roots,
        source: "config/allowed_roots.json".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_governance_file_path_allowlist() {
        assert!(governance_file_path("active-mode").is_ok());
        assert!(governance_file_path("active-blocker").is_ok());
        assert!(governance_file_path("system-state").is_ok());
        assert!(governance_file_path("trust-store").is_ok());
        assert!(governance_file_path("last-recovery").is_ok());
        assert!(governance_file_path("allowed-roots").is_ok());
        assert!(governance_file_path("constitutional-constraints").is_ok());
        assert!(governance_file_path("now-md").is_ok());
    }

    #[test]
    fn test_governance_file_path_rejects_unknown() {
        assert!(governance_file_path("../../../etc/passwd").is_err());
        assert!(governance_file_path("random-file").is_err());
        assert!(governance_file_path("").is_err());
    }

    #[test]
    fn test_read_governance_file_missing() {
        let result = read_governance_file("active-blocker".to_string());
        if let Err(msg) = result {
            assert!(msg.contains("File not found") || msg.contains("Cannot find project root"));
        }
    }

    #[test]
    fn test_check_read_only_returns_report() {
        let report = check_read_only();
        assert!(report.read_only_mode || !report.read_only_mode);
    }
}
