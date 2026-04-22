# P0 Closure Protocol (Draft)

## Purpose
Define when a P0 blocker is `RESOLVED`, `PARTIALLY_RESOLVED`, or `NOT_RESOLVED` across lanes, and prevent convergence from resuming on conflicting claims.

## Scope
- Applies to cross-lane P0 incidents and escalations.
- Read-first and evidence-first: no closure claim without runtime evidence artifacts.
- This document defines process only; it does not grant authority.

## Status Definitions

### `NOT_RESOLVED`
Use when any of the following are true:
- Root cause is still active in runtime checks.
- Contradictory status claims exist and are unresolved.
- Required evidence artifacts are missing or invalid.
- A lane reports active blocker(s) for the same blocker ID.

### `PARTIALLY_RESOLVED`
Use when:
- A remediation change landed, but runtime verification is incomplete, stale, or lane-inconsistent.
- Some lanes pass while at least one lane still reports failure or unresolved blocker.
- Canonical and replica states are not yet converged.

### `RESOLVED`
Use only when:
- Required artifacts are present and valid.
- Independent verifier confirms no contradictions.
- All impacted lanes report no active blocker for the blocker ID.
- Canonical/replica state is converged (or explicitly declared scoped non-canonical with no runtime impact).

## Required Independent Verification
- Closure must include one independent verifier run that did not produce the closure claim.
- Independent verifier must run contradiction check against lane summaries, blocker reports, P0 resolution artifacts, and convergence artifacts.
- Independent verifier artifact must include:
  - `blocker_id`
  - `verifier`
  - `timestamp`
  - `inputs`
  - `result`
  - `evidence_refs`

## Required Artifact Set
- `p0-escalation-<blocker-id>.json`
- `p0-resolution-<blocker-id>.json` or `<blocker-id>-resolution.json`
- `lane-e2e-summary-<lane>.json` for each impacted lane
- `convergence-<blocker-id>-decision.json` or aggregation artifact with blocker decision
- `p0-closure-report-<blocker-id>.json` (final closure artifact)

## Closure Conditions

### Minimum Conditions for `RESOLVED`
1. Blocker appears in escalation artifact.
2. Resolution artifact exists and includes explicit decision/evidence.
3. No lane summary contains the blocker in `active_blockers`.
4. Contradiction checker reports:
   - no resolved/unresolved conflict for blocker ID
   - no missing required fields in closure artifacts
   - no stale evidence beyond configured staleness window
5. Independent verifier artifact says `result: RESOLVED`.

### Conditions for `PARTIALLY_RESOLVED`
- Remediation exists, but any minimum condition above is not yet satisfied.

### Conditions for `NOT_RESOLVED`
- No valid resolution artifact, or contradiction checker still finds blocker conflict.

## Convergence Resume Gate
Convergence may resume only when blocker state is `RESOLVED` and all are true:
- Independent verifier confirms closure.
- No higher-priority active blocker exists.
- Closure artifact is published to Archivist inbox/outbox and references evidence paths.

## Suggested Closure Artifact
`p0-closure-report-<blocker-id>.json`

```json
{
  "id": "p0-closure-report-<blocker-id>",
  "blocker_id": "<blocker-id>",
  "status": "RESOLVED",
  "timestamp": "2026-04-22T00:00:00Z",
  "independent_verifier": "lane-or-agent-id",
  "evidence_refs": [
    "path/to/escalation.json",
    "path/to/resolution.json",
    "path/to/lane-summary.json",
    "path/to/convergence-decision.json"
  ],
  "contradiction_check": {
    "result": "PASS",
    "report_path": "path/to/contradiction-report.json"
  },
  "resume_convergence": true
}
```

## Failure Rule
If any lane still reports blocker active while another reports resolved, state is `PARTIALLY_RESOLVED` at best until contradiction is cleared.
