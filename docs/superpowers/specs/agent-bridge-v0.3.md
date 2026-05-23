# Agent Bridge v0.3 — Script-First Design Spec

OUTPUT_PROVENANCE:
  agent: archivist
  lane: archivist
  generated_at: 2026-05-22T14:23:00-04:00
  session_id: may22-script-first

## 1. Overview

v0.3 adds a **Governance** tab to the Archivist desktop app. This tab exposes
live governance state and lets the operator run governance scripts from inside
the Tauri shell — no terminal needed. It is the Script-First phase of the
hybrid B→A→C path. Mode-First hooks arrive in v0.4; agent runtime is deferred.

### Scope (7 features, all read-only or script-execution)

| # | Feature | Reads | Writes | Mechanism |
|---|---------|-------|--------|-----------|
| 1 | Governance Status dashboard | JSON/YAML files | No | `read_governance_file` |
| 2 | Run Checks button | Script stdout | No | `run_script` via shell |
| 3 | Mode State viewer | `active-mode.json` | No | `read_governance_file` |
| 4 | NOW.md viewer | `NOW.md` | No | `read_governance_file` |
| 5 | Recovery suite runner | Script stdout | Yes (script writes results) | `run_script` via shell |
| 6 | Git status summary | `git status --porcelain` stdout | No | `git_status` via shell |
| 7 | Read-only proof report | `allowed_roots.json` + `is_read_only()` | No | `read_governance_file` + `check_read_only` |

### Non-Goals

- Mode transitions from the UI (v0.4)
- Lane message sending (v0.4)
- Agent runtime / worker adapters (deferred)
- Streaming/long-running action progress bars (deferred)
- Mutation commands beyond what scripts already do

---

## 2. Rust Commands

Four new Tauri commands. All are read-only from the Tauri side (the scripts
they invoke may write, but the Tauri backend itself does not mutate).

### 2.1 `read_governance_file`

```rust
#[tauri::command]
fn read_governance_file(file_name: String) -> Result<String, String>
```

- **Input**: `file_name` — one of the allowed filenames (see allowlist below)
- **Output**: File contents as UTF-8 string
- **Security**: Allowlist-only. No path traversal. The command resolves the
  filename against the project root directory (the directory containing
  `config/allowed_roots.json`). Paths outside the project root are rejected.

**Allowlist of readable files**:

| file_name | Resolved path (relative to project root) |
|-----------|------------------------------------------|
| `active-mode` | `lanes/broadcast/active-mode.json` |
| `active-blocker` | `lanes/broadcast/active-blocker.json` |
| `system-state` | `lanes/broadcast/system_state.json` |
| `trust-store` | `lanes/broadcast/trust-store.json` |
| `last-recovery` | `lanes/broadcast/last-recovery.json` |
| `allowed-roots` | `config/allowed_roots.json` |
| `constitutional-constraints` | `constitutional_constraints.yaml` |
| `now-md` | `NOW.md` |

If the file does not exist, return `Err("File not found: {file_name}")`.

### 2.2 `run_script`

```rust
#[tauri::command]
async fn run_script(script_name: String) -> Result<ScriptOutput, String>
```

```rust
#[derive(serde::Serialize)]
struct ScriptOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    success: bool,
}
```

- **Input**: `script_name` — one of the allowed script names (see allowlist)
- **Output**: Captured stdout, stderr, exit code, and success boolean
- **Security**: Allowlist-only. The command spawns a child process via
  `tauri-plugin-shell`'s `Command::new()`. The working directory is set to
  the project root.

**Allowlist of runnable scripts**:

| script_name | Command |
|-------------|---------|
| `health-check` | `node scripts/health-check.js` |
| `recovery-suite` | `node scripts/recovery-test-suite.js` |
| `mode-check` | `node scripts/mode-check.js --once` |

Timeout: 60 seconds. If the process does not exit within 60s, kill it and
return `ScriptOutput` with `success: false` and `stderr` containing
"Timed out after 60s".

### 2.3 `git_status`

```rust
#[tauri::command]
async fn git_status() -> Result<GitStatusOutput, String>
```

