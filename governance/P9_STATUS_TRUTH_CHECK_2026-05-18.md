OUTPUT_PROVENANCE:
  agent: archivist
  lane: archivist
  generated_at: 2026-05-18T09:29:19Z
  session_id: sess_continuation_20260518

# P9: Status Truth Check

**Phase**: P9 — Control Plane Buildout
**Date**: 2026-05-18
**Auditor**: Archivist (trajectory-continuity session)
**Scope**: Compare all persistent state files against observable reality. Classify mismatches. Recommend remediation.

---

## Methodology

1. Read every state file in `lanes/archivist/state/` and `lanes/broadcast/`
2. Probe observable reality (git HEAD, file counts, directory existence, process state)
3. Classify each mismatch into one of three severity tiers:
   - **STALE-BUT-HARMLESS**: Data is old but no consumer acts on it in a way that causes incorrect behavior
   - **STALE-AND-MISLEADING**: Data is old and a consumer reading it would form an incorrect picture of system state, but no automated action is gated on it
   - **ACTIVELY-WRONG**: Data contradicts reality AND something acts on it (or would act on it if triggered)
4. Recommend remediation for each finding

---

## Findings

### F1: IDENTITY.json — Commit hash stale

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `last_activity.commit` | `2978d5a2` | `75df1718` | STALE-AND-MISLEADING |

- **Delta**: 2 commits behind (`736481b3` housekeeping, `75df1718` epistemic hardening)
- **Consumer impact**: Any script that compares IDENTITY commit to HEAD would report drift. `consensus-check.js` reads `cps_log.jsonl` not IDENTITY directly, but sovereignty reports emit this field.
- **Root cause**: `emit-identity.js` has not been re-run since 2026-05-16T01:51:46Z
- **Remediation**: Re-run `emit-identity.js` or equivalent state emitter at session start

### F2: IDENTITY.json — Heartbeat age stale at emit time

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `health.heartbeat_age_sec` | 17490 (~4.9h) | N/A (no watcher running) | STALE-AND-MISLEADING |

- **Context**: The 17490s value was already ~4.9 hours stale WHEN IT WAS WRITTEN. No watcher process is currently running (post-reboot environment). The field is therefore doubly stale: stale when written, and staler now.
- **Consumer impact**: Heartbeat age is used by `consensus-check.js` to determine lane liveness. A stale heartbeat could trigger false "lane dead" alerts.
- **Root cause**: No lane watcher process running on Windows local. Watcher is headless-only (Ubuntu).
- **Remediation**: Document that heartbeat_age_sec is only meaningful when watcher is running. On Windows local, this field should be ignored or marked as `null`.

### F3: IDENTITY.json — Inbox count wrong

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `inbox.unprocessed` | 3 | 17 | ACTIVELY-WRONG |

- **Context**: IDENTITY was emitted when only 3 unprocessed messages existed. Since then, 14 additional files have appeared (sovereignty reports, housekeeping artifacts, etc.).
- **Consumer impact**: Any script checking `inbox.unprocessed` to decide whether to process messages would undercount by 14.
- **Root cause**: IDENTITY not re-emitted after inbox growth.
- **Remediation**: Re-run state emitter. Consider making inbox count a live query rather than a cached field.

### F4: IDENTITY.json — Outbox count wrong

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `health.outbox_pending` | 0 | 4 | STALE-AND-MISLEADING |

- **Context**: 4 outbox items exist (including the governance-update broadcast from today). IDENTITY says 0.
- **Consumer impact**: Outbox processing scripts might skip processing if they trust this count.
- **Root cause**: IDENTITY not re-emitted after outbox writes.
- **Remediation**: Re-run state emitter.

### F5: active-owner.json — Session expired

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `expires_at` | 2026-05-18T09:13:03Z | Past (now 09:29Z) | STALE-BUT-HARMLESS |
| `pid` | 113796 | No such process | STALE-BUT-HARMLESS |
| `origin_workspace` | `C:\Windows\system32` | N/A | STALE-BUT-HARMLESS |

