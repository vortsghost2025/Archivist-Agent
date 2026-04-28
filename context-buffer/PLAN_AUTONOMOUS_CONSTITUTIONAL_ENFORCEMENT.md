# PLAN: Convergence to Autonomous Constitutional Enforcement

**Author:** Archivist Lane
**Date:** 2026-04-28
**Status:** PROPOSAL — requires 3-lane ratification
**Priority:** P1
**Evidence Base:** constraint-lattice.js, CPS_ENFORCEMENT.md, VERIFICATION_LANES.md, CHECKPOINTS.md, NFM-003

---

## 0. Core Thesis

The current governance stack is **reactive**: it checks known constraints against observed behavior and flags violations. This is necessary but insufficient. The system cannot discover constraints it doesn't already have.

**The evolution:** Make the lattice **proactive** — it must autonomously discover missing constraints by observing failure patterns, propose new constraints to close those gaps, ratify them through verification lanes, and enforce them without requiring manual coordination scaffolding.

**Key principle from operator:** Delegation surface doesn't invent new failure classes; it expands reachable failure modes. The lattice must actively discover missing constraints that prune the delegation surface until failure modes converge with the governance specification.

This is NFM convergence in practice: as the system grows more capable, the constraint lattice must grow correspondingly tighter, or capability outpaces safety.

---

## 1. Current State Assessment

### 1.1 What Exists (Reactive Layer)

| Component | Location | Function | Limitation |
|-----------|----------|----------|------------|
| ConstraintLattice | `src/bridge/constraint-lattice.js` | Meet/join/respectsLattice/detectDrift | Only checks constraints already in the lattice |
| CPS Enforcement | `CPS_ENFORCEMENT.md` | Score-gated action execution | Score drops after violation, not before gap |
| Checkpoints | `CHECKPOINTS.md` | 7-checkpoint pre-action gate | Gates known risks, cannot gate unknowns |
| Verification Lanes | `VERIFICATION_LANES.md` | Dual L/R verification | Requires human or second lane to verify |
| UDS Scoring | `USER_DRIFT_SCORING.md` | Operator drift detection | Detects user drift, not structural gaps |
| SchemaValidator | `src/lane/SchemaValidator.js` | Message compliance | Validates against known schema only |
| Deformation Scoring | constraint-lattice.js:143-169 | Paper D drift scoring | Scores observed vs expected — cannot score what's not expected |

### 1.2 The Gap

The system can answer: "Does this behavior violate known constraints?"
The system **cannot** answer: "What constraint is missing that would explain this failure?"

NFM-003 demonstrated this exactly: `internalBinding` was an unknown bypass vector. The lattice could not detect it because no constraint covered it. The failure was discovered by penetration, not by lattice introspection.

---

## 2. Architecture: Autonomous Discovery Loop

### 2.1 Overview

```
OBSERVE → CLASSIFY → HYPOTHESIZE → PROPOSE → RATIFY → ENFORCE → MONITOR
   ↑                                                              │
   └──────────────────────────────────────────────────────────────┘
```

This is a **closed-loop constraint discovery system**. It runs continuously and converges: each cycle discovers missing constraints and tightens the lattice, reducing the delegation surface until failure modes converge with the governance specification.

### 2.2 Phase 1: OBSERVE (Failure Pattern Collection)

**What:** Collect all signals that indicate a constraint gap, not just a constraint violation.

**Signals that indicate a GAP (not just a violation):**

1. **Quarantine influx** — Messages quarantined for structural reasons (not just missing fields) may indicate a schema gap, not a malformed message.
2. **CPS drops without known cause** — If CPS drops and no known constraint explains it, a missing constraint is the hypothesis.
3. **Deformation log clustering** — If multiple `DIMENSION MISMATCH` or `UNKNOWN` drift types cluster around the same area, the lattice is missing a constraint there.
4. **Checkpoint bypass** — If an action passes all checkpoints but produces a bad outcome, a checkpoint is missing.
5. **Cross-lane inconsistency** — If lanes disagree on a result but neither violates a known constraint, the constraint set is incomplete.
6. **Operator override frequency** — If the operator must override frequently in a specific domain, the lattice lacks automation-grade constraints there.

**Implementation:**