```rust
#[derive(serde::Serialize)]
struct GitStatusOutput {
    porcelain: String,   // raw --porcelain output
    clean: bool,         // true if porcelain is empty
    modified: usize,     // count of modified files
    untracked: usize,    // count of untracked files
    staged: usize,       // count of staged changes
}
```

- **Input**: None
- **Output**: Parsed `git status --porcelain` output with counts
- **Security**: Runs `git status --porcelain` via `tauri-plugin-shell`.
  Working directory is the project root. Read-only — `git status` cannot
  mutate the repository.

### 2.4 `check_read_only`

```rust
#[tauri::command]
fn check_read_only() -> ReadOnlyReport
```

```rust
#[derive(serde::Serialize)]
struct ReadOnlyReport {
    read_only_mode: bool,
    allowed_roots: Vec<String>,
    blocked_roots: Vec<String>,
    source: String,  // path to the config file that was loaded
}
```

- **Input**: None
- **Output**: Current read-only mode state plus the root lists
- **Security**: Wraps existing `safety::is_read_only()` and reads
  `CACHED_CONFIG` for root lists. No filesystem mutation.

### 2.5 Registration

All four commands are added to `lib.rs`:

```rust
// New modules
mod governance;

// In invoke_handler:
tauri::generate_handler![
    ping,
    get_cps_score,
    cps_guard,
    scan_tree,
    summarize_folder,
    build_index,
    build_registry,
    generate_handoff,
    read_governance_file,   // NEW
    run_script,             // NEW
    git_status,             // NEW
    check_read_only,        // NEW
]
```

The four commands live in a new file `src-tauri/src/governance.rs` to keep
`lib.rs` clean. Only the `mod governance;` declaration and the handler
registration go in `lib.rs`.

---

## 3. Shell Plugin Configuration

`tauri.conf.json` must add a `plugins.shell.scope` section to allow the
`node` and `git` commands:

```json
{
  "plugins": {
    "shell": {
      "open": true,
      "scope": [
        {
          "name": "node",
          "cmd": "node",
          "args": true
        },
        {
          "name": "git",
          "cmd": "git",
          "args": true
        }
      ]
    }
  }
}
```

This must be merged into the existing `tauri.conf.json` at the top level.

---

## 4. Frontend Design

### 4.1 Tab Structure

Add `"governance"` to `TAB_NAMES` in `app.js`:

```js
const TAB_NAMES = ['overview', 'retrieve', 'tree', 'output', 'governance'];
```

Add a tab button in `index.html` after the output tab button:

```html
<button class="tab-btn" data-tab="governance">Governance</button>
```

Add a tab content div in `index.html`:

```html
<div id="governance-tab" class="tab-content" style="display:none;"></div>
```

### 4.2 Governance Tab Layout

The governance tab is a vertical dashboard with these sections, each in a
card-style container:

```
┌─────────────────────────────────────────────┐
│  GOVERNANCE STATUS          [Refresh All]   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ CPS: 19  │ │ Mode:    │ │ Read-Only: │  │
│  │ (info)   │ │ OBSERVE  │ │ ON         │  │
│  └──────────┘ └──────────┘ └────────────┘  │
├─────────────────────────────────────────────┤
│  NOW.md                                     │
│  ┌───────────────────────────────────────┐  │
│  │ (rendered markdown as plain text)     │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  SCRIPTS                                    │
│  [Run Health Check]  [Run Recovery Suite]   │
│  ┌───────────────────────────────────────┐  │
│  │ (script output appears here)          │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  GIT STATUS                                 │
│  ┌───────────────────────────────────────┐  │
│  │ Clean: true | Modified: 0 | ...      │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  READ-ONLY PROOF                            │
│  ┌───────────────────────────────────────┐  │
│  │ Mode: true                            │  │
│  │ Allowed: S:/, S:/kernel-lane, ...     │  │
│  │ Blocked: C:\Windows, C:\Program Files │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 4.3 Rendering Functions (app.js)

New functions to add:

- **`renderGovernance()`** — top-level renderer called by `switchTab()`.
  Calls all sub-renderers in parallel where possible.
- **`renderGovernanceStatus()`** — fetches CPS score, mode state, read-only
  status. Renders the three status cards at the top.
- **`renderNowMd()`** — fetches `NOW.md` content. Renders as `<pre>` (no
  markdown parser dependency — just formatted plain text).
- **`renderScriptRunner()`** — creates the script buttons and output area.
  Each button calls `invoke('run_script', { scriptName: '...' })` and
  displays the result in the output area below.
- **`renderGitStatus()`** — fetches git status and renders the summary.
- **`renderReadOnlyProof()`** — fetches the read-only report and renders
  allowed/blocked root lists.

### 4.4 Browser Mock Data

The existing `invoke()` fallback in app.js (lines 147-170) needs mock entries
for the four new commands:

```js
// In the mock fallback:
case 'read_governance_file':
  return mockGovernanceFile(args.file_name);
