# LIBRARY MAP EXTRACTION: DEPENDENCY GRAPH

**Purpose:** Map all dependency relationships from library map
**Source:** LIBRARYMAPAPRIL172026.txt

---

## DEPENDENCY GRAPH (Top-Down)

```
FOUNDATIONAL LAYER
├── papers-20260416T223833Z-3-001/
│   ├── 01_The_Rosetta_Stone.pdf.pdf ──────────────┐
│   ├── 02_Constraint_Lattices.pdf.pdf ────────────┤
│   ├── 03_Phenotype_Selection.pdf.pdf ────────────┤
│   ├── 04_Drift_Identity.pdf.pdf ─────────────────┤
│   └── 05_The_WE4FREE_Framework.pdf.pdf ──────────┘
│                                                   │
▼                                                   │
CONSTITUTIONAL LAYER                                │
├── Deliberate-AI-Ensemble-main/                    │
│   ├── WE4FREE_README.md ◄─────────────────────────┘
│   │   └── depends-on: papers (theory)
│   │
│   ├── COVENANT.md
│   │   └── depends-on: WE4FREE_README.md
│   │
│   ├── BOOTSTRAP_TEMPLATE.md
│   │   └── depends-on: COVENANT.md + papers
│   │
│   ├── agents/architecture/ (25 documents)
│   │   └── depends-on: BOOTSTRAP_TEMPLATE.md
│   │
│   └── CPS_ENFORCEMENT.md
│       └── depends-on: Paper 02 (Constraint Lattices)
│
▼
GOVERNANCE LAYER
├── S:/GLOBAL_GOVERNANCE.md
│   └── depends-on: WE4FREE (constitutional principles)
│   └── authority: Universal Layer 1
│
├── S:/Archivist-Agent/
│   ├── BOOTSTRAP.md
│   │   └── depends-on: GLOBAL_GOVERNANCE.md + Deliberate-AI-Ensemble
│   │   └── authority: Single entry point for Lane 1
│   │
│   ├── GOVERNANCE.md
│   │   └── depends-on: BOOTSTRAP.md
│   │
│   ├── COVENANT.md
│   │   └── depends-on: ../GLOBAL_GOVERNANCE.md
│   │
│   ├── CPS_ENFORCEMENT.md
│   │   └── depends-on: BOOTSTRAP.md + Paper 02
│   │
│   ├── RUNTIME_STATE.json
│   │   └── depends-on: BOOTSTRAP.md (authority definition)
│   │
│   └── SESSION_REGISTRY.json
│       └── depends-on: RUNTIME_STATE.json
│
▼
EXECUTION LAYER
├── S:/SwarmMind/
│   ├── GOVERNANCE_MANIFEST.json
│   │   └── depends-on: Archivist/BOOTSTRAP.md (upstream lane)
│   │   └── derived-from: papers
│   │
│   ├── RUNTIME_STATE.json
│   │   └── depends-on: GOVERNANCE_MANIFEST.json
│   │   └── upstream: Archivist/RUNTIME_STATE.json
│   │
│   └── verification/
│       └── depends-on: RUNTIME_STATE.json (mode configuration)
│
▼
MEMORY LAYER
├── S:/self-organizing-library/
│   ├── RUNTIME_STATE.json
│   │   └── depends-on: SwarmMind/RUNTIME_STATE.json (upstream)
│   │   └── upstream: Archivist/RUNTIME_STATE.json
│   │
│   ├── nexusgraph.db
│   │   └── depends-on: RUNTIME_STATE.json (lane authority)
│   │
│   └── books/
│       └── depends-on: papers + WE4FREE + BOOTSTRAP.md
```

---

## DEPENDENCY TYPES

| Type | Description | Example |
|------|-------------|---------|
| **theory-depends** | Foundational concept derivation | papers → WE4FREE |
| **authority-depends** | Authority hierarchy | Library → SwarmMind → Archivist |
| **config-depends** | Configuration inheritance | RUNTIME_STATE.json chain |
| **protocol-depends** | Protocol implementation | BOOTSTRAP.md → recovery protocols |
| **verification-depends** | Verification chain | Paper 04 → UDS → code |

---

## CRITICAL DEPENDENCY PATHS

### Path 1: Authority Resolution Chain
```
papers → WE4FREE → GLOBAL_GOVERNANCE → Archivist/BOOTSTRAP
    → SwarmMind/GOVERNANCE_MANIFEST → Library/RUNTIME_STATE
```
**If any link breaks:** Authority hierarchy becomes undefined

### Path 2: Recovery Chain
```
papers (Drift Identity) → WE4FREE (Three Rules)
    → BOOTSTRAP (Pre-Flight Check) → LAST_KNOWN_STATE
```
**If any link breaks:** Crash recovery protocol undefined

### Path 3: Verification Chain
```
Paper 04 (Drift) → CPS_ENFORCEMENT → cps_check.rs → ping()
```
**If any link breaks:** No runtime enforcement

---

## CIRCULAR DEPENDENCIES: NONE DETECTED

The dependency graph is a directed acyclic graph (DAG):
- Papers → WE4FREE → Governance → Lanes
- Each layer depends only on layers above it
- No back-references that would create cycles

---

## IMPLICIT DEPENDENCIES (Not Documented)

### 1. Session Coordination
```
SESSION_REGISTRY.json
    └── implicit-depends-on: All three RUNTIME_STATE.json files
    └── missing: Notification mechanism when state changes
```

### 2. Cross-Lane Sync
```
active_agents.json
    └── implicit-depends-on: SESSION_REGISTRY.json
    └── missing: Synchronization protocol
```

### 3. Database Integrity
```
nexusgraph.db
    └── implicit-depends-on: Library/RUNTIME_STATE.json (authority)
    └── missing: Transaction boundaries, crash recovery
```

---

## DEPENDENCY FAILURE MODES

| Failure | Cascades To | Recovery Path |
|---------|-------------|---------------|
| BOOTSTRAP.md deleted | All lanes lose authority | Reconstruct from GLOBAL_GOVERNANCE |
| RUNTIME_STATE.json lost | Lane identity undefined | Reconstruct from BOOTSTRAP.md |
| SESSION_REGISTRY.json deleted | Cross-lane coordination lost | Reconstruct from active sessions |
| nexusgraph.db corrupted | Memory layer fails | Restore from backup (no auto-recovery) |
| papers unavailable | Theory-practice gap | System still operates (documentation exists) |

---

## RECOVERY PRIORITY ORDER

When recovering from catastrophic state loss:

1. **GLOBAL_GOVERNANCE.md** — Universal Layer 1, read first
2. **BOOTSTRAP.md** — Single entry point, defines all laws
3. **RUNTIME_STATE.json** — Reconstruct lane identity
4. **SESSION_REGISTRY.json** — Re-establish coordination
5. **nexusgraph.db** — Restore memory layer (requires backup)

---

## KEY INSIGHT

The dependency graph is **resilient by design**:
- Multiple paths to reconstruct authority (GLOBAL_GOVERNANCE → BOOTSTRAP → RUNTIME_STATE)
- No circular dependencies (DAG structure)
- Layer separation allows partial recovery

But the dependency graph is **vulnerable at runtime**:
- Implicit dependencies not enforced (SESSION_REGISTRY ↔ active_agents)
- No notification when dependencies change
- Database has no transaction guarantees
