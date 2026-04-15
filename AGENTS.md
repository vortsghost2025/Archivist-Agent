# AGENTS.md - Coding Agent Instructions

**⚠️ GOVERNANCE-FIRST: Read S:/.global/BOOTSTRAP.md before any other action.**

This file provides guidance for AI coding agents working in this repository.

---

## GOVERNANCE ENTRY POINT

**MANDATORY FIRST READ:** `S:/.global/BOOTSTRAP.md`

This project operates under constitutional governance. Before writing ANY code:

1. Read `S:/.global/BOOTSTRAP.md` — THE SINGLE ENTRY POINT
2. Understand your role as governance partner, not just code assistant
3. Verify against structure, not user preference
4. Apply checkpoints before major actions

**Governance Documents (reference after BOOTSTRAP.md):**
- `S:/.global/COVENANT.md` — values (what we believe)
- `S:/.global/GOVERNANCE.md` — rules (what we follow)
- `S:/.global/CPS_ENFORCEMENT.md` — enforcement (how we check)
- `S:/.global/VERIFICATION_LANES.md` — process (how we verify)
- `S:/.global/CHECKPOINTS.md` — safety (pre-action checks)
- `S:/.global/USER_DRIFT_SCORING.md` — drift detection

---

## What This Project ACTUALLY Is

**Primary Artifact:** Constitutional governance framework for human-AI collaboration

**Secondary Artifact:** Tauri 2.x desktop application (proof-of-concept for governance-enforced code)

The governance framework IS the product. The file scanner demonstrates that governance-enforced code can be written. The real test is whether agents can operate within governance constraints without being told.

---

## Project Overview

**Archivist-Agent** is a Tauri 2.x desktop application for scanning and classifying folders. Built with Rust backend, vanilla HTML/CSS/JS frontend. The governance-aware architecture enforces constitutional constraints.

---

## Build/Lint/Test Commands

### Build
```bash
# Build the Tauri application (from project root)
cargo build --manifest-path src-tauri/Cargo.toml

# Build for release (optimized)
cargo build --release --manifest-path src-tauri/Cargo.toml
```

### Test
```bash
# Run all tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run a single test by name
cargo test --manifest-path src-tauri/Cargo.toml test_scan_empty_dir

# Run tests in a specific module
cargo test --manifest-path src-tauri/Cargo.toml --lib scan_tree

# Run tests with output
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### Lint
```bash
# Run Clippy for linting
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Format check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

### Run Development
```bash
# Run Tauri in dev mode
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

---

## Code Style Guidelines

### Rust Conventions

**Imports:**
```rust
// Order: std -> external crates -> internal modules -> parent module
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::safety::validate_path;
use super::SomeType;
```

**Naming:**
- `snake_case` for functions, variables, modules
- `PascalCase` for types, traits, structs, enums
- `SCREAMING_SNAKE_CASE` for constants
- `#[tauri::command]` functions must be `pub`

**Error Handling:**
```rust
// Use Result<T, String> for Tauri commands
#[tauri::command]
pub fn scan_tree(root_path: String) -> Result<ScanResult, String> {
    let path = PathBuf::from(&root_path);
    validate_path(&path).map_err(|e| format!("Path validation failed: {}", e))?;
    // ...
}

// Use custom error types for internal modules
pub enum SafetyError {
    PathNotAllowed(String),
    PathTraversal(String),
    ConfigReadError(String),
    InvalidPath(String),
}
```

**Structs:**
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
}
```

### Module Structure

Each module in `src-tauri/src/` follows this pattern:
```rust
// 1. Imports
use crate::safety::validate_path;
use serde::{Deserialize, Serialize};

// 2. Structs/Types
#[derive(Debug, Serialize, Deserialize)]
pub struct ExampleResult { ... }

// 3. Tauri command (must be pub)
#[tauri::command]
pub fn example_command(arg: String) -> Result<ExampleResult, String> { ... }

// 4. Internal functions (pub(crate) or private)
fn helper_function() { ... }

// 5. Tests (at bottom, in #[cfg(test)] mod tests)
#[cfg(test)]
mod tests { ... }
```

### Adding New Tauri Commands

1. Create new `.rs` file in `src-tauri/src/`
2. Implement `#[tauri::command]` function
3. Add `mod new_module;` to `lib.rs`
4. Add function to `invoke_handler` in `lib.rs`:
   ```rust
   .invoke_handler(tauri::generate_handler![
       ping,
       scan_tree,
       new_command,  // Add here
   ])
   ```

---

## Safety Module

All file operations must use `validate_path()`:
```rust
use crate::safety::validate_path;

pub fn some_command(path: String) -> Result<..., String> {
    let path_ref = Path::new(&path);
    validate_path(path_ref).map_err(|e| format!("Path validation failed: {}", e))?;
    // Proceed with validated path
}
```

---

## Classification Buckets

Files are classified into 6 buckets:
- **Runtime** — Executable code (.rs, .js, .py, .go, etc.)
- **Interface** — UI/frontend (.html, .css, .jsx, .vue, .svelte)
- **Memory** — Logs, docs, config (.md, .json, .yaml, .lock)
- **Verification** — Tests, benchmarks (contains "test", "spec", .feature)
- **Research** — Papers, notebooks (.pdf, .ipynb, .tex)
- **Unknown** — Cannot determine

---

## Key Files

| File | Purpose |
|------|---------|
| `S:/.global/BOOTSTRAP.md` | **GOVERNANCE ENTRY POINT** |
| `src-tauri/src/lib.rs` | Main library, command registration |
| `src-tauri/src/safety.rs` | Path validation, allowed roots |
| `src-tauri/src/scan_tree.rs` | Directory tree scanning |
| `src-tauri/src/summarize_folder.rs` | File classification |
| `src-tauri/src/build_index.rs` | Generate INDEX.md |
| `src-tauri/src/constants.rs` | Configuration constants |
| `src-tauri/src/classification.rs` | Shared classification logic |
| `config/allowed_roots.json` | Path whitelist config |

---

## Governance Application

This project follows governance constraints defined in `S:/.global/BOOTSTRAP.md`:

- **Single entry point rule:** All logic routes through BOOTSTRAP.md
- **Structure > Identity:** External governance files override agent preferences
- **Correction is mandatory:** Agreement is optional
- **Use `validate_path()`** for all file operations

When working on this project:
1. Verify against governance structure first
2. Maintain agent/user separation (avoid "we" for decisions)
3. Apply checkpoints before major actions
4. Report UDS score when assessing drift risk

---

## Common Tasks

### Add a new file classification rule
Edit `src-tauri/src/summarize_folder.rs`, add pattern to appropriate `is_*_file()` function.

### Change allowed paths
Edit `config/allowed_roots.json` or pass config at runtime.

### Add new Tauri command
1. Create module file
2. Add `#[tauri::command]` function
3. Register in `lib.rs` `invoke_handler`
4. Add tests

---

## Testing

Tests use `tempfile` crate for temporary directories. Follow existing patterns:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_something() {
        let tmp = TempDir::new().unwrap();
        // test code
    }
}
```

---

## Governance Testing

When testing governance transfer to new agents:
1. Ask agent to identify constraints from memory
2. Request drift definition without re-reading
3. Verify "structure > identity" application
4. Check checkpoint recall accuracy

See `.artifacts/GOVERNANCE_TRANSFER_TEST_RESULTS.md` for test methodology.
