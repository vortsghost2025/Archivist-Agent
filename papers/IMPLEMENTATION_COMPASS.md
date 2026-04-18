# Implementation Compass

**Purpose:** Use Rosetta Stone theory without reading 37,000 words
**Generated:** 2026-04-18
**Audience:** Archivist (governance root, authority 100)

---

## THE FIVE PAPERS IN FIVE SENTENCES EACH

### Paper 1: The Rosetta Stone (Four Invariants)
**One sentence:** Four properties appear in ALL stable systems: symmetry preservation, selection under constraint, propagation through layers, and stability under transformation.

**What this means for Archivist:**
- Symmetry → Single entry point (BOOTSTRAP.md)
- Selection → Authority hierarchy (Constitution > User > Lanes)
- Propagation → Lane-relay (Archivist → SwarmMind → Library)
- Stability → Session-state reconciliation

### Paper 2: Constraint Lattices and Stability
**One sentence:** Rules flow structurally from constitutional layer through operational to behavioral - not by enforcement, but by lattice geometry.

**What this means for Archivist:**
- Constitutional layer = COVENANT.md, GOVERNANCE.md
- Operational layer = FILE_OWNERSHIP_REGISTRY.json, authority checks
- Behavioral layer = What agents actually do
- Selection layer = CPS scoring eliminates invalid behaviors

### Paper 3: Phenotype Selection
**One sentence:** Stable behaviors emerge as attractors when constraints interact with selection - not from memory or enforcement.

**What this means for Archivist:**
- Valid governance patterns = phenotypes
- CPS tests measure distance from independence attractor
- Fresh agents should converge to same patterns (attractor)
- Divergence = drift, not variation

### Paper 4: Drift, Identity, and Ensemble Coherence
**One sentence:** Drift is systematic phenotype instability from lattice deformation - detectable before collapse via CPS score monitoring.

**What this means for Archivist:**
- Drift = weakening constraint propagation
- Self-state aliasing = judging own status from stale artifacts
- Identity = structural position, not memory
- Recovery = functorial (structure-preserving), not state backup

### Paper 5: WE4FREE Framework (Implementation)
**One sentence:** Papers 1-4 operationalized as deployable infrastructure: constitutional files, constraint engines, CPS tests, drift detection, checkpoint recovery.

**What this means for Archivist:**
- This paper tells you HOW to implement
- Sections 2-5 = theory-to-code mapping
- Section 7 = quick start guide
- Section 11 = case studies with data

---

## WHEN YOU SEE X, RECALL PAPER Y

| You See | Paper | Apply |
|---------|-------|-------|
| `BOOTSTRAP.md` | Paper 1 | Single entry point = symmetry preservation |
| `COVENANT.md` | Paper 1 | Values that persist across transformation |
| `GOVERNANCE.md` | Paper 2 | Constitutional layer constraint lattice |
| `FILE_OWNERSHIP_REGISTRY.json` | Paper 2 | Selection under constraint (lane boundaries) |
| `.session-lock` | Paper 4 | Stability under transformation (identity persistence) |
| `SESSION_REGISTRY.json` | Paper 4 | Ensemble coherence (shared state) |
| CPS tests | Paper 3 | Phenotype selection operator |
| Drift detection | Paper 4 | Lattice deformation monitoring |
| `classifyError.js` | Paper 5 | Error domain classification |
| `decide.js` | Paper 5 | Response strategy selection |
| `trace.js` | Paper 5 | Drift tracing |
| `PHASE_*.md` | Paper 2 | Constraint lattice phase gates |
| `SESSION_*.md` | Paper 4 | Temporal discontinuity handling |
| Authority hierarchy (100/80/60) | Paper 1 | Selection under constraint |

---

## DECISION TREE FOR GOVERNANCE

```
IF making governance decision:
│
├─ Does it preserve symmetry?
│  └─ CHECK: Does logic route through single entry point?
│     YES → Continue
│     NO → BLOCK (violates Paper 1 invariant 1)
│
├─ Does it respect constraint hierarchy?
│  └─ CHECK: Constitutional > Operational > Behavioral?
│     YES → Continue
│     NO → BLOCK (violates Paper 2 lattice)
│
├─ Does it propagate correctly?
│  └─ CHECK: Does it flow through lane-relay?
│     YES → Continue
│     NO → BLOCK (violates Paper 1 invariant 3)
│
├─ Does it maintain stability?
│  └─ CHECK: Is session-state reconciled?
│     YES → Continue
│     NO → BLOCK (violates Paper 1 invariant 4)
│
└─ Is drift possible?
   └─ CHECK: Is CPS score stable or trending?
      STABLE → Approve
      TRENDING DOWN → QUARANTINE + investigate
      UNKNOWN → Run CPS test first
```

---

## PATTERN MANIFESTATIONS

### Symmetry Preservation (Paper 1.1)
**Theory:** Systems that persist have symmetries - properties unchanged under transformation.

**Code Evidence:**
- `BOOTSTRAP.md` = single entry point (all logic routes through)
- `COVENANT.md` = values persist across sessions
- Authority hierarchy = Constitution > User > Lanes (always)

