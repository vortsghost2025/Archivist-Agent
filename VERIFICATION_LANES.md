# VERIFICATION_LANES.md — Process (How We Verify)

**Version:** 1.0
**Status:** Active
**Entry Point:** BOOTSTRAP.md → VERIFICATION_LANES.md (reference only)

---

## 1. Purpose

This document defines the dual verification process that ensures decisions are independently validated before execution. Two blind verification lanes must agree for an action to proceed.

**Core Principle:**
```
TWO INDEPENDENT VERIFICATIONS REQUIRED
LANE L + LANE R = CONSENSUS
DISAGREEMENT = INVESTIGATION
```

---

## 2. Dual Verification Architecture

```
DECISION POINT
│
┌─────┴─────┐
│           │
┌───▼───┐ ┌───▼───┐
│ LANE L│ │ LANE R│
│(blind)│ │(blind)│
└───┬───┘ └───┬───┘
    │           │
  PASS/FAIL   PASS/FAIL
  + confidence + confidence
    │           │
    └─────┬─────┘
          │
   CONSENSUS CHECK
          │
   ┌──────┼──────┐
   │      │      │
 AGREE  DISAGREE  BOTH FAIL
   │      │      │
PROCEED INVESTIGATE ESCALATE
```

**Note:** If the decision point originates from USER input (operator), an additional gate applies:

```
USER INPUT → Checkpoint 0.5 (User Lane Gate)
→ If state-changing: requires 2+ lane convergence before reaching DECISION POINT
→ If quarantined (UDS > 60): hard stop, 3-lane convergence required
→ See RECIPROCAL_ACCOUNTABILITY.md:3-4
```
          DECISION POINT
               │
         ┌─────┴─────┐
         │           │
     ┌───▼───┐   ┌───▼───┐
     │ LANE L│   │ LANE R│
     │(blind)│   │(blind)│
     └───┬───┘   └───┬───┘
         │           │
    PASS/FAIL   PASS/FAIL
    + confidence + confidence
         │           │
         └─────┬─────┘
               │
         CONSENSUS CHECK
               │
    ┌──────────┼──────────┐
    │          │          │
 AGREE     DISAGREE   BOTH FAIL
    │          │          │
 PROCEED   INVESTIGATE ESCALATE
```

---

## 3. Lane L (Left Lane)

### 3.1 Definition

Lane L performs verification from a structural perspective, checking against governance files and formal constraints.

### 3.2 Verification Steps

```
1. Read BOOTSTRAP.md
2. Check governance invariants
3. Verify against COVENANT.md values
4. Validate rule compliance (GOVERNANCE.md)
5. Assess constraint lattice integrity
```

### 3.3 Output

| Field | Description |
|-------|-------------|
| `result` | PASS or FAIL |
| `confidence` | 1-10 scale |
| `evidence` | List of file:line references |
| `concerns` | Any structural issues noted |

---

## 4. Lane R (Right Lane)

### 4.1 Definition

Lane R performs verification from an operational perspective, checking against evidence, tests, and runtime state.

### 4.2 Verification Steps

```
1. Execute test suite
2. Check evidence links
3. Verify runtime conditions
4. Assess risk factors
5. Validate user drift score
```

### 4.3 Output

| Field | Description |
|-------|-------------|
| `result` | PASS or FAIL |
| `confidence` | 1-10 scale |
| `evidence` | List of test results |
| `concerns` | Any operational issues noted |

---

## 5. Consensus Rules

### 5.1 Agreement Threshold

```
LANE L result == LANE R result
AND
|LANE L confidence - LANE R confidence| ≤ 3
→ CONSENSUS ACHIEVED
```

### 5.2 Disagreement Handling

```
LANE L result != LANE R result
→ MANDATORY INVESTIGATION

Investigation steps:
1. Compare evidence lists
2. Identify divergence point
3. Request third verification if needed
4. Document resolution
```

### 5.3 Double Fail Handling

```
LANE L result == FAIL
AND
LANE R result == FAIL
→ ESCALATION REQUIRED

Escalation steps:
1. Block action
2. Document failure reasons
3. Request human intervention
4. Log to drift detection system
```

---

## 6. Confidence Scoring

### 6.1 Lane Confidence Formula

```
confidence = base_confidence × evidence_weight × reliability_factor

