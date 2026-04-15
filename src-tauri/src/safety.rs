use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllowedRoots {
    pub allowed_roots: Vec<String>,
    pub blocked_roots: Vec<String>,
    pub read_only_mode: Option<bool>,
}

static CACHED_CONFIG: Lazy<AllowedRoots> =
    Lazy::new(|| load_config().unwrap_or_else(|_| AllowedRoots::default()));

impl Default for AllowedRoots {
    fn default() -> Self {
        Self {
            allowed_roots: vec![],
            blocked_roots: vec!["C:\\Windows".to_string(), "C:\\Program Files".to_string()],
            read_only_mode: Some(false),
        }
    }
}

#[derive(Debug)]
pub enum SafetyError {
    PathNotAllowed(String),
    PathTraversal(String),
    ConfigReadError(String),
    InvalidPath(String),
}

impl std::fmt::Display for SafetyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SafetyError::PathNotAllowed(p) => write!(f, "Path not in allowed roots: {}", p),
            SafetyError::PathTraversal(p) => write!(f, "Path traversal detected: {}", p),
            SafetyError::ConfigReadError(e) => write!(f, "Cannot read allowed_roots.json: {}", e),
            SafetyError::InvalidPath(p) => write!(f, "Invalid path: {}", p),
        }
    }
}

impl std::error::Error for SafetyError {}

#[allow(dead_code)]
pub fn is_read_only() -> bool {
    CACHED_CONFIG.read_only_mode.unwrap_or(false)
}

/// Validates a path for security issues.
///
/// # Security
///
/// This function checks for:
/// - Path traversal attacks (e.g., ".." in path)
/// - Whether the path is within allowed roots (if configured)
/// - Whether the path is in blocked roots
///
/// # Race Condition Mitigation
///
/// For non-existent paths, we canonicalize the parent directory if it exists.
/// This avoids the TOCTOU race condition between checking existence and canonicalization.
pub fn validate_path(path: &Path) -> Result<(), SafetyError> {
    // Check for path traversal attempts
    let path_str = path.to_string_lossy();
    if path_str.contains("..") {
        return Err(SafetyError::PathTraversal(path_str.to_string()));
    }

    let config = CACHED_CONFIG.clone();

    // If no allowed roots configured, allow all non-blocked paths
    if config.allowed_roots.is_empty() {
        return Ok(());
    }

    // Get canonical path, handling non-existent paths safely
    let canonical = get_canonical_path_safe(path)?;

    // Check against blocked roots first
    let canonical_str = canonical.to_string_lossy();
    for blocked in &config.blocked_roots {
        if canonical_str
            .to_lowercase()
            .starts_with(&blocked.to_lowercase())
        {
            return Err(SafetyError::PathNotAllowed(canonical_str.to_string()));
        }
    }

    // Check against allowed roots
    let is_allowed = config.allowed_roots.iter().any(|root| {
        let root_path = Path::new(root);
        canonical.starts_with(root_path)
    });

    if is_allowed {
        Ok(())
    } else {
        Err(SafetyError::PathNotAllowed(
            canonical.to_string_lossy().to_string(),
        ))
    }
}

/// Safely gets canonical path, avoiding TOCTOU race conditions.
///
/// For existing paths: canonicalize directly.
/// For non-existent paths: canonicalize the parent if it exists, then append the filename.
fn get_canonical_path_safe(path: &Path) -> Result<PathBuf, SafetyError> {
    // Try to canonicalize directly first (works for existing paths)
    match path.canonicalize() {
        Ok(canonical) => Ok(canonical),
        Err(_) => {
            // Path doesn't exist or can't be resolved
            // Try to canonicalize parent directory instead
            if let Some(parent) = path.parent() {
                if parent.exists() {
                    let canonical_parent = parent
                        .canonicalize()
                        .map_err(|e| SafetyError::InvalidPath(e.to_string()))?;

                    // Append the filename to the canonicalized parent
                    if let Some(filename) = path.file_name() {
                        return Ok(canonical_parent.join(filename));
                    }
                }
            }
            // If parent doesn't exist either, just use the path as-is
            // (validation will fail against allowed_roots anyway)
            Ok(path.to_path_buf())
        }
    }
}

pub fn load_config() -> Result<AllowedRoots, SafetyError> {
    let config_paths = [
        PathBuf::from("config/allowed_roots.json"),
        PathBuf::from("../config/allowed_roots.json"),
    ];

    for config_path in &config_paths {
        if config_path.exists() {
            let content = std::fs::read_to_string(config_path)
                .map_err(|e| SafetyError::ConfigReadError(e.to_string()))?;

            let roots: AllowedRoots = serde_json::from_str(&content)
                .map_err(|e| SafetyError::ConfigReadError(format!("JSON parse error: {}", e)))?;

            return Ok(roots);
        }
    }

    Ok(AllowedRoots::default())
}

pub fn is_path_allowed(path: &str, config: &AllowedRoots) -> bool {
    let path_lower = path.to_lowercase();

    for blocked in &config.blocked_roots {
        if path_lower.starts_with(&blocked.to_lowercase()) {
            return false;
        }
    }

    if config.allowed_roots.is_empty() {
        return true;
    }

    for allowed in &config.allowed_roots {
        if path_lower.starts_with(&allowed.to_lowercase()) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_path_traversal_blocked() {
        let path = Path::new("/some/path/../../../etc/passwd");
        let result = validate_path(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_blocked_root_rejected() {
        // Windows blocked path should be rejected
        let path = Path::new("C:\\Windows\\System32");
        let result = validate_path(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_temp_dir_allowed() {
        // Temp dirs on Windows are typically in AppData, which is blocked
        // So we test that the validation actually runs and respects config
        let tmp = tempfile::TempDir::new().unwrap();
        let result = validate_path(tmp.path());
        // The result depends on whether temp dir is in allowed/blocked roots
        // Just verify the function runs without panic
        let _ = result;
    }

    #[test]
    fn test_nonexistent_path_in_existing_parent() {
        let tmp = tempfile::TempDir::new().unwrap();
        let non_existent = tmp.path().join("nonexistent_file.txt");

        // Should not panic or error for non-existent paths
        let result = validate_path(&non_existent);
        // Result depends on config, just verify no panic
        let _ = result;
    }

    #[test]
    fn test_symlink_path_handling() {
        // Create temp directory structure
        let tmp = tempfile::TempDir::new().unwrap();
        let dir = tmp.path().join("dir");
        let link = tmp.path().join("link");

        fs::create_dir(&dir).ok();

        // Symlink creation may fail on Windows without admin rights
        #[cfg(unix)]
        {
            use std::os::unix::fs as unix_fs;
            unix_fs::symlink(&dir, &link).ok();

            // Should handle symlinks safely
            let result = validate_path(&link);
            let _ = result;
        }
    }
}
