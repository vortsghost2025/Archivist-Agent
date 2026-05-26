// Evidence: BOOTSTRAP.md:53 — constitutional constraints loaded at session start
// Evidence: PAPER_E.md:1‑20 — defines the four‑layer lattice and CPS baseline
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Representation of a single constitutional constraint.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConstitutionalConstraint {
    pub name: String,
    pub description: String,
    pub weight: i32,
}

pub fn load_constraints() -> Vec<ConstitutionalConstraint> {
    #[cfg(test)]
    use crate::test_env;

    #[cfg(test)]
    {
        if let Some(custom) = test_env::get_constraints_path() {
            let custom_path = Path::new(&custom);
            if custom_path.exists() {
                let content = std::fs::read_to_string(custom_path).unwrap_or_else(|e| {
                    eprintln!("[CPS] Failed to read custom constraint file: {}", e);
                    String::new()
                });
                if content.is_empty() {
                    return Vec::new();
                }
                return serde_yaml::from_str(&content).unwrap_or_else(|e| {
                    eprintln!("[CPS] YAML parse error (custom): {}", e);
                    Vec::new()
                });
            }
        }
    }

    #[cfg(not(test))]
    {
        if let Ok(custom) = std::env::var("CONSTRAINTS_PATH") {
            let custom_path = Path::new(&custom);
            if custom_path.exists() {
                let content = std::fs::read_to_string(custom_path).unwrap_or_else(|e| {
                    eprintln!("[CPS] Failed to read custom constraint file: {}", e);
                    String::new()
                });
                if content.is_empty() {
                    return Vec::new();
                }
                return serde_yaml::from_str(&content).unwrap_or_else(|e| {
                    eprintln!("[CPS] YAML parse error (custom): {}", e);
                    Vec::new()
                });
            }
        }
    }
    // Primary location: crate directory where Cargo.toml lives
    let primary = Path::new(env!("CARGO_MANIFEST_DIR")).join("constitutional_constraints.yaml");
    // Fallback: repository root (one level up from the crate directory)
    let fallback =
        Path::new(env!("CARGO_MANIFEST_DIR")).join(r"..\constitutional_constraints.yaml");
    let path = if primary.exists() {
        primary
    } else if fallback.exists() {
        fallback
    } else {
        return Vec::new();
    };
    let content = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        eprintln!("[CPS] Failed to read constraint file: {}", e);
        String::new()
    });
    if content.is_empty() {
        return Vec::new();
    }
    serde_yaml::from_str(&content).unwrap_or_else(|e| {
        eprintln!("[CPS] YAML parse error: {}", e);
        Vec::new()
    })
}

/// Compute a simple CPS (Constitutional Phenotype Selection) score.
/// The score is the weighted sum of active constraints; baseline is stored for checkpointing.
pub fn compute_cps_score(constraints: &[ConstitutionalConstraint]) -> i32 {
    constraints.iter().map(|c| c.weight).sum()
}

// Global CPS score computed once per session. This value participates in the checkpoint/CPS enforcement loop (see CHECKPOINTS.md and CPS_ENFORCEMENT.md).
// Evidence: BOOTSTRAP.md:53 — constraints loaded at session start.
use once_cell::sync::Lazy;
pub static CPS_SCORE: Lazy<i32> = Lazy::new(|| {
    let constraints = load_constraints();
    compute_cps_score(&constraints)
});

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_env;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_load_constraints_nonexistent() {
        let mut tmp = NamedTempFile::new().expect("temp file creation failed");
        tmp.write_all(b"").expect("write failed");
        test_env::set_constraints_path(tmp.path().to_path_buf());
        let constraints = load_constraints();
        assert!(constraints.is_empty());
        test_env::clear_constraints_path();
    }
}
