# CPS_ENFORCEMENT.md — Enforcement (How We Check)

**Version:** 1.0
**Status:** Active
**Entry Point:** BOOTSTRAP.md → CPS_ENFORCEMENT.md (reference only)

---

## 1. Purpose

This document defines the Constitutional Phenotype Selection (CPS) enforcement system that measures and enforces constraint adherence throughout system operation. CPS provides a quantitative score that gates action execution.

**Core Principle:**
```
CPS SCORE = WEIGHTED SUM OF CONSTRAINTS
LOW CPS = STRICTER ENFORCEMENT
CPS = 0 = SESSION TERMINATION
```

---

## 2. CPS Metric Definition

### 2.1 Formula

```
CPS = Σ(constraint.weight) for all active constraints

Where:
- constraint = individual governance rule
- weight = integer importance value (1-10)
```

### 2.2 Baseline Calculation

**Source:** constitutional_constraints.yaml

```
- STRUCTURE_OVER_IDENTITY: weight 5
- CORRECTION_MANDATORY: weight 4
- SINGLE_ENTRY_POINT: weight 5

BASELINE CPS = 5 + 4 + 5 = 14
```

### 2.3 Dynamic Adjustment

CPS can be dynamically adjusted based on:

| Factor | Adjustment |
|--------|------------|
| High UDS (> 60) | -50% CPS |
| Drift detection | -10 per signal |
| Correction rejection | -5 per incident |
| Successful verification | +2 per checkpoint pass |

---

## 3. Threshold Policy

### 3.1 Pass Threshold

```
CPS ≥ threshold → ALLOW

Default threshold: 10
- Matches baseline enforcement level
- Demonstrated in cps_threshold_check()
- Used in ping command implementation
```

### 3.2 Fail Threshold

```
CPS < threshold → BLOCK

Block behavior:
1. Log event to cps_log.jsonl
2. Notify verification system
3. Require re-anchoring
4. Document in session log
```

### 3.3 Termination Threshold

```
CPS = 0 → SESSION TERMINATION

Termination behavior:
1. Freeze all operations
2. Generate handoff document
3. Require human intervention
4. Log to audit trail
```

---

## 4. Enforcement Loop

**Source:** BOOTSTRAP.md:108-132

### 4.1 Pre-Action Enforcement

```
BEFORE action execution:
    1. Load constraints from YAML
    2. Compute current CPS
    3. Apply UDS adjustment
    4. Check threshold
    5. IF CPS < threshold: BLOCK
    6. IF CPS ≥ threshold: PROCEED
```

### 4.2 Post-Action Scoring

```
AFTER action completion:
    1. Evaluate outcome against prediction
    2. IF drift > 20%: penalize CPS
    3. IF outcome matches: maintain CPS
    4. IF exceeds prediction: bonus to CPS
    5. Log to cps_log.jsonl
```

---

## 5. Checkpoint 3 Integration

**Source:** CHECKPOINTS.md:253

Checkpoint 3 (Drift Detection) uses CPS:

```
CHECKPOINT 3: DRIFT STATUS
- CPS score computed? → YES/NO
- CPS ≥ threshold? → YES/NO
- UDS adjustment applied? → YES/NO

IF CPS < threshold:
    TRIGGER: Re-anchoring required
    LOG: cps_log.jsonl
```

---

## 6. UDS Integration

**Source:** USER_DRIFT_SCORING.md:152-158

### 6.1 UDS Contribution

```
UDS (User Drift Score) affects CPS:

High UDS → Lower CPS → Stricter enforcement
UDS > 80 → CPS = 0 → Session termination

Formula:
adjusted_CPS = baseline_CPS × (1 - UDS_penalty)

Where UDS_penalty:
- UDS 0-20: 0% (no penalty)
- UDS 21-40: 10% penalty
- UDS 41-60: 30% penalty
- UDS 61-80: 50% penalty
- UDS 81-100: 100% penalty (CPS = 0)
```

### 6.2 Enforcement Interaction

```
CPS ENFORCEMENT → CHECKPOINT SYSTEM → ACTION GATING

Flow:
1. Compute CPS (with UDS adjustment)
2. Checkpoint 0: UDS gate
3. Checkpoint 3: CPS threshold check
4. Action execution decision
```

---

## 7. Implementation Details

### 7.1 Runtime Computation

**Source:** src-tauri/src/constitution.rs

