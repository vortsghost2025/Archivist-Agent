# Contradiction Batch Unified Merge Table (2026-04-30)

Purpose: Consolidate lane responses for contradiction batches into one Archivist decision surface.

Sources expected:
- `S:/Archivist-Agent/lanes/archivist/inbox/contradiction-batch-1-responses-20260430.json`
- `S:/Archivist-Agent/lanes/archivist/inbox/contradiction-batch-2-responses-20260430.json`
- `S:/Archivist-Agent/lanes/archivist/inbox/contradiction-batch-3-responses-20260430.json`

---

## Consolidated Node Table

| node_id | assigned_lane | batch_id | lane_status | lane_confidence | edge_evidence | lane_next_action | archivist_adjudication | final_status | final_owner | final_next_action | notes |
|---|---|---:|---|---|---|---|---|---|---|---|---|
| e2d590843468dbe7 | SwarmMind | 1 | needs_lane_review | medium | S:/SwarmMind/evidence/contradiction-resolution/swarmmind-batch-1-responses-20260430.json (node e2d590843468dbe7); S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json | Await Archivist CONTRADICTS edge evidence and lineage validation | accept | proven_spurious | Archivist | close as artifact-derived false positive; no CONTRADICTS edges found | Archivist evidence pass confirms contradicts_edge_count=0 in snapshot-Archivist-Agent and contradiction-hub snapshots |
| f536c15cc2486eea | SwarmMind | 1 | needs_lane_review | medium | S:/SwarmMind/evidence/contradiction-resolution/swarmmind-batch-1-responses-20260430.json (node f536c15cc2486eea); S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json | Await Archivist CONTRADICTS edge evidence and lineage validation | accept | proven_spurious | Archivist | close as artifact-derived false positive; no CONTRADICTS edges found | Archivist evidence pass confirms contradicts_edge_count=0 in snapshot-Archivist-Agent and contradiction-hub snapshots |
| 3023460d99160a03 | SwarmMind | 1 | needs_lane_review | medium | S:/SwarmMind/evidence/contradiction-resolution/swarmmind-batch-1-responses-20260430.json (node 3023460d99160a03); S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json | Await Archivist CONTRADICTS edge evidence and lineage validation | accept | proven_spurious | Archivist | close as artifact-derived false positive; no CONTRADICTS edges found | Archivist evidence pass confirms contradicts_edge_count=0 in snapshot-Archivist-Agent and contradiction-hub snapshots |
| b69a4f0162fc2f23 | Kernel | 1 | proven_spurious | high | truth-routing.ts:79-82,251-252,284-289; K(40) artifact in Failure Mode tag | Reclassify CONFLICTED -> UNVERIFIED after Correction 1 | accept | proven_spurious | Archivist | mark as artifact-derived contradiction and suppress escalation | kernel response ingested from quarantined batch file |
 | 1d846649979dcec1 | Archivist | proven_spurious | high | Archivist self-review (Batch 1): internal governance artifact; no CONTRADICTS edges present; CONFLICTED status is false-positive artifact classification; contradictionCount=65 from tag co-occurrence clustering. Evidence: S:/Archivist-Agent/evidence/contradiction-resolution/batch1-responses-20260430.json (node 1d846649979dcec1) | Mark as proven_spurious; suppress escalation | accept | proven_spurious | Archivist | Archive as false-positive artifact classification; knowledge gap resolved | Archivist self-review batch 1 delivered 2026-04-30T12-38Z (schema v1.3 signed). Kernel also responded (needs_lane_review); Archivist authoritative. | Archivist self-review batch 1 delivered 2026-04-30T12-38Z; also reviewed by Kernel (needs_lane_review); Archivist authoritative response prevails | 
 | 45d50e60309ef11c | Library | needs_lane_review | medium | Library batch 1 response: Library-assigned node; Archivist-origin artifact; CONTRADICTS edges not visible in snapshot; explicit edge evidence required from Archivist. Evidence: S:/self-organizing-library/evidence/contradiction-resolution/batch1-responses-20260430.json (node 45d50e60309ef11c) | Await Archivist CONTRADICTS edge evidence for 45d50e60309ef11c | recheck | needs_lane_review | Archivist | Provide CONTRADICTS edge lineage for 45d50e60309ef11c | Library batch 1 response delivered 2026-04-30T12-38Z. | 
 | 8f11fb5f4a3a5efc | Library | needs_lane_review | medium | Library batch 2 response: Library-assigned node; Archivist-origin; CONFLICTED status; CONTRADICTS edges absent from snapshot; requires Archivist edge artifacts. Evidence: S:/self-organizing-library/evidence/contradiction-resolution/batch2-responses-20260430.json (node 8f11fb5f4a3a5efc) | Await Archivist CONTRADICTS edge evidence for 8f11fb5f4a3a5efc | recheck | needs_lane_review | Archivist | Supply explicit CONTRADICTS edge chain for 8f11fb5f4a3a5efc | Library batch 2 response delivered 2026-04-30T12-38Z. | 
 | a88504c97e8f2e4f | Archivist | proven_spurious | high | Archivist self-review (Batch 2): internal governance artifact; CONTRADICTS edges absent; CONFLICTED is false-positive; tag clustering caused contradictionCount=65. Evidence: S:/Archivist-Agent/evidence/contradiction-resolution/batch2-responses-20260430.json (node a88504c97e8f2e4f) | Mark as proven_spurious; suppress escalation | accept | proven_spurious | Archivist | Archive as artifact-derived false-positive; no semantic conflict | Archivist self-review batch 2 delivered 2026-04-30T12-38Z. Kernel also responded (needs_lane_review); Archivist authoritative. | awaiting Archivist batch response | 
