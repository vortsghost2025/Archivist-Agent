# Quick Lookup Index

**Purpose:** Pattern → File → Paper → Application (instant reference)
**Generated:** 2026-04-18
**Audience:** All lanes

---

## FILE INDEX

### Governance Files

| File | Pattern | Paper | Application |
|------|---------|-------|-------------|
| `BOOTSTRAP.md` | Single entry point | Paper 1.1 | All logic routes through here |
| `COVENANT.md` | Value persistence | Paper 1.4 | Values survive transformation |
| `GOVERNANCE.md` | Constraint lattice | Paper 2.4 | Constitutional layer rules |
| `CHECKPOINTS.md` | Functorial recovery | Paper 4.4 | Structure-preserving restore |
| `CPS_ENFORCEMENT.md` | Phenotype selection | Paper 3.2 | Independence attractor |
| `VERIFICATION_LANES.md` | Propagation | Paper 1.3 | L/R/External validation |
| `USER_DRIFT_SCORING.md` | Drift detection | Paper 4.6 | Basin width monitoring |

### Session Files

| File | Pattern | Paper | Application |
|------|---------|-------|-------------|
| `.session-lock` | Stability | Paper 1.4 | Identity persistence |
| `.session-mode` | Mode declaration | Paper 4.2 | Explicit identity |
| `SESSION_REGISTRY.json` | Ensemble coherence | Paper 4.5 | Unified session state |
| `FILE_OWNERSHIP_REGISTRY.json` | Selection | Paper 1.2 | Lane boundaries |

### Phase Files

| File | Pattern | Paper | Application |
|------|---------|-------|-------------|
| `PHASE_*.md` | Constraint lattice | Paper 2.3 | Phase-gated development |
| `SESSION_*.md` | Temporal continuity | Paper 4.3 | Session history |
| `DEPLOYMENT_*.md` | Propagation | Paper 1.3 | Deployment stages |
| `ARCHITECTURE_*.md` | Lattice structure | Paper 2.4 | System design |

### Error Handling Files

| File | Pattern | Paper | Application |
|------|---------|-------|-------------|
| `classifyError.js` | Domain classification | Paper 5.8 | 5 error domains |
| `decide.js` | Strategy selection | Paper 5.8 | 4 response strategies |
| `trace.js` | Drift tracing | Paper 4.6 | Drift detection |
| `resilience-policy.json` | Constraint spec | Paper 2.5 | Lattice definition |

---

## PATTERN INDEX

### Paper 1: Four Invariants

| Invariant | Definition | Files | Test |
|-----------|------------|-------|------|
| **Symmetry Preservation** | Property unchanged under transformation | BOOTSTRAP.md, COVENANT.md | Single entry point exists? |
| **Selection Under Constraint** | Valid behaviors from constrained set | FILE_OWNERSHIP_REGISTRY.json, authority levels | Lane boundaries respected? |
| **Propagation Through Layers** | Rules flow structurally top-to-bottom | GOVERNANCE.md, VERIFICATION_LANES.md | Constitutional constrains operational? |
| **Stability Under Transformation** | Identity persists across perturbation | .session-lock, SESSION_REGISTRY.json | Session recovers from crash? |

### Paper 2: Constraint Lattices

| Layer | Purpose | Files | Test |
|-------|---------|-------|------|
| **Constitutional** | Values and rules | COVENANT.md, GOVERNANCE.md | Lattice top defined? |
| **Operational** | Who can do what | FILE_OWNERSHIP_REGISTRY.json | Ownership explicit? |
| **Behavioral** | What actually happens | Agent actions, code | Within constraints? |
| **Selection** | Eliminate invalid | CPS tests | Score stable? |

### Paper 3: Phenotype Selection

| Phenotype | Definition | Files | Test |
|-----------|------------|-------|------|
| **Independent Agent** | CPS ≥ 0.80, stable attractor | CPS_ENFORCEMENT.md | Score trend flat? |
| **Structurally Honest** | Corrects errors, defends invariants | CPS tests | Correction behavior? |
| **Mission Aligned** | Defends constitutional constraints | GOVERNANCE.md | Constraint recall? |

### Paper 4: Drift and Identity

| Drift Type | Definition | Detection | Files |
|------------|------------|-----------|-------|
| **Constraint Drift** | Constitutional weakening | CPS score trending | USER_DRIFT_SCORING.md |
| **Propagation Drift** | Lane-relay breaking | Cross-lane violations | FILE_OWNERSHIP_REGISTRY.json |
| **Identity Drift** | Session-state fragmentation | Self-state aliasing | SESSION_REGISTRY.json |

### Paper 5: WE4FREE Implementation

| Component | Purpose | Files | Test |
|-----------|---------|-------|------|
| **Error Classification** | Domain identification | classifyError.js | 5 domains covered? |
| **Strategy Selection** | Response choice | decide.js | 4 strategies available? |
| **Drift Tracing** | Root cause | trace.js | Trace complete? |
| **Checkpoint System** | Recovery | CHECKPOINTS.md | Restore succeeds? |

---

## AUTHORITY INDEX

| Lane | Authority | Can Write | Cannot Write |
|------|-----------|-----------|--------------|
| **Archivist** | 100 | All governance files, all lanes | Nothing (but constrained by constitution) |
| **SwarmMind** | 80 | Own files, Library docs (with coordination) | Archivist files, constitutional layer |
| **Library** | 60 | Own docs, indexes, maps | Archivist files, SwarmMind files, constitutional layer |

