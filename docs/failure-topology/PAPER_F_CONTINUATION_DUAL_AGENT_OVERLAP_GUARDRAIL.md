# Paper F Continuation Draft: Dual-Agent Overlap Guardrail

## Working Title

Topology-Constrained Multi-Agent Coordination: Overlap Windows, Bridge Safety, and Drift Containment

## Thesis

In multi-lane agent systems, runtime drift is driven less by individual policy violation and more by temporal overlap on shared file trees. A simple overlap-window invariant enables measurable containment:

> If two agents can touch the same file tree within 10 minutes, drift risk is high.

## Contribution

This continuation introduces a minimal guardrail with staged enforcement:

1. First overlap warns.
2. Repeat overlap inside a fixed window blocks.
3. Protected shared-path overlap blocks immediately.
4. Unsigned/unowned write intent quarantines.

The model converts concurrency risk into deterministic policy outcomes.

## Mechanism

- Contract artifact: `config/dual-agent-operating-contract.json`
- Operational rule: single writer per lane; read-many allowed.
- Protected surface: broadcast and trust/state synchronization paths.
- Sync rhythm: batch cross-lane writes in fixed windows.

## Why This Matters for Paper F

Paper F argues that governance must be visible in runtime behavior, not only declarative rules. This guardrail provides:

- explicit constraints,
- observable policy actions,
- falsifiable predictions under stress,
- measurable convergence impact.

## Falsifiable Predictions

1. Enabling overlap guardrails reduces repeat-overlap events in consecutive windows.
2. Shared-path collision attempts become blocked/quarantined with explicit reasons.
3. Convergence stability improves under parallel-agent load (fewer conflicted states).

## Experimental Design

### Baseline

- Parallel agents without overlap-window enforcement.
- Measure drift incidents and cross-lane contradiction frequency.

### Treatment

- Same load with overlap-window guardrail active.
- Compare:
  - overlap events,
  - blocked overlaps,
  - quarantine counts for unverified intents,
  - convergence outcomes.

## Metrics

- `overlaps_last_60m`
- `repeat_overlaps_last_60m`
- `blocked_overlaps_last_60m`
- `quarantined_unverified_intents_last_60m`
- `convergence_conflicted_rate`

## Evidence Packaging

- Policy definition: `config/dual-agent-operating-contract.json`
- Runtime test proof: `scripts/test-dual-agent-operating-contract.js`
- Ops guidance: `docs/ops/DUAL_AGENT_CONCURRENCY_GUARDRAIL.md`

## Draft Insert for Paper F

The system’s topological stability did not emerge solely from static lane constraints. Drift pressure increased with concurrent writers and temporal overlap on shared trees. We therefore introduced an overlap-window guardrail: the first cross-agent overlap on the same tree warns, repeated overlap within ten minutes blocks, and overlaps on protected shared paths block immediately. Unsigned or unowned write intents quarantine. This transformed concurrency from an implicit race condition into a governed, measurable runtime surface and improved convergence integrity under parallel operation.
