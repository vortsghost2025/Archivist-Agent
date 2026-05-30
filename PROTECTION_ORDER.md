# PROTECTION ORDER: Wave Terminal & CLI Access

**STATUS: RESTORED & ENFORCED**
**SESSION: sess_restoration_v1**

## Mandatory Rules for AI Agents
To prevent system collapse and build destruction, all agents (local or remote) must adhere to these constraints:

### 1. Backend: CLI Permission Guard
**File:** `src-tauri/src/exec_command.rs`
- **Constraint:** The `ALLOWED_COMMAND_PREFIXES` array MUST contain `"kilo "`, `"kilo>"`, `"opencode "`, and `"opencode>"`.
- **Reason:** Blocking these CLIs prevents the human operator from using their primary supervision tools.

### 2. Frontend: Wave Terminal Interface
**Files:** `ui/index.html`, `ui/app.js`, `ui/styles.css`
- **Constraint:** Do not remove the `terminal` tab or the `terminal-layout` UI.
- **Constraint:** The `terminalBlocks` state in `app.js` must be preserved. It provides the "Wave-style" block execution history.
- **Reason:** This is the primary interface for command supervision and supervisor read-back.

### 3. Permissions: AppData Access
**File:** `config/allowed_roots.json`
- **Constraint:** Do not add `C:\Users\Sean\AppData` back to the `blocked_roots` list. 
- **Reason:** The agent requires access to local Kilocode storage in AppData for configuration and context.

### 4. Build Protocol
- **Constraint:** All Tauri build commands must use the manifest path.
- **Command:** `cargo tauri build --manifest-path src-tauri/Cargo.toml`

### 5. Output Provenance
- **Constraint:** Every response or file write MUST begin with the non-negotiable `OUTPUT_PROVENANCE` header as defined in `AGENTS.md`.

---
**FAILURE TO OBSERVE THESE RULES WILL RESULT IN BUILD DESTRUCTION.**