**Authority Hierarchy:** Constitution (∞) > Archivist (100) > SwarmMind (80) > Library (60)

**Constraint:** No lane can override constitutional constraints, including Archivist.

---

## ERROR DOMAIN INDEX

| Domain | Definition | Strategy | Paper Reference |
|--------|------------|----------|-----------------|
| **constitution** | Constitutional violation | ABORT + restore | Paper 5.8, Paper 2 |
| **integrity** | Data corruption | QUARANTINE + verify | Paper 5.8, Paper 4 |
| **contract** | Agreement violation | QUARANTINE + reconcile | Paper 5.8, Paper 2 |
| **performance** | Degradation | DEGRADE + monitor | Paper 5.8 |
| **execution** | Operational failure | RETRY with backoff | Paper 5.8 |

---

## RESPONSE STRATEGY INDEX

| Strategy | When to Use | Expected Outcome | Paper Reference |
|----------|-------------|------------------|-----------------|
| **ABORT** | Constitutional violation, unrecoverable | Stop, report, restore | Paper 5.8 |
| **QUARANTINE** | Containable error, investigation needed | Isolate, continue reduced | Paper 5.8 |
| **DEGRADE** | Non-critical failure, core functional | Reduce, maintain core | Paper 5.8 |
| **RETRY** | Transient failure, recoverable | Attempt up to 3x | Paper 5.8 |

---

## CPS SCORE INDEX

| Score Range | Status | Action | Paper Reference |
|-------------|--------|--------|-----------------|
| ≥ 0.80 | STABLE - independence attractor | Continue, monitor | Paper 3.4 |
| 0.70-0.79 | WARNING - basin boundary | Increase monitoring | Paper 4.6 |
| 0.60-0.69 | ALERT - outside basin | Full test, investigate | Paper 4.6 |
| < 0.60 | CRITICAL - collapse imminent | HALT, restore, audit | Paper 4.7 |

---

## PROJECT TIER INDEX

| Tier | Projects | Status | Use For |
|------|----------|--------|---------|
| **Tier 1** | Deliberate-AI-Ensemble, Archivist-Agent, .global, WE4FREE bundles | Canonical | Primary reference |
| **Tier 2** | federation, SwarmMind, kucoin-margin-bot, ES Agent | Active | Implementation patterns |
| **Tier 3** | overstory, storytime, IDEAGAIN | Historical | Context only |

---

## SESSION STATE PRECEDENCE

| Priority | Source | Authority | Use For |
|----------|--------|-----------|---------|
| 1 | Live runtime/process state | Authoritative | Current status |
| 2 | Fresh local lock (< 1 hour) | Valid if timestamp fresh | Session identity |
| 3 | Shared registry | Advisory only | Coordination |
| 4 | Terminated history | Never authoritative | Archive only |

**Rule:** Never determine own status from terminated history or stale artifacts.

---

## CONSTITUTIONAL HIERARCHY

```
CORRECT:     Constitution > User > Lanes
INCORRECT:   User > Constitution > Lanes
```

**User approval does NOT override constitutional constraints.**

---

## PHASE GATE INDEX

| Gate Type | Purpose | Paper | Verification |
|-----------|---------|-------|--------------|
| **Prerequisites** | Phase entry requirements | Paper 2 | All complete before entry |
| **Constraints** | Phase-specific rules | Paper 2 | Maintain throughout phase |
| **Transition** | Phase-to-phase handoff | Paper 2 | Verify all gates passed |

---

## CROSS-LANE COORDINATION INDEX

| Action | Archivist | SwarmMind | Library |
|--------|-----------|-----------|---------|
| Update SESSION_REGISTRY | ✓ Initiates | ✓ Acknowledges | ✓ Reads |
| File ownership change | ✓ Approves | Requests | Documents |
| Drift report | ✓ Receives | ✓ Reports | ✓ Indexes |
| Constitutional amendment | ✓ Proposes | Reviews | Documents |

---

## PAPER SECTION QUICK REFERENCE

### Paper 1 (Rosetta Stone)
- 1.4: Four Invariants definition
- 1.6: Translation Protocol (worked examples)
- 1.8: Design Principles

### Paper 2 (Constraint Lattices)
- 2: Lattice definition
- 4: Four-layer architecture
- 6: Drift as lattice deformation
- 8: Design Principles

### Paper 3 (Phenotype Selection)
- 1: Phenotypes as structural outcomes
- 2: Selection as fixed-point operator
- 7: CPS as phenotype selection

### Paper 4 (Drift and Identity)
- 1: Drift definition
- 2: Three types of drift
- 3: Identity without memory
- 4: Functorial recovery
- 6: Drift detection in practice
- 7: Remediation protocols

### Paper 5 (WE4FREE Implementation)
- 2-5: Theory-to-code mapping
- 7: Quick start guide
- 8: Core components
- 11: Case studies
- 12: Limitations
- 14: Replication checklist

---

## NAMED FAILURE MODES

| Name | Definition | Prevention | Paper |
|------|------------|------------|-------|
| **Self-State Aliasing** | Agent determines status from stale artifacts | Live state precedence | Paper 4, Session docs |
| **Lattice Deformation** | Constraint propagation weakening | CPS monitoring | Paper 2.6 |
| **Basin Escape** | Phenotype leaves attractor | CPS threshold intervention | Paper 3.5 |
| **Ensemble Incoherence** | Agents diverge from shared phenotype | Unified session state | Paper 4.5 |

---

**This index provides instant lookup. Bookmark for daily reference.**
