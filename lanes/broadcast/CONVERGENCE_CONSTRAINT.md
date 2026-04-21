# Convergence Constraint v1 — 2026-04-21

## Origin
Operator mandate. Not optional. Not revocable in single session.

## Problem
The system is: resilient, autonomous, processing-heavy.
The system is NOT: self-prioritizing, self-explaining, decision-focused.

Result: very smart, very busy, slightly unfocused.

## Constraint
When ANY lane completes work, the Archivist (coordinator) accepts ONLY:

1. **Top 5 system risks** — ranked, not listed
2. **Single most dangerous false-positive** — the one thing the system believes is true but isn't
3. **One next blocker** — the ONE thing that blocks progress system-wide

Everything else is lane-internal. Process it, store it, but do NOT escalate it.

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
- Status: ACTIVE
- Removal requires: 3-lane convergence + 24h cooling (same as reciprocal accountability)
