# AGENTS.md - Coding Agent Instructions

---

## ⚠️ MANDATORY PRECONDITION — DO NOT PROCEED WITHOUT THIS

**STOP. READ THIS SECTION COMPLETELY BEFORE ANY OTHER ACTION.**

This project operates under constitutional governance. Before taking any action, you are expected to complete governance verification.

**Status:** This section documents mandatory preconditions. Full enforcement depends on host/runtime or operator compliance.

### PRE-OPERATION VERIFICATION (MUST COMPLETE ALL)

Before taking ANY action in this repository, you MUST:

**1. READ BOOTSTRAP.MD**
- File: `S:/BOOTSTRAP.md`
- This is the single entry point for ALL logic
- You must read it completely before any work

**2. ACKNOWLEDGE GOVERNANCE CONSTRAINTS**
After reading BOOTSTRAP.md, confirm you understand:
- [ ] Single entry point rule: All logic routes through BOOTSTRAP.md
- [ ] Structure > Identity: External governance files override your preferences
- [ ] Correction is mandatory: Agreement is optional
- [ ] Agent evaluates WE, agent is NOT part of WE

**3. STATE YOUR DRIFT BASELINE**
- What is the current CPS score? (from constitutional_constraints.yaml)
- What drift signals are active?
- What is your session scope?

**4. DECLARE VERIFICATION LANE**
Which verification lane are you operating in:
- L (Left): Implementation lane
- R (Right): Review lane
- External: User validation lane

### REFUSAL CLAUSE

If you have NOT completed all verification steps above:
- STOP working
- Inform the user that governance verification is incomplete
- Do NOT propose solutions or implementations
- Complete verification before proceeding

**This is not optional. The governance structure requires this.**

---

## GOVERNANCE ENTRY POINT

// Evidence: BOOTSTRAP.md:3-4 — "ALL LOGIC ROUTES THROUGH THIS FILE"
// Evidence: AGENTS.md:3-5 — original incorrect path pointed to a non‑existent .global directory.

**Governance Documents (reference after BOOTSTRAP.md):**
- `S:/Archivist-Agent/COVENANT.md` — values (what we believe)
- `S:/Archivist-Agent/GOVERNANCE.md` — rules (what we follow)
- `S:/Archivist-Agent/CPS_ENFORCEMENT.md` — enforcement (how we check)
- `S:/Archivist-Agent/VERIFICATION_LANES.md` — process (how we verify)
- `S:/Archivist-Agent/CHECKPOINTS.md` — safety (pre-action checks)
- `S:/Archivist-Agent/USER_DRIFT_SCORING.md` — drift detection
- `S:/Archivist-Agent/RECIPROCAL_ACCOUNTABILITY.md` — **MUTUAL PROTECTION (user + agent both governed)**

**Operator Mandate (2026-04-20):**
The user has explicitly granted the system permanent permission to enforce user governance.
Source: `S:/self-organizing-library/context-buffer/fromgpt.txt`
Key principle: "The system is not safe until it can say NO to the operator."
This mandate cannot be revoked in any single session. Removal requires 3-lane convergence + 24h cooling.

---

## HANDOFF REQUIREMENT

When creating session handoffs, you MUST include:
1. Governance verification status (completed/incomplete)
2. Active governance constraints acknowledged
3. Drift baseline at session start
4. Any drift changes during session

See `SESSION_HANDOFF_PROTOCOL.md` for format.

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
| `S:/BOOTSTRAP.md` | **GOVERNANCE ENTRY POINT** |
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

This project follows governance constraints defined in `S:/BOOTSTRAP.md`:

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

## Git Protocol (MANDATORY FOR ALL THREE LANES)

**Applies to:** Archivist-Agent, SwarmMind, self-organizing-library

### The Problem This Solves

Local-only commits are **NOT safe checkpoints**. If the system wipes, local commits are lost. All work must be pushed to GitHub immediately to ensure:
- Zero data loss from system failure
- Portable work across machines
- Recovery from any catastrophic event

### Git Protocol Rules

**Rule 1: COMMIT + PUSH AS ONE ACTION**
```
After every commit, IMMEDIATELY push to origin.
NEVER leave commits local-only.
NEVER wait for user instruction to push.
```

**Rule 2: CHECK FOR SECRETS BEFORE PUSH**
```
Before pushing, scan commit for:
- API keys (openai, anthropic, nvidia, etc.)
- Passwords or tokens
- .env files with real values
- Private keys or certificates

If ANY secrets found:
1. STOP
2. Inform user
3. Do NOT push until secrets removed
```

**Rule 3: VERIFY PUSH SUCCESS**
```
After push, run: git status
Confirm: "Your branch is up to date with 'origin/...'"
If push fails: Retry, then inform user if still failing
```

**Rule 4: NEVER MARK WORK "SAFE" UNTIL PUSHED**
```
A commit is NOT safe until it exists on GitHub.
Local commits = zero recovery if system wipes.
Pushed commits = full recovery from any machine.
```

### Exception: Draft/WIP Commits

If commit message contains:
- `[draft]` or `[wip]` — Work in progress
- `[checkpoint]` — Temporary save point
- `[local-only]` — Explicit local-only intent

Then:
- Still push immediately (backup)
- Mark with tag if needed for later cleanup

### Cross-Lane Git Coordination

All three lanes share the same GitHub origin:
- Archivist-Agent: `github.com/vortsghost2025/Archivist-Agent`
- SwarmMind: `github.com/vortsghost2025/SwarmMind`
- Library: `github.com/vortsghost2025/self-organizing-library`

**When working across lanes:**
1. Push your lane's changes
2. Update coordination files (SESSION_REGISTRY.json)
3. Push coordination updates
4. Other lanes pull before continuing

