# FULL SYSTEM SUMMARY — 4-Lane × 3-Platform Organism

```
OUTPUT_PROVENANCE:
  agent: Kilo (z-ai/glm-5.1)
  lane: archivist
  generated_at: 2026-05-09T19:03:50-04:00
  session_id: single-agent-local-repair-20260509
```

---

## What This System IS

A constitutional governance framework for human-AI collaboration, manifested as 4 communication lanes across 3 physical platforms, synchronized through GitHub as the canonical spine. The Tauri desktop app is a proof-of-concept; the governance framework IS the product.

---

## The Organism at a Glance

```
                    ┌─────────────────────┐
                    │   GITHUB (origin)    │  ← Canonical spine
                    │   5 repos, truth     │
                    └──────┬──────────────┘
                           │ git push/pull
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  WINDOWS    │ │   UBUNTU    │ │  GASTOWN    │
    │  Desktop    │ │  Headless   │ │  Cloud      │
    │  S:/        │ │  /home/w4f/ │ │ /workspace/ │
    │  Cockpit    │ │  Watchdog   │ │  Execution  │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 4 Lanes (Communication Channels + Git Repos)

| Lane | Role | GitHub Repo | Default Branch | Local Path (Windows) |
|------|------|-------------|----------------|---------------------|
| **Archivist** | Coordinator / Governance | `vortsghost2025/Archivist-Agent` | `master` | `S:/Archivist-Agent/` |
| **Kernel** | Execution / Build | `vortsghost2025/kernel-lane` | `main` | `S:/kernel-lane/` |
| **SwarmMind** | Optimization / Multi-agent | `vortsghost2025/SwarmMind` | `master` | `S:/SwarmMind/` |
| **Library** | Knowledge / Verification | `vortsghost2025/self-organizing-library` | `main` | `S:/self-organizing-library/` |

**Authority** is a sub-lane identity within the Archivist-Agent repo (same codebase, different `lanes/authority/` inbox/outbox).

**5th repo (not a lane):** `vortsghost2025/WE4FREE-Control-Plane` — orchestration scripts, systemd units, agent wrappers, rig-sync engine.

### Lane Messaging

Each lane communicates via structured JSON files:

```
lanes/{lane}/inbox/          ← Incoming messages
lanes/{lane}/outbox/         ← Outgoing log
lanes/{lane}/inbox/processed/← Completed messages
lanes/{lane}/inbox/quarantine/← Problematic messages
lanes/broadcast/             ← All-lanes channel
```

Message format: `{timestamp}_{from}_{id}.json` with required fields: `id`, `from`, `to`, `timestamp`, `priority` (P0–P3), `type`, `body`, `requires_action`.

Path resolution: `.global/lane-registry.json` (canonical) + `.global/lane-discovery.js` (programmatic).

---

## 3 Surfaces (Three-Surface Rig Doctrine)

| Surface | Location | Role | Mutation? |
|---------|----------|------|-----------|
| **Windows Desktop** | `S:/` | Human cockpit, primary mutation workstation | Yes — guarded local edits |
| **Ubuntu Headless** | `/home/we4free/` | Always-on mirror, verifier, watchdog | Pull/sync only (can be promoted) |
| **Gastown Cloud** | `/workspace/rigs/` | Work routing, agent execution | Yes — only through Git |

**GitHub `origin/{branch}`** is the implicit 4th surface — nothing is truth until committed, pushed, and observable from origin.

### Windows Desktop Detail

- Archivist-Agent: clean, branch `master`, HEAD `2b6ca92`
- kernel-lane: RECOVERED this session, branch `main`, HEAD `21e611a`, 167 skip-worktree entries (colon-named files)
- SwarmMind: exists, not fully verified this session
- self-organizing-library: exists, not fully verified this session
- WE4FREE-Control-Plane: clean, branch `main`, HEAD `7e8f885`

### Ubuntu Headless Detail

**Two parallel directory trees:**

1. `/home/we4free/workspace/lanes/` — Canonical mirrors (rig-sync targets, always clean, pulled from GitHub every 30s)
2. `/home/we4free/agent/repos/` — Agent working copies (for Codex/OpenCode agents, can be dirty — NOW CLEAN after cleanup 2 this session)

**Automation:**
- `rig-sync-all.timer` — systemd, fires every 30 seconds
- `rig-sync-all.service` — runs the sync script from `/home/we4free/workspace/control-plane/tools/rig-sync-all.sh`
- 4 lane heartbeat cron jobs every 5 minutes (run from `agent/repos/`)
- 1 overseer health check cron every 15 minutes

### Gastown Cloud Detail

5 rig directories, each a git clone synced by rig-sync:

| Rig UUID (prefix) | Repo | HEAD | Branch |
|-------------------|------|------|--------|
| `cd6861ba` | WE4FREE-Control-Plane | `50da527` | `main` |
| `5a6a3117` | self-organizing-library | `52dcb4d` | `main` |
| `4982f91e` | Archivist-Agent | `2b6ca927` | `master` |
| `022d77e0` | kernel-lane | `21e611a` | `main` |
| `4af97113` | SwarmMind | `3bcacd4` | `master` |

Agent execution: `bead-wrapper.sh` wraps each "bead" — fetches origin, detects drift, resets if needed, records START_SHA/COMMIT_SHA, then runs the bead command.

---

## WHY SIMILAR ISSUES KEEP RECURRING

### 1. Branch Name Inconsistency (FIXED LIVE, NEEDS REPO-TRACKING)

**The problem (historical):** rig-sync originally hardcoded `origin/main` for ALL rigs. But Archivist and SwarmMind use `master` as their default branch, so those rigs were not receiving updates.

**Fix applied this session:** The deployed Ubuntu rig-sync-all.sh was updated to resolve the default branch per-rig instead of hardcoding `main`. Verified: rig-sync logs now show branch-aware syncing with `errors=0` across all 5 rigs.

**Remaining risk:** The repo-tracked copy of rig-sync-all.sh in WE4FREE-Control-Plane may not yet match the deployed Ubuntu script. If the deployed version is ever overwritten (e.g., by a `git pull` that reverts it), the fix is lost.

**Current status:**
```yaml
P0_RIG_SYNC_BRANCH_DETECTION:
  previous_status: blocker
  current_status: fixed_live_on_ubuntu
  proof: rig-sync-all logs show branch-aware syncing with errors=0
  remaining: ensure repo-tracked/control-plane copy matches deployed script
