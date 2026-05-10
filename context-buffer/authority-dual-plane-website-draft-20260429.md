# Website Draft: Dual-Plane Authority

OUTPUT_PROVENANCE:
agent: authority-lane
lane: authority
target: dual-plane authority website draft
generated_at: 2026-04-29
session_id: authority-20260429

## OBSERVABILITY_DOMAIN
governance

## NEXT_SAFE_ACTION
Finalize website copy and publish to dual-plane authority page.

## Title

Dual-Plane Authority: Why Override Intent Is Not Execution Permission

## One-Paragraph Summary

The governance contradiction is resolved by separating authority into two planes. The operator retains initiation authority (can direct, initiate, and submit override intent), while constitutional gates retain execution authority for state-changing actions. This keeps operator agency intact without allowing unsafe bypass of convergence and quarantine safeguards.

## Core Model

```text
Operator authority = can initiate / redirect / submit override intent
Constitutional authority = decides whether state-changing execution is admissible
```

## What Was Actually Contradictory

The loop was not "user authority vs system authority."  
The loop was a category error: initiation authority was being treated as execution permission.

## Canonical Invariant

```text
override_intent != execution_permission
```

## Break-Glass Anchor (for cognitive loop interruption)

```text
Override intent is not execution permission.
```

## Why This Matters

- Preserves operator power to direct the system.
- Prevents unsafe state changes without constitutional verification.
- Makes governance readable and falsifiable to outside reviewers.
- Aligns wording with real runtime behavior.

## Canonical Wording (Now Applied in Governance Docs)

```text
User can submit override intent across all lanes; execution of state-changing overrides remains constitution-gated by convergence and quarantine policy.
```

## Website / Graph Mapping Spec

Note: treat this as a **canonical interpretation node** in docs/graph narrative. Do not label it as a proven runtime enforcement fact unless explicitly linked to the concrete governance-file patches.

### Node

```text
authority.dual_plane
```

### Edges

```text
Operator -> Override Intent
Override Intent -> Convergence Gate
Convergence Gate / Quarantine Policy -> Execution Permission
```

### Tooltip Copy

Override intent can be submitted immediately by the operator. Execution of state-changing actions is admitted only after constitutional gate checks (convergence + quarantine policy).

## Three-Layer Documentation Trail

1. **Raw investigation log** — captures the original contradiction.
2. **Truth anchor** — compact reset for recurring cognitive loop.
3. **Dual-plane resolution** — formal wording fix and governance integration.

## Suggested Website Callout Block

**Dual-plane authority prevents false bypass.**  
Operator authority governs initiation. Constitutional authority governs execution.  
This is why the operator remains fully empowered while safety gates remain non-optional.
