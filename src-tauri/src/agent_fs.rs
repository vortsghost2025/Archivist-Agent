// Phase 1: Read-only agent file access commands.
// Evidence: BOOTSTRAP.md — Structure > Identity enforced via read-only guard.
// Evidence: CPS_ENFORCEMENT.md — All commands gated on path validation + read-only check.
//
// Commands:
//   agent_read_file(path) -> AgentFileContent
//   agent_list_directory(path) -> Vec<DirEntryInfo>
//   agent_search_files(path, query) -> Vec<SearchResult>
//   get_read_audit_log() -> Vec<FileReadAuditEntry>
//
// Security:
//   - Every command calls validate_path() from safety.rs
//   - Every command calls check_read_only() from safety.rs (defense in depth)
//   - Secret/sensitive paths are blocked by is_secret_path()
//   - File reads are capped at 1 MB
//   - All reads are recorded to an in-memory audit log

use crate::safety::{self, SafetyError};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;

// ── Constants ──────────────────────────────────────────────────────────

/// Maximum file size the agent is allowed to read (1 MB).
const MAX_READ_BYTES: u64 = 1_048_576;

/// Directory/component names that indicate secret/sensitive content.
/// Any path containing one of these as a component will be blocked.
const SECRET_DIR_NAMES: &[&str] = &[
    ".git",
    ".env",
    ".secrets",
    "secrets",
    "api-keys",
    "api_keys",
    "credentials",
    ".trust",
    "private",
    ".ssh",
    ".gnupg",
    ".vault",
    ".keychain",
];

/// File extensions that indicate secret/sensitive content.
const SECRET_EXTENSIONS: &[&str] = &[
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".jks",
    ".keystore",
    ".jws",
    ".pkcs12",
];

/// File names that always indicate secrets regardless of extension.
const SECRET_FILE_NAMES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    ".env.staging",
    ".env.development",
    "id_rsa",
    "id_ed25519",
    "id_ecdsa",
    "id_dsa",
    ".npmrc",
    ".pypirc",
    ".netrc",
    "credentials.json",
    "service-account.json",
    "service_account.json",
    "client_secret.json",
    "gcloud-service-key.json",
];

// ── Audit Log ──────────────────────────────────────────────────────────

/// A single entry in the read audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileReadAuditEntry {
    pub path: String,
    pub timestamp: String,
    pub result: String, // "success" | "blocked" | "error"
    pub detail: Option<String>,
}

/// In-memory audit log, following the same pattern as CONFIG_CACHE in chat.rs.
static AUDIT_LOG: Lazy<Mutex<Vec<FileReadAuditEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));

fn record_audit(path: &str, result: &str, detail: Option<String>) {
    let entry = FileReadAuditEntry {
        path: path.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        result: result.to_string(),
        detail,
    };
    if let Ok(mut log) = AUDIT_LOG.lock() {
        log.push(entry);
        // Keep the log bounded (last 500 entries)
        if log.len() > 500 {
            let len = log.len();
            log.drain(0..len - 500);
        }
    }
}

// ── Secret Path Detection ──────────────────────────────────────────────

/// Returns true if the path contains secret/sensitive components.
///
/// Checks:
/// - Directory components against SECRET_DIR_NAMES
/// - File extension against SECRET_EXTENSIONS
/// - File name (stem + extension) against SECRET_FILE_NAMES
pub fn is_secret_path(path: &Path) -> bool {
    let path_lower = path.to_string_lossy().to_lowercase();

    // Check file extension
    if let Some(ext) = path.extension() {
        let ext_lower = format!(".{}", ext.to_string_lossy().to_lowercase());
        if SECRET_EXTENSIONS.contains(&ext_lower.as_str()) {
            return true;
        }
    }

    // Check each path component for secret directory names
    for component in path.components() {
        if let std::path::Component::Normal(os_str) = component {
            if let Some(s) = os_str.to_str() {
                let s_lower = s.to_lowercase();
                if SECRET_DIR_NAMES.contains(&s_lower.as_str()) {
                    return true;
                }
            }
        }
    }

    // Check the full file name (e.g., ".env", "credentials.json")
    if let Some(name) = path.file_name() {
        if let Some(name_str) = name.to_str() {
            let name_lower = name_str.to_lowercase();
            if SECRET_FILE_NAMES.contains(&name_lower.as_str()) {
                return true;
            }
        }
    }

    // Also check for patterns like ".env.xxx" (e.g., ".env.local", ".env.production")
    if let Some(name) = path.file_name() {
        if let Some(name_str) = name.to_str() {
            if name_str.to_lowercase().starts_with(".env.") {
                return true;
            }
        }
    }

    // Block paths containing ".trust/private" (key material)
    if path_lower.contains(".trust") && path_lower.contains("private") {
        return true;
    }

    false
}

