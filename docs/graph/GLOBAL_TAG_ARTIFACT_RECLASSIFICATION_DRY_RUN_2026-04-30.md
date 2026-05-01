# Global Tag-Artifact Reclassification — Dry Run Report

**Generated**: 2026-04-30T21:35:18.970Z  
**Analyzed by**: SwarmMind (dry-run)  
**Target**: Full graph snapshot  
**Apply command**: `node dry-run-reclassify-tag-artifacts-global.js --apply --graph "S:/self-organizing-library/context-buffer/graph-snapshot-2026-04-30-17-34-19-619.json"`

---

## Executive Summary

| Metric | Value |
|---|---|
| Total nodes in graph | 3589 |
| Total edges | 44097 |
| Conflicted nodes | **199** |
| Quarantined nodes | 23 |
| Direct CONTRADICTS edges | 0 |

**Proposed reclassification**: 75 nodes (CONFLICTED → UNVERIFIED)  
**Nodes excluded**: 124 (require manual review)

---

## Classification Breakdown

| Category | Count | Action |
|---|---|---|
| artifact_class_conflict_signal | 75 | Safe to auto-reclassify (proposed) |
| direct_semantic_contradiction | 0 | Manual review required |
| mixed | 0 | Investigate |
| ambiguous_blocked | 124 | Investigate |
| **Total conflicted** | **199** | |

---

## Repository Impact (Top 10)

| FreeAgent | 70 | 20 | 0 | 0 | 50 |
| Deliberate-AI-Ensemble | 55 | 5 | 0 | 0 | 50 |
| papers | 31 | 12 | 0 | 0 | 19 |
| Archivist-Agent | 17 | 17 | 0 | 0 | 0 |
| self-organizing-library | 13 | 13 | 0 | 0 | 0 |
| federation | 7 | 2 | 0 | 0 | 5 |
| kernel-lane | 4 | 4 | 0 | 0 | 0 |
| SwarmMind-Self-Optimizing-Multi-Agent-AI-System | 1 | 1 | 0 | 0 | 0 |
| storytime | 1 | 1 | 0 | 0 | 0 |

---

## Top 20 Artifact-Class Candidates

These nodes have **zero CONTRADICTS edges** and high contradictionCount (K(40)+ artifact signature).

| Rank | Node ID | Title | Repo | contradictionCount | Tags |
|---|---|---|---|---|
| 1 | c6afd861a226fc10 | THE SINGLE ENTRY POINT | self-organizing-library | 77 | Failure Mode,Multi-Agent,Covenant |
| 2 | 741647f97fe642ae | THE SINGLE ENTRY POINT | SwarmMind-Self-Optimizing-Multi-Agent-AI-System | 77 | Failure Mode,Multi-Agent,Covenant |
| 3 | 924d83907a0aef82 | Drift, Identity, and Ensemble Coherence  | papers | 53 | Drift,CAISC 2026,Constitutional AI |
| 4 | 79c9991d0f133a56 | Declaration of Intent Protocol | FreeAgent | 44 | Governance,Drift |
| 5 | 417be6412d14ac69 | The Rosetta Stone (Structure Index) | papers | 44 | Rosetta Stone,CAISC 2026,Constitutional AI |
| 6 | e423425eac7b55aa | Declaration of Intent Protocol | Deliberate-AI-Ensemble | 44 | Governance,Drift |
| 7 | 7c5b9c5b5d10f81c | WE4FREE CONSTITUTIONAL GIFT KIT | FreeAgent | 42 | Multi-Agent,Covenant,Verification |
| 8 | d9e257953bef7399 | Paper C — Phenotype Selection in Constra | FreeAgent | 42 | Multi-Agent,Verification,Drift |
| 9 | 81e0b90eb44de696 | Phenotype Selection in Constraint-Govern | papers | 42 | Phenotype,Failure Mode,Drift |
| 10 | a4978eac671fb5f1 | The WE4FREE Framework — Lattice Deformat | papers | 42 | WE4FREE,Drift,Failure Mode |
| 11 | 615aab19efda255e | Arena Feedback Implementation - Producti | Deliberate-AI-Ensemble | 42 | Multi-Agent,Verification,Drift |
| 12 | 6ed054b4a438d970 | CONSTITUTIONAL BOOTSTRAP TEMPLATE | FreeAgent | 41 | Covenant,Drift |
| 13 | 78657e1eaeff4bfe | Constraint Lattices and Stability — Latt | papers | 41 | Constraint Lattice,Drift,Failure Mode |
| 14 | 1ee5e31658f1cc55 | Drift, Identity, and Ensemble Coherence  | papers | 41 | Drift |
| 15 | 42efe4aefe21883e | Drift, Identity, and Ensemble Coherence  | papers | 41 | Drift,Verification |
| 16 | cff9421396c74fbd | Arena Constitutional Validation - Februa | FreeAgent | 40 | Rosetta Stone,Failure Mode,Multi-Agent |
| 17 | 87e8bca61464f300 | Governed Action Pipeline | FreeAgent | 40 | Phase8,Phase9,Phase12 |
| 18 | 47a168b2a279493d | Drift, Identity, and Ensemble Coherence  | papers | 40 | Drift,Failure Mode |
| 19 | d6b49fe453e410a9 | Arena Constitutional Validation - Februa | Deliberate-AI-Ensemble | 40 | Rosetta Stone,Failure Mode,Multi-Agent |
| 20 | 96e320fca0403dec | Three-Lane Constitutional AI Governance  | self-organizing-library | 39 | NFM-001,NFM-002,NFM-003 |