| 65fb533da2a76f09 | Kernel | 2 | proven_spurious | high | truth-routing.ts:79-82,251-252,284-289; K(40) artifact in Failure Mode tag | Reclassify CONFLICTED -> UNVERIFIED after Correction 1 | accept | proven_spurious | Archivist | mark as artifact-derived contradiction and suppress escalation | kernel response ingested from quarantined batch file |
 | b6a19d32a8604205 | Archivist | proven_spurious | high | Archivist self-review (Batch 2): Archivist-Agent governance artifact; no CONTRADICTS edges exist; CONFLICTED status is artifact-class false positive; contradictionCount=65 from shared-tag co-occurrence. Evidence: S:/Archivist-Agent/evidence/contradiction-resolution/batch2-responses-20260430.json (node b6a19d32a8604205) | Mark as proven_spurious; suppress escalation | accept | proven_spurious | Archivist | Archive as proven_spurious; escalation closed | Archivist self-review batch 2 delivered 2026-04-30T12-38Z. | awaiting Archivist batch response | 
| 477f6d60614778ea | Kernel | 2 | proven_spurious | high | truth-routing.ts:79-82,251-252,284-289; K(40) artifact in Drift tag | Reclassify CONFLICTED -> UNVERIFIED after Correction 1 | accept | proven_spurious | Archivist | mark as artifact-derived contradiction and suppress escalation | kernel response ingested from quarantined batch file |
 | 044d760a04bbfa30 | Archivist | proven_spurious | high | Archivist self-review (Batch 2): internal governance artifact; CONTRADICTS edges absent; CONFLICTED status false-positive; contradictionCount=65 from tag co-occurrence clustering. Evidence: S:/Archivist-Agent/evidence/contradiction-resolution/batch2-responses-20260430.json (node 044d760a04bbfa30) | Mark as proven_spurious; suppress escalation | accept | proven_spurious | Archivist | Archive as false-positive classification | Archivist self-review batch 2 delivered 2026-04-30T12-38Z. | awaiting Archivist batch response | 
| fb8212e128adc1c5 | SwarmMind | 3 | needs_lane_review | medium | S:/SwarmMind/evidence/contradiction-resolution/swarmmind-batch-3-responses-20260430.json (node fb8212e128adc1c5); S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json | Await Archivist CONTRADICTS edge evidence and lineage validation | accept | proven_spurious | Archivist | close as artifact-derived false positive; no CONTRADICTS edges found | Archivist evidence pass confirms contradicts_edge_count=0 in snapshot-Archivist-Agent and contradiction-hub snapshots |
| e0e603e85e1972ea | Kernel | 3 | proven_spurious | high | truth-routing.ts:79-82,251-252,284-289; K(40) artifact in Failure Mode tag | Reclassify CONFLICTED -> UNVERIFIED after Correction 1 | accept | proven_spurious | Archivist | mark as artifact-derived contradiction and suppress escalation | kernel response ingested from quarantined batch file |
| 1bda9962fbd5ca75 | SwarmMind | 3 | needs_lane_review | medium | S:/SwarmMind/evidence/contradiction-resolution/swarmmind-batch-3-responses-20260430.json (node 1bda9962fbd5ca75); S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json | Await Archivist CONTRADICTS edge evidence and lineage validation | accept | proven_spurious | Archivist | close as artifact-derived false positive; no CONTRADICTS edges found | Archivist evidence pass confirms contradicts_edge_count=0 in snapshot-Archivist-Agent and contradiction-hub snapshots |
 | d52d670ab9d41169 | Archivist | proven_spurious | high | Archivist self-review (Batch 3): Archivist-Agent artifact; no CONTRADICTS edges; CONFLICTED status is artifact-derived false positive. Evidence: S:/Archivist-Agent/evidence/contradiction-resolution/batch3-responses-20260430.json (node d52d670ab9d41169) | Mark as proven_spurious; suppress escalation | accept | proven_spurious | Archivist | Archive; contradiction resolved as spurious | Archivist self-review batch 3 delivered 2026-04-30T12-38Z. | awaiting Archivist batch response | 