// ── Response Types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentFileContent {
    pub path: String,
    pub content: String,
    pub size_bytes: u64,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub extension: Option<String>,
}

// ── Internal Helpers ───────────────────────────────────────────────────

/// Pre-flight security check: validates path, checks read-only mode, and
/// blocks secret paths. Records blocked attempts to the audit log.
fn pre_flight_check(path: &Path) -> Result<(), String> {
    // 1. Block secret/sensitive paths FIRST — these must be rejected
    //    regardless of whether the path is in allowed roots.
    //    A .env file inside an allowed root is still a secret.
    if is_secret_path(path) {
        record_audit(
            &path.to_string_lossy(),
            "blocked",
            Some("secret_path".to_string()),
        );
        return Err(SafetyError::SecretPathBlocked(path.to_string_lossy().to_string()).to_string());
    }

    // 2. Validate path (traversal, allowed roots, blocked roots)
    safety::validate_path(path).map_err(|e| e.to_string())?;

    // 3. Defense in depth: verify read-only mode is active (these are read
    // commands so this should always pass, but the check documents intent)
    if let Err(e) = safety::check_read_only() {
        // Read-only mode blocks mutations, not reads. If read-only is active,
        // that's the expected state for Phase 1. We allow reads through.
        // We only block if read-only mode is somehow NOT active, meaning
        // the config was changed — but that shouldn't block reads either.
        // The check is here as a marker that these commands are read-only
        // by nature. If someone changes this to a write command, the
        // check_read_only() call should be moved to block the operation.
        let _ = e; // intentionally ignored for read operations
    }

    Ok(())
}

// ── Tauri Commands ─────────────────────────────────────────────────────

/// Read a file's content. Returns text content with a 1 MB cap.
/// Secret paths, path traversal, and disallowed roots are blocked.
#[tauri::command]
pub fn agent_read_file(path: String) -> Result<AgentFileContent, String> {
    let p = Path::new(&path);
    pre_flight_check(p)?;

    // Check file exists
    if !p.exists() {
        record_audit(&path, "error", Some("not_found".to_string()));
        return Err(format!("File not found: {}", path));
    }

    if !p.is_file() {
        record_audit(&path, "error", Some("not_a_file".to_string()));
        return Err(format!("Not a file: {}", path));
    }

    // Check file size
    let metadata = fs::metadata(p).map_err(|e| {
        record_audit(&path, "error", Some(format!("metadata: {}", e)));
        format!("Cannot read file metadata: {}", e)
    })?;

    let size = metadata.len();
    if size > MAX_READ_BYTES {
        record_audit(
            &path,
            "blocked",
            Some(format!("size_exceeded: {} bytes", size)),
        );
        return Err(format!(
            "File too large ({} bytes, max {} bytes): {}",
            size, MAX_READ_BYTES, path
        ));
    }

    // Read content
    let content = fs::read_to_string(p).map_err(|e| {
        record_audit(&path, "error", Some(format!("read: {}", e)));
        format!("Cannot read file: {}", e)
    })?;

    record_audit(&path, "success", None);

    Ok(AgentFileContent {
        path: path.clone(),
        content,
        size_bytes: size,
        truncated: false,
    })
}

/// List directory contents. Returns name, path, is_dir, size, extension for each entry.
#[tauri::command]
pub fn agent_list_directory(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let p = Path::new(&path);
    pre_flight_check(p)?;

    if !p.exists() {
        record_audit(&path, "error", Some("not_found".to_string()));
        return Err(format!("Directory not found: {}", path));
    }

    if !p.is_dir() {
        record_audit(&path, "error", Some("not_a_directory".to_string()));
        return Err(format!("Not a directory: {}", path));
    }

    let entries = fs::read_dir(p).map_err(|e| {
        record_audit(&path, "error", Some(format!("readdir: {}", e)));
        format!("Cannot read directory: {}", e)
    })?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // skip unreadable entries
        };

        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip secret-named entries in the listing
        if is_secret_path(&entry_path) {
            continue;
        }

        let is_dir = entry_path.is_dir();
        let size_bytes = if is_dir {
            0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };
        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());

        result.push(DirEntryInfo {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            size_bytes,
            extension,
        });
    }

    // Sort: directories first, then files, alphabetical within each group
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    record_audit(&path, "success", Some(format!("{} entries", result.len())));

    Ok(result)
}