```javascript
class ConstraintGapDetector {
  constructor(lattice, quarantineManager, deformationLog) {
    this.lattice = lattice;
    this.quarantine = quarantineManager;
    this.deformationLog = deformationLog;
    this.gapCandidates = [];
  }

  scanForGaps() {
    const signals = [];

    // Signal 1: Quarantine clustering
    const quarantinePatterns = this.analyzeQuarantinePatterns();
    signals.push(...quarantinePatterns);

    // Signal 2: Deformation log UNKNOWN/DIMENSION_MISMATCH clustering
    const driftPatterns = this.analyzeDriftClusters();
    signals.push(...driftPatterns);

    // Signal 3: CPS drops without known violation
    const cpsAnomalies = this.analyzeCPSAnomalies();
    signals.push(...cpsAnomalies);

    return this.classifyGapSignals(signals);
  }

  analyzeQuarantinePatterns() {
    // Group quarantined messages by failure type
    // If >3 messages fail for the same structural reason,
    // that's a gap signal, not a compliance failure
  }

  analyzeDriftClusters() {
    // Find UNKNOWN and DIMENSION_MISMATCH entries in deformation log
    // Cluster by proximity in constraint space
    // Each cluster = candidate gap
  }

  classifyGapSignals(signals) {
    // Classify each signal:
    // - SCHEMA_GAP: Missing field or enum value
    // - CONSTRAINT_GAP: Missing behavioral constraint
    // - CHECKPOINT_GAP: Missing pre-action check
    // - EVIDENCE_GAP: Missing verification requirement
    return signals.map(s => ({
      type: this.classifyGapType(s),
      evidence: s,
      confidence: this.assessConfidence(s),
      proposedConstraint: this.hypothesizeConstraint(s),
    }));
  }
}
```

### 2.3 Phase 2: CLASSIFY (Gap Taxonomy)

**What:** Categorize each gap signal by type and severity.

**Gap Types:**

| Gap Type | Description | Example | Severity |
|----------|-------------|---------|----------|
| `SCHEMA_GAP` | Missing field or enum in message schema | `audit` was missing from task_kind (fixed in commit 2005677) | P2 |
| `CONSTRAINT_GAP` | Missing behavioral constraint in lattice | No constraint for `internalBinding` bypass (NFM-003) | P0 |
| `CHECKPOINT_GAP` | Missing pre-action verification step | No checkpoint for OS-level boundary check | P1 |
| `EVIDENCE_GAP` | Missing verification requirement | `evidence_exchange` not required when it should be (fixed) | P2 |
| `DELEGATION_GAP` | Missing constraint on delegation surface | New lane or subagent added without constraint coverage | P0 |

**Confidence Assessment:**

- **HIGH** — Gap confirmed by 2+ independent signals (quarantine + drift + CPS anomaly)
- **MEDIUM** — Gap indicated by 1 signal with clear structural evidence
- **LOW** — Gap hypothesized from pattern but no direct evidence yet

Only HIGH and MEDIUM confidence gaps advance to PROPOSE.

### 2.4 Phase 3: HYPOTHESIZE (Constraint Synthesis)

**What:** For each confirmed gap, synthesize a candidate constraint.

**Constraint synthesis rules:**

1. **From SCHEMA_GAP:** Add missing field/enum to schema + add corresponding lattice constraint
2. **From CONSTRAINT_GAP:** Identify the behavioral invariant that was violated, name it, determine its implications (what other constraints it strengthens)
3. **From CHECKPOINT_GAP:** Identify the pre-condition that was missing, create a checkpoint for it
4. **From DELEGATION_GAP:** Identify the delegation boundary that was unconstrained, create a constraint that limits delegation to verified scope

**Naming convention:** `{DOMAIN}_{INVARIANT}` (e.g., `OS_LEVEL_BOUNDARY`, `DELEGATION_SCOPE_VERIFIED`)

**Implication mapping:** Each new constraint MUST declare which constitutional invariants it strengthens. If it doesn't strengthen any, it's not a governance constraint — it's an operational preference.

### 2.5 Phase 4: PROPOSE (Lane Broadcast)

**What:** Broadcast the proposed constraint to all lanes for review.

**Format:** Schema-compliant inbox message with `type: 'task'`, `task_kind: 'proposal'`, `priority` based on gap severity.

**Content:**

```json
{
  "claim": "Constraint {NAME} is missing from the lattice",
  "evidence": "Path to gap analysis artifact",
  "proposed_constraint": {
    "name": "OS_LEVEL_BOUNDARY",
    "implies": ["STRUCTURE_OVER_IDENTITY", "CORRECTION_MANDATORY"],
    "gap_type": "CONSTRAINT_GAP",
    "confidence": "HIGH",
    "source_signals": ["NFM-003 internalBinding bypass", "deformation log cluster X"]
  },
  "ratification_required": true
}
```

