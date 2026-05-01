# GOVERNANCE AMENDMENT: Canonical Promotion Gate, Script Registry, Output Provenance

**Status:** PROPOSAL — awaiting operator approval
**Source:** exterior-synthesis recommendation + Archivist operational experience
**Date:** 2026-05-01
**Priority:** HIGH — prevents the stale-snapshot regression that just occurred

---

## Problem Statement

During the 2026-05-01 session, Library completed a global verification triage on a
snapshot that was taken BEFORE Archivist had independently resolved 199 CONFLICTED
nodes, triaged 23 QUARANTINED nodes, and verified 407 additional nodes.

Library requested promotion of its snapshot as canonical. Its snapshot reported:
- VERIFIED: 535 | UNVERIFIED: 3,031 | QUARANTINED: 23

Current Archivist state was already:
- VERIFIED: 1,064 | UNVERIFIED: 2,525 | QUARANTINED: 0

This was caught manually. The system needs an automatic gate.

Additionally:
- Repeated operator requests for OUTPUT_PROVENANCE do not persist because they
  are not enforced by validators
- Hundreds of scripts across lanes lack clear purpose, mutation risk, and ownership

---

## Proposal 1: CANONICAL_PROMOTION_GATE

Any artifact that changes or replaces canonical state must declare:

```yaml
base_artifact_path: path/to/snapshot/when/work/started
base_artifact_hash: sha256-of-base-artifact
base_generated_at: ISO-8601-timestamp
current_canonical_artifact_path: path/to/current/canonical
current_canonical_hash: sha256-of-current-canonical
current_canonical_generated_at: ISO-8601-timestamp
promotion_decision: PROMOTE | REBASE_REQUIRED | SUPERSEDED | QUARANTINE
```

**Rule:**

If `current_canonical_hash != base_artifact_hash`, the artifact CANNOT be
promoted automatically. It may only be:

- Preserved as evidence
- Rebased onto current canonical state
- Resubmitted for review

**Natural flow:**

```
lane starts work
  → records base canonical hash
  → does work
  → before promotion, checks current canonical hash
  → if unchanged: PROMOTE
  → if changed: REBASE_REQUIRED
```

The lane itself says: "REBASE_REQUIRED: canonical advanced while I was processing"
instead of needing external catch.

---

## Proposal 2: SCRIPT_REGISTRY

Create generated cross-lane script inventories:

- `SCRIPT_REGISTRY.json` — machine-readable
- `SCRIPT_REGISTRY.md` — human-readable

Each script entry:

```yaml
path: S:/Archivist-Agent/scripts/heartbeat.js
repo: Archivist-Agent
lane: archivist
language: javascript
purpose_guess: Writes heartbeat files every 60 seconds
last_modified: 2026-04-30T20:00:00Z
sha256: abc123...
entrypoint_type: cli | module | scheduled_task
writes_files: true
writes_inbox: true
writes_graph: false
requires_operator_approval: false
danger_level: read_only | report_writer | state_mutation | governance_mutation
last_seen_commit: fe6c08e
```

**Danger levels:**

| Level | Meaning |
|-------|---------|
| read_only | Reads files, produces reports, no mutations |
| report_writer | Writes logs/reports, no state changes |
| state_mutation | Modifies lane state, inbox, or graph |
| governance_mutation | Changes governance documents, GOVERNANCE.md, specs |

**Implementation:** Generate read-only first. No script deletion or refactor.

---

## Proposal 3: OUTPUT_PROVENANCE_REQUIRED

Every lane-facing output, report, inbox message, summary, or promoted artifact
must begin with:

```
OUTPUT_PROVENANCE:
  agent: <agent-runtime-or-model>
  lane: <lane-id>
  generated_at: <ISO-8601>
  session_id: <session-id>
  target_lane: <target-lane>
```

**If missing, the artifact is NOT eligible for:**

- Inbox processing
- Canonical promotion
- Graph mutation
- Governance ratification
- Completion claims

**Enforcement points:**

1. `BOOTSTRAP.md` — add as requirement
2. `AGENTS.md` — add to lane protocol section
3. `GOVERNANCE.md` — add as invariant
4. Lane worker output validator — reject messages without provenance
5. Message schema — make provenance a required field

**Wording:** Not "please include it." It is: "No provenance = invalid output."

---

## Implementation Order

1. **OUTPUT_PROVENANCE_REQUIRED** — Update governance docs first, then validators
2. **SCRIPT_REGISTRY** — Generate read-only inventory across all lanes
3. **CANONICAL_PROMOTION_GATE** — Add to write guard and lane protocol

No auto-apply. Each requires operator approval before implementation.
