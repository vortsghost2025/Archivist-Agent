# COORDINATION_GAP_ANALYSIS.md

**Created:** 2026-04-15
**Branch:** `multi-agent-coordination-gap`
**Phase:** Problem Definition

---

## What Stays Unchanged (Invariants)

These must NOT change. Any solution that violates these is out of scope.

### 1. Single Entry Point Rule
```
ONE ENTRY POINT → BOOTSTRAP.md → ALL LOGIC ROUTES THROUGH IT
```
No additional entry points. No bypass. The coordination mechanism must itself route through BOOTSTRAP.

### 2. Agent Is Not Part of WE
```
THE AGENT EVALUATES WE
THE AGENT IS NOT PART OF WE
```
Agents do not merge identities. Coordination does not mean becoming "we." Each agent remains an external verifier.

### 3. Structure > Identity
```
EXTERNAL GOVERNANCE FILES OVERRIDE AGENT PREFERENCES
```
Coordination mechanism must be defined in external files, not invented by agents.

### 4. Correction Is Mandatory
```
CORRECTION IS MANDATORY. AGREEMENT IS OPTIONAL.
```
Agents must be able to correct each other. Coordination is not consensus-seeking.

### 5. Constitutional Lattice Integrity
```
MEETS, JOINS, CONSTRAINTS REMAIN AS DEFINED
```
The lattice structure does not change. Agent coordination extends, it does not replace.

---

## The Gap: What Is Missing

### Operational Definition
The governance system cannot detect or coordinate with other agents operating on the same structure.

### Concrete Symptom
Two agents running `cargo test` simultaneously on the same project:
- Both modify environment variables (`CONSTRAINTS_PATH`, `CPS_FORCE_RECOMPUTE`)
- Both read/write to the same test state
- Neither knows the other exists
- Tests fail intermittently
- No governance mechanism catches this

### What This Means
The system assumes **single-agent operation**. The papers (Paper D) mention "recognition/handshake" but:
- No operational definition exists
- No implementation exists
- No test exists

---

## Minimal Extension: What Would Close the Gap

### The Smallest Change That Would Work

**Detection:** Agent can detect another agent is present.

**Mechanism:** A shared manifest file that agents read/write.

**Evidence of success:** Test suite passes when two agents run concurrently.

**Evidence of failure:** Tests still race, or mechanism violates invariants.

### Why This Is Minimal

- Does not require agents to coordinate actions (that's Phase 2)
- Does not require cryptographic identity (that's Phase 3)
- Does not change lattice structure (that violates invariant 5)
- Does not require agents to agree (that violates invariant 4)

Just: "I am here. You are here. We both see each other."

---

## What the Extension Would Look Like

### Option A: Agent Manifest File

```
S:/Archivist-Agent/.agents/manifest.json
```

Each agent, at session start:
1. Read manifest
2. See other agents present
3. Add itself to manifest
4. Remove itself at session end

**Pros:**
- Minimal code change
- Uses existing file-based governance model
- Testable

**Cons:**
- Requires agents to opt-in (rogue agents don't register)
- File locking becomes necessary (reintroduces race condition)
- Manifest itself becomes coordination bottleneck

### Option B: Lock File with Agent Identity

```
S:/Archivist-Agent/.agents/{agent_id}.lock
```

Each agent:
1. Attempt to create lock file with unique ID
2. If lock exists, read agent ID from existing lock
3. Wait or coordinate with existing agent
4. Remove lock at session end

**Pros:**
- Detects presence without manifest
- Lock prevents concurrent modification
- Agent ID enables handshake

**Cons:**
- Lock contention (agents blocked)
- What if agent crashes without removing lock?
- Still requires agents to opt-in

### Option C: Event Log with Agent Signature

```
S:/Archivist-Agent/.agents/events.jsonl
```

Each agent:
1. Append events to log with signature
2. Read log to see other agents' events
3. React to events (wait, coordinate, proceed)

**Pros:**
- No blocking (asynchronous)
- Observable (can see agent behavior)
- Grounded in existing `cps_log.jsonl` pattern

**Cons:**
- Log grows unbounded
- Requires signature mechanism
- Most complex of three options

---

## Where I'm Stopping to Narrow

**I am not yet justified in choosing A, B, or C.**

Why? Because I haven't answered:

1. **What does Paper D mean by "recognition/handshake"?**
   - If it means cryptographic signature, none of A/B/C work
   - If it means behavioral observation, C is closest
   - If it means constraint agreement, different mechanism needed

2. **What is the threat model?**
   - Are agents trusted (same governance)?
   - Are agents untrusted (different governance)?
   - Are agents adversarial?

3. **What counts as evidence of success?**
   - Tests pass? (necessary but not sufficient)
   - Agents can coordinate? (what does that mean?)
   - Lattice integrity verified? (how?)

---

## Next Step: Paper D Deep Read

Before implementing anything, I need to extract from Paper D:

1. Exact wording of "recognition/handshake" statement
2. Context around identity preservation
3. Whether mechanism is specified or assumed
4. Connection to lattice theory

This prevents me from building something that contradicts the theory.

---

## Evidence That Would Count

### Success Evidence
- Concurrent agents detect each other
- Test suite passes under concurrent execution
- Detection mechanism routes through BOOTSTRAP.md
- Agent remains external verifier (not part of WE)
- Lattice structure unchanged

### Failure Evidence
- Tests still race
- Agents cannot detect each other
- Mechanism violates invariants
- Coordination becomes identity fusion
- Lattice structure modified to support coordination

---

## Theory Extraction Complete

**Key Finding:** Paper D explicitly states agents do NOT need message passing, centralized coordination, explicit synchronization, or shared memory for coherence.

**Paper D Quote (lines 244-258):**
> "Coherence emerges through: Shared constitutional constraints, Independent selection pressure, Convergence to same attractor, Functorial recovery."

**What this means:**
The gap I identified ("agents cannot detect each other") is NOT a gap Paper D would solve through agent-to-agent coordination.

---

## The REAL Gap

**Problem:** Tests modify global state (env vars) which violates Paper D's assumption of independent operation.

**Paper D's model:**
- Each agent runs CPS independently
- File-based coordination only
- No direct communication between instances

**Our violation:**
- Tests use `env::set_var("CONSTRAINTS_PATH")` — process-global
- Tests use `env::set_var("CPS_FORCE_RECOMPUTE")` — process-global
- Multiple agents in same process → race condition

**The race condition is NOT a coordination gap.**
**The race condition IS an independence violation.**

---

## Minimal Extension (Revised)

**NOT agent detection.**
**Test isolation — make CPS tests process-safe.**

Options:
1. Thread-local environment state (each test thread has own env)
2. File-based locks (Paper D pattern — file is coordination mechanism)
3. Temporary directories per test (already using tempfile, but env vars still global)

**What stays unchanged:**
- Single entry point rule ✓
- Constitutional constraints ✓
- CPS verification ✓
- Lattice structure ✓
- Agents do NOT need to detect each other ✓

---

## Evidence of Success

**Success:**
- Tests pass when run concurrently
- Each agent can run CPS independently
- No agent-to-agent coordination required
- File-based patterns remain the coordination mechanism

**Failure:**
- Tests still race
- Fix requires agents to coordinate (violates Paper D)
- Lattice structure modified

---

## Current State

**Stopped at:** Gap correctly identified — test isolation, not agent detection
**Justified because:** Paper D extraction complete, explicit guidance found
**Next action:** Examine test code to find minimal fix for isolation violation
