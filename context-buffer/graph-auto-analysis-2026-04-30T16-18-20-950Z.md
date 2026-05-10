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

Source: C:\Users\seand\Downloads\graph-snapshot-2026-04-30-16-14-21-321.json
Generated: 2026-04-30T16:18:20.949Z

## Counts
- conflicted: 17
- blocked: 0
- quarantined: 16
- unverified: 368
- verified: 116
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Resolve one conflicted node before any new feature work.
- Convert top unverified claims into test cards with evidence paths.

## Top Conflict/Blocker Nodes
- 044d760a04bbfa30 | conflicted | ðŸ§  What the Previous Reviewer Got WRONG (The â€œLiesâ€)
- fb8212e128adc1c5 | conflicted | APR15
- e0e603e85e1972ea | conflicted | THE SINGLE ENTRY POINT
- 1bda9962fbd5ca75 | conflicted | Paper Outline: When AI Systems Lie About Their Own State
- d52d670ab9d41169 | conflicted | VERIFICATION CHECKPOINT SYSTEM
- a88504c97e8f2e4f | conflicted | COVENANT.md â€” Values (What We Believe)
- 45d50e60309ef11c | conflicted | LIBRARY MAP EXTRACTION: RECOVERY ASSUMPTIONS
- 8f11fb5f4a3a5efc | conflicted | LIBRARY MAP ANALYSIS: COMPLETE AUTHORITY CHAIN
- 1d846649979dcec1 | conflicted | USERDRIFTSCORING.md
- 65fb533da2a76f09 | conflicted | pre compaction validation buffer

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
