use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllowedRoots {
    pub allowed_roots: Vec<String>,
    pub blocked_roots: Vec<String>,
}

impl Default for AllowedRoots {
    fn default() -> Self {
        Self {
            allowed_roots: vec![],
            blocked_roots: vec!["C:\\Windows".to_string(), "C:\\Program Files".to_string()],
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

pub fn validate_path(path: &Path) -> Result<(), SafetyError> {
    let path_str = path.to_string_lossy();
    if path_str.contains("..") {
        return Err(SafetyError::PathTraversal(path_str.to_string()));
    }

    let allowed_roots = load_config();

    match allowed_roots {
        Ok(roots) if !roots.allowed_roots.is_empty() => {
            let canonical = if path.exists() {
                path.canonicalize()
                    .map_err(|e| SafetyError::InvalidPath(e.to_string()))?
            } else {
                if let Some(parent) = path.parent() {
                    if parent.exists() {
                        parent
                            .canonicalize()
                            .map_err(|e| SafetyError::InvalidPath(e.to_string()))?
                    } else {
                        PathBuf::from(path)
                    }
                } else {
                    PathBuf::from(path)
                }
            };

            let is_allowed = roots.allowed_roots.iter().any(|root| {
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
        Ok(_) | Err(_) => Ok(()),
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

    #[test]
    fn test_path_traversal_blocked() {
        let path = Path::new("/some/path/../../../etc/passwd");
        let result = validate_path(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_path_no_config() {
        let tmp = tempfile::TempDir::new().unwrap();
        let result = validate_path(tmp.path());
        assert!(result.is_ok());
    }
}
