use crate::safety::validate_path;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

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
            FileBucket::Runtime => "Runtime",
            FileBucket::Interface => "Interface",
            FileBucket::Memory => "Memory",
            FileBucket::Verification => "Verification",
            FileBucket::Research => "Research",
            FileBucket::Unknown => "Unknown",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassifiedFile {
    pub path: String,
    pub name: String,
    pub bucket: String,
    pub confidence: f32,
    pub reason: String,
    pub size_bytes: u64,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderSummary {
    pub root: String,
    pub total_files: usize,
    pub buckets: HashMap<String, Vec<ClassifiedFile>>,
    pub bucket_counts: HashMap<String, usize>,
    pub unclassified_count: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn summarize_folder(root_path: String) -> Result<FolderSummary, String> {
    let path = PathBuf::from(&root_path);

    validate_path(&path).map_err(|e| format!("Path validation failed: {}", e))?;

    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }

    let mut all_files = Vec::new();
    let mut errors = Vec::new();

    collect_files(&path, &mut all_files, &mut errors);

    let total_files = all_files.len();
    let mut buckets: HashMap<String, Vec<ClassifiedFile>> = HashMap::new();

    for bucket in &[
        "Runtime",
        "Interface",
        "Memory",
        "Verification",
        "Research",
        "Unknown",
    ] {
        buckets.insert(bucket.to_string(), Vec::new());
    }

    for file_path in all_files {
        let classified = classify_file(&file_path);
        let bucket_name = classified.bucket.clone();
        buckets.entry(bucket_name).or_default().push(classified);
    }

    let mut bucket_counts = HashMap::new();
    let mut unclassified_count = 0;

    for (name, files) in &buckets {
        let count = files.len();
        bucket_counts.insert(name.clone(), count);
        if name == "Unknown" {
            unclassified_count = count;
        }
    }

    Ok(FolderSummary {
        root: root_path,
        total_files,
        buckets,
        bucket_counts,
        unclassified_count,
        errors,
    })
}

fn collect_files(dir: &PathBuf, files: &mut Vec<PathBuf>, errors: &mut Vec<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            errors.push(format!("Cannot read {}: {}", dir.display(), e));
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if path.is_dir() {
            if !name_str.starts_with('.')
                && name_str != "node_modules"
                && name_str != "target"
                && name_str != "__pycache__"
                && name_str != ".git"
            {
                collect_files(&path, files, errors);
            }
        } else {
            files.push(path);
        }
    }
}

fn classify_file(path: &PathBuf) -> ClassifiedFile {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let name_lower = name.to_lowercase();

    let (bucket, confidence, reason) = if is_verification_file(&name_lower, &extension) {
        (
            FileBucket::Verification,
            0.9,
            "Filename or path contains test/spec indicators".to_string(),
        )
    } else if is_interface_file(&extension) {
        (
            FileBucket::Interface,
            0.95,
            format!(".{} is a UI/frontend file type", extension),
        )
    } else if is_research_file(&extension, &name_lower) {
        (
            FileBucket::Research,
            0.9,
            format!(".{} is a research/document file type", extension),
        )
    } else if is_memory_file(&extension, &name_lower) {
        (
            FileBucket::Memory,
            0.85,
            format!("{} is a project memory/config file", name),
        )
    } else if is_runtime_file(&extension) {
        (
            FileBucket::Runtime,
            0.9,
            format!(".{} is a runtime/executable file type", extension),
        )
    } else {
        (
            FileBucket::Unknown,
            0.5,
            format!("No classification rule matched .{}", extension),
        )
    };

    ClassifiedFile {
        path: path.to_string_lossy().to_string(),
        name,
        bucket: bucket.as_str().to_string(),
        confidence,
        reason,
        size_bytes,
        extension,
    }
}

fn is_verification_file(name_lower: &str, ext: &str) -> bool {
    name_lower.contains("test")
        || name_lower.contains("spec")
        || name_lower.contains("_test.")
        || name_lower.contains(".test.")
        || name_lower.contains(".spec.")
        || ext == "feature"
        || (ext == "py" && name_lower.starts_with("test_"))
        || (ext == "py" && name_lower.ends_with("_test.py"))
}

fn is_interface_file(ext: &str) -> bool {
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

fn is_research_file(ext: &str, name_lower: &str) -> bool {
    matches!(
        ext,
        "pdf" | "docx" | "doc" | "pptx" | "ppt" | "xlsx" | "xls"
    ) || ext == "ipynb"
        || name_lower.ends_with(".nb")
        || matches!(ext, "tex" | "bib")
        || matches!(ext, "epub" | "mobi")
}

fn is_memory_file(ext: &str, name_lower: &str) -> bool {
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

fn is_runtime_file(ext: &str) -> bool {
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
