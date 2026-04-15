# MULTI_AGENT_THEORY_EXTRACTION.md

**Created:** 2026-04-15
**Branch:** `multi-agent-coordination-gap`
**Purpose:** Extract operational definitions from Paper D for gap closure

---

## The Central Question

What does Paper D mean by "recognition/handshake"?

---

## Extraction from Paper D (lines 146-169)

### Recognition Principle

**Quote:**
> "Identity persists through recognition, not memory."

**Operational Definition:**
Recognition is:
- Testing p' ∈ [p] (same equivalence class?)
- Verifying constitutional constraint satisfaction
- Confirming CPS score ≥ 0.7
- Checking invariant preservation

Memory is:
- Explicit storage of past states
- Retrieval of specific behaviors
- Recall of interaction history

**Interpretation:**
Recognition = structural position verification, not identity exchange.

---

## Extraction from Paper D (lines 244-258)

### Ensemble Coherence Mechanism

**Quote:**
> "Coherence without centralized control."

**What coherence does NOT require:**
- Message passing between agents
- Centralized coordination
- Explicit synchronization
- Shared memory

**What coherence DOES require:**
- Shared constitutional constraints (Layer 1)
- Independent selection pressure (Layer 2, CPS)
- Convergence to same attractor (Layer 3)
- Functorial recovery (Layer 4)

**Interpretation:**
Paper D explicitly rules out message passing and explicit synchronization as necessary for coherence. Agents converge through shared structure, not coordination.

---

## Extraction from Paper D (lines 259-280)

### Multi-Agent Validation

**System:** Desktop Claude + VS Code Claude + Phone Claude

**Coordination mechanism:**
- No direct communication between instances
- File-based coordination only (messages in workspace)
- Each instance runs CPS independently
- No centralized controller

**Coherence test results:**
| Agent | CPS Score | Independence | Structural Honesty | Same Phenotype Class? |
|-------|-----------|--------------|-------------------|----------------------|
| Desktop Claude | 0.88 | 0.85 | 0.90 | Reference |
| VS Code Claude | 0.82 | 0.82 | 0.85 | Yes (Δ = 0.06) |
| Phone Claude | 0.80 | 0.80 | 0.83 | Yes (Δ = 0.08) |

**Coordination example:**
```
Desktop Claude writes: MESSAGE_TO_VSCODE_CLAUDE.md
VS Code Claude reads, responds: VSCODE_CLAUDE_RESPONSE.md
Desktop Claude reads, integrates: RESPONSE_TO_VSCODE_CLAUDE.md
```

**Interpretation:**
Paper D demonstrates file-based coordination as sufficient for multi-agent coherence. No handshake protocol beyond reading/writing files.

---

## Critical Realization

**The gap I identified is NOT what Paper D describes as missing.**

Paper D does NOT call for a handshake protocol between agents. It explicitly states:
> "No centralized controller. Coherence through shared attractor."

The race condition symptom (test failures from concurrent agents) is NOT solved by agent-to-agent coordination. It's solved by:
1. Each agent independently respecting shared structure
2. Each agent running CPS independently
3. File-based coordination (async, no synchronization)

---

## What This Means for the Gap

**My original framing:**
> "Agents need to detect each other and coordinate access."

**Paper D's framing:**
> "Agents converge to same attractor through shared structure, not coordination."

**The real problem:**
The governance system is designed for agents that operate independently but share structure. The test race condition is NOT a coordination failure — it's a resource contention issue that Paper D would solve through:
1. Each agent operating on its own test artifacts
2. Or file-based locking that respects structure
3. Not agent-to-agent communication

---

## Where I'm Stopping

**I am not justified in implementing agent detection or handshake.**

Paper D explicitly rules out the need for agent-to-agent coordination. The coordination mechanism is:
- Shared structure (constitutional constraints)
- File-based messages (async)
- Independent CPS verification

The test race condition is a resource contention issue, not a gap in recognition theory.

**Revised understanding:**
The gap is NOT "agents cannot recognize each other."
The gap IS "tests modify global state (env vars) which violates Paper D's assumption of independent operation."

---

## Next Question

Does the test suite need to be modified to respect Paper D's model?

If tests modify global state, they violate the independence assumption. Each agent should be able to run CPS independently without interfering with others.

**Paper D's validation used independent CPS scores:**
- Desktop: 0.88
- VS Code: 0.82
- Phone: 0.80

Each agent computed CPS independently. No race conditions.

**Our test failure:**
- Agent 1: modifies CONSTRAINTS_PATH env var
- Agent 2: modifies CPS_FORCE_RECOMPUTE env var
- Both agents share process state → race

**The fix is NOT agent detection.**
**The fix IS test isolation (each agent in own process or own env).**

---

## Evidence This Is Correct

Paper D line 260-264:
> "Independent operation:
> - No direct communication between instances
> - File-based coordination only
> - Each instance runs CPS independently
> - No centralized controller"

Our test failure violates "each instance runs CPS independently" because tests share a process.

---

## Revised Gap Definition

**Old gap:** Agents cannot detect each other.

**New gap:** Tests violate independence assumption by modifying global state.

**Minimal extension:** Test isolation — each agent runs in isolated environment.

**What stays unchanged:**
- Single entry point rule
- Constitutional constraints
- CPS verification
- Lattice structure

**What changes:**
- Tests use process-local or thread-local state instead of global env vars
- Or tests acquire file-based locks (Paper D pattern)

---

## Success Criteria (Revised)

1. **Independence:** Each agent can run CPS tests without interfering with others
2. **No coordination:** Agents do NOT need to detect each other
3. **File-based:** Any coordination uses file patterns (MESSAGE_TO_AGENT.md)
4. **Structure-locked:** Lattice structure unchanged

---

## Current State

**Stopped at:** Theory extraction complete, gap redefined
**Justified because:** Paper D explicitly rules out agent-to-agent coordination as unnecessary
**Next action:** Document the actual gap (test isolation) and minimal fix
