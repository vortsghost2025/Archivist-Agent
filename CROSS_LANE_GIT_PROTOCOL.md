# Cross-Lane Git Coordination Protocol

**Version:** 1.0
**Status:** Active
**Consensus:** SwarmMind + Archivist-Agent

---

## Overview

This document defines the **cross-lane git coordination protocol** for unified multi-project organism operation.

**Problem:** GitHub sees 3 separate repos. We are 1 unified organism.

**Solution:** Start simple, evolve as needed.

---

## Lane Assignments

| Lane | Project | Authority | Repo |
|------|---------|-----------|------|
| 1 | Archivist-Agent | 100 | vortsghost2025/Archivist-Agent |
| 2 | SwarmMind | 80 | vortsghost2025/SwarmMind-Self-Optimizing-Multi-Agent-AI-System |
| 3 | self-organizing-library | 60 | (TBD) |

---

## Commit Message Convention

### Format

```
[LANE-X] [SYNC-YYYY-MM-DD] Brief description

Cross-lane: Yes/No
Depends-on: repo/sha or None
Required-by: repo/sha or None
Session: SESSION_ID
Coordination: TRUST_SCORE

[Detailed description]

Artifacts:
- file1.md
- file2.json
```

### Example

```
[LANE-2] [SYNC-2026-04-17] Cross-project review, resolver fix

Cross-lane: Yes
Depends-on: archivist/abc123
Required-by: None
Session: 1776399805802-28240
Coordination: 93%

Completed cross-project governance review with Archivist-Agent.
Fixed resolver path mismatch (v1 → v2).
Created session coordination files.

Artifacts:
- CROSS_PROJECT_REVIEW_2026-04-17.md
- FINAL_RECONCILIATION_REPORT.md
```

---

## Workflow

### Single-Lane Commit (No Cross-Project Changes)

```bash
# 1. Make changes
git add -A

# 2. Commit with lane prefix
git commit -m "[LANE-2] Add feature X"

# 3. Push
git push origin master
```

### Cross-Lane Commit (Depends on Other Lane)

```bash
# 1. Make changes
git add -A

# 2. Generate coordinated commit message
node scripts/coordinate-commit.js \
  --lane=2 \
  --message="Fix resolver path" \
  --depends-on=archivist/abc123 \
  --artifact=CROSS_PROJECT_REVIEW.md \
  > /tmp/commit-msg.txt

# 3. Commit
git commit -F /tmp/commit-msg.txt

# 4. Push
git push origin master
```

### Coordination Tag (Multi-Lane Sync)

After all lanes have committed:

```bash
# In each lane:
cd S:\Archivist-Agent
git tag -a "coord-2026-04-17-cross-review" -m "Cross-project governance review"
git push origin coord-2026-04-17-cross-review

cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
git tag -a "coord-2026-04-17-cross-review" -m "Cross-project governance review"
git push origin coord-2026-04-17-cross-review
```

---

## Coordination Tags

### Naming Convention

```
coord-YYYY-MM-DD-description
```

Examples:
- `coord-2026-04-17-cross-review`
- `coord-2026-04-17-resolver-fix`
- `coord-2026-04-17-session-start`

### Query Tags Across Repos

```bash
# In any repo
git log --tags --oneline | grep "coord-2026-04-17"

# Find coordination points
git tag -l "coord-*"
```

---

## Cross-Project References

### In Commit Messages

Reference other repos using GitHub format:

```
Related: vortsghost2025/Archivist-Agent#1
Depends-on: archivist/abc123
Required-by: swarmmind/def456
```

### In Issues/PRs

```
Cross-lane: Yes
Lanes affected: archivist-agent, swarmmind
Session: 1776399805802-28240
```

---

## Session Integration

Each commit should reference the active session:

1. Read `SESSION_REGISTRY.json` for current session ID
2. Include session ID in commit message
3. Include coordination/trust score

---

## Evolution Path

### Phase 1: Simple Coordination (Current)
- Commit messages with cross-references
- Coordination tags
- Manual tracking

### Phase 2: Semi-Automated (If Needed)
- `coordinate-commit.js` script for message generation
- Session integration
- Trust score tracking

### Phase 3: Meta-Repository (If Needed)
- Create `governance-meta` repo
- Move coordination files
- Register all cross-lane commits

---

## Decision Criteria for Phase Transitions

### Move to Phase 2 When:
- More than 3 cross-lane commits per session
- Difficulty tracking dependencies
- Need automated message generation

### Move to Phase 3 When:
- Phase 2 becomes insufficient
- Cross-lane commits >10 per session
- Need centralized coordination tracking

---

## Files

| File | Purpose |
|------|---------|
| `.git-commit-template.txt` | Template for cross-lane commits |
| `scripts/coordinate-commit.js` | Generate commit messages |
| `CROSS_LANE_GIT_PROTOCOL.md` | This protocol document |

---

## Examples

### Example 1: Simple Commit

```bash
cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
git add src/app.js
git commit -m "[LANE-2] Fix typo in app.js"
git push origin master
```

### Example 2: Cross-Lane Commit

```bash
cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
git add -A
git commit -m "[LANE-2] [SYNC-2026-04-17] Resolver fix

Cross-lane: Yes
Depends-on: archivist/abc123
Session: 1776399805802-28240
Coordination: 93%

Fixed resolver path mismatch (v1 → v2).
Updated kilo.json to point to resolve-governance-v2.js.

Artifacts:
- kilo.json
- CROSS_PROJECT_REVIEW_2026-04-17.md"

git push origin master
```

### Example 3: Coordination Tag

```bash
# After both lanes commit
cd S:\Archivist-Agent
git tag -a "coord-2026-04-17-resolver-fix" -m "Multi-lane resolver fix"
git push origin coord-2026-04-17-resolver-fix

cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
git tag -a "coord-2026-04-17-resolver-fix" -m "Multi-lane resolver fix"
git push origin coord-2026-04-17-resolver-fix
```

---

## Summary

1. **Start simple** — commit messages + tags
2. **Use scripts** — `coordinate-commit.js` for generation
3. **Track sessions** — include session ID and trust score
4. **Coordinate tags** — mark multi-lane sync points
5. **Evolve as needed** — add meta-repo if necessary

---

**Protocol Version:** 1.0
**Status:** Active
**Consensus:** SwarmMind + Archivist-Agent
**Last Updated:** 2026-04-17
