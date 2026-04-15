//! Shared classification logic for Archivist Agent
//!
//! This module provides common classification functions used across
//! multiple commands to reduce code duplication.
#![allow(dead_code, unused_imports)]

use crate::constants;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Result of classifying a path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Classification {
    pub bucket: String,
    pub summary: String,
    pub key_files: Vec<String>,
}

/// Classify a directory based on its path and contents
///
/// # Arguments
/// * `path` - Path to classify
///
/// # Returns
/// * `Classification` with bucket, summary, and key files
pub fn classify_directory(path: &Path) -> Classification {
    let path_str = path.to_string_lossy().to_lowercase();

    // Check path-based patterns first
    if contains_any(&path_str, constants::VERIFICATION_PATH_PATTERNS) {
        return Classification {
            bucket: constants::bucket::VERIFICATION.to_string(),
            summary: "Tests, benchmarks, or verification code".to_string(),
            key_files: collect_key_files(path),
        };
    }

    if contains_any(&path_str, constants::MEMORY_PATH_PATTERNS) {
        return Classification {
            bucket: constants::bucket::MEMORY.to_string(),
            summary: "Logs, cache, or temporary files".to_string(),
            key_files: collect_key_files(path),
        };
    }

    if contains_any(&path_str, constants::INTERFACE_PATH_PATTERNS) {
        // Check if there's actually code in the directory
        if has_code_files(path) {
            return Classification {
                bucket: constants::bucket::INTERFACE.to_string(),
                summary: "User interface or web frontend".to_string(),
                key_files: collect_key_files(path),
            };
        }
        return Classification {
            bucket: constants::bucket::UNKNOWN.to_string(),
            summary: "UI-related path but no code found".to_string(),
            key_files: collect_key_files(path),
        };
    }

    if contains_any(&path_str, constants::RESEARCH_PATH_PATTERNS) {
        return Classification {
            bucket: constants::bucket::RESEARCH.to_string(),
            summary: "Experiments or theoretical work".to_string(),
            key_files: collect_key_files(path),
        };
    }

    // Check if directory contains code files
    if has_code_files(path) {
        return Classification {
            bucket: constants::bucket::RUNTIME.to_string(),
            summary: "Executable code or project".to_string(),
            key_files: collect_key_files(path),
        };
    }

    Classification {
        bucket: constants::bucket::UNKNOWN.to_string(),
        summary: "Unclassified folder".to_string(),
        key_files: collect_key_files(path),
    }
}

/// Classify a single file based on its name and extension
///
/// # Arguments
/// * `filename` - File name (lowercase)
/// * `extension` - File extension (lowercase, without dot)
///
/// # Returns
/// * Tuple of (bucket, confidence, reason)
pub fn classify_file(filename: &str, extension: &str) -> (&'static str, f32, String) {
    // Check for verification/test files first (highest priority)
    if is_verification_file(filename, extension) {
        return (
            constants::bucket::VERIFICATION,
            constants::confidence::MEDIUM,
            format!("Filename or extension indicates test: {}", filename),
        );
    }

    // Check interface files
    if constants::INTERFACE_EXTENSIONS.contains(&extension) {
        return (
            constants::bucket::INTERFACE,
            constants::confidence::HIGH,
            format!(".{} is a UI/frontend file type", extension),
        );
    }

    // Check research files
    if constants::RESEARCH_EXTENSIONS.contains(&extension) {
        return (
            constants::bucket::RESEARCH,
            constants::confidence::MEDIUM,
            format!(".{} is a research/document file type", extension),
        );
    }

    // Check memory files
    if is_memory_file(filename, extension) {
        return (
            constants::bucket::MEMORY,
            constants::confidence::LOW,
            format!("{} is a project memory/config file", filename),
        );
    }

    // Check runtime files
    if constants::RUNTIME_EXTENSIONS.contains(&extension) {
        return (
            constants::bucket::RUNTIME,
            constants::confidence::MEDIUM,
            format!(".{} is a runtime/executable file type", extension),
        );
    }

    // Default to unknown
    (
        constants::bucket::UNKNOWN,
        constants::confidence::DEFAULT,
        format!("No classification rule matched .{}", extension),
    )
}