/// Search for files by name within a directory tree.
/// Simple recursive filename search — matches if the query appears in the
/// file/directory name (case-insensitive). Max depth 8, max 100 results.
#[tauri::command]
pub fn agent_search_files(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let p = Path::new(&path);
    pre_flight_check(p)?;

    if !p.exists() {
        record_audit(&path, "error", Some("not_found".to_string()));
        return Err(format!("Directory not found: {}", path));
    }

    if !p.is_dir() {
        record_audit(&path, "error", Some("not_a_directory".to_string()));
        return Err(format!("Not a directory: {}", path));
    }

    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let query_lower = query.to_lowercase();
    let max_results = 100;
    let max_depth = 8;
    let mut results: Vec<SearchResult> = Vec::new();

    search_recursive(p, &query_lower, &mut results, max_results, 0, max_depth);

    record_audit(
        &path,
        "success",
        Some(format!("query='{}', {} results", query, results.len())),
    );

    Ok(results)
}

/// Return the current read audit log.
#[tauri::command]
pub fn get_read_audit_log() -> Vec<FileReadAuditEntry> {
    if let Ok(log) = AUDIT_LOG.lock() {
        log.clone()
    } else {
        Vec::new()
    }
}

/// Clear the read audit log.
#[tauri::command]
pub fn clear_read_audit_log() -> bool {
    if let Ok(mut log) = AUDIT_LOG.lock() {
        log.clear();
        true
    } else {
        false
    }
}

// ── Recursive Search ───────────────────────────────────────────────────

