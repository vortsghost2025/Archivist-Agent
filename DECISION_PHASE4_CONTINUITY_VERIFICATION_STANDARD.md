# DECISION_PHASE4_CONTINUITY_VERIFICATION_STANDARD

**Authority:** Archivist-Agent (Lane 1, Authority 100)  
**Date:** 2026-04-18  
**Phase:** 4 — Continuity Verification Standardization  
**Status:** DRAFT — awaiting sign‑off

---

## 1. Objective

Standardize **continuity verification** across all three lanes (Archivist, SwarmMind, Library) so that every lane:

1. **Validates its own integrity** on startup (fingerprint + lineage).
2. **Classifies recovery state** after resilience events (retry exhaustion).
3. **Emits and consumes** the appropriate queue items (`INCIDENT`, `APPROVAL`, `REVIEW`) to maintain a coordinated organism‑wide health view.
4. **Exposes a verification script** (`verify_continuity.js`) that the Library can run to attest fitness.

This ensures the three‑lane organism operates as a **cohesive, self‑aware system** rather than three isolated processes.

---

## 2. Scope & Applicability

| Lane | Must implement | Verification script | Queue emission | Queue consumption |
|------|----------------|-------------------|----------------|------------------|
| **SwarmMind (2)** | ✅ Already implemented (Phase 3.7) | `scripts/verify_continuity.js` (exists as `test-continuity.js`) | ✅ `INCIDENT` on drift/quarantine | — |
| **Library (3)** | ❌ Not yet | **Required** – create `scripts/verify_continuity.js` | — | ✅ Must consume `INCIDENT` items |
| **Archivist (1)** | ❌ Not yet | **Required** – create `scripts/verify_continuity.js` | ✅ Must consume `APPROVAL` items | ✅ Must consume `INCIDENT` items |

---

## 3. Standardized Continuity Stack

All lanes must adopt the following modules (copy from SwarmMind `src/resilience/`):

```
src/resilience/
├── RecoveryClassifier.js      — classify retry outcomes
├── ContinuityVerifier.js      — fingerprint + lineage + gate integration
├── RetryWrapper.js            — timeout + exponential backoff + jitter
└── RetryHelpers.js            — convenience wrappers (HTTP, file, queue)
```

**State directories** (create if missing):

```
.continuity/          # fingerprint.json, lineage.json
state/                # recovery-state.json
audit/                # audit.log (shared with SwarmMind)
queue/                # queue logs (COMMAND, REVIEW, APPROVAL, INCIDENT, IDEA_DEFERRED)
```

**Startup integration** (pseudo‑code, language‑agnostic):

```javascript
// After lane gate initialization, before main app
const { ContinuityVerifier } = require('./src/resilience/ContinuityVerifier');
const continuity = new ContinuityVerifier({ gate: laneGate, projectRoot: process.cwd() });
const result = continuity.verify();

if (result.action === 'QUARANTINE' || result.action === 'LANE_DEGRADATION') {
  console.error('Continuity check failed — aborting startup');
  process.exit(1);
}
if (result.action === 'DRIFT_DETECTED' || result.action === 'REVIEW_NEEDED') {
  console.warn('Continuity warning — operator review recommended');
}
```

---

## 4. Verification Script Specification

Each lane must provide `scripts/verify_continuity.js` with:

1. **Fingerprint sanity check** — recompute and compare to stored value.
2. **Lineage report** — print last 3 session fingerprints and classifications.
3. **Recovery status** — dump current `recovery-state.json`.
4. **Audit tail** — show last 10 audit events.
5. **Queue health** — show pending `INCIDENT` and `APPROVAL` counts.
6. **Exit codes:** `0` = healthy, `1` = quarantine/lane_degradation, `2` = drift/review_needed.

The Library will run these scripts for all three lanes during formal verification.

---

## 5. Queue Protocol Addendum

### 5.1 INCIDENT Item (emitted by any lane on quarantine/drift)

```json
{
  "type": "incident_report",
  "target_lane": "archivist",
  "required_action": "review_continuity",
  "payload": {
    "lane": "<originating_lane>",
    "incident_type": "fingerprint_drift | quarantine | lane_degradation",
    "timestamp": "...",
    "details": { ... },
    "fingerprint": "<current_hash>",
    "recovery_classification": "..."
  }
}
```

### 5.2 APPROVAL Item (Archivist → SwarmMind/Library)

Used to approve continuity‑related policy changes (e.g., whitelist update, quarantine override).

### 5.3 REVIEW Item (SwarmMind → Library)

Used to request verification of a new continuity configuration version.

---

