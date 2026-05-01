# Core/Exterior Graph Classification Plan

**Status:** PROPOSAL — READ ONLY — awaiting operator approval
**Author:** Archivist (kilo-auto/free)
**Date:** 2026-05-01
**Scope:** 3,589-node global snapshot

---

## Purpose

Split the NexusGraph into two sections:

- **Core Graph** — the 4-lane constitutional organism (authority-bearing)
- **Exterior Graph** — information sources with zero constitutional authority

Exterior repos do not generate authority-weighted contradiction pressure
against the Core Graph and are not assigned as lane-owned backlog.

---

## Core Graph (1,506 nodes)

| Repo | Total | VERIFIED | UNVERIFIED | Lane Owner |
|------|-------|----------|------------|------------|
| Archivist-Agent | 517 | 135 | 382 | Archivist |
| self-organizing-library | 472 | 106 | 366 | Library |
| SwarmMind | 226 | 6 | 220 | SwarmMind |
| kernel-lane | 215 | 29 | 186 | Kernel |
| papers | 76 | 38 | 38 | Library |

**Tags to apply:**
- `graph_section:core`
- `authority_weight:normal`

**Core UNVERIFIED backlog:** 1,192 nodes — each lane verifies its own

---

## Exterior Graph (2,083 nodes)

| Repo | Total | VERIFIED | UNVERIFIED | Role |
|------|-------|----------|------------|------|
| FreeAgent | 828 | 252 | 576 | origin_artifact |
| federation | 572 | 21 | 551 | simulation |
| Deliberate-AI-Ensemble | 412 | 102 | 310 | pattern_donor |
| storytime | 271 | 7 | 264 | history |

**Tags to apply:**
- `graph_section:exterior`
- `authority_weight:0`
- `exterior_role:origin_artifact | simulation | pattern_donor | history`

**Exterior UNVERIFIED backlog:** 1,701 nodes — these are NOT verified like core code.
They are classified as information sources and do not require governance verification.

---

## Role Definitions

| Role | Meaning | Verification Treatment |
|------|---------|----------------------|
| origin_artifact | Early work, prototypes, operator's original code | Tag as historical, no governance verification needed |
| simulation | Theoretical models, paper simulations, federation theory | Tag as reference material, no governance verification needed |
| pattern_donor | Code patterns, architectural examples, ensemble experiments | Tag as reference, verify only if adopted into core |
| history | Session logs, story archives, conversation records | Tag as archival, no governance verification needed |

---

## Implementation Steps (NOT auto-applied)

1. **Tag all core repo nodes** with `graph_section:core` and `authority_weight:normal`
2. **Tag all exterior repo nodes** with `graph_section:exterior`, `authority_weight:0`, and `exterior_role:{role}`
3. **Update site-index generator** to recognize the split for web display
4. **Update contradiction detection** to exclude exterior→core contradiction pressure
5. **Separate web graph views** — core graph as primary, exterior as secondary reference

---

## What This Changes

- Exterior nodes no longer count toward lane verification backlogs
- Exterior nodes cannot generate authority-weighted CONFLICTED status against core nodes unless explicitly promoted
- Core lanes are only responsible for their own repo's UNVERIFIED nodes
- The web graph can display two sections naturally

---

## What This Does NOT Change

- Exterior nodes still exist in the graph
- Exterior nodes still have cross-references and tags
- Exterior nodes can still be searched and linked
- No nodes are deleted or moved

---

## Approval Required

This plan requires operator approval before any mutations are applied.

No auto-apply. No broad verification. Classification first.
