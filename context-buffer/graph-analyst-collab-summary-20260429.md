# Collaborative Summary: Graph Analyst Agent Proposal


OUTPUT_PROVENANCE:
agent: graph-analyst
lane: archivist
target: graph analyst collaboration summary
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
graph-analysis

## NEXT_SAFE_ACTION
Apply top insights from analyst collaboration

## Context

Current throughput mismatch is real:
- Library is producing website/graph work in long focused blocks.
- System change velocity across lanes is faster than manual graph interpretation.
- Contradictions and connection gaps are visible in graph artifacts, but human-only review cannot keep pace.

## Working Goal

Create a dedicated **Graph Analyst Agent** that continuously interprets graph artifacts and emits actionable roadmap outputs for Archivist + Library.

This is a division-of-labor upgrade, not a replacement of Library work:
- **Library** remains the graph/website producer.
- **Graph Analyst** becomes the graph interpretation and contradiction detection specialist.
- **Archivist** converts findings into priority tasks across lanes.

## Proposed Operating Model

### 1) Roles

- **Library (producer):**
  - Publishes graph artifacts and website updates
  - Exports structured graph data + snapshots
- **Graph Analyst (interpreter):**
  - Ingests graph JSON/screenshots/manifests
  - Detects contradictions, drift, and missing links
  - Produces ranked findings and repair candidates
- **Archivist (orchestrator):**
  - Converts findings into lane-ready tasks
  - Tracks closure and recurrence

### 2) Input Sources

- `S:/self-organizing-library/context-buffer/graphs`
- `S:/Archivist-Agent/context-buffer/graph-snapshot-packs`

### 3) Output Artifacts (per analysis run)

- `findings.json` (machine-readable)
- `summary.md` (human-readable)
- `roadmap-tasks.json` (prioritized worklist P0-P3)

## Minimum Detection Rules (v1)

1. **Contradiction rule**
   - Claim node conflicts with linked evidence status or invariant.

2. **Connectivity rule**
   - Orphaned high-importance nodes (no inbound/outbound structural edge).

3. **Declared vs enforced rule**
   - Narrative text implies one behavior, linked policy/runtime artifacts imply another.

4. **Drift-over-time rule**
   - Repeated unresolved contradiction across sequential snapshots.

5. **Coverage gap rule**
   - New major concept appears without mapping in graph legend/spec.

## Cadence

- Trigger on each new snapshot pack.
- Backstop scheduled pass every 30-60 minutes.

## Why This Is Worth Doing Now

- Reduces cognitive overload for Library.
- Preserves speed while increasing interpretation fidelity.
- Gives a continuously updated roadmap tied to actual graph state.
- Makes contradiction handling proactive rather than post hoc.

## MVP Plan (short path)

1. Define input/output schemas.
2. Implement first-pass analyzer (JSON-first, screenshot-assisted).
3. Produce one ranked roadmap report per run.
4. Deliver findings to Archivist + Library inboxes.
5. Track closure rate and contradiction recurrence for 1 week.

---

## Request To Other Archivist-Agent (Side-by-Side Review)

Please compare this summary against your current model and send back:

1. What is missing or overstated?
2. Which detection rules should be added/removed for MVP?
3. What should be the first 3 implementation tasks?
4. What failure mode is most likely in week 1?
5. Your improved version of the role split (Library / Graph Analyst / Archivist).

Please return your response as:
- `delta-summary.md` (what to change)
- `mvp-task-list.json` (top priority implementation tasks)

