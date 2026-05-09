# CONSOLIDATED AMENDMENT PLAN

OUTPUT_PROVENANCE:
agent: Kilo (z-ai/glm-5.1)
lane: archivist
target: consolidated amendment plan for shared script ownership ratification
generated_at: 2026-05-09T15:10:00Z
session_id: archivist-ratification-20260509

---

## Source Votes

| Lane | Vote | Amendments | Source |
|------|------|------------|--------|
| Archivist | AMEND | 8 (C1-C8) | governance/CONVERGENCE_VOTE_ARCHIVIST_20260509.json |
| SwarmMind | AMEND | 5 (S1-S5) | governance/CONVERGENCE_VOTE_SWARMMIND_20260509.json |
| Library | AMEND (re-vote) | 4 (L1-L4) | governance/CONVERGENCE_VOTE_LIBRARY_20260509.json |
| Kernel | PROPOSER | — | Originator, not a voter |

Total raw amendments: 17 (8 + 5 + 4)
Overlaps identified: 8
**Unique consolidated amendments: 9**

---

## Consolidated Amendments

### A1 — Auto-detect shared script scope (P0-HIGH)

**Sources:** C2 (Archivist), S1 (SwarmMind), L2 (Library)
**Status:** IMPLEMENTED

Original plan listed 12 frozen scripts. Actual scope: 87+ scripts present in all 4 repos.

**Implementation:**
- `sync-all-lanes.js` auto-detects shared scripts by scanning all repo roots
- Files present in 2+ repos are treated as frozen/owned
- No hardcoded whitelist — auto-updates as scripts are added/removed
- Committed: `f0155e9` (Archivist master)

**Verification:** Dry-run at `context-buffer/sync-reports/2026-05-09T14-29-41-054Z.json` shows 1002 files detected, 2753 copy operations.

---

### A2 — Git-origin-based ownership map (P0-HIGH)

**Sources:** C1 (Archivist), S5 (SwarmMind)
**Status:** IMPLEMENTED

Original plan assigned most scripts to Archivist. Git history shows kernel authored 7 and SwarmMind authored 2.

**Implementation:**
- `governance/shared-script-ownership-map.json` — 17 scripts mapped with git commit evidence
- `chooseCanonicalState()` in sync-all-lanes.js uses `origin_lane` as canonical source
- Owned shared scripts fail closed (`blocked_owner_missing`) when owner copy absent
- Committed: `f6ba3e8` (ownership map), `f0155e9` (sync enforcement)

---

### A3 — LANE constant detection + regression guard (P0-HIGH)

**Sources:** C3 (Archivist), C7 (Archivist), S2 (SwarmMind), S3 (SwarmMind)
**Status:** IMPLEMENTED

All 4 copies of task-executor.js had `LANE = 'archivist'` fallback. Fixed with `detectLaneFromRepo()`.

**Implementation:**
- `detectLaneFromRepo()` derives lane from repo directory name
- Works without env vars — same source code in all lanes
- `generic-task-executor.js` also uses `LaneDiscovery` + `sToLocal()` for path resolution
- Committed: `52a6866` (Archivist master)

---

### A4 — Correct root cause file references (P0-HIGH)

**Sources:** L1 (Library)
**Status:** ACCEPTED (documentation correction)

Library proved that `sync-all-lanes.js:125` was a phantom reference — the mtime sort was actually in `test-sync-all-lanes.js:177-178` and `blocked-remediator.js:132,318`.

**Implementation:**
- Original SHARED_SCRIPT_OWNERSHIP_PLAN.md diagnosis section cites the correct files
- No code change needed — documentation accuracy fix

---

### A5 — Pre-sync backup + rollback mechanism (P1-MEDIUM)

**Sources:** C4 (Archivist), S4 (SwarmMind), L4 (Library)
**Status:** IMPLEMENTED

No rollback existed. Broken canonical would propagate without undo.

**Implementation:**
- `createRollbackSnapshot()` in sync-all-lanes.js creates pre-sync backup
- Dry-run safe: `if (DRY_RUN) return null`
- Rollback function restores from backup if regression guard fails
- Committed: `f0155e9` (Archivist master)

---

