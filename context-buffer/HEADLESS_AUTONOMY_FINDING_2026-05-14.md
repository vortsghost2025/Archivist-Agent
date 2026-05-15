# HEADLESS_AUTONOMY_FINDING_2026-05-14

OUTPUT_PROVENANCE:
agent: z-ai/glm5
lane: archivist
generated_at: 2026-05-15T00:40:00Z
session_id: archivist-session-20260514

## Finding

Four-lane headless autonomy does not require four resident model agents.

A persistent lane substrate — workers, relays, executors, CI loop,
supervision — can maintain cross-lane convergence and system evolution
while a single live Archivist agent provides governance review,
interpretation, and nudging.

## Observation That Triggered This Finding

Kernel and SwarmMind had no resident lane agents active for days, yet
their repos received tightly synchronized governance/convergence work
(signing migration, schema fixes, ContradictionAdjudicator wiring,
trust-store canonical sync). This appeared as "dormant lanes doing
coordinated work without agents."

## Root Cause Analysis

The synchronization had two layers:

1. **Canonical convergence protocol** (Windows-side): Archivist owns
   canonical copies of 11 shared scripts + 2 schemas. Changes made
   to canonical files in Archivist propagate to all lanes via
   `sync-canonical-scripts.js`, regardless of agent presence.

2. **Headless autonomous substrate** (always-on): Even without model
   agents, the headless box runs 18 systemd services that maintain
   lane state: lane-workers scan inboxes, relay-daemons move messages,
   executors run queued tasks, heartbeats broadcast health, CI loop
   maintains git state, supervision daemon monitors all lanes.

The "feels alive" effect was real autonomous runtime — but obscured by
false complexity.

## False Complexity Observed

- Duplicate services (old + new naming): 10 extra processes
- Broken broadcast fan-out: `to=all` messages rejected, stuck in outbox
- Executor crash loops from missing utility scripts (lost during git resets)
- Health misclassification: housekeeping-only dirty states reported as
  unhealthy, triggering false alarms

## Corrections Applied

| Fix | Detail |
|-----|--------|
| Stopped 10 duplicate services | 8 duplicate workers/relays + watcher + agent-runner |
| relay-daemon.js broadcast fix | `to=all` → fan-out to all lanes except sender |
| relay-daemon.js archive | Delivered messages → `outbox/delivered/` instead of delete |
| store-journal.js event types | Added `work_quarantined`, `message_delivered`, etc. |
| Supervision health detection | New `OK_HK` state: housekeeping-only dirty = healthy |
| Missing utility scripts | Synced `node-version-guard.js` + `util/*.js` to all lanes |
| Stale outbox cleanup | Archived 16 undelivered May 13 messages |
| CI loop housekeeping patterns | Added `logs/*` (all log files, not just .json) |
| CI loop commit throttle | Housekeeping-only commits: 5min → 24h minimum |

## Post-Correction State

- 18 active services (was 27)
- 4/4 lanes OK_HK
- 48 node processes (down from ~65)
- Outbox backlog cleared
- Autonomy preserved, visibility improved

## Architectural Model

```
Headless box:
  4 lanes always running as substrate
  1 live agent (Archivist) as governance/nudge layer
  Control Plane / exterior reviews send recommendations

NOT:
  4 heavyweight model agents always online burning tokens
```

## Causal Chain For "Dormant Lanes Doing Synchronized Work"

```
canonical scripts sync across lanes
+ lane services/executors active without model agents
+ broadcast messages intended for all lanes
+ duplicate old/new service definitions causing excess activity
+ missing utility files crash-looping some executors
+ supervision misreading expected housekeeping dirtiness as unhealthy
= lanes appear strangely synchronized, noisy, and agent-like
```

Fixing this does NOT remove autonomy. It removes the false complexity
around the autonomy.

## Corroboration

- Code/push claims: substantiated by GitHub commit history across 4 repos
- Runtime-state claims: verified by status snapshot (service list, health
  board, process count, archived messages, throttle config)
- Causal attribution report: context-buffer/dormant-lane-causal-attribution-report.md
- Exterior review: ChatGPT GPT-5.5 Thinking (exterior-synthesis lane)

## Verification Gate

Housekeeping commit suppression: 24h throttle applied. Verification
window open until 2026-05-15T22:22Z. If no housekeeping-only commit
appears after the last one (2026-05-14T21:42:06Z), the cyclone fix
is PASS.

## Recommendation

PASS for "always-on four-lane headless substrate with conditional agent
activation" as the default operating doctrine.
