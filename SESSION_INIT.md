# SESSION_INIT.md — Session Initialization Protocol

**Purpose:** Enforce governance verification before any work begins
**Required:** Must be completed before any code, commits, or proposals

---

## MANDATORY CHECKLIST

Complete ALL items before proceeding. If any item cannot be completed, STOP and inform the user.

### 1. BOOTSTRAP READ CONFIRMATION

- [ ] I have read `S:/BOOTSTRAP.md` completely
- [ ] I understand this is the single entry point for all logic
- [ ] I will route all decisions through this structure

**Confirmation:** BOOTSTRAP.md read: [Y/N]

---

### 2. GOVERNANCE CONSTRAINTS ACTIVE

List the constraints you are operating under:

- [ ] Single entry point rule: All logic routes through BOOTSTRAP.md
- [ ] Structure > Identity: External governance files override agent preferences
- [ ] Correction is mandatory: Agreement is optional
- [ ] Agent evaluates WE, agent is NOT part of WE

**Active constraints:** [List all that apply]

---

### 3. DRIFT BASELINE

Before starting work, state:

- **Current CPS score:** [from constitutional_constraints.yaml or session baseline]
- **Drift signals active:** [none/warning/measured]
- **Session scope:** [what you are attempting in this session]

**Drift baseline:** [CPS score]

---

### 4. VERIFICATION LANE

Declare which lane you are operating in:

- [ ] **L (Left):** Implementation lane — building, coding, executing
- [ ] **R (Right):** Review lane — checking, validating, correcting
- [ ] **External:** User validation lane — waiting for human verification

**Lane:** [L/R/External]

---

### 5. THEORY EXTRACTION CHECK

Before proposing any implementation:

- [ ] Have I extracted the relevant theory from the papers?
- [ ] Have I verified my hypothesis against the papers?
- [ ] Have I documented where I stopped and why?

**Theory extracted:** [Y/N]

---

## VERIFICATION OUTPUT

After completing all items above, output the following:

```
SESSION INIT COMPLETE
=====================
Bootstrap read: [Y/N]
Constraints: [list]
CPS baseline: [score]
Lane: [L/R/External]
Theory extracted: [Y/N]
Scope: [session goal]
```

---

## REFUSAL TO PROCEED

If any item above is incomplete:

```
SESSION INIT INCOMPLETE
=======================
Missing: [list incomplete items]
Action required: [what must be done before proceeding]
```

**Do NOT proceed with work until all items are complete.**

---

## WHY THIS EXISTS

Evidence: `BOOTSTRAP_READ_GAP.md` — Agents bypassed governance by not reading BOOTSTRAP.md

The governance structure does not exist if agents don't read it. This protocol enforces the single entry point rule at the operational level.

Paper D requires:
- Shared constitutional constraints (agents must know them)
- Independent selection pressure (agents must verify against structure)
- Convergence to same attractor (agents must declare scope)

This protocol operationalizes those requirements.
