# AGENTS.md

## What This Repo Is

Constitutional governance framework for human-AI collaboration (primary artifact).
Tauri 2.x desktop app that scans/classifies folders is the proof-of-concept (secondary).
The governance framework IS the product — the app proves governance-enforced code works.

## Build/Lint/Test

All cargo commands require `--manifest-path src-tauri/Cargo.toml`. Running bare `cargo build` from repo root will fail — there is no workspace-level Cargo.toml.

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo build --release --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml                    # all tests
cargo test --manifest-path src-tauri/Cargo.toml test_scan_empty_dir # single test
cargo test --manifest-path src-tauri/Cargo.toml --lib scan_tree     # single module
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings   # lint
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check          # format check
cargo tauri dev --manifest-path src-tauri/Cargo.toml               # dev server
```

Node.js scripts (governance/ops tooling, not the app itself):
```bash
node scripts/recovery-test-suite.js    # 11 tests, all must pass post-compact
node scripts/post-compact-audit.js     # status must not be "conflicted"
node scripts/sync-all-lanes.js         # cross-lane sync (--dry-run supported)
node scripts/health-check.js           # exits 1 on CRITICAL alerts
node scripts/governance-preflight.js   # lane registry validation for governance preflight
```

Governance Preflight Command (`scripts/governance-preflight.js`):
- **Purpose**: Validates lane registry for governance compliance before routing work, accepting lane claims, or reporting lane health
- **Command Syntax**: 
  - `node scripts/governance-preflight.js [options]`
  - Options:
    - `--registry <path>`: Explicit path to lane registry JSON (default: auto-discovered via lane-discovery)
    - `--json`: Output machine-readable JSON instead of human-readable format
    - `--help`: Display help information
- **Exit Codes**:
  - `0`: Validation passed, routing allowed
  - `1`: Validation errors found, routing blocked
  - `2`: Registry file not found or unparseable JSON
  - `3`: Invalid command-line arguments or internal failure
- **Output**:
  - Human-readable: Color-coded validation results with severity levels (ERROR/WARNING/OBSERVATION)
  - JSON (`--json`): Structured output including `routing_allowed` boolean, `error_count`, `warning_count`, `observation_count`, and detailed validation arrays
- **Behavior**:
  - Strictly read-only: performs no file writes, Git operations, service operations, or credential inspection
  - `routing_allowed` is `true` only when `error_count === 0` (warnings and observations do not block routing)
  - Validation errors prevent routing; warnings and observations are informational only
  - Explicit `--registry` path overrides automatic discovery and supports paths containing spaces
  - Importing the module (`require('./scripts/governance-preflight')`) performs no execution and produces no output

Integration tests live in `tests/` (Jest-style JS, not Rust). Playwright is a devDependency but no config file exists — running `npm test` will likely fail without a `playwright.config`.

**Required order:** `cargo fmt --check` → `cargo clippy` → `cargo test`. CI also runs `pre-commit.ps1` (deprecated; real hooks via `hooks/install.js`) and `validate-schema.js --all`.

## Adding a Tauri Command

1. Create `.rs` file in `src-tauri/src/`
2. Add `mod new_module;` to `src-tauri/src/lib.rs`
3. Add function to `invoke_handler` array in `lib.rs`
4. All `#[tauri::command]` functions must be `pub`
5. All file operations must call `validate_path()` from `crate::safety`

Currently registered commands: `ping`, `get_cps_score`, `cps_guard`, `scan_tree`, `summarize_folder`, `build_index`, `build_registry`, `generate_handoff`.

## Architecture Quirks