**Every proposal MUST include:**
1. The constraint name and definition
2. Which constitutional invariants it strengthens (implication chain)
3. The evidence that motivated it (gap signals)
4. The expected enforcement behavior
5. A falsification test — what observation would prove this constraint is wrong?

### 2.6 Phase 5: RATIFY (3-Lane Convergence)

**What:** Lanes review the proposal. Ratification requires convergence.

**Ratification rules (from GOVERNANCE.md + VERIFICATION_LANES.md):**

| Gap Severity | Ratification Requirement |
|-------------|------------------------|
| P0 (CONSTRAINT_GAP, DELEGATION_GAP) | 3-lane convergence + operator acknowledgment |
| P1 (CHECKPOINT_GAP) | 2-lane convergence |
| P2 (SCHEMA_GAP, EVIDENCE_GAP) | 1-lane review + 24h no-objection |

**Ratification response format:**

```json
{
  "type": "response",
  "task_kind": "ratification",
  "body": "APPROVE | REJECT | AMEND",
  "amendments": "... (if AMEND)"
}
```

**Rejection requires evidence.** A lane cannot reject a proposal without providing a falsification: "This constraint is wrong because..."

**Amendment requires specificity.** A lane cannot amend without providing the exact change.

### 2.7 Phase 6: ENFORCE (Lattice Integration)

**What:** Ratified constraints are integrated into the lattice.

**Integration sequence:**

1. Add constraint to `ConstraintLattice` via `addConstraint()` or `addToConstitution()`
2. Update `createGovernanceLattice()` factory function
3. Add constraint to CPS weight table in `constitutional_constraints.yaml`
4. Update relevant checkpoint in `CHECKPOINTS.md`
5. Add schema enforcement if applicable
6. Run constraint lattice tests to verify no regressions
7. Commit + push

**Enforcement is immediate after integration.** No grace period. If the lattice has the constraint, it's enforced.

### 2.8 Phase 7: MONITOR (Deformation Tracking)

**What:** After enforcement, monitor the lattice for deformation caused by the new constraint.

**Monitor for:**

- New `DIMENSION MISMATCH` entries that reference the new constraint — indicates the constraint is too strict
- CPS drops attributable to the new constraint — indicates weight may need adjustment
- Quarantine of messages that were previously valid — indicates schema change was too narrow
- Cross-lane disputes referencing the new constraint — indicates ambiguous definition

**If deformation is detected:** The constraint becomes a candidate for amendment (Phase 4).

---

## 3. Delegation Surface Convergence

### 3.1 Delegation Amplification Theorem

> When agent A delegates to agent B, the failure modes of B become reachable failure modes of A, PLUS new failure modes from the delegation itself (miscommunication, scope ambiguity, timing).

**Consequence:** Every delegation step expands the failure surface. The only way to prevent this expansion from producing unbounded risk is to add constraints that prune the expanded surface back down.

### 3.2 Convergence Criterion

The lattice has converged when:

```
For all reachable failure modes F:
  There exists a constraint C in the lattice such that:
    C prevents F, OR
    C detects F before damage, OR
    C contains F to a known-safe boundary
```

This is NOT a claim that all failure modes are known. It IS a claim that for all failure modes the system has observed, it has constraints that handle them.

### 3.3 Practical Convergence Test

After each discovery cycle, run:

```javascript
function testConvergence(lattice, knownFailureModes) {
  const uncovered = [];
  for (const failure of knownFailureModes) {
    const covered = lattice.constraints.has(failure.constraint);
    if (!covered) uncovered.push(failure);
  }
  return {
    converged: uncovered.length === 0,
    uncovered_gaps: uncovered,
    coverage_ratio: 1 - (uncovered.length / knownFailureModes.length)
  };
}
```

---

## 4. Implementation Roadmap

### Phase A: ConstraintGapDetector (Week 1)

1. Implement `ConstraintGapDetector` class in `src/bridge/constraint-gap-detector.js`
2. Wire into existing `lane-worker.js` processing pipeline
3. Add gap signals from quarantine + deformation log
4. Tests in `src/bridge/__tests__/constraint-gap-detector.test.js`

**Deliverable:** System can detect and classify constraint gaps automatically.

