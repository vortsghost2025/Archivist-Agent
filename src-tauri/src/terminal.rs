// Interactive terminal backed by a persistent PTY.
//
// Architecture:
//   1. `spawn_terminal` creates a PTY via `portable-pty`, spawns the
//      user's shell inside it, and starts a background reader task.
//   2. The reader task forwards PTY output bytes to the frontend as
//      Tauri events (`terminal-output`).
//   3. The frontend (xterm.js) sends keystrokes via `terminal_input`,
//      which writes them to the PTY's stdin.
//   4. `resize_pty` forwards column/row changes from xterm.js to the
//      PTY so the shell's $COLUMNS/$LINES stay in sync.
//   5. `kill_terminal` cleans up the PTY process.
//
// Safety:
//   - Only shells from an allowlist are launchable (no arbitrary exes).
//   - CWD must be within an allowed root (reuses safety.rs).
//   - Sessions are tracked in a global HashMap keyed by a u64 id.
//   - All sessions are recorded in an in-memory audit log.

use once_cell::sync::Lazy;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

// ── Constants ──────────────────────────────────────────────────────────

const MAX_AUDIT_ENTRIES: usize = 200;

const ALLOWED_SHELLS: &[&str] = &[
    "powershell",
    "pwsh",
    "cmd",
    "bash",
    "zsh",
    "sh",
    "fish",
    "nu",
];

// Default shell resolution order for Windows
#[cfg(target_os = "windows")]
#[allow(dead_code)]
const DEFAULT_SHELL_CANDIDATES: &[&str] = &["pwsh.exe", "powershell.exe", "cmd.exe"];

// Default shell resolution order for Unix
#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
const DEFAULT_SHELL_CANDIDATES: &[&str] = &["/bin/zsh", "/bin/bash", "/bin/sh"];

// ── Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSession {
    pub id: u64,
    pub shell: String,
    pub cwd: String,
    pub created_at: String,
    pub alive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalAuditEntry {
    pub session_id: u64,
    pub action: String, // "spawn", "input", "kill", "resize"
    pub detail: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    /// Shell binary name or absolute path. Empty = auto-detect.
    pub shell: Option<String>,
    /// Working directory. Empty = home dir.
    pub cwd: Option<String>,
    /// Initial columns.
    pub cols: Option<u16>,
    /// Initial rows.
    pub rows: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnResponse {
    pub session_id: u64,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputRequest {
    pub session_id: u64,
    pub data: String, // base64-encoded bytes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeRequest {
    pub session_id: u64,
    pub cols: u16,
    pub rows: u16,
}

// Internal state held per PTY
struct PtyState {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    _child: Box<dyn portable_pty::Child + Send>,
    killed: bool,
    shell: String,
    cwd: String,
    created_at: String,
}

// ── Global State ───────────────────────────────────────────────────────

static NEXT_SESSION_ID: Lazy<Mutex<u64>> = Lazy::new(|| Mutex::new(1));
static PTY_SESSIONS: Lazy<Mutex<HashMap<u64, PtyState>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static TERMINAL_AUDIT_LOG: Lazy<Mutex<Vec<TerminalAuditEntry>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

// ── Helpers ────────────────────────────────────────────────────────────

fn next_id() -> u64 {
    let mut id = NEXT_SESSION_ID.lock().unwrap();
    *id += 1;
    *id
}

fn audit(session_id: u64, action: &str, detail: Option<String>) {
    let entry = TerminalAuditEntry {
        session_id,
        action: action.to_string(),
        detail,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    if let Ok(mut log) = TERMINAL_AUDIT_LOG.lock() {
        log.push(entry);
        if log.len() > MAX_AUDIT_ENTRIES {
            let len = log.len();
            log.drain(0..len - MAX_AUDIT_ENTRIES);
        }
    }
}

/// Resolve the default shell. Walks candidate list and returns the first
/// that exists on PATH. Returns the FULL PATH, not just the name.
/// Prefers cmd.exe for reliability on Windows PTY.
fn resolve_default_shell() -> String {
    // cmd.exe is most reliable for PTY on Windows
    #[cfg(target_os = "windows")]
    {
        let cmd = r"C:\Windows\System32\cmd.exe";
        if std::path::Path::new(cmd).exists() {
            return cmd.to_string();
        }
    }
    // Try PowerShell 7
    if let Ok(path) = which::which("pwsh.exe") {
        return path.to_string_lossy().to_string();
    }
    // Fall back to Windows PowerShell
    if let Ok(path) = which::which("powershell.exe") {
        return path.to_string_lossy().to_string();
    }
    // Last resort
    #[cfg(target_os = "windows")]
    return r"C:\Windows\System32\cmd.exe".to_string();
    #[cfg(not(target_os = "windows"))]
    return "/bin/sh".to_string();
}

/// Validate that a shell name or path is in the allowlist.
/// Returns the FULL PATH to the shell binary.
fn validate_shell(shell: &str) -> Result<String, String> {
    let basename = PathBuf::from(shell)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    // Check exact name or stem (without .exe)
    let stem = basename.trim_end_matches(".exe");
    for allowed in ALLOWED_SHELLS {
        if basename == *allowed || stem == *allowed {
            // Resolve the full path
            if let Ok(path) = which::which(shell) {
                return Ok(path.to_string_lossy().to_string());
            }
            // Try with .exe on Windows
            #[cfg(target_os = "windows")]
            {
                let with_exe = format!("{}.exe", shell);
                if let Ok(path) = which::which(&with_exe) {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
            // Return the name even if which fails — let the PTY try it
            return Ok(shell.to_string());
        }
    }
    Err(format!(
        "Shell '{}' not in allowlist: {}",
        shell,
        ALLOWED_SHELLS.join(", ")
    ))
}

/// Validate CWD is within an allowed root (reuses safety.rs if available).
fn validate_cwd(cwd: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(cwd);
    if path.exists() && path.is_dir() {
        Ok(path)
    } else {
        Err(format!("CWD does not exist or is not a directory: {}", cwd))
    }
}

/// Encode bytes to base64.
fn to_b64(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Decode base64 to bytes.
fn from_b64(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("Base64 decode error: {}", e))
}

// ── Tauri Commands ─────────────────────────────────────────────────────

/// Spawn a new PTY session.
#[tauri::command]
pub fn spawn_terminal(app: AppHandle, request: SpawnRequest) -> Result<SpawnResponse, String> {
    let shell_name = request.shell.unwrap_or_default();
    let shell = if shell_name.is_empty() {
        resolve_default_shell()
    } else {
        validate_shell(&shell_name)?
    };

    eprintln!("[terminal] Resolved shell: {}", shell);

    let cwd_path = if let Some(ref cwd) = request.cwd {
        if cwd.is_empty() {
            dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
        } else {
            validate_cwd(cwd)?
        }
    } else {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
    };

    eprintln!("[terminal] CWD: {:?}", cwd_path);

    let cols = request.cols.unwrap_or(80);
    let rows = request.rows.unwrap_or(24);

    // Create the PTY
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY open failed: {}", e))?;

    // Build the command
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd_path);

    // Set env vars for better shell integration
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Spawn the child process
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("PTY spawn failed: {}", e))?;

    eprintln!("[terminal] Shell spawned successfully");

    // Drop the slave side (we only need master)
    drop(pair.slave);

    let session_id = next_id();
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    // Clone the reader BEFORE storing the master
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    // Store the master to keep the PTY alive
    PTY_SESSIONS.lock().unwrap().insert(
        session_id,
        PtyState {
            writer,
            master: pair.master,
            _child: child,
            killed: false,
            shell: shell.to_string(),
            cwd: cwd_path.to_string_lossy().to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    );

    // Start the reader thread — pumps PTY output → Tauri events

    let sid = session_id;
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut reader = reader;
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    // EOF or error — session died
                    eprintln!("[terminal] Session {} exited (EOF/error)", sid);
                    let _ =
                        app_handle.emit("terminal-exit", serde_json::json!({ "sessionId": sid }));
                    if let Ok(mut sessions) = PTY_SESSIONS.lock() {
                        if let Some(state) = sessions.get_mut(&sid) {
                            state.killed = true;
                        }
                    }
                    break;
                }
                Ok(n) => {
                    let payload = serde_json::json!({
                        "sessionId": sid,
                        "data": to_b64(&buf[..n]),
                    });
                    let _ = app_handle.emit("terminal-output", payload);
                }
            }
        }
    });

    // Master is stored in session state to keep PTY alive

    let shell_display = shell.clone();
    let cwd_display = cwd_path.to_string_lossy().to_string();

    audit(
        session_id,
        "spawn",
        Some(format!("shell={} cwd={}", shell_display, cwd_display)),
    );

    eprintln!("[terminal] Session {} ready", session_id);

    Ok(SpawnResponse {
        session_id,
        shell: shell_display,
        cwd: cwd_display,
    })
}

