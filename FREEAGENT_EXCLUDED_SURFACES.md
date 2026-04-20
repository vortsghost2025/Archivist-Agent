# FreeAgent Excluded Surfaces Registry

Date: 2026-04-19

This document tracks all surfaces explicitly excluded from the production phenotype.

## Exclusion Categories

### 1. Domain-Specific Exclusions

| Path | Reason | Revisit Date |
|------|--------|--------------|
| `medical/*` | Domain not in scope for orchestration | TBD |
| `DISTRIBUTED_MICROSERVICES_UNIVERSE/*` | Experimental, not production-ready | TBD |

### 2. Archive/Legacy Exclusions

| Path | Reason | Revisit Date |
|------|--------|--------------|
| `_ARCHIVED/` | Historical reference only | Never |
| `_root/` | Legacy structure | Never |
| `archive/` | Deprecated components | Never |

### 3. Development Artifacts

| Path | Reason | Revisit Date |
|------|--------|--------------|
| `.continuity_test*/` | Test fixtures | After Phase 5 |
| `logs/*.json` | Runtime logs, not code | N/A |
| `state/test_*/` | Test state directories | After Phase 5 |

### 4. External Dependencies

| Path | Reason | Revisit Date |
|------|--------|--------------|
| `node_modules/` | Package dependencies | Managed by package manager |
| `.next/` | Build output | Regenerated on build |
| `.kilo/`, `.kilocode/` | Editor configs | N/A |

### 5. Deferred from FreeAgent

The following from the original roadmap are deferred:

- `orchestrator` as separate service (not present in current lanes)
- `agent1/2/3` as separate processes (SwarmMind has agents but different model)
- Port bindings 3847, 54121-54123 (not applicable to current architecture)

## Current Architecture Reality

The three-lane system (Archivist, Library, SwarmMind) operates as:
- Single-process Node.js applications
- File-based trust store (Archivist hosts)
- JWS-based identity verification
- Queue-based artifact handling

Not the distributed microservices model described in roadmap assumptions.

## Re-evaluation Process

To move an excluded surface into production phenotype:
1. Document specific need
2. Assess impact on verification path
3. Create phase plan for integration
4. Human approval required

---
Last updated: 2026-04-19
