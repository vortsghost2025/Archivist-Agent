# Graph Auto Analysis


OUTPUT_PROVENANCE:
agent: graph-analyst
lane: archivist
target: automated graph analysis
generated_at: 2026-05-03
session_id: archivist-2026-05-03

## OBSERVABILITY_DOMAIN
graph-analysis

## NEXT_SAFE_ACTION
Review analysis findings and update knowledge graph

Source: C:\Users\seand\AppData\Local\Temp\cec-weight-smoke-graph-alt-shapes.json
Generated: 2026-05-03T03:41:13.690Z

## Counts
- conflicted: 2
- blocked: 1
- quarantined: 0
- unverified: 0
- verified: 0
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Resolve one conflicted node before any new feature work.
- Keep one active blocker only; pause all non-blocker work.

## Top Conflict/Blocker Nodes
- critical-properties | conflicted | Critical via properties | weight:15
- probe-blocked | blocked | Probe blocked | weight:13
- plain | conflicted | Plain conflict | weight:10

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
