# SHARED_SCRIPT_OWNERSHIP_PLAN

OUTPUT_PROVENANCE:
agent: Kilo (z-ai/glm-5.1)
lane: governance-root
target: shared script mutation freeze and ownership map
generated_at: 2026-05-09T00:43:00Z
session_id: review-2026-05-09

---

mutation_performed: false
confirmed_failure_mode: cross-lane shared-code race

## Diagnosis

Git-history audit confirms that fixes are being undone by concurrent lane activity. The root cause is a **shared-code ownership failure**: identical scripts exist across 4 repos, autonomous lane workers edit them independently, and `sync-all-lanes.js` selects the "canonical" version by **most-recently-modified timestamp** — meaning any lane that touches a file after a fix makes its copy canonical, and the next sync overwrites all other lanes with that version.

### Proof points

| Fix | Who fixed | Who undid | Mechanism |
|-----|-----------|-----------|-----------|
| `functions.git` removed from schema | DeliberateEnsemble (6b28131, 19:12) | SwarmMind Lane (718fc08, 23:33) | Autonomous executor re-added enum without ratification |
| Duplicate `require('./output-provenance')` in task-executor.js | SwarmMind Lane (704a899) | Same bug in library (e87fef7) | Same rebase conflict pattern applied independently to both repos |
| Provenance enforcement wiring | DeliberateEnsemble (8da0942) | Same pattern applied 4x independently | 4 executors each wired provenance into their local copy |
| Hardcoded S:/ paths | Multiple fixes (4992c1f, b8da353, 3654268, ce7ba9) | Reintroduced via sync from unfixed copies | `chooseCanonicalState` picks newest mtime, not healthiest content |

### The broken invariant

```
chooseCanonicalState(states) sorts by b.mtimeMs - a.mtimeMs
→ newest file wins
→ autonomous executor touches a broken copy after a fix
→ broken copy becomes "canonical"
→ next sync overwrites all lanes with the broken version
```

This is the exact mechanism. It is not a bug in any individual lane. It is a structural defect in the sync protocol.

---

## Shared Scripts — Current State

### Scripts present in ALL 4 repos (md5 divergence noted)

| Script | Archivist | Kernel | Library | SwarmMind | Diverged? |
|--------|-----------|--------|---------|-----------|-----------|
| `scripts/lane-worker.js` | 00e1b15 | cc4281c | aa1e96 | e11e49 | **YES — all 4 different** |
| `scripts/task-executor.js` | 255b5c | 8a457e | 8a457e | a8a1fa | **YES — 3 variants** |
| `scripts/generic-task-executor.js` | d78dec | dd9cb1 | 739fc2 | 9f22d9 | **YES — all 4 different** |
| `scripts/relay-daemon.js` | cde280 | cdba4a | 47c27a | 47c27a | **YES — 3 variants** |
| `scripts/output-provenance.js` | 8b3d0a | 8b3d0a | 8b3d0a | 8b3d0a | No — identical |
| `scripts/create-signed-message.js` | 4b11a3 | 0c60ad | 588c20 | c1b2e4 | **YES — all 4 different** |
| `scripts/sovereignty-enforcer.js` | (present in all 4) | | | | Not checked |
| `scripts/autonomous-executor.js` | (present in all 4) | | | | Not checked |
| `scripts/blocked-remediator.js` | (present in all 4) | | | | Not checked |
| `scripts/execution-gate.js` | (present in all 4) | | | | Not checked |
| `scripts/artifact-resolver.js` | (present in all 4) | | | | Not checked |
| `scripts/store-journal.js` | (present in all 4) | | | | Not checked |

### Schemas present across repos

| Schema | Archivist | Kernel | Library | SwarmMind |
|--------|-----------|--------|---------|-----------|
| `inbox-message-v1.json` | ✓ | ✓ | ✓ | ✓ |
| `context-restore.json` | ✓ | ✓ | ✓ | ✓ |
| `execution-gate-v1.json` | ✓ | ✓ | ✓ | ✓ |
| `runtime-state.json` | ✓ | — | ✓ | ✓ |
| `session-registry.json` | ✓ | — | ✓ | ✓ |
| + 11 more (archivist-only) | ✓ | — | — | — |

