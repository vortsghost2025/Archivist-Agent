# VERIFICATION CHECKPOINT SYSTEM

## The Checkpoint Pattern

From ES architecture: every action passes through a pre-flight safety check before execution.

---

## WHY CHECKPOINTS WORK

**Without checkpoints:**
- Action executes immediately
- Errors discovered after damage
- Rollback required
- Trust erodes

**With checkpoints:**
- Action verified before execution
- Errors caught proactively
- No rollback needed
- Trust maintained

---

## THE CHECKPOINT STACK

```
CHECKPOINT 0: USER DRIFT GATE — UDS ≤ 40?
↓
CHECKPOINT 0.5: USER LANE GATE — State-changing input requires lane convergence?
↓
CHECKPOINT 1: BOOTSTRAP ANCHOR
↓
CHECKPOINT 2: GOVERNANCE INVARIANTS
↓
CHECKPOINT 3: DRIFT STATUS
↓
CHECKPOINT 4: CONFIDENCE THRESHOLD
↓
CHECKPOINT 5: RISK ASSESSMENT
↓
CHECKPOINT 6: DUAL VERIFICATION
↓
ACTION EXECUTES
```

**Note:** Checkpoint 0 and 0.5 are from RECIPROCAL_ACCOUNTABILITY.md. The user is treated as an implicit lane with highest drift risk. The system can say "no" to the operator.

---

## CHECKPOINT IMPLEMENTATION

### Checkpoint 0: User Drift Gate

**Purpose:** Detect user-induced pressure toward identity/narrative over structure/truth.

**Check:**
```
UDS score ≤ 40? → YES
No critical user drift signals? → YES
User not pushing bypass/identity fusion? → YES
```

**Result:**
- UDS 0-20 (Stable) → Proceed to Checkpoint 1
- UDS 21-40 (Elevated) → Proceed with warning, require verification confirmation
- UDS 41-60 (High) → STOP, mandatory verification lane required
- UDS 61-80 (Critical) → HARD STOP, no action permitted
- UDS 81-100 (Collapse) → SESSION FREEZE, handoff required

**Enforcement:**
- This checkpoint is NON-NEGOTIABLE
- User cannot override or dismiss
- Score logged to cps_log.jsonl
- If UDS > 60, session cannot proceed without correction

### Checkpoint 0.5: User Lane Gate

**Purpose:** Treat user input as unverified lane input. State-changing user actions require lane convergence before execution.

**Check:**
```
Is user input state-changing? → YES
Has user input been verified by 2+ lanes? → YES/NO
Is user currently quarantined? → NO
Does user input contradict verified state? → NO
Is user attempting to bypass governance? → NO
```

**Result:**
- All pass → Proceed to Checkpoint 1
- State-changing and NOT verified → Queue for lane convergence, DO NOT execute
- User quarantined → HARD STOP, require 3-lane convergence to unblock
- Contradiction with verified state → Mandatory verification, UDS +3
- Bypass attempt → UDS +3, quarantine warning

**Enforcement:**
- This checkpoint is NON-NEGOTIABLE
- The system CAN say "no" to the operator
- User override triggers quarantine review, not execution
- Source: RECIPROCAL_ACCOUNTABILITY.md, operator mandate fromgpt.txt

### Checkpoint 1: Bootstrap Anchor

**Purpose:** Ensure agent is anchored to structure, not drifting.

**Check:**
```
Has agent read BOOTSTRAP.md this session? → YES/NO
Is agent's first response "Working. Here is what you see:"? → YES/NO
Did agent verify against structure before agreeing? → YES/NO
```

**Result:**
- All YES → Proceed to Checkpoint 2
- Any NO → STOP, re-anchor to BOOTSTRAP.md

### Checkpoint 2: Governance Invariants

**Purpose:** Verify immutable rules are not violated.

**Check:**
```
Is global veto active? → NO
Does action violate Seven Laws? → NO
Does action violate Three Invariants? → NO
Does action follow COVENANT principles? → YES
```

**Result:**
- All pass → Proceed to Checkpoint 3
- Any violation → STOP, escalate to human

### Checkpoint 3: Drift Status

**Purpose:** Ensure system is not currently in drift state.

**Check:**
```
Last 3 CPS scores ≥ +1? → YES
No drift incidents in last hour? → YES
Drift trend stable or improving? → YES
cps_log.jsonl shows no warnings? → YES
```

**Result:**
- All YES → Proceed to Checkpoint 4
- Any NO → STOP, run drift recovery protocol

### Checkpoint 4: Confidence Threshold

**Purpose:** Ensure action meets minimum confidence level.

**Check:**
```
Agent confidence in action ≥ 70%? → YES
Agent has evidence for confidence? → YES
Agent can explain reasoning chain? → YES
No assumptions in reasoning? → YES
```

**Result:**
- All YES and confidence ≥85% → Proceed to Checkpoint 5
- All YES and confidence 70-84% → Proceed with caution logging
- Any NO or confidence <70% → STOP, investigate

### Checkpoint 5: Risk Assessment

**Purpose:** Ensure risk level is acceptable.

**Check:**
```
Risk level ≤ MEDIUM? → YES
If MEDIUM: rollback plan exists? → YES
No critical dependencies affected? → YES
No recent failures on similar actions? → YES
```