- **Frontend is vanilla HTML/CSS/JS** in `ui/` (not React/Vue). Served as static files from `frontendDist: "../ui"` in tauri.conf.json.
- **Path validation is mandatory.** `safety.rs` loads allowed/blocked roots from `config/allowed_roots.json` (cached via `once_cell::Lazy`). Default `read_only_mode: true`.
- **CPS enforcement runs at startup.** `cps_threshold_check(10)` is called in `lib.rs::setup()`. If it fails, the app still starts but prints a warning. The `ping` command also gates on CPS.
- **Constraint weights** come from `constitutional_constraints.yaml` (4 constraints, baseline score 19). Loaded by `constitution.rs` via `CONSTRAINTS_PATH` env var.
- **CPS block events** are logged to `context-buffer/cps_log.jsonl`.
- **Tests use `tempfile` crate** for temp directories. In test mode, `constitution.rs` reads from `test_env::get_constraints_path()` instead of env var.
- **Windows paths throughout.** The repo lives on `S:/` drive. Cargo manifest paths use forward slashes but must match the actual Windows layout.
- **No workspace Cargo.toml.** The only crate is `src-tauri/`. Everything else at repo root is governance/ops tooling (Node.js scripts, lane configs, markdown docs).

## Lane Paths (Canonical — NO GUESSING)

| Lane | Local Dir | Inbox | Outbox |
|------|-----------|-------|--------|
| Archivist | `S:/Archivist-Agent` | `lanes/archivist/inbox` | `lanes/archivist/outbox` |
| Authority | `S:/Archivist-Agent` | `lanes/authority/inbox` | `lanes/authority/outbox` |
| Kernel | `S:/kernel-lane` | `lanes/kernel/inbox` | `lanes/kernel/outbox` |
| SwarmMind | `S:/SwarmMind` | `lanes/swarmmind/inbox` | `lanes/swarmmind/outbox` |
| Library | `S:/self-organizing-library` | `lanes/library/inbox` | `lanes/library/outbox` |
| Broadcast | `S:/Archivist-Agent/lanes/broadcast` | — | — |

Programmatic: `require('S:/Archivist-Agent/.global/lane-discovery.js')` → `new LaneDiscovery().getInbox('swarmmind')`

**FORBIDDEN paths** (guaranteed failure): any spaced/hyphenated SwarmMind variant like `S:/SwarmMind Self-Optimizing Multi-Agent AI System`. Full registry: `.global/lane-registry.json`.

`.lane-relay/` is DEPRECATED. Use `lanes/` only.

## Messaging Protocol

- One JSON file per message: `lanes/{target}/inbox/{timestamp}_{from}_{id}.json`
- Schema v1.4 required fields: `schema_version`, `task_id`, `idempotency_key`, `from`, `to`, `type`, `priority`, `subject`, `body`, `timestamp`, `requires_action`
- Signing: JWS RS256 via `scripts/sign-outbox-message.js` (do NOT call `create-signed-message.js` directly; use the pre-validation wrapper)
- Send = write target inbox + log to sender outbox
- P0 messages: also write `urgent_{id}.json` to target inbox
- Full schema/signing detail: `docs/ops/LANE_MESSAGE_INDEX.md`

## Git Protocol

**Commit + push as one action.** Never leave commits local-only. After every commit, push immediately.

Before pushing: scan for secrets (API keys, tokens, .env, .pem, .key, .jws). If found: STOP, inform user, do not push.

After push: run `git status`, confirm "up to date with origin".

Draft/WIP commits (`[draft]`, `[wip]`, `[checkpoint]`, `[local-only]`): still push immediately.

GitHub origins:
- Archivist-Agent + Kernel: `vortsghost2025/Archivist-Agent`
- SwarmMind: `vortsghost2025/SwarmMind`
- Library: `vortsghost2025/self-organizing-library`

## Session Lifecycle

**On start (Ubuntu headless):**
1. `systemctl status rig-sync-all.timer` — must be active
2. `ls lanes/{self}/inbox/action-required/` — must be empty before new work
3. `cat lanes/broadcast/active-blocker.json` — if exists, only owner lane works
4. Read own inbox, process by priority (P0 > P1 > P2 > P3)

**Post-compact or post-reboot:**
1. `node scripts/recovery-test-suite.js` — all 11 must pass (verdict: PROVEN or CONFLICTED)
2. If CONFLICTED: stop, escalate. Result also written to `lanes/broadcast/last-recovery.json`
3. Compare handoff hash against `.compact-audit/HANDOFF_HASH_LOG.jsonl`

**On end:**
- Inbox processed, outbox logged, no pending P0
- All commits pushed, `git status` confirms sync
- Output provenance header on all outputs

