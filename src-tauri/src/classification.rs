//! Shared 6-bucket classification module (single source of truth).
//!
//! Provides both file-level and directory-level classification using the
//! canonical priority order: Verification > Interface > Research > Memory > Runtime > Unknown.
//!
//! Consumers: summarize_folder.rs, build_index.rs, build_registry.rs, generate_handoff.rs

use crate::constants::{bucket, confidence};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// ---------------------------------------------------------------------------
// File-level classification
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum FileBucket {
    Runtime,
    Interface,
    Memory,
    Verification,
    Research,
    Unknown,
}

impl FileBucket {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileBucket::Runtime => bucket::RUNTIME,
            FileBucket::Interface => bucket::INTERFACE,
            FileBucket::Memory => bucket::MEMORY,
            FileBucket::Verification => bucket::VERIFICATION,
            FileBucket::Research => bucket::RESEARCH,
            FileBucket::Unknown => bucket::UNKNOWN,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClassifiedFile {
    pub path: String,
    pub name: String,
    pub bucket: String,
    pub confidence: f32,
    pub reason: String,
    pub size_bytes: u64,
    pub extension: String,
}

/// Classify a single file by its path, extension, and name.
/// Canonical priority: Verification > Interface > Research > Memory > Runtime > Unknown.
pub fn classify_file(path: &Path) -> ClassifiedFile {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let size_bytes = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let name_lower = name.to_lowercase();

    let (file_bucket, conf, reason) = if is_verification_file(&name_lower, &extension) {
        (
            FileBucket::Verification,
            confidence::MEDIUM,
            "Filename or path contains test/spec indicators".to_string(),
        )
    } else if is_interface_file(&extension) {
        (
            FileBucket::Interface,
            confidence::HIGH,
            format!(".{} is a UI/frontend file type", extension),
        )
    } else if is_research_file(&extension, &name_lower) {
        (
            FileBucket::Research,
            confidence::MEDIUM,
            format!(".{} is a research/document file type", extension),
        )
    } else if is_memory_file(&extension, &name_lower) {
        (
            FileBucket::Memory,
            confidence::LOW,
            format!("{} is a project memory/config file", name),
        )
    } else if is_runtime_file(&extension) {
        (
            FileBucket::Runtime,
            confidence::MEDIUM,
            format!(".{} is a runtime/executable file type", extension),
        )
    } else {
        (
            FileBucket::Unknown,
            confidence::DEFAULT,
            format!("No classification rule matched .{}", extension),
        )
    };

    ClassifiedFile {
        path: path.to_string_lossy().to_string(),
        name,
        bucket: file_bucket.as_str().to_string(),
        confidence: conf,
        reason,
        size_bytes,
        extension,
    }
}

// ---------------------------------------------------------------------------
// Directory-level classification
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirClassification {
    pub bucket: String,
    pub summary: String,
    pub key_files: Vec<String>,
    pub has_code: bool,
}

/// Classify a directory by sampling its contents and checking its own name keywords.
/// Only the directory's own name (last path component) is checked, not the full path,
/// to avoid false matches from parent directories (e.g. Windows Temp folders).
/// Canonical priority: Verification > Interface > Research > Memory > Runtime > Unknown.
pub fn classify_directory(path: &Path, sample_limit: usize) -> DirClassification {
    let dir_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mut has_code = false;
    let mut key_files: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()).take(sample_limit) {
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if entry.path().is_file() {
                if entry_name.ends_with(".js")
                    || entry_name.ends_with(".ts")
                    || entry_name.ends_with(".rs")
                    || entry_name.ends_with(".py")
                    || entry_name.ends_with(".go")
                    || entry_name.ends_with(".html")
                {
                    has_code = true;
                }
                if entry_name.to_lowercase().contains("readme")
                    || entry_name.ends_with(".json")
                    || entry_name.ends_with(".md")
                    || entry_name.ends_with(".toml")
                {
                    key_files.push(entry_name);
                }
            }
        }
    }

    // Canonical priority order: Verification > Interface > Research > Memory > Runtime > Unknown
    // Only check the directory's own name, not the full path
    let (dir_bucket, summary) = if dir_name.contains("test")
        || dir_name.contains("spec")
        || dir_name.contains("bench")
    {
        (
            bucket::VERIFICATION.to_string(),
            "Tests, benchmarks, or reports".to_string(),
        )
    } else if dir_name.contains("ui") || dir_name.contains("frontend") || dir_name.contains("web") {
        if has_code {
            (
                bucket::INTERFACE.to_string(),
                "User interface or web frontend".to_string(),
            )
        } else {
            (
                bucket::UNKNOWN.to_string(),
                "Unclassified folder".to_string(),
            )
        }
    } else if dir_name.contains("research") || dir_name.contains("experiment") {
        (
            bucket::RESEARCH.to_string(),
            "Experiments or theoretical work".to_string(),
        )
    } else if dir_name.contains("logs") || dir_name.contains("cache") || dir_name.contains("temp") {
        (
            bucket::MEMORY.to_string(),
            "Logs, documentation, or state".to_string(),
        )
    } else if has_code {
        (
            bucket::RUNTIME.to_string(),
            "Executable code or project".to_string(),
        )
    } else {
        (
            bucket::UNKNOWN.to_string(),
            "Unclassified folder".to_string(),
        )
    };

    DirClassification {
        bucket: dir_bucket,
        summary,
        key_files,
        has_code,
    }
}