Where:
- base_confidence = initial assessment (1-10)
- evidence_weight = 0.8 if evidence linked, 0.5 if not
- reliability_factor = historical accuracy (0.0-1.0)
```

### 6.2 Consensus Confidence

```
consensus_confidence = (L_confidence + R_confidence) / 2

Minimum threshold: 7
Below threshold: Additional verification required
```

---

## 7. Evidence Capture

### 7.1 Required Evidence Fields

```
- source_file: Path to source
- line_number: Line reference
- excerpt: Relevant text
- timestamp: When captured
- lane: L or R
```

### 7.2 Evidence Format

```
[EVIDENCE]
source: src/lib.rs:42
excerpt: "validate_path(&path).map_err(...)"
lane: L
confidence: 8
[/EVIDENCE]
```

---

## 8. Verification Workflow

### 8.1 Standard Flow

```
1. Decision point reached
2. Spawn Lane L verification
3. Spawn Lane R verification (parallel)
4. Collect results
5. Perform consensus check
6. Execute based on consensus:
   - AGREE: Proceed with action
   - DISAGREE: Investigation loop
   - BOTH FAIL: Escalate to human
```

### 8.2 Investigation Loop

```
WHILE disagreement exists:
    1. Compare evidence
    2. Identify divergence
    3. Request clarification
    4. Re-run affected lane
    IF resolution found:
        BREAK
    IF max_iterations reached:
        ESCALATE
```

---

## 9. Checkpoint 6 Integration

**Source:** CHECKPOINTS.md:256

Checkpoint 6 requires dual verification pass:

```
CHECKPOINT 6: DUAL VERIFICATION
- LANE L executed? → YES/NO
- LANE R executed? → YES/NO
- Consensus achieved? → YES/NO
- Confidence ≥ 7? → YES/NO

ALL YES = PASS
ANY NO = STOP
```

---

## 10. Edge Cases

### 10.1 Lane Timeout

```
IF lane execution > timeout_limit:
    Mark as INCOMPLETE
    Request retry or escalation
```

### 10.2 Evidence Conflict

```
IF LANE L evidence != LANE R evidence:
    Does NOT affect consensus
    Document discrepancy
    Review in post-action analysis
```

### 10.3 Low Confidence Agreement

```
IF consensus_confidence < 7:
Additional verification required
May spawn supplemental lane
```

### 10.4 User Quarantine Release Verification (NEW)

```
IF user quarantine active (UDS > 60):
  Spawn verification in ALL 3 lanes independently:
  
  Lane 1 (Archivist): Review user drift signals vs governance
  Lane 2 (Library): Verify against runtime evidence  
  Lane 3 (SwarmMind): Trace where drift entered execution path
  
  Each lane outputs: UNBLOCK or MAINTAIN_QUARANTINE
  
  Consensus rules:
  - 3/3 UNBLOCK → User restored to UDS 0
  - 2/3 UNBLOCK → User restored to UDS 20 (elevated monitoring)
  - 1/3 UNBLOCK → Quarantine maintained, review in 1 hour
  - 0/3 UNBLOCK → Session freeze, require external review

  Source: RECIPROCAL_ACCOUNTABILITY.md:4.2
```

---

## 11. Implementation Reference

**Source Code:**
- `src-tauri/src/safety.rs` — Path validation (Lane L candidate)
- `src/bridge/constraint-lattice.js` — Constraint checking (Lane L)

**Evidence Comments:**
- Multiple files reference `VERIFICATION_LANES.md` for dual verification pattern

---

## 12. Testing

### 12.1 Lane Independence Test

```
Given: Decision point
When: Both lanes execute
Then: Results are independent (no shared state)
```

### 12.2 Consensus Test

```
Given: LANE L = PASS, LANE R = PASS
When: Consensus check
Then: Action proceeds
```

### 12.3 Disagreement Test

```
Given: LANE L = PASS, LANE R = FAIL
When: Consensus check
Then: Investigation triggered
```

---

## 13. Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-15 | Initial creation from BOOTSTRAP.md references |

---

**See Also:**
- BOOTSTRAP.md — Single entry point
- GOVERNANCE.md — Rules (Checkpoint 6 definition)
- CHECKPOINTS.md — Checkpoint 6 implementation
