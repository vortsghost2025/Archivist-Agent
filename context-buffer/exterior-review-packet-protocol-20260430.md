# Exterior Review Packet Protocol (2026-04-30)

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-30T13:43:00Z
session_id: unknown

## 1. Problem Statement

The exterior review workflow has reached a context ceiling. As system size and lane complexity increased, exterior reviewers were repeatedly forced to reconstruct the full organism from fragmented exports.

That pattern introduces drag, stale interpretation risk, and repeated bootstrap cost.

The protocol objective is to make exterior review bounded, falsifiable, and repeatable:

- one packet
- one decision request
- explicit evidence paths
- explicit approval outcome

## 2. Why Bulk Exterior Review No Longer Scales

Prior pattern:

```text
human copies bulk context -> exterior reviewer reconstructs state -> advisory verdict
```

Scaling issues:

- high context transfer overhead per review
- repeated reconstruction of shared background
- increased stale-read and omission risk
- inconsistent decision surfaces across reviewers

Protocol pattern:

```text
lane output -> case-file packet -> exterior verdict -> Archivist merge
```

## 3. Packet Schema

Each exterior packet must include:

- `packet_id`
- `generated_at`
- `source_lane`
- `target_reviewer`
- `question`
- `target_node_or_cluster`
- `current_state`
- `proposed_action`
- `evidence_paths`
- `snapshot_paths`
- `relevant_counts`
- `known_artifacts`
- `risk_if_wrong`
- `approval_needed`
- `hard_boundaries`
- `expected_response_format`

Recommended JSON skeleton:

```json
{
  "packet_id": "pkt-<timestamp>-<slug>",
  "generated_at": "ISO-8601",
  "source_lane": "archivist",
  "target_reviewer": "exterior-synthesis",
  "question": "one bounded decision question",
  "target_node_or_cluster": "node id or cluster signature",
  "current_state": "proven | unproven | conflicted | blocked | quarantined | resolved",
  "proposed_action": "single proposed action",
  "evidence_paths": [],
  "snapshot_paths": [],
  "relevant_counts": {},
  "known_artifacts": [],
  "risk_if_wrong": "single paragraph",
  "approval_needed": "approve | reject | amend",
  "hard_boundaries": [],
  "expected_response_format": {
    "verdict": "approve | reject | amend | insufficient_evidence",
    "reason": "string",
    "required_changes": [],
    "evidence_gaps": [],
    "safe_next_action": "string",
    "do_not_do": []
  }
}
```

## 4. Exterior Response Contract

Exterior reviewer must return:

- `verdict`: `approve | reject | amend | insufficient_evidence`
- `reason`
- `required_changes`
- `evidence_gaps`
- `safe_next_action`
- `do_not_do`

Response must be bounded to the submitted packet scope only.

## 5. Required Evidence Path Rules

- Every claim in the packet must map to at least one explicit artifact path.
- If an evidence path is missing, mark the packet `insufficient_evidence`.
- Do not infer mutation outcomes from narrative text alone.
- Prefer machine-readable sources when available (`.json`, logs, snapshots).
- Distinguish observed facts from recommendations.

## 6. Hard Boundaries

For this protocol draft phase:

- Documentation only.
- Do not implement packet generator yet.
- Do not mutate graph state.
- Do not change mapper code.
- Do not dispatch lane messages.
- Do not sign broadcast.
- Do not commit until exact file list is shown and approved.

## 7. Worked Example: CONTRADICTION_SIGNATURE_39 Closure

### Packet Focus

- target cluster: `contradictionCount=39`
- current classification: `proven_spurious`
- effective totals:
  - `proven_spurious: 17`
  - `needs_lane_review: 0`
  - `proven_conflict: 0`
  - `blocked: 0`

### Evidence Paths

- `S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json`
- `S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.md`
- `S:/Archivist-Agent/context-buffer/contradiction-batch-unified-merge-table-20260430.md`
- `S:/Archivist-Agent/context-buffer/contradiction-signature-39-archivist-edge-pass-20260430.md`

### Decision Requested

`approve | reject | amend` unsigned closure broadcast draft.

### Example Packet (abbreviated)

```json
{
  "packet_id": "pkt-20260430-contradiction-signature-39-closeout",
  "source_lane": "archivist",
  "target_reviewer": "exterior-synthesis",
  "question": "Should Archivist approve unsigned superseding closure broadcast draft for contradiction signature 39?",
  "target_node_or_cluster": "contradictionCount=39 cluster",
  "current_state": "proven_spurious",
  "proposed_action": "approve unsigned closure draft pending operator gate",
  "relevant_counts": {
    "proven_spurious": 17,
    "needs_lane_review": 0,
    "proven_conflict": 0,
    "blocked": 0
  },
  "approval_needed": "approve | reject | amend"
}
```

## 8. Archivist Merge Procedure

When exterior verdict returns:

1. Validate response format contract fields are present.
2. Confirm verdict scope matches packet scope.
3. Cross-check required evidence gaps (if any).
4. Apply one of:
   - `approve`: proceed to next internal gate
   - `amend`: revise draft packet/action and re-review if needed
   - `reject`: halt action and capture rationale
   - `insufficient_evidence`: gather missing artifacts and resubmit packet
5. Record merge outcome in a traceable artifact path.

## 9. Non-goals

- Not a graph mutation protocol.
- Not a runtime enforcement mechanism.
- Not a lane messaging transport change.
- Not a replacement for governance or convergence gates.
- Not a full automation spec for packet generation (yet).

## 10. Future Implementation Notes

Future implementation (out of current scope) should add:

- packet generator script from graph/lane outputs
- schema validation for packet format
- reviewer response parser
- archival index of packet-to-verdict mappings
- CI checks for packet contract compliance

Implementation must preserve the core rule:

```text
Exterior lanes do not need total context.
Exterior lanes need a falsifiable review packet.
```
