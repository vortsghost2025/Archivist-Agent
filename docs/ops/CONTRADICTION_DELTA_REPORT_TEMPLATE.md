# Contradiction Delta Report

**Purpose:** Compare contradiction state before/after remediation and publish a cross-lane execution summary.  
**Run window:** [START -> END]  
**Prepared by:** [lane/operator]  
**Source snapshot (before):** `[path]`  
**Source snapshot (after):** `[path]`

---

## Executive Delta

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Total nodes | | | |
| Conflicted nodes | | | |
| Unverified nodes | | | |
| Quarantined nodes | | | |
| Verified nodes | | | |

**Interpretation:** [one paragraph on whether remediation improved the graph]

---

## Top-25 Remediation Progress

| Bucket | Count |
|---|---:|
| Top-25 resolved | |
| Top-25 still conflicted | |
| Top-25 changed category/status | |
| Top-25 not found in after snapshot | |

### Resolved (sample)
- `[node_id]` — [title]
- `[node_id]` — [title]

### Still conflicted (sample)
- `[node_id]` — [title] — [blocker note]
- `[node_id]` — [title] — [blocker note]

---

## New Conflicts Introduced

| Node ID | Repo | Category | ContradictionCount | Notes |
|---|---|---|---:|---|
| | | | | |

---

## Lane Execution Summary

| Lane | Command run | Result | Artifact |
|---|---|---|---|
| Archivist | | | |
| Library | | | |
| Kernel | | | |
| SwarmMind | | | |

---

## Recommended Next Queue

1. [next 5 highest-impact unresolved nodes]
2. [next 5 governance/root-doc conflicts]
3. [manual review queue from ambiguous set]

---

## Broadcast Payload Stub

Use this payload body for all 4 inboxes:

```text
OUTPUT_PROVENANCE:
agent: [runtime]
lane: archivist
generated_at: [ISO-8601]
session_id: [id-or-unknown]

Contradiction remediation delta complete.
Before: conflicted=[n], unverified=[n], quarantined=[n]
After: conflicted=[n], unverified=[n], quarantined=[n]
Top-25 resolved=[n], remaining=[n], new_conflicts=[n]
Artifacts:
- [delta report path]
- [before snapshot path]
- [after snapshot path]
```
