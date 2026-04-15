//! Configuration constants for Archivist Agent
//!
//! This module centralizes all magic numbers and configuration values
//! to improve maintainability and allow easy tuning.

//! Maximum directory traversal depth
#[allow(dead_code)]
pub const MAX_SCAN_DEPTH: usize = 10;

/// Maximum path length allowed for input validation
#[allow(dead_code)]
pub const MAX_PATH_LENGTH: usize = 4096;

/// Maximum number of entries to read when classifying a directory
#[allow(dead_code)]
pub const MAX_CLASSIFY_ENTRIES: usize = 20;

/// Maximum number of key files to collect per directory
#[allow(dead_code)]
pub const MAX_KEY_FILES: usize = 10;

/// Classification confidence thresholds
#[allow(dead_code)]
pub mod confidence {
    pub const HIGH: f32 = 0.95;
    pub const MEDIUM: f32 = 0.90;
    pub const LOW: f32 = 0.85;
    pub const DEFAULT: f32 = 0.50;
}

/// File classification buckets
#[allow(dead_code)]
pub mod bucket {
    pub const RUNTIME: &str = "Runtime";
    pub const INTERFACE: &str = "Interface";
    pub const MEMORY: &str = "Memory";
    pub const VERIFICATION: &str = "Verification";
    pub const RESEARCH: &str = "Research";
    pub const UNKNOWN: &str = "Unknown";
}

/// Directory names to skip during scanning
#[allow(dead_code)]
pub const SKIP_DIRS: &[&str] = &[
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    ".env",
    "env",
];

/// File extensions for runtime/executable files
#[allow(dead_code)]
pub const RUNTIME_EXTENSIONS: &[&str] = &[
    "rs", "c", "cpp", "cc", "h", "hpp", "java", "kt", "scala", "clj", "py", "rb", "lua", "pl",
    "php", "js", "mjs", "cjs", "ts", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "go",
    "swift", "dart", "zig", "exe", "dll", "so", "dylib", "wasm", "class", "pyc", "o",
];

/// File extensions for UI/frontend files
#[allow(dead_code)]
pub const INTERFACE_EXTENSIONS: &[&str] = &[
    "html",
    "htm",
    "css",
    "scss",
    "sass",
    "less",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "astro",
    "hbs",
    "handlebars",
    "ejs",
    "pug",
];

/// File extensions for research/document files
#[allow(dead_code)]
pub const RESEARCH_EXTENSIONS: &[&str] = &[
    "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls", "ipynb", "tex", "bib", "epub", "mobi",
];

/// File extensions for memory/config files
#[allow(dead_code)]
pub const MEMORY_EXTENSIONS: &[&str] = &[
    "md", "mdx", "rst", "txt", "org", "json", "yaml", "yml", "toml", "ini", "cfg", "conf",
];

/// Special filenames for memory/config files
#[allow(dead_code)]
pub const MEMORY_FILENAMES: &[&str] = &[
    "readme",
    "changelog",
    "license",
    "contributing",
    "makefile",
    "dockerfile",
    ".env",
    ".gitignore",
    "spec.md",
    "handoff.md",
    "cargo.lock",
    "package-lock.json",
];

/// Patterns that indicate verification/test files
#[allow(dead_code)]
pub const VERIFICATION_PATTERNS: &[&str] = &["test", "spec", "bench", "_test", ".test.", ".spec."];

/// Path patterns for classification by directory name
#[allow(dead_code)]
pub const VERIFICATION_PATH_PATTERNS: &[&str] = &["test", "spec", "bench"];
#[allow(dead_code)]
pub const MEMORY_PATH_PATTERNS: &[&str] = &["logs", "cache", "temp"];
#[allow(dead_code)]
pub const INTERFACE_PATH_PATTERNS: &[&str] = &["ui", "frontend", "web"];
#[allow(dead_code)]
pub const RESEARCH_PATH_PATTERNS: &[&str] = &["research", "experiment"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants_are_reasonable() {
        assert!(MAX_SCAN_DEPTH > 0);
        assert!(MAX_SCAN_DEPTH <= 50); // Reasonable upper bound
        assert!(MAX_PATH_LENGTH > 260); // Windows MAX_PATH
        assert!(!SKIP_DIRS.is_empty());
        assert!(!RUNTIME_EXTENSIONS.is_empty());
    }

    #[test]
    fn test_confidence_values_in_range() {
        assert!(confidence::HIGH > confidence::MEDIUM);
        assert!(confidence::MEDIUM > confidence::LOW);
        assert!(confidence::LOW > confidence::DEFAULT);
        assert!(confidence::HIGH <= 1.0);
        assert!(confidence::DEFAULT >= 0.0);
    }

    #[test]
    fn test_bucket_names_match() {
        assert_eq!(bucket::RUNTIME, "Runtime");
        assert_eq!(bucket::INTERFACE, "Interface");
        assert_eq!(bucket::MEMORY, "Memory");
        assert_eq!(bucket::VERIFICATION, "Verification");
        assert_eq!(bucket::RESEARCH, "Research");
        assert_eq!(bucket::UNKNOWN, "Unknown");
    }
}
