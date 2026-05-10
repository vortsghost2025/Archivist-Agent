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

Source: C:\Users\seand\Downloads\graph-snapshot-FreeAgent-2026-04-30-12-52-02-534.json
Generated: 2026-04-30T12:53:30.388Z

## Counts
- conflicted: 70
- blocked: 0
- quarantined: 1
- unverified: 575
- verified: 182
- resolved: 0
- unknown: 0
- contradiction_edges: 0

## Next Actions
- Resolve one conflicted node before any new feature work.
- Convert top unverified claims into test cards with evidence paths.

## Top Conflict/Blocker Nodes
- 2003e3946c86dbf9 | conflicted | AGENT HANDOFF BRIEF - Current Context
- bda5d25735663d77 | conflicted | ðŸŽŠ PROJECT COMPLETION SUMMARY
- 339f82f33db3bf86 | conflicted | AGENT OPERATIONAL PROTOCOL
- 46f72116106c6d55 | conflicted | ALERTING RULES
- b585750139e20b54 | conflicted | API Test Breakdown - February 9, 2026
- 387eb5981c9fc13d | conflicted | ARCHITECTURE MASTER SPEC
- a23cb8dc41d84138 | conflicted | WE4FREE Platform - Universal Swarm Architecture Validation
- cff9421396c74fbd | conflicted | Arena Constitutional Validation - February 10, 2026
- 704392bf27412eb6 | conflicted | BOOTSTRAP EXAMPLE: The WE Team
- 6ed054b4a438d970 | conflicted | CONSTITUTIONAL BOOTSTRAP TEMPLATE

## Discipline Gate
- No new feature work until one conflicted node is closed with evidence.
