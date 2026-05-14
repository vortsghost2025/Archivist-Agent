# Causal Attribution Report: Dormant-Lane Synchronization

OUTPUT_PROVENANCE:
agent: z-ai/glm5
lane: archivist
generated_at: 2026-05-14T22:20:00Z
session_id: archivist-session-20260514

## Question

Kernel and SwarmMind had no resident lane agents active for days, yet their
repos received tightly synchronized governance/convergence work. How?

## Evidence

### 1. Commit Timing Analysis

| Commit Purpose | Kernel Timestamp | SwarmMind Timestamp | Delta |
|---|---|---|---|
| RS256→EdDSA migration | 10:44:24 EDT | 10:41:40 EDT | SwarmMind FIRST (-2m44s) |
| Identity-enforcer fix | 11:41:22 EDT | 11:41:36 EDT | +14s |
| Node 12 compat fix | 12:44:15 EDT | 12:44:23 EDT | +8s |
| Trust-store sync | 17:25:40 EDT | 17:25:47 EDT | +7s |
| CI signing test suite | 18:12:25 EDT | 18:12:26 EDT | +1s |
| Signing integrity workflow | 18:36:26 EDT | 18:36:32 EDT | +6s |
| Mutation guard | 19:16:54 EDT | 19:17:58 EDT | +64s |
| Mutation guard step | 19:50:13 EDT | 19:50:15 EDT | +2s |
| test-ci-signing path fix | 20:26:50 EDT | 20:26:55 EDT | +5s |
| Heartbeat active-owner | 23:33:55 EDT | 23:34:06 EDT | +11s |
| Schema EdDSA fix | 23:48:32 EDT | 23:48:33 EDT | +1s |
| ContradictionAdjudicator | 13:50:37 EDT | 13:50:46 EDT | +9s |

**Pattern:** Consistently 1-64 second deltas. Not human sequential commits.
Scripted or automated multi-repo mutation.

### 2. Author Attribution

All synchronized commits have:
- Author: `DeliberateEnsemble <seandavidramsingh@gmail.com>`
- Committer: `DeliberateEnsemble <seandavidramsingh@gmail.com>`

This is the Windows desktop git identity (confirmed: `git config --global
user.name` on `100.95.92.117` returns `DeliberateEnsemble`).

The headless machine's kernel-lane is configured as `Kernel Lane
<kernel@lanes.local>`. So these commits did NOT originate from the headless
autonomous executor.

### 3. Propagation Mechanism Identified

**`sync-canonical-scripts.js`** in `Archivist-Agent/scripts/`:

- Reads `CANONICAL_SCRIPT_REGISTRY.json` which lists 11 shared scripts and 2
  shared schemas that MUST be identical across all 4 lanes
- Compares Archivist (canonical source) against kernel, swarmmind, library
  using SHA-256
- If hash differs, runs regression guards (no hardcoded S: paths, no duplicate
  requires, provenance enforcement present)
- If guards pass, **writes the canonical version to target lane**

The registry includes:
- `lane-worker.js`, `relay-daemon.js`, `heartbeat.js`,
  `autonomous-executor.js`, `blocked-remediator.js`, `post-compact-audit.js`
- `schemas/inbox-message-v1.json`, `schemas/context-restore.json`

**Direction:** archivist → kernel, swarmmind, library (one-way)

### 4. Causal Chain (Reconstructed)

For a representative synchronized pair (e.g., "Fix inbox-message-v1.json
schema: add EdDSA to signature_alg"):

```
1. HUMAN OPERATOR (seand) at Windows desktop
   └─ Interactive agent session (Cursor/Codex/GPT) in Archivist-Agent repo
      └─ Identifies schema drift: inbox-message-v1.json missing EdDSA
         └─ Modifies canonical copy: S:\Archivist-Agent\schemas\inbox-message-v1.json
            └─ Commits to Archivist with [LANE-1] prefix
               │
2. SYNC-CANONICAL-SCRIPTS.JS (manual or scripted invocation)
   └─ Reads CANONICAL_SCRIPT_REGISTRY.json
      └─ Detects hash mismatch in kernel-lane and SwarmMind copies
         └─ Regression guard passes (no hardcoded paths, etc.)
            └─ Writes canonical version to:
               ├─ S:\kernel-lane\schemas\inbox-message-v1.json  (23:48:32)
               └─ S:\SwarmMind\schemas\inbox-message-v1.json   (23:48:33)
                  │
3. GIT COMMIT (sequential, automated)
   └─ cd kernel-lane && git add -A && git commit -m "[LANE-2] Fix schema..."  (1s)
   └─ cd SwarmMind && git add -A && git commit -m "[LANE-3] Fix schema..."   (1s later)
   └─ cd each && git push origin