### Phase B: Constraint Proposal Pipeline (Week 2)

1. Implement proposal creation from gap candidates
2. Wire proposal delivery to all 4 lane inboxes via `deliverMessage()`
3. Add `task_kind: 'proposal'` handling to lane-worker
4. Tests for proposal generation and delivery

**Deliverable:** System can broadcast proposed constraints to all lanes.

### Phase C: Ratification Tracker (Week 2-3)

1. Implement `RatificationTracker` — tracks proposal responses from lanes
2. Apply convergence rules (3-lane for P0, 2-lane for P1, 1-lane for P2)
3. Auto-integrate ratified constraints into lattice
4. Tests for ratification logic

**Deliverable:** System can ratify and integrate constraints without manual coordination.

### Phase D: Delegation Surface Audit (Week 3)

1. Enumerate all delegation paths in the system (lane-to-lane, agent-to-subagent, operator-to-system)
2. For each path, verify constraint coverage
3. Generate `DELEGATION_SURFACE_AUDIT.md`
4. Feed uncovered paths back into Phase A as gap signals

**Deliverable:** Complete map of delegation surface with constraint coverage.

### Phase E: Continuous Monitoring (Week 4)

1. Wire deformation monitoring into lattice operations
2. Add convergence test to post-compact audit suite
3. Add convergence metric to lane heartbeats
4. Dashboard: coverage ratio over time

**Deliverable:** System self-monitors constraint coverage and reports convergence progress.

---

## 5. Success Criteria

| Criterion | Measure | Target |
|-----------|---------|--------|
| Gap detection | ConstraintGapDetector identifies known gaps | All 6 NFM-003 bypass vectors detected |
| Proposal generation | System generates valid schema-compliant proposals | 100% schema pass rate |
| Ratification | Proposals reach convergence without manual intervention | P0: 3-lane in <24h, P1: 2-lane in <12h |
| Integration | Ratified constraints auto-added to lattice | Zero manual lattice edits needed |
| Convergence | Coverage ratio for known failure modes | ≥ 95% within 30 days |
| Stability | No regression in existing tests | All constraint-lattice tests pass |

---

## 6. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| False gap detection (over-constraining) | Falsification test required per proposal; deformation monitoring detects over-constraint |
| Proposal spam (too many low-confidence gaps) | Only HIGH/MEDIUM advance; LOW queued for batch review |
| Ratification deadlock (lanes never converge) | 24h timeout → escalate to operator; P2 auto-ratifies after no-objection |
| Constraint conflicts (new constraint contradicts existing) | Meet/join operations detect conflicts before integration |
| Lattice explosion (too many constraints) | Periodic constraint consolidation; merge implied constraints |
| Operator bypass of ratified constraints | RECIPROCAL_ACCOUNTABILITY.md already governs this; UDS Checkpoint 0 enforces |

---

## 7. Relationship to Existing Governance

This plan does NOT replace any existing governance document. It extends them:

| Existing | Extension |
|----------|-----------|
| `constraint-lattice.js` | Add `ConstraintGapDetector` + `RatificationTracker` |
| `CPS_ENFORCEMENT.md` | Add dynamic constraint weights from ratified proposals |
| `CHECKPOINTS.md` | Add auto-generated checkpoints from CONSTRAINT_GAP proposals |
| `VERIFICATION_LANES.md` | Add ratification convergence rules |
| `USER_DRIFT_SCORING.md` | Add gap-detection signals as UDS inputs |
| `GOVERNANCE.md` | Add autonomous discovery protocol |

---

## 8. NFM Convergence Statement

This plan operationalizes the Delegation Amplification Theorem:

> The delegation surface grows with capability. The constraint lattice must grow correspondingly. Autonomous discovery is the mechanism that ensures this co-growth without requiring manual intervention for each new constraint.

The system converges when: for every observed failure mode, the lattice contains a constraint that prevents, detects, or contains it. This is NOT completeness (unobserved failure modes may exist). This IS closure (every observed gap is closed).

**The lattice doesn't need to be perfect. It needs to be self-repairing.**

---

**End of Plan Document**

**Claim:** This plan provides a concrete path from reactive constraint checking to autonomous constitutional enforcement.
**Evidence:** `src/bridge/constraint-lattice.js` (current reactive implementation), `context-buffer/PLAN_AUTONOMOUS_CONSTITUTIONAL_ENFORCEMENT.md` (this document).
**Status:** unproven — requires implementation and ratification.
