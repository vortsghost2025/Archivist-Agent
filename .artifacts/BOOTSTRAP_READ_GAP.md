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

### Layer 1: Instruction Hardening (DONE)
- AGENTS.md modified with mandatory precondition section
- Refusal clause added
- Governance constraints explicitly listed

### Layer 2: Session-Init Ritual (DONE)
- SESSION_INIT.md created
- Checklist must be completed before work
- Verification output required

### Layer 3: Checkpoint Before Commit (DONE)
- Commit checkpoint added to CHECKPOINTS.md
- Governance consultation verified before commit
- Theory extraction confirmed

### Layer 4: Runtime Enforcement (NOT IMPLEMENTED)
**This is the missing piece.**

Layer 1-3 make governance "checked" at the instruction layer.
Layer 4 would make governance "blocking" at the runtime layer.

**What Layer 4 would require:**
- Host/runtime explicitly loads SESSION_INIT.md
- Command/workflow requires completion before proceeding
- Human/operator rejects work that skips verification
- Or: automated check that detects bypass and blocks operation

**Current status:** Layer 1-3 implemented. Layer 4 outside current scope (requires tooling changes beyond documentation).

---

## Success Criteria

**The gap is closed when:**

1. No agent can operate without confirming BOOTSTRAP.md read
2. Governance constraints are acknowledged before any work
3. Drift status is tracked throughout session
4. Handoffs include governance verification state
5. The structure is mandatory, not voluntary

**Current status:**

Layers 1-3 substantially reduce the gap:
- Governance initialization is now explicit (SESSION_INIT.md)
- Governance initialization is now visible (verification output)
- Governance initialization is now procedural (checkpoints)

But Layer 4 (runtime enforcement) is not yet implemented:
- Full closure depends on host/runtime or operator enforcement
- Without Layer 4, the system is "stronger, but still partly voluntary"

**Accurate claim:**
The gap is reduced at the instruction/workflow layer. Full closure requires runtime-level enforcement that detects and rejects operation without verified governance initialization.

---

## Current State

**Stopped at:** Layer 1-3 implemented, Layer 4 not yet designed
**Layer 4 = runtime enforcement that detects and rejects operation without verified governance initialization**
**Next action:** Define what Layer 4 would look like, or acknowledge this is outside current scope