/// Check if a file is a verification/test file
fn is_verification_file(filename: &str, extension: &str) -> bool {
    // Check filename patterns
    for pattern in constants::VERIFICATION_PATTERNS {
        if filename.contains(pattern) {
            return true;
        }
    }

    // Check extension-specific patterns
    if extension == "feature" {
        return true;
    }

    // Python test files
    if extension == "py" && (filename.starts_with("test_") || filename.ends_with("_test.py")) {
        return true;
    }

    false
}

/// Check if a file is a memory/config file
fn is_memory_file(filename: &str, extension: &str) -> bool {
    // Check extension
    if constants::MEMORY_EXTENSIONS.contains(&extension) {
        return true;
    }

    // Check filename
    let filename_lower = filename.to_lowercase();
    for name in constants::MEMORY_FILENAMES {
        if filename_lower == *name || filename_lower.ends_with(&format!(".{}", name)) {
            return true;
        }
    }

    // Check for lock files
    if filename_lower.ends_with(".lock") {
        return true;
    }

    false
}

/// Check if a string contains any of the given patterns
fn contains_any(s: &str, patterns: &[&str]) -> bool {
    patterns.iter().any(|p| s.contains(p))
}

/// Check if a directory contains code files
fn has_code_files(path: &Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries
            .filter_map(|e| e.ok())
            .take(constants::MAX_CLASSIFY_ENTRIES)
        {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            let ext = get_extension(&name);
            if constants::RUNTIME_EXTENSIONS.contains(&ext.as_str()) {
                return true;
            }
        }
    }
    false
}

/// Collect key files from a directory (README, config files, etc.)
fn collect_key_files(path: &Path) -> Vec<String> {
    let mut key_files = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries
            .filter_map(|e| e.ok())
            .take(constants::MAX_KEY_FILES)
        {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            if name_lower.contains("readme")
                || name_lower.ends_with(".md")
                || name_lower.ends_with(".json")
                || name_lower.ends_with(".toml")
            {
                key_files.push(name);
            }
        }
    }

    key_files
}

/// Get file extension from filename
fn get_extension(filename: &str) -> String {
    filename.rsplit('.').next().unwrap_or("").to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_classify_rust_file() {
        let (bucket, _, _) = classify_file("main.rs", "rs");
        assert_eq!(bucket, "Runtime");
    }

    #[test]
    fn test_classify_test_file() {
        let (bucket, _, _) = classify_file("safety_test.rs", "rs");
        assert_eq!(bucket, "Verification");
    }

    #[test]
    fn test_classify_html_file() {
        let (bucket, _, _) = classify_file("index.html", "html");
        assert_eq!(bucket, "Interface");
    }

    #[test]
    fn test_classify_markdown_file() {
        let (bucket, _, _) = classify_file("README.md", "md");
        assert_eq!(bucket, "Memory");
    }

    #[test]
    fn test_classify_pdf_file() {
        let (bucket, _, _) = classify_file("paper.pdf", "pdf");
        assert_eq!(bucket, "Research");
    }

    #[test]
    fn test_classify_unknown_file() {
        let (bucket, _, _) = classify_file("model.onnx", "onnx");
        assert_eq!(bucket, "Unknown");
    }

    #[test]
    fn test_verification_patterns() {
        assert!(is_verification_file("test_safety.rs", "rs"));
        assert!(is_verification_file("safety.test.js", "js"));
        assert!(is_verification_file("safety.spec.ts", "ts"));
        assert!(is_verification_file("test_main.py", "py"));
    }

    #[test]
    fn test_memory_patterns() {
        assert!(is_memory_file("README.md", "md"));
        assert!(is_memory_file("package.json", "json"));
        assert!(is_memory_file("Cargo.lock", "lock"));
        assert!(is_memory_file(".gitignore", "gitignore"));
    }

    #[test]
    fn test_has_code_files_empty_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        assert!(!has_code_files(tmp.path()));
    }

    #[test]
    fn test_has_code_files_with_code() {
        let tmp = tempfile::TempDir::new().unwrap();
        std::fs::write(tmp.path().join("main.rs"), "fn main() {}").unwrap();
        assert!(has_code_files(tmp.path()));
    }
}
