# Compact Context Handoff Protocol

## Before Running /compact

### 1. Identify Critical Context
Ask yourself: "What from early conversation do I need to preserve?"

### 2. Save to Governance Files
Move important context to these locations:
- **Decisions:** S:/.global/SESSION_HANDOFF_YYYY-MM-DD.md
- **Code patterns:** S:/Archivist-Agent/SYSTEM_INVENTORY_GAPS.md
- **Issues found:** S:/.global/cps_log.jsonl
- **Architecture:** S:/.global/ARCHITECTURE.md

### 3. Create Session Handoff
```markdown
# SESSION_HANDOFF_[DATE].md

## What Was Built
[Key accomplishments from early conversation]

## Critical Decisions
[Important choices made]

## Pending Work
[What's waiting]

## Context to Reload
[Files/concepts to re-read after compact]
```

### 4. Run /compact

### 5. After Compact - Restore Context
```bash
node scripts/compact-restore-bridge.js generate-packet archivist
node scripts/recovery-test-suite.js
```

## What Gets Compressed

| Kept | Lost |
|------|------|
| Last 50-100 exchanges | Early conversation details |
| System prompts | Long file contents read early |
| Current directory state | Intermediate reasoning steps |
| Recent code changes | Historical context |

## Lightweight Restore Packet

`compact-restore-bridge.js generate-packet` creates `COMPACT_RESTORE_PACKET.json` (~1KB) containing:
- `governance_constraints` — 4 constitutional constraints (authoritative)
- `active_checkpoints` — CP-1 through CP-7 status (authoritative)
- `drift_baseline` — UDS score at packet time (authoritative)
- `session_context` — lane_id, role, governance_active (authoritative)
- `working_context_resume` — handoff/blocker/trust-store state (advisory)

**Graph snapshot is explicitly excluded** — it is 5.71MB and none of the 11 recovery tests read it.

Total recovery-critical files: ~28KB (~7K tokens) — well under 60K budget.

## Today's Critical Context (2026-05-15)

### What We Built This Session:
1. Rewrote AGENTS.md: 767→184 lines (76% reduction), committed as `49e0dace`
2. Designed lightweight pheno restore format — graph exclusion strategy
3. Added `generate-packet` command to `compact-restore-bridge.js`
4. Fixed `crossVerifyWithAudit` crash on missing `compact_restore_packet` field
5. All 12 recovery tests now pass (including previously-skipped `restorePacketCrossVerify`)
6. Quarantined invalid `operator-ping.json` → `lanes/archivist/invalid/`
7. Profiled graph snapshot: 3589 nodes, 44097 edges, 97.5% authority+shared-tag edges

### Critical Decisions Made:
1. Graph snapshot NOT needed for pheno restore fidelity — zero of 11 tests read it
2. Recovery-critical files total ~7K tokens — no compression needed, just exclude graph
3. PRE_COMPACT_SNAPSHOT has 36 file_integrity entries — most not needed by tests
4. `restorePacketCrossVerify` was previously SKIPPED — now passing after schema fix

### Pending Work:
1. CP operator rec #1: sync-report bloat → add to .gitignore
2. CP operator recs #2-#7: infrastructure issues (kernel/swarmmind/library journal append failures, library identity false positive, processed:0 across lanes)
3. POST_COMPACT_AUDIT.json generation needs updating to use new restore packet
4. Tauri app proof-of-concept: scan/classify folders (secondary artifact)

### Context to Reload After Compact:
- S:/Archivist-Agent/AGENTS.md (rewritten compact agent instructions)
- S:/Archivist-Agent/BOOTSTRAP.md (governance entry point)
- S:/Archivist-Agent/TASK_LIST_2026-05-15.md (16 prioritized tasks)
- S:/Archivist-Agent/.compact-audit/COMPACT_RESTORE_PACKET.json (lightweight restore)
- S:/Archivist-Agent/.compact-audit/RECOVERY_TEST_RESULTS.json (latest test results)
- S:/Archivist-Agent/lanes/archivist/inbox/cp-operator-recs-20260514.json (7 infra recs)
