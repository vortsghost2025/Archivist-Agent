// Execute shell commands with safety gates.
// Evidence: BOOTSTRAP.md — Structure > Identity, operator consent for dangerous ops.
//
// Safety:
// - Commands are validated against a blocklist of dangerous patterns
// - Working directory must be within allowed roots
// - Execution timeout (default 30s, max 120s)
// - Output is capped at 64KB for stdout and 32KB for stderr
// - All executions are recorded to an in-memory audit log
// - Secret paths are blocked in working directory
//
// Dual-mode architecture (like agent_write):
// force=false (UI mode): Rust validates, JS spawns via tauri-plugin-shell
// force=true (agent mode): Rust validates AND spawns via std::process::Command

use crate::safety;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_SECS: u64 = 30;
const MAX_TIMEOUT_SECS: u64 = 120;
const MAX_STDOUT_BYTES: usize = 65_536;
const MAX_STDERR_BYTES: usize = 32_768;
const MAX_AUDIT_ENTRIES: usize = 200;

const BLOCKED_COMMAND_PATTERNS: &[&str] = &[
    "rm -rf /",
    "rm -rf /*",
    "del /s /q C:\\",
    "del /s /q S:\\",
    "format ",
    "mkfs.",
    "dd if=",
    "shutdown",
    "reboot",
    "init 0",
    "init 6",
    "systemctl poweroff",
    "systemctl reboot",
    "taskkill /f /im explorer",
    "reg delete",
    "reg add",
    "diskpart",
    "cipher /w",
    "sfc /scannow",
    "dism",
];

const ALLOWED_COMMAND_PREFIXES: &[&str] = &[
    "kilo ",
    "kilo>",
    "opencode ",
    "opencode>",
    "cargo ",
    "cargo>",
    "npm ",
    "npm>",
    "npx ",
    "npx>",
    "node ",
    "node>",
    "git ",
    "git>",
    "python ",
    "python3 ",
    "py ",
    "rustc ",
    "rustfmt ",
    "rustup ",
    "clippy-driver ",
    "echo ",
    "dir ",
    "ls",
    "cat ",
    "head ",
    "tail ",
    "wc ",
    "grep ",
    "find ",
    "which ",
    "where ",
    "type ",
    "pwd",
    "cd ",
    "mkdir ",
    "cp ",
    "mv ",
    "touch ",
    "chmod ",
    "stat ",
    "file ",
    "du ",
    "df ",
    "ps ",
    "tasklist",
    "cargo",
    "npm",
    "npx",
    "node",
    "git",
    "python",
    "python3",
    "rustc",
    "rustfmt",
    "rustup",
    "kilo",
    "opencode",
];

// ── Audit Log ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecAuditEntry {
    pub command: String,
    pub working_dir: Option<String>,
    pub timestamp: String,
    pub result: String,
    pub exit_code: Option<i32>,
    pub detail: Option<String>,
    pub read_only_override: bool,
}

static EXEC_AUDIT_LOG: Lazy<Mutex<Vec<ExecAuditEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));

fn record_exec_audit(
    command: &str,
    working_dir: Option<&str>,
    result: &str,
    exit_code: Option<i32>,
    detail: Option<String>,
    read_only_override: bool,
) {
    let entry = ExecAuditEntry {
        command: command.to_string(),
        working_dir: working_dir.map(|s| s.to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        result: result.to_string(),
        exit_code,
        detail,
        read_only_override,
    };
    if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
        log.push(entry);
        if log.len() > MAX_AUDIT_ENTRIES {
            let len = log.len();
            log.drain(0..len - MAX_AUDIT_ENTRIES);
        }
    }
}

// ── Response Types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecCommandResponse {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub timed_out: bool,
    pub working_dir: Option<String>,
    pub requires_consent: bool,
    pub read_only_overridden: bool,
    pub executed: bool,
}

// ── Command Validation ─────────────────────────────────────────────────

fn validate_command(command: &str) -> Result<(), String> {
    let command_trimmed = command.trim();

    if command_trimmed.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let command_lower = command_trimmed.to_lowercase();
    for pattern in BLOCKED_COMMAND_PATTERNS {
        if command_lower.contains(&pattern.to_lowercase()) {
            return Err(format!(
                "Command blocked by safety policy: contains forbidden pattern '{}'",
                pattern
            ));
        }
    }

    let starts_allowed = ALLOWED_COMMAND_PREFIXES
        .iter()
        .any(|prefix| command_trimmed.starts_with(prefix));

    if !starts_allowed {
        return Err(format!(
            "Command not in allowed list: '{}'. \
             Allowed prefixes: cargo, npm, npx, node, git, python, rustc, \
             rustfmt, rustup, echo, dir, ls, cat, head, tail, wc, grep, \
             find, which, where, type, pwd, cd, mkdir, cp, mv, touch, \
             chmod, stat, file, du, df, ps, tasklist",
            command_trimmed
        ));
    }

    Ok(())
}