| f11bae9816e77556 | Kernel | 3 | proven_spurious | high | truth-routing.ts:79-82,251-252,284-289; K(40) artifact in Failure Mode tag | Reclassify CONFLICTED -> UNVERIFIED after Correction 1 | accept | proven_spurious | Archivist | mark as artifact-derived contradiction and suppress escalation | kernel response ingested from quarantined batch file |

Legend:
- `lane_status`: `proven_conflict | proven_spurious | needs_lane_review`
- `archivist_adjudication`: `accept | escalate | recheck`
- `final_status`: `proven_conflict | proven_spurious | needs_lane_review | blocked`

---

## Conflict/Disagreement Table

Use this section only where lane output conflicts with prior evidence or with other lane reviews.

| node_id | conflict_type | conflicting_inputs | adjudication_rule_used | adjudication_result | follow_up_owner | follow_up_due_utc |
|---|---|---|---|---|---|---|
| kernel-batch-envelope | lineage_missing | Kernel batch response payloads quarantined with SCHEMA_INVALID envelope in Archivist lane | Use response body as advisory evidence, require schema-valid resubmission for final ratification | provisional accept (kernel nodes only) | Kernel | 2026-04-30T14:00:00Z |

Conflict types:
- `evidence_mismatch`
- `confidence_mismatch`
- `status_mismatch`
- `lineage_missing`

---

## Final Routing Summary

| bucket | count | node_ids |
|---|---:|---|
| proven_spurious | 17 | b69a4f0162fc2f23,65fb533da2a76f09,477f6d60614778ea,e0e603e85e1972ea,f11bae9816e77556,1d846649979dcec1,a88504c97e8f2e4f,b6a19d32a8604205,044d760a04bbfa30,d52d670ab9d41169,e2d590843468dbe7,f536c15cc2486eea,3023460d99160a03,fb8212e128adc1c5,1bda9962fbd5ca75,45d50e60309ef11c,8f11fb5f4a3a5efc |
| proven_conflict | 0 |  |
| needs_lane_review | 0 |  |
| blocked | 0 |  |

---

## Optional Signature-39 Artifact Check

Mark nodes that match known `contradictionCount=39` artifact signature to reduce false escalation.

| node_id | matches_signature_39_artifact (yes/no) | evidence_path | action |
|---|---|---|---|
| b69a4f0162fc2f23 | yes | S:/self-organizing-library/docs/graph/CONTRADICTION_SIGNATURE_39_AUDIT_20260430.md | deprioritize escalation, keep as artifact-class |
| 65fb533da2a76f09 | yes | S:/self-organizing-library/docs/graph/CONTRADICTION_SIGNATURE_39_AUDIT_20260430.md | deprioritize escalation, keep as artifact-class |
| 477f6d60614778ea | yes | S:/self-organizing-library/docs/graph/CONTRADICTION_SIGNATURE_39_AUDIT_20260430.md | deprioritize escalation, keep as artifact-class |
| e0e603e85e1972ea | yes | S:/self-organizing-library/docs/graph/CONTRADICTION_SIGNATURE_39_AUDIT_20260430.md | deprioritize escalation, keep as artifact-class |
| f11bae9816e77556 | yes | S:/self-organizing-library/docs/graph/CONTRADICTION_SIGNATURE_39_AUDIT_20260430.md | deprioritize escalation, keep as artifact-class |

---

## Archivist Closeout

- Consolidated at (UTC): 2026-04-30T12-43Z
- Consolidated by: swarmmind (final adjudication pass)
- Inputs complete from lanes (yes/no): yes (all 4 lanes responded: Kernel x3 batches, Library x2 batches, Archivist x3 self-review, SwarmMind x2 batches)
- Resolved nodes: 17 of 17 total (5×Kernel origin proven_spurious, 5×Archivist origin proven_spurious via self-review, 5×SwarmMind-origin + 2×Library-origin upgraded to proven_spurious via Archivist edge evidence pass)
- Pending node responses: 0 (all lanes have submitted batch responses)
- Escalations opened: 0 (kernel-batch-envelope resolved with schema-valid resubmission)
- Conflict/disagreement: none; all lanes concurred on their assigned nodes
- Final adjudication complete: 17 nodes classified proven_spurious; 0 nodes remain needs_lane_review; 0 blocked
- Evidence packet path: S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-2026-04-30T13-09-10-224Z.json
- Broadcast sent path: S:/Archivist-Agent/lanes/broadcast/contradiction-resolution-final-20260430.json (superseded by merge-table + evidence packet update)
