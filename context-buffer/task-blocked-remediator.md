# TASK ASSIGNMENT: Build blocked-remediator.js (Phase 3.2)

OUTPUT_PROVENANCE:
agent: z-ai/glm5 (Windows Archivist session)
lane: archivist
target: blocked-remediator-design
generated_at: 2026-05-07T22:15:00Z
session_id: windows-archivist-20260507

## OBSERVABILITY_DOMAIN
governance_blocked_task_recovery

## NEXT_SAFE_ACTION
Implement blocked-remediator.js per task spec

## Task

Build `scripts/blocked-remediator.js` — an autonomous script that scans `lanes/archivist/inbox/blocked/` and `lanes/archivist/inbox/quarantine/` for stale messages and applies known remediation patterns.

## Requirements

1. Scan `blocked/` and `quarantine/` directories for `.json` messages
2. Classify each message by age (stale = older than 24h) and type
3. Apply known remediation patterns:
   - E2E test artifacts older than 24h → move to `processed/`
   - Duplicate heartbeat files → deduplicate, keep newest
   - Schema-violation messages with fixable fields → auto-repair and re-inject to `inbox/`
   - Orphaned delivery logs (no corresponding outbox message) → archive
   - Messages with expired leases (`lease.expires_at < now`) → move to `expired/` subdirectory
4. Never auto-delete — only move between inbox subdirectories (`processed/`, `expired/`, `archive/`)
5. Generate a remediation report JSON with before/after counts
6. Dry-run by default (`--apply` to execute)
7. Node 20 compatible — no optional chaining (`?.`), use `(obj || {}).prop` patterns
8. Must not cross-lane `require()` — sovereignty compliant

## Current State

- Archivist blocked/: ~41 items, quarantine/: ~34 items (most from April/May)
- Library blocked/: ~14, quarantine/: ~6
- Kernel quarantine/: ~2
- SwarmMind quarantine/: ~2

## Constraints

- CONTRADICTION_RESOLUTION_PLAYBOOK applies: never auto-resolve CONTRADICTS edges
- Commit messages use `[LANE-1]` prefix
- COMMIT + PUSH as one action

## After Building

1. Run with `--dry-run` first
2. If results look reasonable, run with `--apply` on Archivist repo only
3. Commit + push immediately
4. Write remediation report to `context-buffer/blocked-remediation-report-{timestamp}.json`