fn validate_working_dir(working_dir: &str) -> Result<(), String> {
    let p = Path::new(working_dir);

    if crate::agent_fs::is_secret_path(p) {
        return Err(format!(
            "Working directory is a secret/sensitive path: {}",
            working_dir
        ));
    }

    safety::validate_path(p).map_err(|e| e.to_string())?;

    if !p.exists() {
        return Err(format!("Working directory does not exist: {}", working_dir));
    }
    if !p.is_dir() {
        return Err(format!(
            "Working directory is not a directory: {}",
            working_dir
        ));
    }

    Ok(())
}

// ── Command ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn execute_command(
    command: String,
    working_dir: Option<String>,
    timeout_secs: Option<u64>,
    force: Option<bool>,
) -> Result<ExecCommandResponse, String> {
    let force = force.unwrap_or(false);

    validate_command(&command)?;

    let working_dir_str = working_dir.clone();
    if let Some(ref wd) = working_dir {
        validate_working_dir(wd)?;
    }

    let (requires_consent, read_only_overridden) = if force {
        let read_only = safety::check_read_only().is_err();
        (false, read_only)
    } else {
        let read_only = safety::check_read_only().is_err();
        (read_only, read_only)
    };

    let timeout = timeout_secs
        .unwrap_or(DEFAULT_TIMEOUT_SECS)
        .min(MAX_TIMEOUT_SECS);

    if force {
        let result = run_command(&command, working_dir.as_deref(), timeout);

        record_exec_audit(
            &command,
            working_dir_str.as_deref(),
            if result.timed_out {
                "timeout"
            } else {
                "success"
            },
            Some(result.exit_code),
            Some(format!(
                "{} stdout bytes, {} stderr bytes [force=true]",
                result.stdout.len(),
                result.stderr.len()
            )),
            read_only_overridden,
        );

        Ok(ExecCommandResponse {
            command,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            timed_out: result.timed_out,
            working_dir: working_dir_str,
            requires_consent,
            read_only_overridden,
            executed: true,
        })
    } else {
        record_exec_audit(
            &command,
            working_dir_str.as_deref(),
            "validated",
            None,
            Some(format!("timeout={}s", timeout)),
            read_only_overridden,
        );

        Ok(ExecCommandResponse {
            command,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: -1,
            timed_out: false,
            working_dir: working_dir_str,
            requires_consent,
            read_only_overridden,
            executed: false,
        })
    }
}

// ── Internal Execution ─────────────────────────────────────────────────

struct CommandOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    timed_out: bool,
}

fn run_command(command: &str, working_dir: Option<&str>, timeout_secs: u64) -> CommandOutput {
    let (program, args) = if cfg!(windows) {
        ("cmd", vec!["/C", command])
    } else {
        ("sh", vec!["-c", command])
    };

    let mut cmd = std::process::Command::new(program);
    cmd.args(&args);

    if let Some(wd) = working_dir {
        cmd.current_dir(wd);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return CommandOutput {
                stdout: String::new(),
                stderr: format!("Failed to spawn command: {}", e),
                exit_code: -1,
                timed_out: false,
            }
        }
    };

    let timeout = Duration::from_secs(timeout_secs);
    match wait_with_timeout(child, timeout) {
        Ok(output) => {
            let exit_code = output.status.code().unwrap_or(-1);
            let stdout = truncate_bytes(&output.stdout, MAX_STDOUT_BYTES);
            let stderr = truncate_bytes(&output.stderr, MAX_STDERR_BYTES);
            CommandOutput {
                stdout,
                stderr,
                exit_code,
                timed_out: false,
            }
        }
        Err(_) => CommandOutput {
            stdout: String::new(),
            stderr: format!("Command timed out after {} seconds", timeout_secs),
            exit_code: -1,
            timed_out: true,
        },
    }
}

fn wait_with_timeout(
    mut child: std::process::Child,
    timeout: Duration,
) -> Result<std::process::Output, ()> {
    let start = std::time::Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = child.wait_with_output();
                match output {
                    Ok(o) => return Ok(o),
                    Err(_) => {
                        return Ok(std::process::Output {
                            status,
                            stdout: Vec::new(),
                            stderr: Vec::new(),
                        });
                    }
                }
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(());
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(_) => {
                return Err(());
            }
        }
    }
}

fn truncate_bytes(data: &[u8], max_len: usize) -> String {
    if data.len() <= max_len {
        String::from_utf8_lossy(data).to_string()
    } else {
        let mut truncated = String::from_utf8_lossy(&data[..max_len]).to_string();
        truncated.push_str(&format!(
            "\n\n... [truncated - {} bytes total, showing first {}]",
            data.len(),
            max_len
        ));
        truncated
    }
}

// ── Audit Log Commands ─────────────────────────────────────────────────