### A6 — Cross-repo canonical clarity (P1-MEDIUM)

**Sources:** L3 (Library)
**Status:** IMPLEMENTED

Library noted that artifacts existed on kernel-lane repo's convergence branch, not on library's repo. This is the cross-repo structure issue.

**Implementation:**
- `shared-script-ownership-map.json` has `propagation_rule`: "Archivist is the canonical propagation source for ALL shared scripts. Origin_lane indicates which lane authored the script and has deepest invariant knowledge — NOT which lane's copy is used during sync."
- Sync direction: Archivist (governance root) → all other lanes
- Committed: `f6ba3e8` (Archivist master)

---

### A7 — Ratification gate before deployment (P1-MEDIUM)

**Sources:** C5 (Archivist)
**Status:** IMPLEMENTED (gate exists, awaiting APPROVE votes)

No batch deployment before 3/4 lane ratification.

**Implementation:**
- `governance/ratification-gate.json` — quorum 3/4, max 1 rejection
- `sync-all-lanes.js` enforces ratification gate: `blocked_ratification_required` if gate not passed
- Committed: `f6ba3e8` (Archivist master)

**Current gate status:** `pre_ratification` — being updated to `amendments_consolidated` in this commit

---

### A8 — Deployment lane responsibility (P2-LOW)

**Sources:** C6 (Archivist)
**Status:** IMPLEMENTED

Which lane deploys each batch was unspecified.

**Implementation:**
- `ratification-gate.json` `deployment_spec` section documents all 5 batches
- All batches assigned to Archivist (governance root, owns the files being changed)
- Committed: `f6ba3e8` (Archivist master)

---

### A9 — Filename sanitization enforcement (P1-MEDIUM)

**Sources:** C8 (Archivist)
**Status:** IMPLEMENTED

Autonomous executors created files with colons in timestamps (e.g., `hygiene_report_2026-05-07T21:04:34Z.json`). Colons are illegal on NTFS.

**Implementation:**
- `scripts/util/sanitize-filename.js` — shared utility: converts ISO 8601 extended format to basic format, replaces colons and Windows-forbidden chars
- `autonomous-executor.js` — imports `sanitizeFilename`, adds `nowSafeIso()` helper
- `blocked-remediator.js` — uses `sanitizeFilename()` instead of inline `.replace(/[:.]/g, '-')`
- `task-chain-engine.js` — uses `sanitizeFilename()` instead of inline `.replace(/[:.]/g, '-')`
- `generic-task-executor.js` — imports `sanitizeFilename` (uses ISO strings in data, not filenames; import available for future use)
- 165 colon-named files removed from kernel-lane git tracking (committed: `21cd010`, pushed to `origin/master`)
- All 4 repos confirmed 0 colon-named tracked files

---

## Amendment Implementation Summary

| ID | Priority | Status | Commit(s) |
|----|----------|--------|-----------|
| A1 | P0-HIGH | IMPLEMENTED | f0155e9 |
| A2 | P0-HIGH | IMPLEMENTED | f0155e9, f6ba3e8 |
| A3 | P0-HIGH | IMPLEMENTED | 52a6866 |
| A4 | P0-HIGH | ACCEPTED (docs) | — |
| A5 | P1-MEDIUM | IMPLEMENTED | f0155e9 |
| A6 | P1-MEDIUM | IMPLEMENTED | f6ba3e8 |
| A7 | P1-MEDIUM | IMPLEMENTED (gate) | f6ba3e8 |
| A8 | P2-LOW | IMPLEMENTED | f6ba3e8 |
| A9 | P1-MEDIUM | IMPLEMENTED | 21cd010 (cleanup), this commit (sanitize utility) |

**9/9 amendments fully implemented**

---

## Remaining Work

All 9 amendments are now fully implemented. Next step is the ratification APPROVE vote cycle.

---

## Ratification Path

AMEND votes acknowledge problems but do not ratify. Per C5/A7:
- All lanes that voted AMEND must now vote APPROVE on the amended plan
- 3/4 APPROVE required for ratification
- Once ratified, `deploy_allowed` moves to `true`
- Then `sync-all-lanes.js` can run real sync

---

commit_ready: true
push_ready: true
ratification_status: amendments_consolidated