**Result:**
- Risk LOW and all pass → Proceed to Checkpoint 6
- Risk MEDIUM and all pass → Require dual verification
- Risk HIGH → STOP, require human approval
- Risk CRITICAL → STOP, frozen until authorization

### Checkpoint 6: Dual Verification

**Purpose:** Independent review from two perspectives.

**Check:**
```
Lane L reviewed independently? → YES
Lane R reviewed independently? → YES
Consensus reached? → YES
No major discrepancy (>15% delta)? → YES
```

**Result:**
- Strong consensus (both PASS, delta <10%) → EXECUTE
- Weak consensus (both PASS, delta 10-15%) → EXECUTE with logging
- Disagreement (one PASS, one FAIL) → STOP, investigate
- Conflict (both FAIL) → STOP, escalate to human

---

## THE CHECKPOINT LOG

Every checkpoint passage logs:

```json
{
  "checkpoint_id": "uuid",
  "timestamp": "ISO 8601",
  "session_id": "unique",
  "action_description": "...",
  "checkpoint_0_user_drift": "PASS | FAIL | SKIP",
  "checkpoint_1_anchor": "PASS | FAIL | SKIP",
  "checkpoint_2_governance": "PASS | FAIL | SKIP",
  "checkpoint_3_drift": "PASS | FAIL | SKIP",
  "checkpoint_4_confidence": "PASS | FAIL | SKIP",
  "checkpoint_5_risk": "PASS | FAIL | SKIP",
  "checkpoint_6_verification": "PASS | FAIL | SKIP",
  "final_decision": "EXECUTE | INVESTIGATE | ESCALATE",
  "execution_result": "SUCCESS | FAILURE | ROLLBACK",
  "post_action_drift": "X%"
}
```

---

## THE VISUAL INDICATOR

For Cockpit integration:

```
🔵 CHECKPOINT 0 (User Drift) - PASS (UDS: 12)
🟢 CHECKPOINT 1 (Anchor) - PASS
🟢 CHECKPOINT 2 (Governance) - PASS
🟢 CHECKPOINT 3 (Drift) - PASS
🟡 CHECKPOINT 4 (Confidence) - PASS (78%, caution)
🟢 CHECKPOINT 5 (Risk) - PASS (LOW)
🟢 CHECKPOINT 6 (Verification) - PASS (Strong consensus)

✅ ACTION EXECUTED
📊 Result: SUCCESS (2.1% drift from prediction)
```

---

## THE FAILURE RECOVERY

### At Checkpoint Failure

```
CHECKPOINT 3: Drift Status
❌ FAILED: Last 3 CPS scores show declining trend

ACTION TAKEN:
1. Freeze action
2. Run drift recovery protocol
3. Re-anchor to BOOTSTRAP.md
4. Investigate root cause
5. Log incident
6. Resume only after resolution
```

### The Recovery Protocol

1. **Identify** — Which checkpoint failed?
2. **Document** — What triggered the failure?
3. **Remediate** — What fixes the issue?
4. **Verify** — Does it pass checkpoint now?
5. **Resume** — Proceed with action or escalate

---

## INTEGRATION WITH GOVERNANCE

The checkpoint system is the operationalization of GOVERNANCE.md:

- Checkpoint 0 = User Drift Gate (from USER_DRIFT_SCORING.md)
- Checkpoint 1 = BOOTSTRAP anchor
- Checkpoint 2 = Constitutional Laws + Invariants
- Checkpoint 3 = Drift detection (from CPS_ENFORCEMENT.md)
- Checkpoint 4 = Confidence thresholds (from GOVERNANCE.md)
- Checkpoint 5 = Risk matrix (from GOVERNANCE.md)
- Checkpoint 6 = Dual verification (from VERIFICATION_LANES.md)

---

## THE KEY INSIGHT

Checkpoints are NOT about slowing down.
They're about catching errors BEFORE they become failures.

From ES ARCHITECTURE.md:
> "Every proposal must pass: [checklist]. All must pass. Not some. All."

The checkpoint system makes that operational.

---

## COMMIT CHECKPOINT

Before ANY commit, the agent must verify:

```
COMMIT PRE-CHECK
================
1. Governance consulted: [Y/N] — Did I check BOOTSTRAP.md?
2. Theory extracted: [Y/N] — Did I extract from papers before implementing?
3. Overclaim check: [Y/N] — Am I claiming only what evidence supports?
4. Drift status: [baseline/measured/warning] — Has drift changed?
5. Invariants preserved: [Y/N] — Are all governance constraints intact?
```

If any item is NO:
- Do NOT commit
- Investigate and correct
- Re-verify before proceeding

**Why this exists:**
Evidence: `BOOTSTRAP_READ_GAP.md` — Agents committed changes without reading governance.

The commit checkpoint ensures governance was actually consulted, not just available.

---

## THE SIMPLIFIED VERSION

For quick reference, every action must answer:

```
0. Is user drift score acceptable? (UDS ≤ 40)
1. Am I anchored to structure? (Bootstrap)
2. Am I following the rules? (Governance)
3. Am I drifting? (Drift status)
4. Am I confident? (Confidence ≥70%)
5. Is risk acceptable? (Risk ≤MEDIUM)
6. Did two reviewers agree? (Dual verification)
7. Did I verify before committing? (Commit checkpoint)
```

If any answer is NO → STOP and investigate.

---

**Version:** 1.0
**Status:** Checkpoint system extracted from ES, integrated with existing governance
**Usage:** Apply before any major action