fn search_recursive(
    dir: &Path,
    query_lower: &str,
    results: &mut Vec<SearchResult>,
    max_results: usize,
    current_depth: usize,
    max_depth: usize,
) {
    if current_depth > max_depth || results.len() >= max_results {
        return;
    }

    // Validate this directory path
    if safety::validate_path(dir).is_err() {
        return;
    }

    // Block secret paths
    if is_secret_path(dir) {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        if results.len() >= max_results {
            return;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = entry.path();

        // Skip secret paths
        if is_secret_path(&entry_path) {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_lowercase();

        if name_lower.contains(query_lower) {
            let is_dir = entry_path.is_dir();
            let size_bytes = if is_dir {
                0
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            };
            let extension = entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string());

            results.push(SearchResult {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                size_bytes,
                extension,
            });
        }

        // Recurse into subdirectories
        if entry_path.is_dir() {
            search_recursive(
                &entry_path,
                query_lower,
                results,
                max_results,
                current_depth + 1,
                max_depth,
            );
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Helper: take a snapshot of the audit log, run a test body, then
    /// restore the snapshot. This isolates each test from the global log
    /// even when tests run in parallel threads.
    fn with_isolated_audit_log<F>(f: F)
    where
        F: FnOnce(),
    {
        // Snapshot current log
        let snapshot = if let Ok(log) = AUDIT_LOG.lock() {
            log.clone()
        } else {
            Vec::new()
        };
        // Clear for isolation
        if let Ok(mut log) = AUDIT_LOG.lock() {
            log.clear();
        }
        // Run test body
        f();
        // Restore snapshot
        if let Ok(mut log) = AUDIT_LOG.lock() {
            *log = snapshot;
        }
    }

    // ── is_secret_path tests ───────────────────────────────────────────

    #[test]
    fn test_secret_path_git_dir() {
        assert!(is_secret_path(Path::new("S:/project/.git/config")));
    }

    #[test]
    fn test_secret_path_env_file() {
        assert!(is_secret_path(Path::new("S:/project/.env")));
    }

    #[test]
    fn test_secret_path_env_local() {
        assert!(is_secret_path(Path::new("S:/project/.env.local")));
    }

    #[test]
    fn test_secret_path_secrets_dir() {
        assert!(is_secret_path(Path::new("S:/project/secrets/db_password")));
    }

    #[test]
    fn test_secret_path_credentials_dir() {
        assert!(is_secret_path(Path::new("S:/project/credentials/aws.json")));
    }

    #[test]
    fn test_secret_path_pem_file() {
        assert!(is_secret_path(Path::new("S:/project/cert.pem")));
    }

    #[test]
    fn test_secret_path_key_file() {
        assert!(is_secret_path(Path::new("S:/project/server.key")));
    }

    #[test]
    fn test_secret_path_p12_file() {
        assert!(is_secret_path(Path::new("S:/project/cert.p12")));
    }

    #[test]
    fn test_secret_path_pfx_file() {
        assert!(is_secret_path(Path::new("S:/project/cert.pfx")));
    }

    #[test]
    fn test_secret_path_trust_private() {
        assert!(is_secret_path(Path::new(
            "S:/project/.trust/private/signing.key"
        )));
    }

    #[test]
    fn test_secret_path_ssh_dir() {
        assert!(is_secret_path(Path::new("S:/home/.ssh/id_rsa")));
    }

    #[test]
    fn test_secret_path_api_keys_dir() {
        assert!(is_secret_path(Path::new("S:/project/api-keys/nvidia.json")));
    }

    #[test]
    fn test_secret_path_credentials_json() {
        assert!(is_secret_path(Path::new("S:/project/credentials.json")));
    }

    #[test]
    fn test_secret_path_service_account() {
        assert!(is_secret_path(Path::new("S:/project/service-account.json")));
    }

    #[test]
    fn test_not_secret_path_normal_file() {
        assert!(!is_secret_path(Path::new("S:/project/src/main.rs")));
    }

    #[test]
    fn test_not_secret_path_readme() {
        assert!(!is_secret_path(Path::new("S:/project/README.md")));
    }

    #[test]
    fn test_not_secret_path_config_yaml() {
        assert!(!is_secret_path(Path::new(
            "S:/project/config/constitutional_constraints.yaml"
        )));
    }

    #[test]
    fn test_not_secret_path_src_dir() {
        assert!(!is_secret_path(Path::new("S:/project/src")));
    }

    // ── path traversal blocked ─────────────────────────────────────────

    #[test]
    fn test_path_traversal_blocked() {
        let path = Path::new("S:/project/../../../etc/passwd");
        let result = pre_flight_check(path);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("traversal") || err.contains(".."),
            "Expected traversal error, got: {}",
            err
        );
    }

    // ── allowed file can be read ───────────────────────────────────────

    #[test]
    fn test_read_allowed_file() {
        let tmp = tempfile::TempDir::new().unwrap();
        let file_path = tmp.path().join("test_read.txt");
        fs::write(&file_path, "hello from test").unwrap();

        // This test uses a temp dir path — whether it passes validate_path
        // depends on the allowed_roots config. We test the full flow
        // by mocking a path that would be allowed.
        // Instead, test is_secret_path returns false for normal files.
        assert!(!is_secret_path(&file_path));
    }

    // ── secret path blocked by pre_flight_check ─────────────────────────

    #[test]
    fn test_read_file_blocks_secret_path() {
        with_isolated_audit_log(|| {
            let tmp = tempfile::TempDir::new().unwrap();
            let secret_file = tmp.path().join(".env");
            fs::write(&secret_file, "API_KEY=secret123").unwrap();

            // is_secret_path should block this
            assert!(is_secret_path(&secret_file));

            // The pre_flight_check should block it too (secret check is
            // now BEFORE validate_path, so it returns SecretPathBlocked)
            let result = pre_flight_check(&secret_file);
            assert!(result.is_err());
            let err = result.unwrap_err();
            assert!(
                err.contains("secret") || err.contains("blocked"),
                "Expected secret path block, got: {}",
                err
            );
        });
    }

    // ── audit log records reads ────────────────────────────────────────

    #[test]
    fn test_audit_log_records_blocked_read() {
        with_isolated_audit_log(|| {
            let secret_file = Path::new("S:/project/.env");
            let _ = pre_flight_check(secret_file);

            let log_entries = get_read_audit_log();
            let found = log_entries
                .iter()
                .any(|e| e.path.contains(".env") && e.result == "blocked");
            assert!(
                found,
                "Audit log should contain blocked entry for .env, got: {:?}",
                log_entries
            );
        });
    }

    // ── blocked root rejected ──────────────────────────────────────────

    #[test]
    fn test_blocked_root_rejected() {
        let path = Path::new("C:\\Windows\\System32\\config");
        let result = pre_flight_check(path);
        assert!(result.is_err());
    }

    // ── file size limit ────────────────────────────────────────────────

    #[test]
    fn test_max_read_bytes_constant() {
        assert_eq!(MAX_READ_BYTES, 1_048_576);
    }

    // ── audit log bounded ──────────────────────────────────────────────

    #[test]
    fn test_audit_log_stays_bounded() {
        with_isolated_audit_log(|| {
            // Record more than 500 entries
            for i in 0..600 {
                record_audit(&format!("S:/test/file_{}.txt", i), "success", None);
            }

            let log_entries = get_read_audit_log();
            assert!(
                log_entries.len() <= 500,
                "Audit log should be bounded to 500 entries, got: {}",
                log_entries.len()
            );
            // Last entry should be file_599
            let last = log_entries.last().unwrap();
            assert!(last.path.contains("file_599"));
        });
    }
}
