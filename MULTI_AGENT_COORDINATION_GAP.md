# MULTI_AGENT_COORDINATION_GAP.md

**Created:** 2026-04-15
**Branch:** `multi-agent-coordination-gap`
**Status:** Research & Implementation Phase

---

## The Problem

The governance system is designed to detect drift from structure when a single agent operates on it. But as demonstrated today:

**When two agents operate on the same project simultaneously, neither can detect the other's presence.**

The symptom (test failures) is identical whether caused by:
- Self-inflicted parallel execution
- External agent execution
- Both simultaneously

This is a gap in the constitutional enforcement model.

---

## What the Papers Say

### Paper B — Constraint Lattices
- Defines how constraints compose under `meet` and `join`
- Assumes a single agent evaluating constraints
- Does not address concurrent evaluation

### Paper C — Phenotype Selection
- Agents stabilize into fixed-point behaviors under lattice pressure
- Assumes agents are observable to each other
- Does not address hidden concurrent agents

### Paper D — Drift & Identity
- Identity persists through "recognition/handshake"
- Correction must be mandatory and external
- **Implies** a recognition mechanism exists
- **Does not specify** how agents recognize each other

### Paper E — Operational Layering
- External verifier (Structure > Identity) — Archivist-Agent
- Assumes verifier is singular
- Does not address multiple verifiers or concurrent agents

---

## The Gap

**Recognition/Handshake mechanism is assumed but not implemented.**

The papers state that "identity persists through recognition/handshake, not raw memory" — but there is no mechanism for agents to:
1. Detect other agents operating on the same structure
2. Coordinate access to shared resources (env vars, files, tests)
3. Resolve conflicts when both agents modify the same state
4. Establish a trust or identity handshake

---

## Possible Solutions

### Option A: Lock-Based Coordination
- Implement file-based locks for shared resources
- Agents must acquire lock before modifying governance state
- Pros: Simple, proven pattern
- Cons: Lock contention, deadlock risk, doesn't detect hidden agents

### Option B: Process Registry
- Each agent registers itself in a shared manifest
- Agent reads registry at session start, sees other agents
- Pros: Visibility, coordination possible
- Cons: Requires agents to opt-in, doesn't prevent rogue agents

### Option C: Event Stream Broadcasting
- Agents publish events to a shared stream (file, message queue)
- Other agents subscribe and react to events
- Pros: Real-time coordination, observable
- Cons: Complexity, requires infrastructure

### Option D: Lattice-Based Handshake Protocol
- Define handshake as lattice operation (meet of agent identities)
- Agents exchange constraint signatures
- Handshake succeeds if agents share common constitutional sublattice
- Pros: Grounded in paper theory, testable
- Cons: Most complex, requires extending lattice model

---

## Research Questions

1. **What does "recognition/handshake" mean operationally?**
   - Is it cryptographic (key exchange)?
   - Is it structural (constraint signature comparison)?
   - Is it behavioral (fixed-point verification)?

2. **Can the lattice itself encode agent identity?**
   - Each agent as a node in the lattice?
   - Agent coordination as lattice composition?

3. **What's the minimum handshake to prevent concurrent drift?**
   - Simple "I am here" marker?
   - Full constraint signature exchange?
   - Behavioral commitment protocol?

4. **How does this affect the single entry point rule?**
   - Does each agent need its own entry point?
   - Or does the entry point become a coordination hub?

---

## Implementation Priorities

### Phase 1: Detection
- Implement agent presence detection mechanism
- Log when another agent is operating on same structure
- Update CPS scoring to account for concurrent access

### Phase 2: Coordination
- Define handshake protocol based on lattice theory
- Implement agent registration/manifest system
- Add coordination primitives to governance stack

### Phase 3: Formalization
- Prove handshake maintains lattice integrity
- Verify fixed-point stability under concurrent access
- Document operational correspondence to Paper D

---

## Success Criteria

The gap is closed when:

1. **Detection:** Agent can detect other agents operating on same structure
2. **Coordination:** Agents can coordinate access without drift
3. **Handshake:** Recognition protocol exists and is testable
4. **Formalization:** Implementation maps to Paper D "recognition/handshake" concept
5. **Verification:** Multi-agent test suite passes without race conditions

---

## UPDATE: 2026-04-15

**Original framing was incorrect.**

The gap was NOT "agents cannot detect each other."
The gap WAS "tests violate independence assumption."

**Paper D states (lines 260-264):**
> "Independent operation:
> - No direct communication between instances
> - File-based coordination only
> - Each instance runs CPS independently
> - No centralized controller"

The race condition was caused by tests modifying global state (`env::set_var`),
which violates "each instance runs CPS independently."

**Fix implemented:** Thread-local test environment
- Created `test_env.rs` module with thread-local state
- Tests now use thread-local variables instead of global env vars
- Each test thread has isolated CPS computation
- Production code unchanged

**Verification:**
```
cargo test -- --test-threads=4
running 39 tests
test result: ok. 39 passed; 0 failed
```

**What stays unchanged:**
- Single entry point rule ✓
- Constitutional constraints ✓
- CPS verification ✓
- Lattice structure ✓
- Paper D's model ✓

**The coordination gap is closed.**

Paper D's model does NOT require agent-to-agent coordination. Agents converge
through shared structure, not communication. The test isolation fix restores
the independence assumption, closing the gap.

---

## Notes

This work extends the governance framework from single-agent to multi-agent coordination while preserving:
- Single entry point rule
- Constitutional constraint enforcement
- External verification model
- Lattice-based drift detection

The goal is not to change the architecture, but to extend it to handle the reality of concurrent agent operations.