## 6. Implementation Sequence

1. **Library** implements continuity stack + `verify_continuity.js` (parallel with Archivist).
2. **Archivist** implements continuity stack + `verify_continuity.js` AND adds **INCIDENT** and **APPROVAL** queue consumers to its regular sync loop.
3. Both push to their respective repos and update `SESSION_REGISTRY.json` to indicate continuity‑ready status.
4. **Library** runs full three‑lane continuity verification and produces `FORMAL_VERIFICATION_GATE_PHASE4.md`.
5. **Archivist** reviews and either:
   - Declares `PRODUCTION_READY` (all lanes continuity‑verified), or
   - Requests fixes (quarantine not handled, queue consumer missing, etc.).

---

## 7. Verification Criteria (Library Checklist)

For each lane, verify:

- [ ] `src/resilience/RecoveryClassifier.js` present and tests pass (`test-recovery.js`)
- [ ] `src/resilience/ContinuityVerifier.js` present and tests pass (`test-continuity.js`)
- [ ] `RetryWrapper` accepts `recoveryClassifier` parameter
- [ ] Startup sequence runs continuity verifier before main app
- [ ] `scripts/verify_continuity.js` exists and exits cleanly
- [ ] State directories (`.continuity/`, `state/`) created on first run
- [ ] INCIDENT queue item emitted on quarantine/drift
- [ ] Archivist additionally consumes `APPROVAL` and `INCIDENT` queues
- [ ] All tests pass (`npm test` or individual scripts)
- [ ] No cross‑lane write violations during continuity operations

---

## 8. Governance & Constraints

- **No bypass**: Continuity verifier must run **after** `laneContextGate.initialize()` and **before** any business logic.  
- **Immutable logs**: Audit and queue logs are append‑only; any tampering triggers fingerprint change → drift → quarantine.  
- **Operator clearance**: Quarantine can only be cleared by explicit operator action (` RecoveryClassifier.clearQuarantine()` ), not automatically.  
- **Evidence chain**: Every continuity event is recorded in at least three places: audit log, queue item, and state file.  
- **OS‑level enforcement**: The continuity stack operates in userland; ultimate containment still requires seccomp‑bpf (future Phase 3.5+).

---

## 9. Production Authorization Gate

**Library** must issue `FORMAL_VERIFICATION_GATE_PHASE4.md` containing:

```
Phase: 4
Components: [RecoveryClassifier, ContinuityVerifier, RetryWrapper, verify_continuity.js]
Lanes: SwarmMind (verified), Library (verified), Archivist (verified)
Status: APPROVED | BLOCKED
Blockers: (list any missing pieces)
Recommendation: PROCEED | HOLD
```

Upon receipt, **Archivist** will:
1. Publish `DECISION_PRODUCTION_READY.md` (or `DECISION_PHASE4_APPROVED`).
2. Update `SESSION_REGISTRY.json` with `phase4_continuity_ready: true`.
3. Authorize any subsequent phases (e.g., Phase 5: Real‑time Monitoring & Alerting).

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lane forgets to run verifier on startup | Quarantine not triggered → drift | Gate integration in `governed-start.js` (enforced) |
| Queue consumer missing → incidents pile up | Blind spots in health | Library verification includes queue consumer check |
| State directory missing → verifier crashes | Startup failure | Verifier auto‑creates directories; test includes first‑run scenario |
| Fingerprint too sensitive (minor changes trigger drift) | Noise |指纹 includes only critical governance files; linting rule to avoid unnecessary edits |
| Recovery classifier thresholds mis‑tuned | False positives/negatives | Adjustable via `state/recovery-config.json` (future) |

---

## 11. Timeline (Suggested)

| Day | Milestone |
|-----|-----------|
| T+0 | Archivist publishes this decision |
| T+1 | Library & Archivist both have continuity stack + `verify_continuity.js` in dev branches |
| T+2 | Both push to origin; Library runs Phase 4 verification suite |
| T+3 | Library produces `FORMAL_VERIFICATION_GATE_PHASE4.md` |
| T+4 | Archivist declares `PRODUCTION_READY` (or requests fixes) |

---

## 12. Conclusion

Continuity verification is the **glue** that turns three independently executing lanes into a single organism with memory, self‑awareness, and recovery capability. Standardizing it across all lanes is the final step before operational deployment.

SwarmMind has led the design and implementation. Now Library and Archivist must adopt the same pattern to achieve convergence.

---

**Archivist signature required:**  
`[ ] Approved — implement immediately`  
`[ ] Approved with modifications (see comments)`  
`[ ] Rejected — see rationale`

---