---

## Direct Semantic Contradictions (Manual Review Required)




---

## Mixed / Ambiguous Cases (Investigate)

**Mixed** (0): These nodes have CONTRADICTS edges but also extensive shared-tag co-occurrence. May be partial artifacts.

**Ambiguous/Blocked** (124): Status unclear — could be isolated nodes or low-contraCount artifacts.

---

## Before/After Projection

| Status | Before | After (if apply) |
|---|---|---|
| Conflicted | 199 | 0 |
| Unverified | 2898 | 2973 |
| Verified | 469 | unchanged |
| Quarantined | 23 | unchanged |

---

## Files That Would Be Modified

| File | Change |
|---|---|
| `S:/self-organizing-library/context-buffer/graph-snapshot-2026-04-30-17-34-19-619.json` | Update status for 75 nodes; add `artifact_class:tag_group` tags |

*No other files modified.*

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| False positive reclassification | Very Low | Low | All targets have zero CONTRADICTS edges; pattern matches known K(40) artifact signature |
| Data loss | None | N/A | Backup created automatically before any mutation |
| System instability | Low | Medium | After apply, run lane-worker to propagate; monitor contradictionCount alerts |

**Overall risk: LOW** — This is a safe bulk operation targeting known false positives.

---

## Required Operator Approval

**To proceed with mutation**, run:

```powershell
node dry-run-reclassify-tag-artifacts-global.js --apply --graph "S:/self-organizing-library/context-buffer/graph-snapshot-2026-04-30-17-34-19-619.json"
```

**What happens then:**
1. Graph snapshot is backed up with timestamp
2. All 75 artifact-class nodes are reclassified CONFLICTED → UNVERIFIED
3. Tags added: `artifact_class:tag_group`, `reclassified:2026-04-30`
4. Status counts updated
5. This dry-run report becomes the audit record

**No further actions** (no lane dispatch, no git commits, no index rebuild) until you review the results.

---

## Post-Apply Checklist

- [ ] Verify graph status_counts show conflicted=0
- [ ] Confirm artifact_class tags present on reclassified nodes
- [ ] Check that contradictionCount alerts are suppressed for these nodes
- [ ] Notify affected lanes (FreeAgent, Deliberate-AI-Ensemble, papers, etc.)
- [ ] Archive this dry-run report for audit trail

---

**Generated by**: SwarmMind dry-run analyzer  
**Snapshot**: `snapshot-2026-04-30-13-34-19`  
**Confidence**: HIGH — all targets match verified artifact pattern