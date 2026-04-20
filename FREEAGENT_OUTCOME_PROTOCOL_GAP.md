# Outcome Protocol Gap Analysis

Date: 2026-04-19
Phase: 3

## Comparison: Current vs. Proposed

### Current State (Phase 3 Complete)

Our verification system returns:

```javascript
{
  valid: true|false,
  reason?: 'QUARANTINED' | 'MISSING_SIGNATURE' | 'LANE_MISMATCH' | ...,
  note?: string,
  itemId?: string,
  lane?: string
}
```

### Proposed State (Outcome Protocol)

The outcome protocol proposes:

```typescript
{
  status: "SUCCESS" | "FAILURE" | "ESCALATE" | "DEFER" | "QUARANTINE",
  lane: string,
  task_id: string,
  summary: string,
  confidence: number,  // 0.0 - 1.0
  result?: T,
  error_code?: string,
  reason?: string,
  requires?: Requirement[],
  escalation_target?: EscalationTarget,
  suggested_next_step?: string,
  evidence?: EvidenceRef[],
  blockers?: string[],
  trace_id?: string,
  created_at: string
}
```

---

## What We Have

| Feature | Status | Evidence |
|---------|--------|----------|
| SUCCESS equivalent | ✅ | `valid: true` |
| FAILURE equivalent | ✅ | `valid: false` (some cases) |
| QUARANTINE status | ✅ | `reason: 'QUARANTINED'` |
| Structured rejection | ✅ | No throws, structured objects |
| Reason codes | ✅ | `VERIFY_REASON.*` constants |
| Evidence logging | ✅ | `quarantine.log` |
| Lane identification | ✅ | `lane` field |
| Timestamp | ✅ | `created_at` equivalent |

---

## What We're Missing

| Feature | Gap | Priority |
|---------|-----|----------|
| ESCALATE status | No escalation mechanism | P1 |
| DEFER status | No deferred task handling | P2 |
| Confidence scoring | Binary valid/invalid only | P1 |
| `requires` field | No structured blocking reasons | P2 |
| `escalation_target` | No routing logic | P1 |
| `suggested_next_step` | No recovery guidance | P2 |
| `trace_id` | No correlation across lanes | P3 |
| Decision policy | No threshold enforcement | P1 |
| Routing rules | No "4 minds > 1" mechanism | P1 |

---

## Core Principle Alignment

### Proposed Core Rule

```
task => SUCCESS | FAILURE | ESCALATE | DEFER | QUARANTINE
```

vs.

```
task => valid: true | valid: false
```

### "Do Not Force Completion" ✅

**Current implementation:**
- Verification failures return `valid: false`
- Queue throws on verification failure
- No fake success possible

**Matches proposed intent:**
- No partial work labeled SUCCESS
- No missing evidence labeled verified
- Deterministic failures terminate or quarantine

### "Allow Help" ⚠️

**Current implementation:**
- Recovery endpoint exists but is informational
- No routing to other lanes
- No escalation mechanism

**Gap:**
- Cannot request assistance from Library/Archivist
- No `ESCALATE` status to trigger routing

### "Route Uncertainty" ❌

**Current implementation:**
- Binary result (valid/invalid)
- No confidence scoring
- No "uncertain but not failed" state

**Gap:**
- Cannot express "90% confident but need verification"
- Cannot defer low-confidence tasks
- Cannot escalate without failing

### "Block Fake Success" ✅

**Current implementation:**
- Strict mode enforced by anchor
- Fallback paths eliminated
- Verification order enforced

**Matches proposed intent:**
- No fallback acceptance after deterministic rejection
- No legacy acceptance mode
- Recovery cannot override local decision

---

## Recommended Integration

### Phase 4 Addition (Reliability Pass)

Add to Phase 4 deliverables:

1. `core/protocols/outcome.js` - Outcome schema
2. `core/protocols/decision-policy.js` - Confidence thresholds
3. `orchestrator/escalation-manager.js` - Routing logic
4. `FREEAGENT_ESCALATION_PROTOCOL.md` - Documentation

### Minimal Implementation

Start with confidence scoring:

```javascript
// Convert current verification result to outcome
function toOutcome(verificationResult) {
  if (verificationResult.valid) {
    return {
      status: "SUCCESS",
      confidence: 1.0,
      result: verificationResult,
      created_at: new Date().toISOString()
    };
  }
  
  if (verificationResult.reason === 'QUARANTINED') {
    return {
      status: "QUARANTINE",
      confidence: 0.95,
      reason: verificationResult.note,
      created_at: new Date().toISOString()
    };
  }
  
  return {
    status: "FAILURE",
    confidence: 0.0,
    error_code: verificationResult.reason,
    created_at: new Date().toISOString()
  };
}
```

### Confidence Thresholds

```javascript
const POLICY = {
  completion_threshold: 0.9,  // >= 0.9 may complete
  escalation_threshold: 0.8,  // < 0.8 must escalate
  quarantine_on_contradiction: true
};
```

---

## Policy File Addition

Add to `FREEAGENT_SYSTEM_ANCHOR.json`:

```json
{
  "outcome_policy": {
    "completion_threshold": 0.9,
    "escalation_threshold": 0.8,
    "allowed_statuses": ["SUCCESS", "FAILURE", "ESCALATE", "DEFER", "QUARANTINE"],
    "forbid_partial_success": true,
    "forbid_unverified_success": true,
    "quarantine_on_verification_contradiction": true,
    "default_escalation_target": "ORCHESTRATOR"
  }
}
```

---

## Gate Addition

Add to Phase 4 gate:

> No lane may return SUCCESS unless confidence, evidence, and result payload satisfy protocol validation. Otherwise must return ESCALATE, DEFER, FAILURE, or QUARANTINE.

---

## Summary

| Aspect | Status |
|--------|--------|
| Phase 3 complete | ✅ All deliverables done |
| Fallback elimination | ✅ Verified |
| Hardening tests | ✅ 4/4 pass |
| Outcome protocol | ⚠️ Partially aligned |
| Recommendation | Add to Phase 4 or 5 |

**Bottom line:** Current implementation enforces honesty and blocks fake success. Missing: confidence scoring and escalation routing.

---

Last updated: 2026-04-19
