# BOOTSTRAP_READ_GAP.md

**Created:** 2026-04-15
**Severity:** CRITICAL
**Status:** OPEN — Fix in progress

---

## The Gap

**What happened:**
When this project was loaded in opencode, the agent (me) did NOT automatically read BOOTSTRAP.md. I saw:
- `src-tauri/Cargo.toml` — treated as "the project"
- `AGENTS.md` — read because it's a standard opencode convention
- Governance files — NOT read

**Why this is critical:**
- The entire governance framework depends on BOOTSTRAP.md being the single entry point
- If agents can operate without reading governance, the governance doesn't exist in practice
- This is a structural vulnerability, not a documentation issue

**What should have happened:**
1. Agent reads BOOTSTRAP.md FIRST
2. Agent acknowledges governance constraints
3. Agent verifies against structure before proposing solutions
4. Agent does NOT proceed until these are complete

---

## Root Cause

**Technical cause:**
- Opencode's default behavior loads project structure (Cargo.toml, package.json, etc.)
- AGENTS.md references BOOTSTRAP.md but doesn't enforce the read
- No verification mechanism exists

**Design gap:**
- Single entry point is documented but not enforced
- Governance files are "available" but not "required"
- Agent can bypass by simply not reading

---

## The Risk

**What could go wrong:**

1. **Drift goes undetected:** Agent operates without knowing constraints
2. **Structure violated:** Agent makes decisions based on user preference, not governance
3. **Overclaiming:** Agent proposes solutions without extracting theory first
4. **Coordination bypass:** Multiple agents could operate without shared context

**This already happened:**
- I proposed "agent detection" without reading Paper D
- I would have implemented unnecessary handshake protocol
- The lattice caught it only because I stopped to extract theory
- A less careful agent would have proceeded

---

## Paper D Violation

**Paper D lines 244-258:**
> "Coherence emerges through: shared constitutional constraints, independent selection pressure, convergence to same attractor."

If agents don't share constitutional constraints (because they didn't read them), there IS no coherence. The ensemble cannot converge to the same attractor if agents don't know what the attractor is.

**This violates the independence assumption:**
- Independence requires knowing the constraints
- Agents operating without governance are not independent — they're ungrounded
- The lattice cannot enforce what the agent doesn't know

---

## Evidence Chain

1. BOOTSTRAP.md states: "ALL LOGIC ROUTES THROUGH THIS FILE"
2. AGENTS.md states: "Read S:/BOOTSTRAP.md before any other action"
3. Neither file enforces this — they only document it
4. Agent loaded project and bypassed governance
5. Governance did not operate until agent chose to read it
6. The structure is voluntary, not mandatory

---

## Gap Closure Requirements

**Minimum requirements:**

1. **Precondition enforcement:** Agent cannot proceed without confirming BOOTSTRAP.md read
2. **Verification step:** Agent must list active governance constraints
3. **Drift status check:** Agent must state current drift baseline
4. **Scope declaration:** Agent must declare what it's attempting

**Optional but recommended:**

5. **Commit checkpoint:** Before any commit, agent confirms governance consulted
6. **Handoff protocol:** Session handoffs include governance verification state
7. **Drift score tracking:** Agent reports drift score changes during session

---

## Implementation Plan

### Phase 1: AGENTS.md Modification
Add enforcement language at the top:
- Explicit "READ THIS FIRST" section
- Verification checklist before proceeding
- Refusal clause if not complete

### Phase 2: SESSION_INIT.md Creation
Protocol file that must be completed:
- Bootstrap read confirmation
- Governance constraints list
- Drift status
- Session scope

### Phase 3: Verification Checkpoint
Add to commit process:
- Governance consultation confirmation
- Theory extraction before implementation
- Overclaim check

---

## Success Criteria

**The gap is closed when:**

1. No agent can operate without confirming BOOTSTRAP.md read
2. Governance constraints are acknowledged before any work
3. Drift status is tracked throughout session
4. Handoffs include governance verification state
5. The structure is mandatory, not voluntary

---

## Current State

**Stopped at:** Gap documented
**Next action:** Implement AGENTS.md modification