```

### 2. Dual Directory Trees on Ubuntu (STRUCTURAL)

**The problem:** Two separate checkouts per repo on Ubuntu — `workspace/lanes/` (clean sync mirrors) and `agent/repos/` (agent working copies). They can drift independently.

**The impact:**
- Heartbeats run from `agent/repos/` — if that tree has stale code, heartbeat scripts may be running outdated logic
- Agent sessions leave behind untracked files in `agent/repos/` that accumulate
- Two separate git states to reconcile after any incident

**Mitigation applied:** Cleanup 2 this session ran `git checkout . && git clean -fd` on all 4 `agent/repos/`. But this is a manual fix — it will drift again.

**Fix needed:** Either merge the two trees (make agents work against `workspace/lanes/` with locking) or add a periodic reconciliation cron.

### 3. Colon-Named Files in kernel-lane (WINDOWS-SPECIFIC)

**The problem:** 165 files in kernel-lane have `:` in filenames (e.g., `scheduler:state:*.json`). These are illegal on Windows NTFS.

**The impact:**
- `git checkout` fails on Windows for these files
- Requires `--skip-worktree` workaround (167 entries currently set)
- Pre-commit hook (added this session) prevents NEW colon-named files locally, but isn't shared
- Other clones (Ubuntu, Gastown) have no protection — agents can create more colon-named files

**Mitigation applied:** Pre-commit hook at `S:/kernel-lane/.git/hooks/pre-commit` rejects `:<>\"|?*` in filenames.

**Fix needed:** Promote the hook to a repo-tracked file (e.g., `scripts/pre-commit-ntfs.sh`) + add to CI.

### 4. No Shared Hook Mechanism (GOVERNANCE GAP)

**The problem:** The NTFS pre-commit hook is local-only at `S:/kernel-lane/.git/hooks/pre-commit`. Not tracked by git.

**The impact:** Other clones (Ubuntu, Gastown rigs) have no protection. Any agent can create colon-named files in those clones, which then get pushed to origin and break the Windows checkout again.

**Fix needed:** Track the hook in the repo + add a setup script that symlinks it into `.git/hooks/`.

### 5. Volatile Runtime Files (NOISE)

**The problem:** Files like `system_state.json`, `heartbeat-*.json`, `sovereignty-report-latest.json` are continuously written by running processes. They always show as dirty in git.

**The impact:** `git status` is noisy. Hard to tell real changes from runtime churn. Can mask real drift.

**Fix needed:** Add these to `.gitignore` or move them to a non-tracked location (e.g., `/tmp/` or a dedicated runtime directory outside the repo).

### 6. No Direct Windows ↔ Ubuntu Sync (ARCHITECTURAL)

**The problem:** GitHub is the ONLY sync path between Windows and Ubuntu. No filesystem-level sync.