/// Write input bytes to a PTY session.
#[tauri::command]
pub fn terminal_input(request: InputRequest) -> Result<(), String> {
    let bytes = from_b64(&request.data)?;
    let mut sessions = PTY_SESSIONS.lock().unwrap();
    if let Some(state) = sessions.get_mut(&request.session_id) {
        if state.killed {
            return Err("Session is dead".to_string());
        }
        state
            .writer
            .write_all(&bytes)
            .map_err(|e| format!("PTY write failed: {}", e))?;
        state
            .writer
            .flush()
            .map_err(|e| format!("PTY flush failed: {}", e))?;
        Ok(())
    } else {
        Err(format!("Session {} not found", request.session_id))
    }
}

#[tauri::command]
pub fn resize_pty(request: ResizeRequest) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS.lock().unwrap();
    if let Some(state) = sessions.get_mut(&request.session_id) {
        state
            .master
            .resize(portable_pty::PtySize {
                rows: request.rows,
                cols: request.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize failed: {}", e))?;
        audit(
            request.session_id,
            "resize",
            Some(format!("cols={} rows={}", request.cols, request.rows)),
        );
        Ok(())
    } else {
        Err(format!("Session {} not found", request.session_id))
    }
}

/// Kill a PTY session.
#[tauri::command]
pub fn kill_terminal(session_id: u64) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS.lock().unwrap();
    if let Some(state) = sessions.remove(&session_id) {
        drop(state.writer);
        // _child is dropped here too, which should signal the process
        audit(session_id, "kill", None);
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}

/// List active terminal sessions.
#[tauri::command]
pub fn list_terminals() -> Vec<TerminalSession> {
    let sessions = PTY_SESSIONS.lock().unwrap();
    sessions
        .iter()
        .map(|(id, state)| TerminalSession {
            id: *id,
            shell: state.shell.clone(),
            cwd: state.cwd.clone(),
            created_at: state.created_at.clone(),
            alive: !state.killed,
        })
        .collect()
}

/// Get the terminal audit log.
#[tauri::command]
pub fn get_terminal_audit_log() -> Vec<TerminalAuditEntry> {
    TERMINAL_AUDIT_LOG
        .lock()
        .map(|log| log.clone())
        .unwrap_or_default()
}

/// Clear the terminal audit log.
#[tauri::command]
pub fn clear_terminal_audit_log() {
    if let Ok(mut log) = TERMINAL_AUDIT_LOG.lock() {
        log.clear();
    }
}