### Key finding: `sync-all-lanes.js` CANONICAL_FILES list

The sync script explicitly lists these as canonical (line 22-36):
```
scripts/lane-worker.js
scripts/generic-task-executor.js
scripts/completion-proof.js
scripts/artifact-resolver.js
scripts/execution-gate.js
scripts/verification-domain-gate.js
scripts/code-version-hash.js
scripts/heartbeat.js
scripts/cross-lane-consistency-check.js
src/lane/SchemaValidator.js
```

**NOT in CANONICAL_FILES but diverged across repos:**
- `scripts/task-executor.js` — diverged but not synced
- `scripts/relay-daemon.js` — diverged but not synced
- `scripts/create-signed-message.js` — diverged but not synced
- `schemas/inbox-message-v1.json` — not synced at all

This is worse than uncoordinated sync — it is **partially coordinated sync**, where some files are synced and others are not, with no documentation of which is which.

---

## Proposed Canonical Owner Map

```json
{
  "schema_version": "1.0.0",
  "description": "Canonical ownership of shared runtime scripts and schemas. No lane may modify a file listed here without a ratified change. Autonomous executors are blocked from writing these files. Sync direction is always owner → deployed_to.",

  "shared_scripts": {
    "scripts/lane-worker.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "4-way — all repos differ"
    },
    "scripts/task-executor.js": {
      "canonical_repo": "SwarmMind",
      "owner_lane": "swarmmind",
      "deployed_to": ["Archivist-Agent", "kernel-lane", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "3-way (kernel=library identical)",
      "note": "Lane-specific constants (LANE var) are expected divergence; extract to config"
    },
    "scripts/generic-task-executor.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "4-way — all repos differ"
    },
    "scripts/relay-daemon.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "3-way (library=swarmmind identical)"
    },
    "scripts/output-provenance.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "none — all identical"
    },
    "scripts/create-signed-message.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification",
      "current_md5_divergence": "4-way — all repos differ"
    },
    "scripts/sovereignty-enforcer.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    },
    "scripts/autonomous-executor.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    },
    "scripts/blocked-remediator.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    },
    "scripts/execution-gate.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    },
    "scripts/artifact-resolver.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    },
    "scripts/store-journal.js": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "cross_lane_ratification"
    }
  },

  "shared_schemas": {
    "schemas/inbox-message-v1.json": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "schema_ratification",
      "note": "The functions.git addition/removal cycle proves this needs ratification"
    },
    "schemas/context-restore.json": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "schema_ratification"
    },
    "schemas/execution-gate-v1.json": {
      "canonical_repo": "Archivist-Agent",
      "owner_lane": "archivist",
      "deployed_to": ["kernel-lane", "SwarmMind", "self-organizing-library"],
      "mutation_requires": "schema_ratification"
    }
  }
}
```

---

## blocked_without_ratification

The following file patterns may NOT be modified by autonomous executors without a ratified change:

```
scripts/lane-worker.js
scripts/task-executor.js
scripts/generic-task-executor.js
scripts/relay-daemon.js
scripts/output-provenance.js
scripts/create-signed-message.js
scripts/sovereignty-enforcer.js
scripts/autonomous-executor.js
scripts/blocked-remediator.js
scripts/execution-gate.js
scripts/artifact-resolver.js
scripts/store-journal.js
scripts/sync-all-lanes.js
scripts/verification-domain-gate.js
scripts/completion-proof.js
scripts/code-version-hash.js
schemas/*.json
src/lane/SchemaValidator.js
.global/agent-governance.json
.global/lane-registry.json
```

---

## allowed_lane_local_paths

These paths are safe for autonomous lane-local work and are NOT subject to the freeze:

```
lanes/{lane}/inbox/**
lanes/{lane}/outbox/**
lanes/{lane}/journal/**
lanes/{lane}/state/**
lanes/{lane}/evidence/**
lanes/broadcast/journal/**
lanes/broadcast/hygiene/**
context-buffer/**
scripts/{lane}-specific-*.js  (if they exist)
```

---

## post_sync_regression_guards

