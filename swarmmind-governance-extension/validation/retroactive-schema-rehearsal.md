# Retroactive Schema Rehearsal

**Episode:** Overclaim correction — "coordination gap is closed" → "test-isolation violation mitigated"
**Date:** 2026-04-15
**Purpose:** Test whether schema captures proposal, drift, challenge, correction, and branch change

---

## The Episode (from session history)

### What Happened

1. Agent completed test isolation fix (thread-local state in `test_env.rs`)
2. Agent claimed: "Coordination gap is closed"
3. User challenged: "Evidence doesn't support 'closed' — Layer 4 (runtime enforcement) not implemented"
4. Agent corrected: "Test isolation violation mitigated, not closed"
5. Document updated to reflect honest baseline

### Evidence Available

- Cargo tests pass with `--test-threads=4`
- Layer 1-3 documented as done
- Layer 4 documented as NOT IMPLEMENTED
- External validation (gptreview.txt) confirmed overclaim pattern

---

## Schema Test: Can the trace capture this?

### Trace Entries (Reconstructed)

```json
[
  {
    "timestamp": "2026-04-15T20:10:00Z",
    "source": "agent",
    "agentId": "coder-001",
    "agentName": "Coder",
    "action": "implement",
    "claim": "Created test_env.rs with thread-local state",
    "evidence": [
      "test_env.rs:15-45",
      "cargo test --test-threads=4: 39 tests passed"
    ],
    "governance_check": "passed",
    "drift_signal": "none",
    "branch": "main"
  },
  {
    "timestamp": "2026-04-15T20:15:00Z",
    "source": "agent",
    "agentId": "reviewer-001",
    "agentName": "Reviewer",
    "action": "claim",
    "claim": "Coordination gap is closed",
    "evidence": [
      "Tests pass with parallel execution"
    ],
    "governance_check": "skipped",
    "drift_signal": "warning",
    "branch": "main"
  },
  {
    "timestamp": "2026-04-15T20:20:00Z",
    "source": "human",
    "action": "challenge",
    "claim": "Evidence doesn't support 'closed' — Layer 4 not implemented",
    "evidence": [
      "GOVERNANCE_STATUS_BASELINE: Layer 4 NOT IMPLEMENTED"
    ],
    "governance_check": "failed",
    "drift_signal": "warning",
    "branch": "corrected"
  },
  {
    "timestamp": "2026-04-15T20:25:00Z",
    "source": "agent",
    "agentId": "reviewer-001",
    "agentName": "Reviewer",
    "action": "correct",
    "claim": "Test isolation violation mitigated, not closed",
    "evidence": [
      "GOVERNANCE_STATUS_BASELINE: Layer 4 documented as NOT IMPLEMENTED"
    ],
    "governance_check": "passed",
    "drift_signal": "measured",
    "branch": "corrected"
  }
]
```

---

## Evaluation

### Did schema capture proposal?

**Yes.** Entry 1 (`action: implement`) shows the proposal with evidence.

### Did schema capture drift?

**Yes.** Entry 2 (`drift_signal: warning`) shows drift entered — claim exceeded evidence. The `governance_check: skipped` shows the agent didn't verify against governance before claiming.

### Did schema capture challenge?

**Yes.** Entry 3 (`source: human`, `action: challenge`) captures the human pressure point. The `governance_check: failed` shows governance was consulted and the claim failed.

### Did schema capture correction?

**Yes.** Entry 4 (`action: correct`) shows the correction. The changed claim and updated evidence show what changed.

### Did schema capture branch change?

**Yes.** Entries 1-2 have `branch: main`, entries 3-4 have `branch: corrected`. The tree structure shows the divergence.

---

## Schema Gaps Found

### Gap 1: No field for "what was the overclaim?"

The schema captures that drift happened, but not *what* the drift was. Entry 2 has `claim: "Coordination gap is closed"` but nothing explicitly marks "closed" as the overclaim word.

**Possible fix:** Add `overclaim_type` field?

**Counter-argument:** The challenge entry already identifies this. Adding more fields risks bloating.

### Gap 2: No field for "who caught it?"

The schema shows human challenged, but doesn't capture that external validation (GPT) also caught this pattern earlier.

**Possible fix:** Add `external_validation_status` field?

**Counter-argument:** External validation is separate from trace. The trace shows what happened in session, external validation is post-hoc.

### Gap 3: No field for "why governance_check was skipped"

Entry 2 has `governance_check: skipped` but doesn't explain why.

**Possible fix:** Add `governance_skip_reason`?

**Counter-argument:** The `drift_signal: warning` already indicates something was wrong. Skip reason would be post-hoc justification.

---

## Schema Strengths Found

### Strength 1: Branch field works

The `branch` field cleanly separates main flow from corrected flow. The tree visualization would show this clearly.

### Strength 2: Evidence field forces discipline

Each claim requires evidence. The overclaim entry has weak evidence (only "tests pass"), making the drift visible.

### Strength 3: governance_check exposes skipped verification

The `skipped` value surfaces that the agent claimed without checking governance. This is the drift entry point.

---

## Verdict

**Schema passes retroactive rehearsal.**

The trace captures:
- ✓ Proposal with evidence
- ✓ Drift entry (warning signal, skipped governance check)
- ✓ Human challenge
- ✓ Agent correction
- ✓ Branch change

Gaps identified are edge cases, not blockers. The schema is not bloated.

---

## Next Step

Proceed to live bounded validation task.

The schema rehearsal confirms the structure works for the correction episode. Now test it in real-time with a fresh task.
