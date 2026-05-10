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

Source: S:\Archivist-Agent\context-buffer\graph-roadmap-extraction-result-2026-04-29T17-28-57-999Z.json
Generated: 2026-04-30T12:52:30.883Z

## Counts
- conflicted: 0
- blocked: 0
- quarantined: 0
- unverified: 0
- verified: 0
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Run a maintenance pass: verify high-impact unverified nodes.

## Top Conflict/Blocker Nodes
- F-001 | observation | 2/4 packs include AI findings template; non-template packs block structured comparison.
- F-002 | observation | Snapshot volume is high (32 images) but mostly visual artifacts; contradiction and governance state are not encoded as machine fields.
- F-003 | hypothesis | 0 duplicated copy artifacts detected; this can distort trend comparisons and create false contradiction density.
- F-004 | observation | Snapshot manifests do not carry explicit governance path metadata (authority/trust/enforcement links).

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