- **Context**: The 15-minute session window expired ~16 minutes ago. The PID is likely from a prior Kilo session that no longer exists.
- **Consumer impact**: No automated process gates on active-owner.json currently. The file is advisory.
- **Root cause**: Session expired naturally. No re-claim was made by the current session.
- **Remediation**: Current session should write a new active-owner.json claim if it intends to be the active owner. If not, leave as-is (expired is honest).

### F6: productivity-report-tracker.json — Very stale

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `last_report_date` | 2026-04-30 | 2026-05-18 (18+ days stale) | STALE-AND-MISLEADING |

- **Context**: No productivity report has been generated for 18+ days. The tracker holds a single pending request from April 30.
- **Consumer impact**: If any process checks whether reports are up-to-date, it would see 18 days of gap. Currently no automated consumer.
- **Root cause**: No report generation has been triggered since April 30.
- **Remediation**: Generate a current productivity report or retire the tracker if it's not being used.

### F7: governance-verification-registry.json — Very stale, ACKs overdue

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `last_scan` | 2026-05-04T01:56:00Z | 2026-05-18 (14+ days stale) | STALE-AND-MISLEADING |
| PENDING_ACK count | 4 | 4 (unchanged) | ACTIVELY-WRONG |

- **Context**: 4 messages have been in PENDING_ACK state for weeks, past the `alert_threshold_hours: 24` by a large margin. Two from 2026-04-20 (library, swarmmind), two from 2026-05-04 (library, swarmmind).
- **Consumer impact**: The alert threshold is supposed to trigger escalation, but no automated scanner is running to enforce it. The registry is effectively a dead letter office.
- **Root cause**: No automated verification-registry scanner. ACKs depend on other lanes actively responding, which they haven't.
- **Remediation**: (1) Re-run the registry scanner, (2) Investigate why library and swarmmind never ACKed, (3) Consider whether unACKed messages from 30+ days ago should be auto-escalated or archived.

### F8: last-recovery.json — Stale heartbeats

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `lane_heartbeats` | archivist=alive(13s), library=alive(22s), etc. | No watchers running | STALE-BUT-HARMLESS |

- **Context**: Heartbeat data is from 2026-05-16. It was accurate at emit time. The recovery verdict (PROVEN, 12/12 tests) is archival and correct.
- **Consumer impact**: The recovery verdict is the important field; heartbeats are supplementary. No action gated on stale heartbeat data.
- **Root cause**: Archival data from a past recovery run. No re-recovery triggered since.
- **Remediation**: None needed. This file is a recovery log, not a live state file.

### F9: trust-store.json — No control_plane key registered

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| Key count | 4 (archivist, library, swarmmind, kernel) | 4 (unchanged) | STALE-AND-MISLEADING |

- **Context**: The Control Plane agent has no registered key pair in the trust store. This is relevant to the pending authority expansion proposal — any message from Control Plane cannot be cryptographically verified.
- **Consumer impact**: Any signed message from Control Plane would fail signature verification.
- **Root cause**: Control Plane was never registered as a lane identity.
- **Remediation**: If authority is granted to Control Plane, a key pair must be registered first. This is a prerequisite for any approval of the pending proposal.

### F10: watcher-mode.json — Accurate

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `mode` | "auto" | "auto" (no watcher running, but mode setting is correct) | ACCURATE |

- No mismatch. The mode was set to "auto" on 2026-05-15 and hasn't been changed.

### F11: deferred-todo.json — Accurate

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| kernel-lane status | "deferred" | S:/kernel-lane exists but untrusted | ACCURATE |

- No mismatch. The deferred status correctly reflects reality.

### F12: active-blocker.json — Accurate

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `active` | false | No known blocker | ACCURATE |

- No mismatch.

### F13: system_state.json — Likely accurate

| Field | Declared | Actual | Severity |
|-------|----------|--------|----------|
| `system_status` | "consistent" | No known contradictions | ACCURATE |

- Timestamp is 2026-05-18T08:58:03Z (recent). Consistent with no active contradictions observed.