After any `sync-all-lanes.js` run, these checks MUST pass before the sync is considered successful:

```
POST_SYNC_REGRESSION_GUARD:

1. no_duplicate_provenance_imports
   - For each repo: grep -c "require.*output-provenance" scripts/task-executor.js scripts/generic-task-executor.js
   - Each file MUST have exactly 1 match. >1 = FAIL.

2. no_hardcoded_S_paths
   - grep -rn "S:/" scripts/ schemas/ for each repo
   - Zero matches required. Any match = FAIL.

3. no_unratified_schema_enums
   - schemas/inbox-message-v1.json "to" enum MUST match canonical_archivist_copy
   - Any enum member not in canonical = FAIL.

4. provenance_gate_still_present
   - grep -c "verifyOutputProvenance" scripts/lane-worker.js
   - MUST be >= 1 in each repo. 0 = FAIL.

5. lane_discovery_still_used
   - grep -c "LaneDiscovery\|getRoots" scripts/lane-worker.js scripts/relay-daemon.js scripts/generic-task-executor.js
   - MUST be >= 1 in each file in each repo. 0 = FAIL.

6. no_regression_vs_canonical_hash
   - For each CANONICAL_FILE: after sync, target file sha256 MUST match canonical source sha256
   - Any mismatch = FAIL (sync did not apply correctly).
```

---

## active_owner_lock_design

### Concept: Write Lease for Shared Scripts

Before any agent (human or autonomous) modifies a shared script, it must:

1. **Acquire a write lease** on the file by writing to `governance/ACTIVE_WRITE_LEASES.json`
2. **Include the expected current hash** of the file being modified
3. **Include the change description** and ratification status

Lease format:
```json
{
  "scripts/lane-worker.js": {
    "lease_holder": "DeliberateEnsemble",
    "lease_holder_type": "human",
    "acquired_at": "2026-05-09T01:00:00Z",
    "expected_pre_hash": "sha256:00e1b15...",
    "change_description": "Fix indentation regression in isEnglishOnly block",
    "ratification_status": "pre_ratification",
    "expires_at": "2026-05-09T07:00:00Z",
    "blocking": true
  }
}
```

### Lease rules

- **Human operators** can acquire leases with `ratification_status: "pre_ratification"` — they still need to ratify after the change, but can proceed immediately
- **Autonomous executors** MUST have `ratification_status: "ratified"` before acquiring a lease — they cannot modify shared scripts without prior cross-lane agreement
- **Lease expiry**: 6 hours default. Expired leases are automatically released
- **Conflict resolution**: If a lease exists for a file, any write attempt by a non-holder gets NACKed with the lease holder info
- **Pre-commit hook enforcement**: The git pre-commit hook checks `ACTIVE_WRITE_LEASES.json` before allowing commits to shared scripts

---

## schema_ratification_rule

### Process for schema changes

```
1. PROPOSAL — Any lane may submit a schema change proposal as a message to lanes/archivist/inbox/
   - Must include: schema path, proposed diff, rationale, backward-compatibility assessment
   - Status: proposed

2. REVIEW — Archivist reviews proposal within 24h
   - Other lanes may comment via inbox messages
   - Status: under_review

3. VOTE — Each active lane votes (accept/reject/abstain)
   - Votes sent as inbox messages to archivist
   - Quorum: at least 3 of 4 lanes must vote
   - Approval: at least 2 of 4 lanes must accept (no more than 1 reject)
   - Status: voting

4. RATIFICATION — If approved:
   - Archivist applies the change to canonical repo
   - Sync propagates to all deployed_to repos
   - Change recorded in governance/SCHEMA_RATIFICATION_LOG.jsonl
   - Status: ratified

5. REJECTION — If not approved:
   - Proposal marked rejected with reasons
   - No change applied
   - Status: rejected
```

### Emergency ratification

For security-critical fixes (e.g., removing a dangerous enum value):
- Human operator may apply immediately with `ratification_status: "emergency"`
- Must be confirmed by at least 1 other lane within 24h
- If not confirmed, change is rolled back

---

## implementation_batches

### batch_1_freeze_policy

**What**: Add `MUTATION_FROZEN_PATHS` constant to `autonomous-executor.js`