#[tauri::command]
pub fn get_exec_audit_log() -> Vec<ExecAuditEntry> {
    EXEC_AUDIT_LOG
        .lock()
        .map(|log| log.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_exec_audit_log() -> bool {
    if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
        log.clear();
        true
    } else {
        false
    }
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_command_blocks_dangerous_rm() {
        assert!(validate_command("rm -rf /").is_err());
        assert!(validate_command("rm -rf /*").is_err());
    }

    #[test]
    fn test_validate_command_blocks_format() {
        assert!(validate_command("format C:").is_err());
    }

    #[test]
    fn test_validate_command_blocks_shutdown() {
        assert!(validate_command("shutdown /s /t 0").is_err());
    }

    #[test]
    fn test_validate_command_blocks_reg_delete() {
        assert!(validate_command("reg delete HKLM\\Software\\Test").is_err());
    }

    #[test]
    fn test_validate_command_allows_cargo() {
        assert!(validate_command("cargo check").is_ok());
        assert!(validate_command("cargo test --lib").is_ok());
        assert!(validate_command("cargo build --release").is_ok());
        assert!(validate_command("cargo clippy").is_ok());
        assert!(validate_command("cargo fmt --check").is_ok());
    }

    #[test]
    fn test_validate_command_allows_npm() {
        assert!(validate_command("npm install").is_ok());
        assert!(validate_command("npm test").is_ok());
        assert!(validate_command("npm run build").is_ok());
    }

    #[test]
    fn test_validate_command_allows_git() {
        assert!(validate_command("git status").is_ok());
        assert!(validate_command("git add .").is_ok());
        assert!(validate_command("git commit -m \"test\"").is_ok());
        assert!(validate_command("git push").is_ok());
        assert!(validate_command("git log --oneline").is_ok());
    }

    #[test]
    fn test_validate_command_allows_node() {
        assert!(validate_command("node --version").is_ok());
        assert!(validate_command("node scripts/test.js").is_ok());
    }

    #[test]
    fn test_validate_command_allows_python() {
        assert!(validate_command("python --version").is_ok());
        assert!(validate_command("python3 -m pytest").is_ok());
    }

    #[test]
    fn test_validate_command_allows_ls() {
        assert!(validate_command("ls -la").is_ok());
        assert!(validate_command("ls").is_ok());
    }

    #[test]
    fn test_validate_command_allows_grep() {
        assert!(validate_command("grep -r \"pattern\" .").is_ok());
    }

    #[test]
    fn test_validate_command_rejects_unknown() {
        assert!(validate_command("dangerous_command --flag").is_err());
        assert!(validate_command("unknown_tool").is_err());
    }

    #[test]
    fn test_validate_command_empty_rejected() {
        assert!(validate_command("").is_err());
        assert!(validate_command("   ").is_err());
    }

    #[test]
    fn test_truncate_bytes_short() {
        let data = b"hello world";
        let result = truncate_bytes(data, 100);
        assert_eq!(result, "hello world");
        assert!(!result.contains("truncated"));
    }

    #[test]
    fn test_truncate_bytes_long() {
        let data: Vec<u8> = (0..200).map(|i| b'x' + (i % 26)).collect();
        let result = truncate_bytes(&data, 100);
        assert!(result.contains("truncated"));
        assert!(result.contains("200 bytes total"));
    }

    #[test]
    fn test_timeout_capped_at_max() {
        let timeout = 300u64;
        let capped = timeout.min(MAX_TIMEOUT_SECS);
        assert_eq!(capped, MAX_TIMEOUT_SECS);
    }

    #[test]
    fn test_default_timeout() {
        assert_eq!(DEFAULT_TIMEOUT_SECS, 30);
        assert_eq!(MAX_TIMEOUT_SECS, 120);
    }

    #[test]
    fn test_audit_log_recording() {
        if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
            log.clear();
        }
        record_exec_audit(
            "cargo test",
            Some("S:/project"),
            "success",
            Some(0),
            None,
            false,
        );
        let log = get_exec_audit_log();
        let entry = log.iter().find(|e| e.command == "cargo test");
        assert!(entry.is_some(), "Expected audit entry for cargo test");
        let e = entry.unwrap();
        assert_eq!(e.result, "success");
        assert_eq!(e.exit_code, Some(0));
        assert_eq!(e.working_dir, Some("S:/project".to_string()));
        if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
            log.clear();
        }
    }

    #[test]
    fn test_audit_log_bounded() {
        if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
            log.clear();
        }
        for i in 0..300 {
            record_exec_audit(
                &format!("cargo test {}", i),
                None,
                "success",
                Some(0),
                None,
                false,
            );
        }
        let log = get_exec_audit_log();
        assert!(
            log.len() <= MAX_AUDIT_ENTRIES,
            "Should be bounded to {}, got {}",
            MAX_AUDIT_ENTRIES,
            log.len()
        );
        if let Ok(mut log) = EXEC_AUDIT_LOG.lock() {
            log.clear();
        }
    }
}
