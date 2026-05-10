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
Generated: 2026-04-30T17:19:35.232Z

## Counts
- conflicted: 0
- blocked: 0
- quarantined: 0
- unverified: 221
- verified: 5
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Convert top unverified claims into test cards with evidence paths.
- Run a maintenance pass: verify high-impact unverified nodes.

## Top Conflict/Blocker Nodes
- none

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