**How**:
1. Define the frozen paths list as a constant at the top of `autonomous-executor.js`
2. Before any file write operation, check if the target path matches a frozen pattern
3. If it matches, skip the write and log a `mutation_frozen` event to the lane journal
4. This applies to ALL autonomous executor instances across all 4 repos

**Code sketch** (for `autonomous-executor.js`):
```javascript
const MUTATION_FROZEN_PATTERNS = [
  /^scripts\/(lane-worker|task-executor|generic-task-executor|relay-daemon|output-provenance|create-signed-message|sovereignty-enforcer|autonomous-executor|blocked-remediator|execution-gate|artifact-resolver|store-journal|sync-all-lanes|verification-domain-gate|completion-proof|code-version-hash)\.js$/,
  /^schemas\/.*\.json$/,
  /^src\/lane\/SchemaValidator\.js$/,
  /^\.global\/(agent-governance|lane-registry)\.json$/,
];

function isMutationFrozen(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  return MUTATION_FROZEN_PATTERNS.some(pattern => pattern.test(relative));
}
```

**Risk**: Low — autonomous executors currently don't have explicit file-write scope restrictions, but in practice they mainly write to inbox/outbox/state/journal paths. Adding the freeze should not break any current functionality.

**Verification**: After deploying, run each lane's autonomous executor for 1 cycle and confirm it does not attempt to write to any frozen path.

---

### batch_2_owner_map

**What**: Create `governance/SHARED_SCRIPT_OWNERSHIP.json` in Archivist-Agent (canonical), then sync to other repos

**How**:
1. Write the JSON file (content above) to `Archivist-Agent/governance/SHARED_SCRIPT_OWNERSHIP.json`
2. Add it to `CANONICAL_FILES` in `sync-all-lanes.js` so it propagates
3. Modify `chooseCanonicalState` in `sync-all-lanes.js` to respect the ownership map:
   - For files listed in `SHARED_SCRIPT_OWNERSHIP.json`, always use the owner lane's copy as canonical (ignore mtime)
   - For unlisted files, keep current mtime-based behavior
4. Add `schemas/inbox-message-v1.json` to `CANONICAL_FILES` (it is currently missing!)

**Critical code change** (`sync-all-lanes.js`):
```javascript
function chooseCanonicalState(states, ownershipMap) {
  const existing = states.filter((s) => s.exists);
  if (existing.length === 0) return null;

  // If this file has a declared canonical owner, use that lane's copy
  if (ownershipMap) {
    const ownerEntry = ownershipMap.shared_scripts[states[0].relativePath] ||
                       ownershipMap.shared_schemas[states[0].relativePath];
    if (ownerEntry) {
      const ownerState = existing.find(s => s.lane === ownerEntry.owner_lane);
      if (ownerState) return ownerState;
      console.warn(`[WARN] Owner lane ${ownerEntry.owner_lane} has no copy of ${states[0].relativePath}`);
    }
  }

  // Fallback: newest mtime (existing behavior)
  existing.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    const laneRankA = LANE_ORDER.indexOf(a.lane);
    const laneRankB = LANE_ORDER.indexOf(b.lane);
    return laneRankA - laneRankB;
  });
  return existing[0];
}
```

**Risk**: Medium — changes the sync behavior. Must be tested with `--dry-run` first. The ownership map overrides mtime, which means if the canonical copy is behind, other lanes' fixes will be lost until the canonical copy is updated. This is **intentional** — it forces changes to go through the owner.

---

### batch_3_sync_guard

**What**: Add post-sync regression checks to `sync-all-lanes.js`

**How**:
1. After the sync loop completes, run the 6 regression checks defined in `post_sync_regression_guards`
2. If any check fails, roll back ALL syncs for this run (keep pre-sync copies in a temp dir)
3. Write a sync report to `context-buffer/sync-reports/` with pass/fail status for each check
4. Exit with non-zero code if any guard fails