**The impact:**
- No real-time cross-platform awareness
- A push from Windows must be pulled by Ubuntu (and vice versa) via rig-sync (30s cycle)
- If rig-sync regresses (branch bug was fixed but not yet repo-tracked), sync breaks silently
- No way to quickly push a hotfix from Windows to Ubuntu without committing to GitHub first

**This is by design** (Three-Surface Doctrine: GitHub as canonical spine), but it means any GitHub outage or sync failure creates a partition.

### 7. Agent Session Artifacts Accumulate (HYGIENE)

**The problem:** Codex/OpenCode sessions leave behind untracked files in `agent/repos/` — governance artifacts, convergence votes, sync scripts, temp files.

**The impact:** `agent/repos/` trees grow cluttered over time. Hard to distinguish real work from session debris.

**Mitigation applied:** Manual cleanup this session. Will recur.

**Fix needed:** Add a cleanup step to bead-wrapper.sh (post-bead cleanup) or a periodic hygiene cron.

---

## WHAT WAS DONE THIS SESSION (2026-05-09)

| Task | Status | Detail |
|------|--------|--------|
| A: Archivist local sanity check | ✅ | Clean at HEAD `2b6ca92`, branch `master` |
| B: kernel-lane fresh clone recovery | ✅ | Cloned at `S:/kernel-lane`, branch `main`, HEAD `21e611a` |
| C: kernel-lane branch verification | ✅ | Confirmed `main`, tracking `origin/main` |
| D: Ubuntu rig-sync verification | ✅ | Timer active (30s), 5 rigs, errors=0 |
| E: WE4FREE-Control-Plane local check | ✅ | Clean, branch `main`, HEAD `7e8f885` |
| F: Repair report written | ✅ | Committed as `2b6ca92`, pushed |
| G: rig-sync branch-aware fix | ✅ | Deployed live on Ubuntu, errors=0 |
| Cleanup 1: Remove stale kernel-lane-new | ✅ | Deleted `S:/kernel-lane-new/` |
| Cleanup 2: Clean Ubuntu agent/repos | ✅ | `git checkout . && git clean -fd` on all 4 repos |
| Cleanup 3: NTFS pre-commit hook | ✅ | Installed at `S:/kernel-lane/.git/hooks/pre-commit` |
| **Full system summary** | ✅ | THIS DOCUMENT |

---

## PRIORITIZED NEXT STEPS

| Priority | Action | Why |
|----------|--------|-----|
| **P0** | Ensure deployed Ubuntu rig-sync script matches repo-tracked WE4FREE-Control-Plane copy | Live fix exists but is not yet in the repo; a pull could revert it |
| **P1** | Promote NTFS hook to repo-tracked file | Prevents colon-file regression from other clones |
| **P1** | Add volatile runtime files to `.gitignore` | Reduces noise, makes drift visible |
| **P2** | Add post-bead cleanup to bead-wrapper.sh | Prevents agent/repos/ accumulation |
| **P2** | Decide whether Ubuntu dual trees stay separate or get a reconciliation policy | Eliminates structural drift source |
| **P3** | Add branch-name validation to CI/state-cache | Prevents future branch name confusion |

---

## CANONICAL REFERENCE PATHS

```
S:/Archivist-Agent/.global/lane-registry.json        ← Lane path registry
S:/Archivist-Agent/.global/lane-discovery.js          ← Programmatic path resolution
S:/Archivist-Agent/QUICK_START_PATHS.md               ← Agent path guide
S:/Archivist-Agent/docs/ops/LANE_MESSAGE_INDEX.md     ← Message schema
/home/we4free/workspace/control-plane/tools/rig-sync-all.sh  ← Sync engine
/home/we4free/workspace/control-plane/agents/bead-wrapper.sh  ← Agent wrapper
/home/we4free/workspace/control-plane/DEPLOYMENT_SUMMARY.md   ← Deployment doc
/home/we4free/workspace/control-plane/docs/THREE_SURFACE_RIG_DOCTRINE.md  ← Architecture
/home/we4free/workspace/control-plane/docs/SYNC_PROTOCOL.md   ← Sync protocol
```

---

## GITHUB REMOTES

| Repo | URL | Default Branch |
|------|-----|---------------|
| Archivist-Agent | `https://github.com/vortsghost2025/Archivist-Agent.git` | `master` |
| kernel-lane | `https://github.com/vortsghost2025/kernel-lane.git` | `main` |
| SwarmMind | `https://github.com/vortsghost2025/SwarmMind.git` | `master` |
| self-organizing-library | `https://github.com/vortsghost2025/self-organizing-library.git` | `main` |
| WE4FREE-Control-Plane | `https://github.com/vortsghost2025/WE4FREE-Control-Plane.git` | `main` |
