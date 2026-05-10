# Compact Subagent Integration Status (2026-04-29)


OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: compact subagent integration plan
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
compact-restore

## NEXT_SAFE_ACTION
Test subagent compact/restore cycle end-to-end

## What was changed

1. `scripts/subcompact_worker.js`
   - Removed local placeholder compact logic.
   - Delegates to canonical runner: `scripts/run-compact-with-audit.js`.
   - Reads:
     - `.compact-audit/POST_COMPACT_AUDIT.json`
     - `.compact-audit/RECOVERY_TEST_RESULTS.json`
     - `.compact-audit/meta.json`
   - Returns compact response with status, handoff hash, recovery, and audit summary.

2. `scripts/run-compact-with-audit.js`
   - Added `COMPACT_COMMAND` support.
   - If `COMPACT_COMMAND` is set, runs it as the real compact operation.
   - If not set, falls back to placeholder compact with explicit log message.

## Verification run

- Command executed: `node scripts/orchestrate_compact.js`
- Result: success, status `aligned`
- Meta stayed healthy (`compact_status: idle`) and handoff hash persisted.

## Operational note

To use a real compact operation, set environment variable before orchestrator:

`COMPACT_COMMAND=<your real compact command>`

Then run:

`node scripts/orchestrate_compact.js`