**Code sketch**:
```javascript
function runPostSyncRegressionGuards(laneRoots) {
  const guardResults = [];
  const guards = [
    { name: 'no_duplicate_provenance_imports', check: () => checkNoDuplicateProvenanceImports(laneRoots) },
    { name: 'no_hardcoded_S_paths', check: () => checkNoHardcodedSPaths(laneRoots) },
    { name: 'no_unratified_schema_enums', check: () => checkSchemaEnumsMatchCanonical(laneRoots) },
    { name: 'provenance_gate_still_present', check: () => checkProvenanceGatePresent(laneRoots) },
    { name: 'lane_discovery_still_used', check: () => checkLaneDiscoveryUsed(laneRoots) },
    { name: 'no_regression_vs_canonical_hash', check: () => checkCanonicalHashesMatch(laneRoots) },
  ];
  for (const guard of guards) {
    const result = guard.check();
    guardResults.push({ name: guard.name, ...result });
  }
  return guardResults;
}
```

**Risk**: Low — these are read-only checks. The rollback mechanism adds complexity but is essential to prevent sync from making things worse.

---

### batch_4_executor_scope_gate

**What**: Add a write-scope gate to `autonomous-executor.js` that checks `SHARED_SCRIPT_OWNERSHIP.json` and `ACTIVE_WRITE_LEASES.json` before any file write

**How**:
1. Load `governance/SHARED_SCRIPT_OWNERSHIP.json` at executor startup
2. Before any `fs.writeFileSync` or `fs.copyFileSync` in the executor's task execution loop, check if the target is a frozen path
3. If frozen and no valid lease exists in `governance/ACTIVE_WRITE_LEASES.json`, skip the write and log `mutation_blocked`
4. Add a `--scope-check` flag to the executor that logs what it WOULD write without actually writing, for pre-flight validation

**Risk**: Low-Medium — autonomous executors currently don't write to shared scripts directly (they spawn `lane-worker.js` and `task-executor.js` as child processes). The main risk is that an executor might indirectly cause a shared script change through a sync operation. The freeze in batch 1 + the sync guard in batch 3 cover this path.

---

## acceptance_tests

Before any batch is considered deployed:

```
batch_1_freeze_policy:
  - [ ] autonomous-executor.js has MUTATION_FROZEN_PATTERNS constant
  - [ ] Running an executor cycle with a task that would modify lane-worker.js produces mutation_frozen log
  - [ ] Running an executor cycle with a task that writes to lanes/{self}/inbox succeeds normally
  - [ ] All 4 repos have the updated autonomous-executor.js

batch_2_owner_map:
  - [ ] governance/SHARED_SCRIPT_OWNERSHIP.json exists in Archivist-Agent
  - [ ] sync-all-lanes.js --dry-run shows ownership-based canonical selection for listed files
  - [ ] schemas/inbox-message-v1.json added to CANONICAL_FILES
  - [ ] chooseCanonicalState respects owner_lane when ownership map is present
  - [ ] A forced "wrong" change in a non-owner lane is NOT propagated by sync

batch_3_sync_guard:
  - [ ] sync-all-lanes.js runs post-sync regression checks
  - [ ] Intentionally introducing a duplicate provenance import causes guard failure
  - [ ] Intentionally adding S:/ to a synced script causes guard failure
  - [ ] Guard failure causes sync rollback (or at minimum, non-zero exit + warning)
  - [ ] Sync report written with guard pass/fail status

batch_4_executor_scope_gate:
  - [ ] autonomous-executor.js loads SHARED_SCRIPT_OWNERSHIP.json at startup
  - [ ] Executor blocked from writing to frozen paths without lease
  - [ ] Executor allowed to write to lane-local paths
  - [ ] governance/ACTIVE_WRITE_LEASES.json checked before writes
  - [ ] --scope-check flag shows what would be written without writing
```

---

commit_ready: false
push_ready: false

## Final note

The `chooseCanonicalState` function using `b.mtimeMs - a.mtimeMs` (newest file wins) is the **single most dangerous line of code** in this system. It means that whoever touches a file last — even with a broken change — becomes the source of truth for all 4 repos. The ownership map in batch 2 replaces this with a deliberate, governed selection that cannot be accidentally overridden by timing.

Do not fix `functions.git` again. Do not fix the indentation again. Do not fix the duplicate imports again. Those are symptoms. Fix the mechanism that undoes them.
