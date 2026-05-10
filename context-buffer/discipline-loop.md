# Discipline Loop (Graph = Map + Debugger)

OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: discipline-loop-protocol

## OBSERVABILITY_DOMAIN
governance-protocol

## NEXT_SAFE_ACTION
Apply discipline contract gates before any new work

Use this every session. If any gate fails, stop.

## 1. Discipline Contract

- No new feature/code change until one contradiction is resolved or explicitly downgraded with evidence.
- No claim enters `proven` without reproducible artifact evidence.
- Only one active blocker at a time.
- "Feels true" is invalid; valid states are `proven`, `unproven`, `conflicted`, `blocked`, `quarantined`, `resolved`.
- Every cycle must include: target node, falsifiable check, evidence path, and stop condition.

## 2. Daily Execution Loop

1. Pick top `P0/P1` node using the `Node Selection Priority` section.
2. Write a 3-line test card:
   - claim
   - falsifier
   - evidence path
3. Execute one smallest verification action.
4. Apply `Graph Writeback / No-Change Rule`.
5. Queue next smallest action.
6. Repeat.

## 3. Forced Session Start Template

```text
SESSION INTENT:
TARGET NODE:
CURRENT STATE:
FALSIFIABLE CHECK:
EVIDENCE PATH TO PRODUCE:
STOP CONDITION:
```

## 4. Forced Session End Template

```text
RESULT:
NEW STATE OR NO-CHANGE:
EVIDENCE PATH:
CONTRADICTIONS REDUCED:
NEXT SMALLEST ACTION:
```

## 5. Anti-Drift Stop Conditions

Stop immediately if any condition is true:

- Editing starts without a declared target node.
- Architecture expansion starts before current contradiction test card is closed.
- State change is attempted without artifact evidence.
- More than one blocker is active.
- Priority is chosen by largest count instead of risk ordering.

When stopped: return to the current target node and run one smallest verification action only.

## 6. Operator Scoreboard

Track only:

- `conflicted_count`
- `unproven_count`
- `proven_today`
- `mean_time_to_resolution`
- `reopened_claims`

Target trend: conflicted down, proven up, reopened near zero.

## 7. Node Selection Priority

Pick top `P0/P1` by this order:

1. public misleading risk
2. authority/governance ambiguity
3. repeated graph signature
4. blocked publication/evidence trail
5. operator accessibility impact

## 8. Graph Writeback / No-Change Rule

Every work session ends with either:

- graph writeback if evidence supports a state change, or
- a no-change note with evidence path and next smallest action.

Do not mutate graph status when evidence is incomplete.

## 9. Non-goals

- Do not change graph data in this document workflow.
- Do not change mapper code in this document workflow.
- Do not change lane state in this document workflow.
- Do not dispatch lane tasks from this document workflow.
- Do not treat this file as runtime enforcement; it is a discipline guide until explicitly approved.

## Auto Analysis Command

```bash
powershell -ExecutionPolicy Bypass -File "S:/Archivist-Agent/scripts/run-latest-graph-analysis.ps1"
```

Outputs in `S:/Archivist-Agent/context-buffer`:

- `graph-auto-analysis-<timestamp>.json`
- `graph-auto-analysis-<timestamp>.md`