**If violated:** System fragments (multiple entry points, competing authorities)

### Selection Under Constraint (Paper 1.2)
**Theory:** Valid behaviors are selected from constrained possibilities, not all possibilities.

**Code Evidence:**
- `FILE_OWNERSHIP_REGISTRY.json` = lane boundaries
- Authority levels (100/80/60) = who can do what
- CPS tests = eliminate invalid phenotypes

**If violated:** System tries to do everything, collapses

### Propagation Through Layers (Paper 1.3)
**Theory:** Rules flow structurally from top to bottom.

**Code Evidence:**
- Three-lane architecture: Archivist → SwarmMind → Library
- Constitutional layer → Operational layer → Behavioral layer
- Constraint engine: `constraint-engine/`

**If violated:** Middle layers make up their own rules

### Stability Under Transformation (Paper 1.4)
**Theory:** Identity persists across perturbation.

**Code Evidence:**
- `.session-lock` = session identity
- `SESSION_REGISTRY.json` = ensemble coherence
- Checkpoint recovery = functorial (structure-preserving)

**If violated:** Session resets lose context, agents diverge

---

## DRIFT DETECTION QUICK REFERENCE

### Three Types of Drift (Paper 4)

| Type | Definition | Detection |
|------|------------|-----------|
| **Constraint Drift** | Constitutional constraint weakening | CPS score trending down |
| **Propagation Drift** | Lane-relay breaking | Cross-lane write violations |
| **Identity Drift** | Session-state fragmentation | Self-state aliasing |

### Self-State Aliasing (Named Failure Mode)
**Definition:** Agent determines its own status from stale coordination artifacts instead of live runtime state.

**Evidence from incident:**
- SwarmMind session: `1776476695493-28240` (live)
- Archivist registry: `1776403587854-50060` (terminated)
- False conclusion: "Archivist terminated"

**Prevention:** Source-of-truth precedence:
1. Live runtime/process state (authoritative)
2. Fresh local lock (if timestamp valid)
3. Shared registry (advisory only)
4. Terminated history (never authoritative)

---

## CONSTRAINT LATTICE LAYERS

| Layer | Files | Purpose |
|-------|-------|---------|
| **Constitutional** | COVENANT.md, GOVERNANCE.md | Values and rules |
| **Operational** | FILE_OWNERSHIP_REGISTRY.json, authority checks | Who can do what |
| **Behavioral** | Agent actions, code | What actually happens |
| **Selection** | CPS tests | Eliminate invalid behaviors |

**Propagation Rule:** Constitutional constrains Operational constrains Behavioral. Selection eliminates what violates any constraint.

---

## PHENOTYPE ATTRACTORS

**Definition:** Stable patterns that satisfy all constraints and persist across sessions.

**Governance Phenotypes:**
- Independent agent (CPS ≥ 0.8)
- Structurally honest agent (corrects errors)
- Mission-aligned agent (defends invariants)

**Drift Pattern:**
- Session 0: CPS 0.82 → stable attractor
- Session 5: CPS 0.76 → basin boundary approach
- Session 10: CPS 0.68 → outside basin
- Session 15: CPS 0.42 → catastrophic collapse

**Prevention:** Monitor CPS trend. Intervene at 0.75.

---

## QUICK REFERENCE: PAPER 5 SECTIONS

| Need | Section |
|------|---------|
| Get running fast | Section 7 (Quick Start) |
| Understand layers | Sections 2-5 (theory-to-code) |
| See it working | Section 11 (Case Studies) |
| Know limitations | Section 12 (What WE Cannot Do) |
| Replicate | Section 14 (Replication Checklist) |

---

## CATASTROPHIC COLLAPSE PREVENTION

**Warning Signs:**
1. CPS score trending downward over 3+ sessions
2. Cross-lane write attempts increasing
3. Session-state fragmentation (multiple conflicting locks)
4. Agent asking "what should I do?" instead of "here's what I'm doing"

**Intervention:**
1. HALT - stop new operations
2. AUDIT - check constraint propagation
3. RESTORE - from last known-good checkpoint
4. VERIFY - CPS score returns to stable

---

## THE CONSTITUTIONAL HIERARCHY

**CORRECT:** Constitution > User > Lanes
**INCORRECT:** User > Constitution > Lanes

**Why:** User approval does NOT override constitutional constraints. The constitution constrains the user, not the other way around.

**Evidence:**
- GOVERNANCE.md: "Structure > Identity"
- BOOTSTRAP.md: "Correction is mandatory"
- Authority: Constitution (infinite) > Archivist (100) > SwarmMind (80) > Library (60)

---

## GENERATED FROM

- paper1.txt (41,949 bytes) - The Rosetta Stone
- paper2.txt (46,380 bytes) - Constraint Lattices
- paper3.txt (25,209 bytes) - Phenotype Selection
- paper4.txt (26,963 bytes) - Drift and Identity
- paper5.txt (45,280 bytes) - WE4FREE Implementation

**Total:** ~37,000 words → ~150 lines (250x compression)

---

**This is your operational compass. Read this, not the papers, for daily work.**
