# Graph Auto Analysis


OUTPUT_PROVENANCE:
agent: graph-analyst
lane: archivist
target: automated graph analysis
generated_at: 2026-04-30
session_id: archivist-2026-04-30

## OBSERVABILITY_DOMAIN
graph-analysis

## NEXT_SAFE_ACTION
Review analysis findings and update knowledge graph

Source: S:\Archivist-Agent\context-buffer\graph-snapshot-2026-04-30-16-11-43-243.json
Generated: 2026-04-30T17:17:26.870Z

## Counts
- conflicted: 1
- blocked: 0
- quarantined: 0
- unverified: 220
- verified: 5
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Resolve one conflicted node before any new feature work.
- Convert top unverified claims into test cards with evidence paths.

## Top Conflict/Blocker Nodes
- 741647f97fe642ae | conflicted | THE SINGLE ENTRY POINT

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