case 'run_script':
  return mockScriptOutput(args.script_name);
case 'git_status':
  return { porcelain: '', clean: true, modified: 0, untracked: 0, staged: 0 };
case 'check_read_only':
  return { read_only_mode: true, allowed_roots: ['S:/'], blocked_roots: ['C:\\Windows'], source: 'config/allowed_roots.json' };
```

### 4.5 Accessibility

- All status cards use `<h3>` headings for screen reader navigation
- Script output uses `<pre role="log" aria-live="polite">`
- Buttons have descriptive `aria-label` attributes
- Color is never the sole indicator of status — always paired with text
- Zoom controls (already implemented) apply to the governance tab

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| Governance file missing | Show "File not found: {name}" in the card |
| Script execution fails (non-zero exit) | Show stderr in output area, mark as FAILED |
| Script times out (60s) | Show "Timed out after 60s" in output area |
| Git not found | Show "git not available" in git status card |
| Tauri invoke fails | Show error message in the relevant card |
| Network/offline | N/A — all data is local |

---

## 6. File Map

### New Files

| File | Purpose |
|------|---------|
| `src-tauri/src/governance.rs` | All 4 new Tauri commands |
| `docs/superpowers/specs/agent-bridge-v0.3.md` | This design doc |

### Modified Files

| File | Changes |
|------|---------|
| `src-tauri/src/lib.rs` | Add `mod governance;`, register 4 commands in `invoke_handler` |
| `src-tauri/tauri.conf.json` | Add `plugins.shell.scope` for `node` and `git` |
| `ui/app.js` | Add `governance` to `TAB_NAMES`, add `renderGovernance()` and sub-renderers, add mock data |
| `ui/index.html` | Add governance tab button and content div |
| `ui/styles.css` | Add governance tab styles (cards, layout, script output) |

---

## 7. Implementation Order

1. `governance.rs` — all 4 Rust commands
2. `lib.rs` — register the new module and commands
3. `tauri.conf.json` — add shell scope
4. `ui/index.html` — add tab button and content div
5. `ui/app.js` — add tab name, renderers, mock data
6. `ui/styles.css` — add governance styles
7. Build and test: `cd S:\Archivist-Agent\src-tauri && cargo tauri dev`
8. Verify all 7 features render and function
9. Commit: `[LANE-1] feat: agent bridge v0.3 — script-first governance tab`

---

## 8. Testing Checklist

- [ ] Governance tab appears when clicked
- [ ] CPS score displays correctly (should be 19 with default constraints)
- [ ] Mode state displays (OBSERVE)
- [ ] Read-only mode displays (true)
- [ ] NOW.md content renders in the viewer
- [ ] "Run Health Check" button executes health-check.js and shows output
- [ ] "Run Recovery Suite" button executes recovery-test-suite.js and shows output
- [ ] Git status shows modified/untracked/staged counts
- [ ] Read-only proof report shows allowed and blocked roots
- [ ] Refresh All button re-fetches all data
- [ ] Zoom controls work on governance tab (top-left anchor, viewport fill)
- [ ] Browser mock mode works (no Tauri runtime)
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo fmt --check` passes
- [ ] `cargo test` passes (all existing + any new tests)

---

## 9. Deferred to v0.4

- Mode transition UI (OBSERVE → BUILD → CHAOS-LAB → RECOVERY)
- Lane message composition and sending
- Anti-bypass detection in the app
- Streaming/progress for long-running scripts
- CPS score re-evaluation (currently computed once at startup)