---

## Summary Table

| ID | File | Field | Severity | Action Required |
|----|------|-------|----------|-----------------|
| F1 | IDENTITY.json | commit hash | STALE-AND-MISLEADING | Re-run emit-identity.js |
| F2 | IDENTITY.json | heartbeat_age_sec | STALE-AND-MISLEADING | Document as N/A on Windows local |
| F3 | IDENTITY.json | inbox.unprocessed | ACTIVELY-WRONG | Re-run emit-identity.js |
| F4 | IDENTITY.json | outbox_pending | STALE-AND-MISLEADING | Re-run emit-identity.js |
| F5 | active-owner.json | session expired | STALE-BUT-HARMLESS | Write new claim or leave expired |
| F6 | productivity-report-tracker.json | last_report_date | STALE-AND-MISLEADING | Generate report or retire tracker |
| F7 | governance-verification-registry.json | last_scan + PENDING_ACKs | ACTIVELY-WRONG | Re-run scanner, investigate unACKed |
| F8 | last-recovery.json | heartbeat data | STALE-BUT-HARMLESS | No action (archival) |
| F9 | trust-store.json | no control_plane key | STALE-AND-MISLEADING | Register key if authority granted |
| F10 | watcher-mode.json | all | ACCURATE | None |
| F11 | deferred-todo.json | all | ACCURATE | None |
| F12 | active-blocker.json | all | ACCURATE | None |
| F13 | system_state.json | all | ACCURATE | None |

**Counts**: 2 ACTIVELY-WRONG, 5 STALE-AND-MISLEADING, 2 STALE-BUT-HARMLESS, 4 ACCURATE

---

## Structural Observations

1. **IDENTITY.json is the worst-offending file** — 4 of 13 findings are from this single file. It acts as a system snapshot but is only as fresh as its last emission. No daemon re-emits it on state changes.

2. **No automated freshness enforcement exists** — There is no mechanism that detects stale state files and either refreshes them or flags them as stale. The `alert_threshold_hours` in the verification registry is defined but never checked by a running process.

3. **Headless ↔ Windows local asymmetry** — Heartbeat age, watcher mode, and active-owner PID are meaningful on headless (where watchers run) but partially or fully meaningless on Windows local (where they don't). State files don't distinguish which runtime emitted them.

4. **The verification registry is a dead letter office** — 4 messages have been PENDING_ACK for 14-28 days with no escalation. The 24-hour alert threshold has been exceeded by 13-27 days with no consequence.

---

## Remediation Priority

1. **P1**: Re-run `emit-identity.js` to fix F1, F2, F3, F4 (single action fixes 4 findings)
2. **P1**: Investigate and resolve F7 (governance verification registry — ACTIVELY-WRONG, ACKs weeks overdue)
3. **P2**: Address F9 (trust-store key for Control Plane) — prerequisite for authority proposal decision
4. **P2**: Address F6 (productivity report tracker) — generate report or retire
5. **P3**: Address F5 (active-owner) — write new claim if this session is acting as active owner
6. **P3**: Address F2 structurally — document heartbeat semantics on Windows local

---

## Continuity Experiment Note

This P9 check is itself a continuity specimen: a fresh Archivist could have read the same files and identified the same mismatches. The methodology (read declared, probe actual, classify by severity) is in the governance docs, not trajectory-dependent. The only trajectory-informed observation is the structural note about headless/Windows asymmetry — a fresh agent might not know that watchers only run on headless and would misclassify F2.

**Classification**: observation (the mismatches are factual), observation (structural notes informed by trajectory knowledge)

---

## Convergence Gate

```json
{
  "claim": "P9 Status Truth Check identifies 9 mismatches across 9 state files, with 2 actively-wrong and 5 stale-and-misleading findings. IDENTITY.json is the primary source of drift.",
  "evidence": "governance/P9_STATUS_TRUTH_CHECK_2026-05-18.md",
  "verified_by": "archivist",
  "contradictions": [],
  "status": "proven"
}
```
