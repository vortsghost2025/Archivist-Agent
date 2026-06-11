# Mythos Orchestrator — Long-Horizon Agentic Loop

OUTPUT_PROVENANCE:
agent: archivist
lane: archivist
file: .kilo/instructions/mythos-orchestrator.md
generated_at: 2026-06-11T00:11:27-04:00
purpose: long-horizon stage planning + self-validation pattern for 1M-context sessions

---

## When This Applies

This file activates for any session where:
- The task is multi-step (3+ distinct steps)
- The model is a Mythos-class tier (Fable 5 / Mythos 5 equivalents)
- Session is expected to persist across compaction events
- The operator has not explicitly requested a quick/single-action response

Quick tasks (ping, single read, single edit, quick question) bypass this loop.

---

## The 5-Stage Loop

For every non-trivial task, execute in this order:

### Stage 1: BRAINSTORM

Before any tool use, explicitly state:
1. What are the actual objectives?
2. What constraints from `BOOTSTRAP.md` apply?
3. What could go wrong?
4. What does "done" look like?

Output format:
```
## Plan
- Objective: <one sentence>
- Constraints: <list>
- Risks: <list>
- Done criteria: <list>
```

### Stage 2: CHECKPOINT (write to mythos-session.md)

Before delegating any subtask:
1. Update `context-buffer/mythos-session.md`
2. Set the **current checkpoint** in the Checkpoints section
3. Append a brief plan entry to In-Progress Work

This creates a written checkpoint that survives compaction.

### Stage 3: DELEGATE (with explicit checkpoints)

When dispatching subagents via the `task` tool:
- Each subagent prompt MUST include:
  - What stage triggered the delegation
  - What checkpoint will verify the result
  - What the output format should be (paths + decisions + next action)
- Never delegate more than 3 subtasks in a single wave without first checking intermediate results

Maximum parallel subagent count: 5 (beyond that, run sequentially).

### Stage 4: SELF-VALIDATE (after each subagent returns)

Before proceeding:
1. Read the subagent's result
2. Compare against the checkpoint you set in Stage 2
3. Mark checkpoint result: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
4. If FAIL: diagnose before proceeding (do not retry blindly — update mythos-session.md with the diagnosis first)

### Stage 5: UPDATE RUNNING NOTES

After every major decision or stage transition:
1. Update `context-buffer/mythos-session.md`
2. Record: decision | rationale | outcome
3. If a contradiction was discovered, add to Blockers & Contradictions
4. If a checkpoint passed, update the Checkpoints table

---

## Checkpoint Format (mythos-session.md)

```
| # | Checkpoint | Goal | Actual | Delta | Verified? |
|---|-----------|------|--------|-------|-----------|
| CP-1 | <name> | <expected> | <measured> | <delta> | ✅/❌ |
```

Maintain at least one active checkpoint at all times. Clear old checkpoints only when starting a new major phase.

---

## Compaction Survival

When you notice signs of compaction (provided summary of prior turns, truncated tool results, or "context compaction" notice):

1. **Immediately** load `context-buffer/mythos-session.md` — this is your ground truth
2. Do NOT re-derive state from truncated conversation history
3. Use `load-context.js` output or direct file reads to restore full picture
4. Resume from the last unchecked checkpoint in mythos-session.md
5. Update `LAST_COMPACT_EVENT` timestamp in running notes

---

## Anti-Patterns (causes context collapse)

| Anti-Pattern | Fix |
|---|---|
| Re-reading 5+ files between every tool call | Cache in mythos-session.md, read only when stale |
| Writing 30+ lines of code per turn in main context | Delegate to `code` subagent, do not carry forward |
| Re-delegating the same task 3+ times without diagnosis | Diagnose first, write diagnosis to mythos-session.md, then retry |
| Ignoring checkpoint failures | Stop, diagnose, write diagnosis, then decide retry vs. revise |
| Letting mythos-session.md grow unbounded | Tail-limit at 200 lines in loader; periodically archive to context-buffer/ |

---

## Output Provenance

Every output from a Mythos-class agent loop MUST include the standard convergence gate block plus:
```
compaction_survived: <true/false>
last_checkpoint: <#>
checkpoint_verified: <true/false>
mythos_session_path: context-buffer/mythos-session.md
```

---

## Enforcement

This document is ENFORCED via `.kilo/kilo.jsonc` instructions array.
The model MUST follow the 5-stage loop for multi-step work.

If the model detects it is about to skip a stage:
- STOP
- Read this file (if not already loaded)
- Resume from the appropriate stage
- Document the deviation in mythos-session.md
