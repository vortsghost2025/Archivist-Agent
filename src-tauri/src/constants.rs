// Phase 2 patch test
//! Configuration constants for Archivist Agent
//!
//! This module centralizes all magic numbers and configuration values
//! to improve maintainability and allow easy tuning.

//! Maximum directory traversal depth
pub const MAX_SCAN_DEPTH: usize = 10;

/// Maximum path length allowed for input validation
pub const MAX_PATH_LENGTH: usize = 4096;

/// Classification confidence thresholds
pub mod confidence {
    pub const HIGH: f32 = 0.95;
    pub const MEDIUM: f32 = 0.90;
    pub const LOW: f32 = 0.85;
    pub const DEFAULT: f32 = 0.50;
}

/// File classification buckets
pub mod bucket {
    pub const RUNTIME: &str = "Runtime";
    pub const INTERFACE: &str = "Interface";
    pub const MEMORY: &str = "Memory";
    pub const VERIFICATION: &str = "Verification";
    pub const RESEARCH: &str = "Research";
    pub const UNKNOWN: &str = "Unknown";
}

/// Directory names to skip during scanning
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

// Extension constants removed — classification.rs was the sole consumer.
// Inline classification in summarize_folder.rs, build_index.rs, build_registry.rs,
// and generate_handoff.rs maintains their own extension lists.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn test_constants_are_reasonable() {
        assert!(MAX_SCAN_DEPTH > 0);
        assert!(MAX_SCAN_DEPTH <= 50); // Reasonable upper bound
        assert!(MAX_PATH_LENGTH > 260); // Windows MAX_PATH
        assert!(!SKIP_DIRS.is_empty());
    }

    #[test]
    #[allow(clippy::assertions_on_constants)]
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