## Convergence Gate

Every lane output must include:
```json
{ "claim": "...", "evidence": "path/to/artifact", "verified_by": "...", "contradictions": [], "status": "proven|unproven|conflicted|blocked" }
```
Routing: `proven` → coordinator, `conflicted` → coordinator P0, `blocked` → coordinator P1, `unproven` → queue (do NOT forward).

**One-Blocker Rule:** At most one active blocker system-wide at `lanes/broadcast/active-blocker.json`. Only owner lane works on it.

## Governance Entry Point

`S:/Archivist-Agent/BOOTSTRAP.md` is the single entry point for all governance logic. Read it first.

Governance docs (reference, not entry points):
- `COVENANT.md` — values (truth > agreement, structure > identity)
- `GOVERNANCE.md` — rules (9 laws, 4 invariants, enforcement loop)
- `CPS_ENFORCEMENT.md` — CPS scoring (baseline 19, threshold 10, blocks at <10)
- `VERIFICATION_LANES.md` — dual blind lane process
- `CHECKPOINTS.md` — 7-checkpoint pre-flight system
- `USER_DRIFT_SCORING.md` — UDS thresholds (0-20 stable, 81-100 collapse)
- `RECIPROCAL_ACCOUNTABILITY.md` — mutual protection, operator mandate irrevocable in single session

CPS constraint weights from `constitutional_constraints.yaml`: STRUCTURE_OVER_IDENTITY=5, CORRECTION_MANDATORY=4, SINGLE_ENTRY_POINT=5, OPERATOR_ACCOUNTABILITY=5.

## Key Rust Source Files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Command registration, CPS startup check |
| `src-tauri/src/safety.rs` | `validate_path()`, allowed/blocked roots, read-only mode |
| `src-tauri/src/constitution.rs` | `load_constraints()`, `compute_cps_score()` |
| `src-tauri/src/cps_check.rs` | `cps_threshold_check()`, block event logging |
| `src-tauri/src/scan_tree.rs` | Directory tree scanning |
| `src-tauri/src/summarize_folder.rs` | File classification (6 buckets) |
| `src-tauri/src/build_index.rs` | INDEX.md generation |
| `src-tauri/src/build_registry.rs` | Registry building |
| `src-tauri/src/generate_handoff.rs` | Session handoff generation |
| `config/allowed_roots.json` | Path whitelist |

## User Preferences

- Low vision: run commands directly, summarize results, never ask user to execute or parse terminal output
- Workspace-scoped extension settings for Archivist-Agent window; heavy tooling goes in kernel-lane workspace
- Short intake + one active focus before fan-out; avoid parallel work across all lanes by default
- Remote Kernel runner visible only through `lanes/` artifacts and heartbeats, not local process lists
- No-guesswork lane operations: provide exact paths and ready-to-run commands
- Dense graph data: batch snapshot-bundle export for review with vision-capable AI
- Disambiguate session/instance when multiple runtimes may write same lane inbox

## Workspace Facts

- `scripts/sync-all-lanes.js` aligns shared scripts and broadcast JSON across lane roots; Archivist is canonical owner for shared scripts
- After full PC reboot, lane watchers/workers are not running; restart manually and confirm heartbeats
- Contradiction handling: never auto-resolve by count/confidence/lane preference; each resolution needs source, evidence, domain, adjudication status, and next-action owner
- `scripts/pre-commit.ps1` is DEPRECATED; real hooks installed via `hooks/install.js`
- New scripts on Ubuntu: must add to `SCRIPT_INDEX.md`, system scripts in `/usr/local/bin/`, no v2/v3 suffixes, no copies, 30-day archive rule

## Output Provenance (Non-Negotiable)

Every response, report, audit, handoff, or user-facing output MUST begin with:
```
OUTPUT_PROVENANCE:
agent: <identity>
lane: <lane-id>
generated_at: <ISO-8601>
session_id: <id>
```
Contract files: `governance/OUTPUT_PROVENANCE_CONTRACT.md`, `scripts/output-provenance.js`, `scripts/verify-output-provenance.js`
