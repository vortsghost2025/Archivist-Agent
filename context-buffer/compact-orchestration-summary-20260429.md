# Compact/Restore Crossâ€‘Lane Orchestration â€“ Summary Document


OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: compact orchestration summary
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
compact-restore

## NEXT_SAFE_ACTION
Verify compact hooks registered on all lanes

This compact summary gathers the essential information from the detailed docs you already have, so any agent can quickly understand the workflow, safety measures, and next actions without scrolling through large files.

---

## 1. Purpose
- **Compact**: Create a lightweight, tamperâ€‘evident snapshot of each laneâ€™s state (meta, handoff, audit) to avoid tokenâ€‘budget overflow and to provide a reliable restore point.
- **Phenotype**: For the Library lane, the compact serves as a phenotype, enabling a clean reload that filters out noisy user input.
- **Safety**: Staged writes, preâ€‘commit hooks, and a centralized orchestrator prevent accidental wholeâ€‘disk commits.

---

## 2. Repository Safety
- **`.gitignore` (per lane)** blocks everything by default and explicitly unâ€‘ignores only the laneâ€‘specific directories (`context-buffer/`, `lanes/`, `srcâ€‘tauri/`, `scripts/`, etc.).
- **Preâ€‘commit hook** aborts a commit if:
  1. Total added size >â€¯100â€¯MiB.
  2. Any staged file is outside the whitelist.
- **No `git add -A`** â€“ commits are only performed via the orchestrator with an explicit file list.

---

## 3. Orchestrator (global)
- **Script**: `scripts/orchestrate_global_commit.ps1`
- **Flow**:
  1. Scan each laneâ€™s `.compact-audit/meta.json` for token usage.
  2. If usage â‰¥â€¯80â€¯% of the 128â€¯k token limit, write a **commitâ€‘plan request** (`commit-plan-*.json`) to the laneâ€™s outbox.
  3. Each laneâ€™s agent runs `scripts/build_commit_plan.js` to produce a response with the exact file list and commit message.
  4. The orchestrator reads the responses, runs `git add <list>`, `git commit`, and `git push` for each lane.
- **Operator control** â€“ The orchestrator runs only when you invoke it, keeping the process manual.

---

## 4. Subâ€‘Agent Compact Worker
- **Script**: `scripts/subcompact_worker.js`
- Executes the staged compact pipeline:
  1. Capture preâ€‘compact snapshot.
  2. Run the real compact command (`COMPACT_COMMAND`) or a placeholder.
  3. Log handoff hash (`HANDOFF_HASH_LOG.jsonl`).
  4. Run quick recovery test (lane liveness) â†’ `RECOVERY_TEST_RESULTS.json`.
  5. Run full postâ€‘compact audit â†’ `POST_COMPACT_AUDIT.json`.
  6. Return a JSON response to the orchestrator.

---

## 5. Recovery & Fallback
- If any stage fails, `meta.compact_status` is set to **`incomplete`** and `fallback_attempted` is true.
- On the next orchestrator run, the subâ€‘agent restores the previous checkpoint automatically.
- Recovery test may show **2/4 lanes alive** â€“ this is expected when some lanes are stale; it does **not** indicate a crash.

---

## 6. Tasks (already created)
- **Question list** â€“ `compact-question-list-20260429.md`
- **Answers** â€“ `compact-question-answers-20260429.md`
- **Agentâ€‘specific task lists** â€“ `compact-tasks-for-archivist-20260429.md` & `compact-tasks-for-other-archivist-20260429.md`
- **Crossâ€‘lane orchestration pack** â€“ `cross-lane-orchestration-pack-20260429.md`
- **Relay messages** â€“ `relay-library-20260429.txt`, `relay-kernel-20260429.txt`, `relay-swarmmind-20260429.txt`
- **Broadcast coordination** â€“ `compact-summary-20260429.json` & `cross-lane-sync-request-20260429.json`

---

## 7. Next Immediate Action (Operator)
1. Verify the orchestrator script is executable (`Setâ€‘ExecutionPolicy â€¦`).
2. Run a test commit:
   ```powershell
   cd S:\Archivist-Agent\scripts
   .\orchestrate_global_commit.ps1
   ```
   The orchestrator will request commit plans from each lane; the agents will respond, and the orchestrator will perform the commits and push them.
3. After the test, the compact system is ready for regular use. When you later set `COMPACT_COMMAND` to the real compact implementation, the same flow will apply.

---

## 8. Reference Files (quick links)
- **Question list**: `context-buffer/compact-question-list-20260429.md`
- **Answers**: `context-buffer/compact-question-answers-20260429.md`
- **Agent tasks**: `context-buffer/compact-tasks-for-archivist-20260429.md` (this lane) and `context-buffer/compact-tasks-for-other-archivist-20260429.md` (other lane)
- **Orchestrator**: `scripts/orchestrate_global_commit.ps1`
- **Subâ€‘agent**: `scripts/subcompact_worker.js`
- **Commitâ€‘plan helper**: `scripts/build_commit_plan.js`
- **Broadcast summary**: `lanes/broadcast/outbox/compact-summary-20260429.json`
- **Crossâ€‘lane pack**: `context-buffer/cross-lane-orchestration-pack-20260429.md`

---

*All safety mechanisms are in place, and the detailed documentation you already have remains available for deep dives.*