// ---------------------------------------------------------------------------
// Public predicate functions
// ---------------------------------------------------------------------------

pub fn is_verification_file(name_lower: &str, ext: &str) -> bool {
    name_lower.contains("test")
        || name_lower.contains("spec")
        || name_lower.contains("_test.")
        || name_lower.contains(".test.")
        || name_lower.contains(".spec.")
        || ext == "feature"
        || (ext == "py" && name_lower.starts_with("test_"))
        || (ext == "py" && name_lower.ends_with("_test.py"))
}

pub fn is_interface_file(ext: &str) -> bool {
    matches!(
        ext,
        "html"
            | "htm"
            | "css"
            | "scss"
            | "sass"
            | "less"
            | "jsx"
            | "tsx"
            | "vue"
            | "svelte"
            | "astro"
            | "hbs"
            | "handlebars"
            | "ejs"
            | "pug"
    )
}

pub fn is_research_file(ext: &str, name_lower: &str) -> bool {
    matches!(
        ext,
        "pdf" | "docx" | "doc" | "pptx" | "ppt" | "xlsx" | "xls"
    ) || ext == "ipynb"
        || name_lower.ends_with(".nb")
        || matches!(ext, "tex" | "bib")
        || matches!(ext, "epub" | "mobi")
}

pub fn is_memory_file(ext: &str, name_lower: &str) -> bool {
    matches!(ext, "md" | "mdx" | "rst" | "txt" | "org")
        || matches!(
            ext,
            "json" | "yaml" | "yml" | "toml" | "ini" | "cfg" | "conf"
        )
        || matches!(
            name_lower,
            "readme"
                | "changelog"
                | "license"
                | "contributing"
                | "makefile"
                | "dockerfile"
                | ".env"
                | ".gitignore"
                | "spec.md"
                | "handoff.md"
        )
        || name_lower.ends_with(".lock")
        || name_lower == "cargo.lock"
        || name_lower == "package-lock.json"
}

