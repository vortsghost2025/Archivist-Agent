# Enforcement Proof Gate Checklist

**Version:** 1.0  
**Date:** 2026-04-20  
**Source:** GOVERNANCE.md Section 13, Invariant 4

---

## Purpose

This checklist replaces string-presence gate tests with behavioral verification. A component is not complete until all four items are satisfied.

---

## The Four Requirements

### 1. RUNTIME CALL SITE

**Question:** Where is this component invoked in production?

**Required:**
- File path
- Function name
- Line number

**Example:**
```
Component: Outcome Protocol
Call site: VerifierWrapper.js, verify(), line 45
```

**Fail condition:** Cannot point to call site → component is dead code.

---

### 2. REAL EXECUTION TRACE

**Question:** What is the actual call chain from entry point to component?

**Required:**
- Entry point (API endpoint, queue consumer, etc.)
- Each function in the chain
- Final component invocation

**Example:**
```
Entry: Queue.push() [Queue.js:78]
  ↓
VerifierWrapper.verify() [VerifierWrapper.js:23]
  ↓
Outcome.fromVerificationResult() [outcome.js:156]
```

**Fail condition:** No traceable path → not integrated.

---

### 3. FAILURE CASE BLOCKED

**Question:** What specific failure does this component prevent?

**Required:**
- Input that would be wrong without component
- What component does to block it
- Evidence of blocking (test case, log, etc.)

**Example:**
```
Input: Invalid signature (key not in trust store)
Component action: Returns QUARANTINE outcome
Evidence: test-invalid-signature.js passes
```

**Fail condition:** Cannot identify blocked failure → component not enforcing.

---

### 4. BYPASS ANALYSIS

**Question:** Are there alternate paths that circumvent this component?

**Required:**
- List all code paths to the protected operation
- Confirm each path goes through component
- Identify any bypass branches

**Example:**
```
Path 1: Queue.push() → verify() ✓ (uses component)
Path 2: Queue.process() → verify() ✓ (uses component)
Path 3: Recovery endpoint → QUARANTINE ✓ (logs only, no override)

Bypass branches:
- HMAC fallback: REMOVED
- Unsigned accept: REMOVED
- Recovery override: FORBIDDEN

Result: No bypass exists
```

**Fail condition:** Bypass path exists → component can be circumvented.

---

## Gate Test Template

Replace string-presence checks with this format:

```javascript
// WRONG: String presence
check('Recovery override forbidden',
  fileContains(policyFile, 'recovery_override_allowed'));

// RIGHT: Behavioral verification
check('Recovery override is actually rejected',
  () => {
    const result = attemptRecoveryOverride();
    return result.status === 'REJECTED' && result.reason === 'OVERRIDE_FORBIDDEN';
  });
```

---

## Phase Completion Requirements

Before marking any phase complete:

1. **Builder self-checks**
   - Unit tests pass
   - Integration tests pass
   - Code compiles

2. **Enforcement Proof provided**
   - All four requirements documented
   - Evidence references included

3. **Adversarial review (Codex lane)**
   - Execution traced
   - Bypass paths identified
   - Behavioral tests run

4. **Operator signoff**
   - Contradictions resolved
   - Cross-lane consistency verified

---

## Common Failure Patterns

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Dead code | Tests pass but component never called | Integrate into execution path |
| Bypass exists | Component exists but alternate path skips it | Remove bypass branch |
| String-only gates | Check for text in file, not behavior | Replace with runtime tests |
| Self-verification | Builder marks complete without review | Require adversarial signoff |

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial creation from Phase 4 post-mortem |

---

**See Also:**
- GOVERNANCE.md Section 12 (Role Separation)
- GOVERNANCE.md Section 13 (Enforcement Proof Requirement)
- GOVERNANCE.md Invariant 4 (Execution Path Reality)
