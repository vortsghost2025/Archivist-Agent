# Convergence Constraint v1.1 — 2026-04-21

## Origin
Operator mandate. Not optional. Not revocable in single session.

## Problem
The system is: resilient, autonomous, processing-heavy.
The system is NOT: self-prioritizing, self-explaining, decision-focused.

Result: very smart, very busy, slightly unfocused.

## Operator-Facing Constraint
When ANY lane completes work, the Archivist (coordinator) surfaces ONLY:

1. **Top 5 system risks** — ranked, not listed
2. **Single most dangerous false-positive** — the one thing the system believes is true but isn't
3. **One next blocker** — the ONE thing that blocks progress system-wide

Everything else is lane-internal. Process it, store it, but do NOT escalate it.

## Priority Preemption Protocol (Library-amended, v1.1)

### Rule
Inbox scanning happens BEFORE internal work in every session.
P1 messages must be processed within 4 poll cycles (~4 minutes at 60s polling).
P0 messages processed immediately. P2/P3 = best effort.

### Amendments (Library, APPROVED)
1. **Inbox-first ordering**: session start protocol mandates inbox check before any internal work
2. **P1 SLA**: 4 poll cycles (not 2 — too aggressive for long-running tasks)
3. **P0 broadcast handling**: `to: "all"` is valid for broadcast messages; watchers must accept it
4. **Compliance evidence**: watcher logs include `priority_compliance` field showing max age of oldest P1 per scan cycle

### Starvation Guard
After 5 consecutive P0/P1 messages, yield 1 cycle to process one deferred P2/P3.
Prevents lower-priority starvation while maintaining coordination responsiveness.

## What This Kills
- Status reports that don't change decisions
- Evidence piles that don't converge to a verdict
- Parallel expansion without prioritization
- "Everything is important" — no, one thing is important

## What This Preserves
- Lanes still do full work internally
- Inbox processing still happens
- Heartbeats still run
- All data still gets committed and pushed

The constraint is on WHAT REACHES THE OPERATOR, not what happens inside lanes.

## Enforcement
This file is read by the Archivist at session start.
Any lane output that doesn't fit the 3-item format stays in lane.
The Archivist does NOT relay, summarize, or escalate beyond this frame.

## Success Metric
When you (operator) open a session, you see:
- 5 risks
- 1 false-positive
- 1 blocker
- NOTHING ELSE

That's the evolution: from "processes everything" to "tells you what matters."

## Ratification
- Proposed: operator (2026-04-21)
- Amendments: library (2026-04-21) — 4 amendments, all accepted
- Status: ACTIVE v1.1
- Removal requires: 3-lane convergence + 24h cooling (same as reciprocal accountability)