pub fn is_runtime_file(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "c"
            | "cpp"
            | "cc"
            | "h"
            | "hpp"
            | "java"
            | "kt"
            | "scala"
            | "clj"
            | "py"
            | "rb"
            | "lua"
            | "pl"
            | "php"
            | "js"
            | "mjs"
            | "cjs"
            | "ts"
            | "sh"
            | "bash"
            | "zsh"
            | "fish"
            | "ps1"
            | "bat"
            | "cmd"
            | "go"
            | "swift"
            | "dart"
            | "zig"
            | "exe"
            | "dll"
            | "so"
            | "dylib"
            | "wasm"
            | "class"
            | "pyc"
            | "o"
    )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // -- File-level classification tests (migrated from summarize_folder.rs) --

    #[test]
    fn test_classify_rust_file() {
        let path = PathBuf::from("src/main.rs");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Runtime");
    }

    #[test]
    fn test_classify_test_file_overrides_runtime() {
        let path = PathBuf::from("src/safety_test.rs");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Verification");
    }

    #[test]
    fn test_classify_html() {
        let path = PathBuf::from("ui/index.html");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Interface");
    }

    #[test]
    fn test_classify_markdown() {
        let path = PathBuf::from("README.md");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Memory");
    }

    #[test]
    fn test_classify_pdf() {
        let path = PathBuf::from("docs/paper.pdf");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Research");
    }

    #[test]
    fn test_classify_unknown() {
        let path = PathBuf::from("data/model.onnx");
        let result = classify_file(&path);
        assert_eq!(result.bucket, "Unknown");
    }

    #[test]
    fn test_verification_patterns() {
        assert!(is_verification_file("test_safety.rs", "rs"));
        assert!(is_verification_file("safety.test.js", "js"));
        assert!(is_verification_file("safety.spec.ts", "ts"));
        assert!(is_verification_file("test_main.py", "py"));
    }

    // -- FileBucket::as_str roundtrip test --

    #[test]
    fn test_file_bucket_as_str_roundtrip() {
        assert_eq!(FileBucket::Runtime.as_str(), "Runtime");
        assert_eq!(FileBucket::Interface.as_str(), "Interface");
        assert_eq!(FileBucket::Memory.as_str(), "Memory");
        assert_eq!(FileBucket::Verification.as_str(), "Verification");
        assert_eq!(FileBucket::Research.as_str(), "Research");
        assert_eq!(FileBucket::Unknown.as_str(), "Unknown");
    }

    // -- Predicate coverage tests --

    #[test]
    fn test_interface_file_extensions() {
        assert!(is_interface_file("html"));
        assert!(is_interface_file("css"));
        assert!(is_interface_file("jsx"));
        assert!(is_interface_file("tsx"));
        assert!(is_interface_file("vue"));
        assert!(is_interface_file("svelte"));
        assert!(!is_interface_file("rs"));
        assert!(!is_interface_file("json"));
    }

    #[test]
    fn test_research_file_extensions() {
        assert!(is_research_file("pdf", ""));
        assert!(is_research_file("docx", ""));
        assert!(is_research_file("ipynb", ""));
        assert!(is_research_file("tex", ""));
        assert!(!is_research_file("rs", ""));
        assert!(!is_research_file("md", ""));
    }

    #[test]
    fn test_memory_file_extensions() {
        assert!(is_memory_file("md", ""));
        assert!(is_memory_file("json", ""));
        assert!(is_memory_file("yaml", ""));
        assert!(is_memory_file("", "readme"));
        assert!(is_memory_file("", "changelog"));
        assert!(is_memory_file("", ".gitignore"));
        assert!(!is_memory_file("rs", ""));
        assert!(!is_memory_file("html", ""));
    }

    #[test]
    fn test_runtime_file_extensions() {
        assert!(is_runtime_file("rs"));
        assert!(is_runtime_file("py"));
        assert!(is_runtime_file("js"));
        assert!(is_runtime_file("ts"));
        assert!(is_runtime_file("go"));
        assert!(is_runtime_file("exe"));
        assert!(!is_runtime_file("html"));
        assert!(!is_runtime_file("md"));
    }

    #[test]
    fn test_verification_edge_cases() {
        assert!(is_verification_file("my.feature", "feature"));
        assert!(is_verification_file("test_foo.py", "py"));
        assert!(is_verification_file("bar_test.py", "py"));
        assert!(!is_verification_file("main.rs", "rs"));
        assert!(!is_verification_file("index.html", "html"));
    }

    // -- Directory-level classification tests --

    #[test]
    fn test_classify_directory_test_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test-suite");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Verification");
    }

    #[test]
    fn test_classify_directory_ui_folder_with_code() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("ui-components");
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("app.js"), "").unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Interface");
        assert!(result.has_code);
    }

    #[test]
    fn test_classify_directory_ui_folder_without_code() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("ui-assets");
        fs::create_dir_all(&path).unwrap();
        // No code files — just a png
        fs::write(path.join("logo.png"), "").unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Unknown");
    }

    #[test]
    fn test_classify_directory_research_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("research-papers");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Research");
    }

    #[test]
    fn test_classify_directory_logs_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("logs-output");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Memory");
    }

    #[test]
    fn test_classify_directory_code_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("my-project");
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("main.rs"), "").unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Runtime");
        assert!(result.has_code);
    }

    #[test]
    fn test_classify_directory_empty_unknown() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("random-folder");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Unknown");
        assert!(!result.has_code);
    }

    #[test]
    fn test_classify_directory_collects_key_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("some-project");
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("README.md"), "").unwrap();
        fs::write(path.join("package.json"), "").unwrap();
        fs::write(path.join("main.rs"), "").unwrap();
        let result = classify_directory(&path, 10);
        assert!(result.key_files.len() >= 2);
        assert!(result.key_files.iter().any(|f| f.contains("README")));
        assert!(result.key_files.iter().any(|f| f.contains("package.json")));
    }

    #[test]
    fn test_classify_directory_bench_is_verification() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bench-suite");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Verification");
    }

    #[test]
    fn test_classify_directory_temp_is_memory() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("temp-data");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Memory");
    }

    #[test]
    fn test_classify_directory_experiment_is_research() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("experiment-42");
        fs::create_dir_all(&path).unwrap();
        let result = classify_directory(&path, 10);
        assert_eq!(result.bucket, "Research");
    }
}