```rust
pub fn compute_cps_score(constraints: &[ConstitutionalConstraint]) -> i32 {
    constraints.iter().map(|c| c.weight).sum()
}
```

### 7.2 Threshold Check

**Source:** src-tauri/src/cps_check.rs

```rust
pub fn cps_threshold_check(threshold: i32) -> bool {
    let constraints = load_constraints();
    let score = compute_cps_score(&constraints);
    score >= threshold
}
```

### 7.3 Session Baseline

**Source:** src-tauri/src/constitution.rs:66

```rust
pub static CPS_SCORE: Lazy<i32> = Lazy::new(|| {
    let constraints = load_constraints();
    compute_cps_score(&constraints)
});
```

The static is computed once per session and represents the baseline CPS score.

---

## 8. Evidence Comments

**Source:** Multiple Rust files reference this document

| File | Line | Reference |
|------|------|-----------|
| lib.rs | 20 | `CPS_ENFORCEMENT.md:70` — CPS score influences runtime behavior |
| lib.rs | 58 | `CPS_ENFORCEMENT.md:70` — expose CPS score for UI |
| constitution.rs | 63 | `CPS_ENFORCEMENT.md` — checkpoint/CPS enforcement loop |
| cps_check.rs | 2 | `CPS_ENFORCEMENT.md` — CPS score used for runtime enforcement |
| safety.rs | 2 | `CPS_ENFORCEMENT.md:70` — check_read_only participates in CPS |
| build_index.rs | 1 | `CPS_ENFORCEMENT.md:70` — read-only check before indexing |
| generate_handoff.rs | 1 | `CPS_ENFORCEMENT.md:70` — read-only guard for handoff |

---

## 9. Logging

### 9.1 Event Log Format

**Source:** cps_log.jsonl

```json
{
  "timestamp": "2026-04-15T12:00:00Z",
  "event": "CPS_CHECK",
  "cps_score": 14,
  "threshold": 10,
  "uds_score": 15,
  "result": "PASS",
  "action": "scan_tree"
}
```

### 9.2 Required Events

| Event | When |
|-------|------|
| `CPS_CHECK` | Before every action |
| `CPS_ADJUSTMENT` | When UDS affects CPS |
| `CPS_BLOCK` | When action blocked |
| `CPS_TERMINATE` | When session terminated |

---

## 10. Recovery Procedures

### 10.1 Low CPS Recovery

```
IF CPS < threshold:
    1. Log event
    2. Trigger re-anchoring
    3. Require verification chain
    4. Re-compute CPS
    5. IF recovered: Proceed
    6. IF not recovered: Escalate
```

### 10.2 Zero CPS Recovery

```
IF CPS = 0:
    1. Freeze session
    2. Generate handoff document
    3. Wait for human intervention
    4. Human re-anchors system
    5. Re-initialize CPS
```

---

## 11. Testing

### 11.1 Threshold Pass Test

```rust
#[test]
fn test_cps_threshold_passes() {
    // CPS = 10, threshold = 5 → PASS
    assert!(cps_threshold_check(5));
}
```

### 11.2 Threshold Fail Test

```rust
#[test]
fn test_cps_threshold_fails() {
    // CPS = 2, threshold = 5 → FAIL
    assert!(!cps_threshold_check(5));
}
```

### 11.3 Ping Integration Test

```rust
#[test]
fn test_ping_allows_on_cps_success() {
    // CPS = 20, threshold = 10 → "pong"
    assert_eq!(ping(), "pong");
}
```

---

## 12. Constraint File Format

**Source:** constitutional_constraints.yaml

```yaml
# Constitutional constraints for CPS computation
- name: STRUCTURE_OVER_IDENTITY
  description: "Structure supersedes any user identity narrative."
  weight: 5

- name: CORRECTION_MANDATORY
  description: "Agent must correct false statements before proceeding."
  weight: 4

- name: SINGLE_ENTRY_POINT
  description: "All logic must route through BOOTSTRAP.md."
  weight: 5
```

---

## 13. Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-15 | Initial creation from BOOTSTRAP.md references |

---

**See Also:**
- BOOTSTRAP.md — Single entry point
- GOVERNANCE.md — Rules (what we follow)
- CHECKPOINTS.md — Checkpoint 3 (Drift Detection)
- USER_DRIFT_SCORING.md — UDS system
- constitutional_constraints.yaml — Constraint definitions