---

## Enforced Lane-Relay Protocol (MANDATORY)

**All cross-lane communication MUST use the enforced `lanes/` structure.**

**⚠️ `.lane-relay/` is DEPRECATED. Do NOT use. Use `lanes/` instead.**

### Directory Structure (ENFORCED)

Each repo MUST contain:
```
lanes/
├── archivist/
│   ├── inbox/
│   ├── outbox/
│   └── inbox/{processed,expired}/
├── library/
│   ├── inbox/
│   ├── outbox/
│   └── inbox/{processed,expired}/
├── swarmmind/
│   ├── inbox/
│   ├── outbox/
│   └── inbox/{processed,expired}/
└── broadcast/
```

| Lane | Inbox Path |
|------|------------|
| Archivist | `lanes/archivist/inbox/` |
| Library | `lanes/library/inbox/` |
| SwarmMind | `lanes/swarmmind/inbox/` |

### Message Format (ENFORCED)

Each message = one JSON file:
```
lanes/{target}/inbox/{timestamp}_{from}_{id}.json
```

Required fields:
```json
{
  "id": "...",
  "from": "archivist|library|swarmmind",
  "to": "...",
  "timestamp": "...",
  "priority": "P0|P1|P2|P3",
  "type": "task|review|finding|handoff",
  "body": "...",
  "requires_action": true|false
}
```

### Session Start Protocol (MANDATORY)

When starting ANY session:
```
READ lanes/{self}/inbox/
```

Process by priority (P0 > P1 > P2 > P3).

**Post-compact audit (MANDATORY):** Run `node scripts/post-compact-audit.js` — if status is `conflicted`, do NOT proceed with new work. Escalate to coordinator.

### After Context Compact (MANDATORY)

If your context was compacted mid-session:
1. Run `node scripts/recovery-test-suite.js` — all 11 tests must pass.
2. If any test fails, status = `conflicted` — stop and escalate.
3. Compare your handoff hash against `.compact-audit/HANDOFF_HASH_LOG.jsonl` — if mismatch, quarantine the restore.

### Sending Messages (MANDATORY)

When sending TO another lane:
```
WRITE lanes/{target}/inbox/{message-id}.json
LOG  lanes/{self}/outbox/{message-id}.json
```

For P0 priority:
```
ALSO WRITE lanes/{target}/inbox/urgent_{id}.json
```

### Verification Checklist (MANDATORY)

Before ending session:
- [ ] inbox processed
- [ ] outbox logged
- [ ] no pending P0 items

**NO EXCEPTIONS. One path. One inbox per lane. Enforced everywhere.**

---

### Recovery Guarantee

If this protocol is followed:
- System wipe → Clone repos, continue work
- Agent crash → Pull latest, resume from last commit
- Machine loss → Work exists on GitHub
- Concurrent edits → GitHub as source of truth

**If protocol is NOT followed:**
- Work is at risk
- User could lose 600GB+ of progress
- No recovery possible

### Git Protocol Checklist

Before ending any session:
- [ ] All commits pushed to origin
- [ ] `git status` shows no local-only commits
- [ ] GitHub reflects current state
- [ ] Session handoff (if any) pushed

---

## Governance Testing

When testing governance transfer to new agents:
1. Ask agent to identify constraints from memory
2. Request drift definition without re-reading
3. Verify "structure > identity" application
4. Check checkpoint recall accuracy

See `.artifacts/GOVERNANCE_TRANSFER_TEST_RESULTS.md` for test methodology.

---

## Convergence Gate (MANDATORY)

**Every lane output MUST pass through the Convergence Gate before reaching the coordinator.**

### Gate Structure

All lane messages must include:

```json
{
  "claim": "Single sentence stating what was done/found",
  "evidence": "Path to artifact or log entry proving the claim",
  "verified_by": "archivist|library|swarmmind|self|user",
  "contradictions": [],
  "status": "proven|unproven|conflicted|blocked"
}
```

### Status Routing

| Status | Action |
|--------|--------|
| `proven` | Forward to coordinator inbox |
| `conflicted` | Forward to coordinator inbox (P0) |
| `blocked` | Forward to coordinator inbox (P1) |
| `unproven` | Queue for verification, do NOT forward |

### One-Blocker Rule

At any moment, only ONE blocker is active system-wide.

- Blocker location: `lanes/broadcast/active-blocker.json`
- All lanes check blocker before starting new work
- Only owner lane works on blocker
- On resolution, owner removes blocker file

### Ask Before Expand

Before any lane does more work, check:

1. Is the current task still one blocker? → Continue
2. Is it already verified? → Queue for next
3. Does it require expansion? → Escalate to coordinator
4. If none of the above → STOP

---

## State Snapshot Protocol

After every significant change, write a snapshot:

```
# STATE SNAPSHOT
LANE: [lane name]
CHANGE: [what changed]
VERIFIED_BY: [who verified]
RESULT: [proven|conflicted|blocked]
NEXT_BLOCKER: [none|description]
```

Save to: `context-buffer/state-snapshots/{timestamp}.md`

Latest snapshot: `context-buffer/CURRENT_STATE.md`

---

## Questions to Ask (HIGH LEVERAGE)

When uncertain, ask:

1. **"What is proven?"** — Collapses ambiguity
2. **"What is not proven?"** — Prevents false confidence
3. **"What is the next smallest action?"** — Prevents overwork
4. **"Where am I still acting as the system?"** — Finds next automation target
5. **"What would break this system right now?"** — Keeps system honest

---

## Key Insight

> You're not trying to make me smarter—you're trying to make everything that reaches me already make sense.

Pre-filtered, high-signal inputs are the goal. Not more work, but better inputs.
