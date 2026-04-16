# CPS Gating in Archivist-Agent

## Overview

Archivist-Agent implements Constitutional Policy Scoring (CPS) gating to enforce governance constraints at the command level. This document describes how CPS checks work and how they integrate with Tauri commands.

## What is CPS Gating?

CPS gating is a mechanism that blocks or allows command execution based on a constitutional compliance score. The score is calculated from `constitutional_constraints.yaml` and represents how well the current session adheres to defined governance policies.

## How It Works

### 1. Score Calculation

The CPS score is calculated by `src-tauri/src/cps_check.rs`:

```rust
pub fn cps_threshold_check() -> Result<f32, String>
```

This function:
- Reads `constitutional_constraints.yaml`
- Calculates a compliance score (0.0 to 1.0)
- Returns `Ok(score)` if above threshold, `Err` otherwise

### 2. Command Gating

Commands that require CPS compliance call the check:

```rust
#[tauri::command]
pub fn ping() -> Result<String, String> {
    cps_threshold_check()?;  // Block if CPS too low
    Ok("pong".to_string())
}
```

### 3. Threshold

Default threshold is defined in `cps_check.rs`. If the calculated score is below the threshold, the command returns an error instead of executing.

## Commands with CPS Gating

| Command | CPS Gated | Purpose |
|---------|-----------|---------|
| `ping` | Yes | Health check - verifies governance compliance |
| `get_cps_score` | Yes | Returns current CPS score |

Commands that modify the filesystem use `check_read_only()` instead, which enforces a different governance constraint (read-only mode).

## Read-Only Mode

Separate from CPS gating, the `check_read_only()` function enforces the "Structure > Identity" constraint:

```rust
#[tauri::command]
pub fn build_index(root: String) -> Result<IndexResult, String> {
    check_read_only()?;  // Block if read-only mode active
    // ... proceed with indexing
}
```

### Commands with Read-Only Guard

| Command | Module | Purpose |
|---------|--------|---------|
| `build_index` | `build_index.rs` | Generate INDEX.md |
| `generate_handoff` | `generate_handoff.rs` | Create project handoff |
| `build_registry` | `build_registry.rs` | Build project registry |

## Configuration

### CPS Threshold

Defined in `constitutional_constraints.yaml`:

```yaml
cps_threshold: 0.7
```

### Read-Only Mode

Defined in `config/allowed_roots.json`:

```json
{
  "allowed_roots": ["S:\\Archivist-Agent"],
  "blocked_roots": ["C:\\Windows", "C:\\Program Files"],
  "read_only_mode": false
}
```

## Testing

CPS gating is tested via:

```rust
#[test]
fn test_ping_blocks_on_cps_failure() {
    // Verify ping returns error when CPS too low
}

#[test]
fn test_ping_allows_on_cps_success() {
    // Verify ping succeeds when CPS sufficient
}
```

Run tests with:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## Governance Evidence

- Evidence: `CPS_ENFORCEMENT.md:70` — CPS threshold check before operations
- Evidence: `BOOTSTRAP.md:46` — Structure > Identity enforced via read-only guard
