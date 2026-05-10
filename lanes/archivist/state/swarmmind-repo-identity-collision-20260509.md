# SwarmMind Repository Identity Collision — Read-Only Reconciliation Report

```
OUTPUT_PROVENANCE:
  agent: kilo/z-ai/glm-5.1
  lane: archivist
  generated_at: 2026-05-09T21:20:29-04:00
  session_id: continuation
```

## Classification

**REPOSITORY_IDENTITY_COLLISION** — Two unrelated git histories share a single GitHub remote URL.

## Summary

The SwarmMind remote (`vortsghost2025/SwarmMind-Self-Optimizing-Multi-Agent-AI-System`) has two branches with **no common ancestor**. The local `main` branch (active working branch) and the remote default `master` branch represent completely separate repository histories that were never forked from each other.

## Evidence

### 1. Active Working Directory: `S:/SwarmMind`

| Property | Value |
|----------|-------|
| Branch | `main` (checked out) |
| HEAD | `4c5b9cb` |
| Tracking | `origin/main` |
| Commit count | 139 |
| Status | CLEAN |
| Worktrees | `bold-clementine`, `feat/swarm-role-split` |

Recent commits on `main`:
```
4c5b9cb [LANE-2] Sync with remote
2ed12e0 Merge branch 'main' of remote
1666e0a [LANE-2] Pre-sync checkpoint
3bcacd4 [LANE-3] Add SwarmMind convergence vote
b815189 [LANE-3] sync canonical scripts from archivist
```

### 2. Remote Default Branch: `origin/master`

| Property | Value |
|----------|-------|
| HEAD | `495479d` |
| Commit count | 125 |
| File count | 541 |
| Default branch on GitHub | YES |

Recent commits on `origin/master`:
```
495479d Final ratification received from Archivist
a15d53f Add cross-lane-sync-gate.js, ci-integration-check.js
9ae3d80 feat: full canonical convergence
1c525be MERGE: resolve add/add conflict
f6f6442 FIX: canonical key_id
```

### 3. Divergence

```
git merge-base main origin/master → NO COMMON ANCESTOR
git diff --stat main origin/master → 1934 files changed
```

The two branches share approximately 41 files in common out of 1453+541 total.

### 4. Local `master` Branch

| Property | Value |
|----------|-------|
| HEAD | `8558ef5` |
| Commit count | 1 |
| Content | Init commit only (`init: SwarmMind lane - initial commit with gitignore and safe_test`) |

This is an orphan commit, not connected to either `main` or `origin/master`.

### 5. Deprecated Directory: `S:/SwarmMind Self-Optimizing Multi-Agent AI System`

| Property | Value |
|----------|-------|
| Git repo | NO — no `.git` directory |
| Contents | `lanes/`, `logs/`, `scripts/` subdirectories only |
| `lanes/` | `swarmmind/` subdirectory |
| `scripts/` | `prepare-commit-msg.sh` |
| `logs/` | 7 MCP puppeteer log files (Apr 27 – May 3) |

**Assessment**: Leftover files from a previous working directory. No unique unpushed git commits. Safe to archive or delete after operator confirmation.

### 6. Remote Branches

```
remotes/origin/HEAD -> origin/master
remotes/origin/copilot/audit-self-optimizing-ai-system
remotes/origin/main
remotes/origin/master
remotes/origin/session/agent_9fddc379-33f3-4133-b6b3-0ff5b25bae5b
```

## Reconciliation Gate Status

Per `SWARMMIND_RECONCILIATION_GATE` (operator mandate this session):

- merge_allowed: **false**
- rebase_allowed: **false**
- reset_allowed: **false**
- force_push_allowed: **false**

No mutations have been performed. This report is read-only.

## Recommendation

### Proposed Policy

1. **`main` is canonical** — It contains all current lane-2/3 work, canonical scripts, governance, and archive. It is the branch actively used by all agents.

2. **`origin/master` is archive-only** — It contains older Codex-era work. Some files (canonical convergence scripts, trust-store) may be worth cherry-picking into `main` if needed, but the branch itself should NOT be merged.

3. **Change GitHub default branch** from `master` to `main` — This prevents accidental pulls of the wrong history and aligns GitHub UI with actual working state.

4. **Local `master` branch** (1 orphan commit) — Delete. It adds no value.

5. **Deprecated directory** (`S:/SwarmMind Self-Optimizing Multi-Agent AI System`) — Archive or delete. Contains only stale log files and one hook script. No git history.

6. **Remote stale branches** — `origin/copilot/audit-self-optimizing-ai-system` and `origin/session/agent_9fddc379-33f3-4133-b6b3-0ff5b25bae5b` should be reviewed for archival or deletion.

### Steps (OPERATOR APPROVAL REQUIRED BEFORE EACH)

| Step | Action | Risk | Prerequisite |
|------|--------|------|-------------|
| 1 | Change GitHub default branch to `main` | Low — UI only, no data loss | Operator approval |
| 2 | Delete local `master` branch (`git branch -D master`) | Low — 1 orphan commit, no loss | Operator approval |
| 3 | Archive or delete deprecated directory | Low — no git data, only stale logs | Operator approval |
| 4 | Review `origin/master` for any files worth cherry-picking to `main` | Medium — requires manual review | Operator + agent review |
| 5 | Tag `origin/master` as archive (`git tag archive/codex-era master`) | Low — preserves history | Operator approval |
| 6 | Delete stale remote branches | Low — session/Copilot branches | Operator approval |

### What NOT to Do

- **NEVER** `git merge master` or `git merge origin/master` into `main` — would create a merge of unrelated histories
- **NEVER** `git rebase` either branch onto the other
- **NEVER** `git reset --hard` or `git push --force`
- **NEVER** `--allow-unrelated-histories`

## Open Questions for Operator

1. Should we change the GitHub default branch from `master` to `main` now?
2. Should the deprecated directory be deleted or archived to a specific location?
3. Are there any files on `origin/master` that should be cherry-picked into `main` before it's archived?
4. Should `origin/master` be tagged as `archive/codex-era` and then protected or left as-is?

## State Snapshot

```
STATE SNAPSHOT:
  LANE: archivist
  CHANGE: Wrote SwarmMind repo identity collision report
  VERIFIED_BY: self (read-only git analysis)
  RESULT: proven
  NEXT_BLOCKER: operator decision on reconciliation steps
```
