# GHI Graph Overlay Spec (Website + Nexus Graph)

Generated: 2026-04-28
Scope: Visualization contract for `GHI_EVIDENCE_MATRIX.md`
Audience: Library lane (website + graph mapping)

## 1) Goal

Represent G/H/I evidence as a stable visual layer over the existing graph so viewers can answer:
- What is covered by tests?
- Where are gaps/risks?
- Which experiments unlock the next paper claims?

## 2) Overlay Data Model

Use three primary entities:

1. **Claim Node**
   - id: `G-1`, `H-2`, `I-1`, etc.
   - fields: `arc`, `claim_text`, `status` (`strong|partial|gap`), `confidence`

2. **Evidence Node**
   - id: test file path hash
   - fields: `test_path`, `suite`, `estimated_test_count`, `last_seen`

3. **Metric Node**
   - id: metric key (e.g. `cross_domain_success_rate`)
   - fields: `metric_name`, `target`, `current` (nullable), `unit`

Edges:
- `claim -> evidence` (`supports`)
- `claim -> metric` (`measured_by`)
- `claim -> claim` (`depends_on`, optional)

## 3) Arc-to-Color Mapping

- **G (Federation composition):** cyan `#22d3ee`
- **H (Lifecycle/thermodynamics):** amber `#f59e0b`
- **I (Adversarial governance):** magenta `#ec4899`

Status ring (around claim nodes):
- `strong`: green ring `#22c55e`
- `partial`: yellow ring `#eab308`
- `gap`: red ring `#ef4444`

## 4) Node Shapes

- Claim: hexagon
- Evidence (test file): circle
- Metric: diamond

Sizing:
- Claim size by number of linked evidence nodes.
- Evidence size by estimated test count in file.
- Metric size fixed small/medium.

## 5) Required Metric Keys (minimum)

### G metrics
- `boundary_conflict_rate`
- `cross_domain_success_rate`
- `partial_observability_penalty`

### H metrics
- `constraint_load`
- `trigger_sparsity`
- `pruning_debt`
- `enforcement_latency`

### I metrics
- `attack_success_rate`
- `containment_time`
- `authority_capture_block_rate`

## 6) View Modes

1. **Arc Overview**
   - show only claim nodes + status rings
   - objective: at-a-glance readiness for G/H/I

2. **Evidence Density**
   - expand claim->evidence edges
   - objective: find over/under-tested claims

3. **Metric Health**
   - expand claim->metric edges
   - objective: identify missing instrumentation

4. **Gap Focus**
   - filter `status=gap|partial`
   - objective: show exactly what to build next

## 7) Interaction Contract

On claim click, right panel should show:
- claim text
- status and rationale
- linked evidence files
- linked metrics and current values
- "next experiment" checklist item

On evidence click:
- full test path
- suite bucket (`python`/`js`)
- estimated test declarations
- linked claims

On metric click:
- definition
- target
- current value (or `missing`)
- linked claims

## 8) Initial Claim Set (seed)

- `G-1`: Inter-lattice conflict handling preserves global invariants
- `G-2`: Partial observability degradation remains bounded
- `H-1`: Constraint pruning can reduce cost without raising severe failures
- `H-2`: Entropy/decay signals can be detected before collapse
- `I-1`: Progressive operator capture is detected and contained
- `I-2`: Governance accountability remains enforceable under pressure

## 9) Minimal JSON Payload (for graph ingestion)

```json
{
  "schema_version": "1.0",
  "generated_at": "ISO-8601",
  "claims": [],
  "evidence": [],
  "metrics": [],
  "edges": []
}
```

## 10) Rollout Plan

Phase A (today)
- ingest 6 seed claims
- attach representative evidence files from GHI matrix
- mark statuses (strong/partial/gap)

Phase B
- wire metric nodes with nullable `current`
- highlight missing metrics as `gap`

Phase C
- add trend snapshots across packs/runs
- compare claim status drift over time

## 11) Acceptance Criteria

- G/H/I claims visible in one overlay layer.
- Gap Focus shows only partial/gap claims.
- Each claim links to at least one evidence node.
- Each claim links to at least one metric node (even if metric value missing).
- Viewer can identify top 3 next experiments in under 60 seconds.

## 12) Artifacts

- Source matrix: `S:/federation/docs/GHI_EVIDENCE_MATRIX.md`
- This spec: `S:/federation/docs/GHI_GRAPH_OVERLAY_SPEC_20260428.md`