```

### 5. Headless Supervision Role

The headless four-lane supervision tooling:
- **Monitored** all 4 lanes (inbox watchers, heartbeat checks, lane status
  board)
- **Did NOT materially participate** in routing, triggering, or applying the
  synchronized code changes
- The supervision daemon reads lane state but does not mutate lane repos
- The autonomous-executor.js per-lane daemon processes inbox tasks but does
  not propagate code across lanes

The propagation was done FROM the Windows desktop, BY the operator (or an
operator-launched agent session), using `sync-canonical-scripts.js` as the
convergence tool.

### 6. Why Dormant Lanes Got Work

The answer is now clear:

1. **Canonical convergence protocol**: Archivist owns canonical copies of 11
   scripts + 2 schemas. When a change is made to a canonical file in
   Archivist, `sync-canonical-scripts.js` propagates it to ALL lanes
   regardless of whether that lane's agent is active.

2. **Trust-store/signing migration**: The May 11 signing migration was a
   cross-lane infrastructure change. It HAD to be applied to all lanes for
   signature verification to work. The convergence script was the correct
   tool for this.

3. **No agent cognition required**: The target lanes don't need a live agent
   to receive a file copy. The script writes files and commits. The target
   lane's agent can verify the change later when it wakes up.

## Recommendation

**PASS** for adopting "always-on four-lane headless substrate with conditional
agent activation" as the default doctrine, with these clarifications:

1. The headless substrate provides **monitoring and readiness**, not
   propagation. The convergence propagation is a SEPARATE mechanism
   (Windows-side `sync-canonical-scripts.js`).

2. The "always-on" part that matters most is:
   - 4 inboxes watched (15s poll via headless watchers)
   - 4 heartbeats maintained (60s via systemd services)
   - 4 lane state boards updated (supervision daemon)
   - CI loop running (30min cycle, housekeeping commit throttle 24h)

3. **Agent attachment is conditional**: An LLM agent should only be invoked
   when:
   - A lane inbox receives a task
   - A blocker appears
   - A convergence update needs verification (not just application)
   - A drift/quarantine/continuity event requires response
   - Scheduled maintenance is due

4. **The convergence script should be automated** (currently manual). A
   post-commit hook in Archivist that runs `sync-canonical-scripts.js
   --dry-run` and alerts on drift would close the loop without requiring
   operator intervention.

5. **Housekeeping cyclone status**: Throttled from 5min → 24h for
   housekeeping-only commits. Substantive changes still commit immediately.
   This is now correctly configured.

## Architectural Model

```
┌─────────────────────────────────────────────────┐
│              Windows Desktop                    │
│  ┌───────────┐  ┌──────────────┐               │
│  │ Operator  │  │ Agent Session│               │
│  │ (seand)   │──│ (Cursor/GPT) │               │
│  └─────┬─────┘  └──────┬───────┘               │
│        │               │                        │
│        ▼               ▼                        │
│  ┌─────────────────────────────┐               │
│  │ Archivist (canonical owner) │               │
│  │ - 11 shared scripts         │               │
│  │ - 2 shared schemas          │               │
│  │ - trust-store.json          │               │
│  └──────────┬──────────────────┘               │
│             │ sync-canonical-scripts.js         │
│             ▼                                    │
│  ┌────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Kernel │ │SwarmMind│ │ Library │  ← FILE   │
│  └────┬───┘ └────┬────┘ └────┬────┘  COPY     │
│       │          │          │                   │
└───────┼──────────┼──────────┼───────────────────┘
        │sshfs     │sshfs     │sshfs
        ▼          ▼          ▼
┌─────────────────────────────────────────────────┐
│           Headless Ubuntu (always-on)           │
│  ┌────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Kernel │ │SwarmMind│ │ Library │           │
│  │ ★mon   │ │ ★mon    │ │ ★mon    │  ★=monitored│
│  │ ☆hb    │ │ ☆hb     │ │ ☆hb     │  ☆=heartbeat│
│  │ ○inbox │ │ ○inbox  │ │ ○inbox  │  ○=watched │
│  └────────┘ └─────────┘ └─────────┘           │
│                                                │
│  NO active LLM agent unless inbox has work     │
│  Supervision daemon: 60s cycle                 │
│  CI loop: 30min cycle, 24h commit throttle     │
└─────────────────────────────────────────────────┘
```

## Verdict

The dormant-lane synchronization is **architecturally sound** and **causally
traceable**. It is NOT an anomaly. It is the convergence protocol working as
designed: canonical changes propagate to all lanes regardless of agent
presence.

The "it feels more alive than expected" effect comes from:
1. All 4 lanes being continuously monitored (headless substrate)
2. Canonical convergence propagating code without agent cognition (Windows-side)
3. CI loops maintaining git state even in dormant lanes

This supports the proposed operating doctrine:
**Persistent lane substrates, intermittent model cognition.**
