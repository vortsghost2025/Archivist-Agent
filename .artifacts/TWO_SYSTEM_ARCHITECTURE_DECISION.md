# Two-System Architecture Decision: Rust Safety + JS Lattice

**Decision Date**: 2026-04-15
**Status**: DOCUMENTED — Intentional architecture, not a gap

---

## THE OBSERVATION

Fresh agent review noted:

> "The lattice remains implicit. There is no explicit `ConstraintLattice` object, meet/join operations, or deformation metric in the current Rust code (these exist only in the separate JS bridge you added later). The mapping is structural but not yet formalized in the Tauri core."

This is correct. It is **not a bug** — it is an intentional architectural decision.

---

## THE TWO SYSTEMS

### System 1: Rust Core (Tauri Backend)

**Location**: `src-tauri/src/`

**Purpose**: **Operational Safety Enforcement**

**Components**:
- `safety.rs` — Path validation, allowed/blocked roots, read-only mode
- `constants.rs` — Hard constraint values (MAX_SCAN_DEPTH, etc.)
- `scan_tree.rs`, `summarize_folder.rs`, etc. — Domain commands

**What It Does**:
- Enforces safety constraints at runtime
- Blocks path traversal attacks
- Validates all filesystem operations
- Implements read-only mode governance

**What It Does NOT Do**:
- Formal lattice operations (meet, join)
- Drift deformation metrics
- Phenotype stability checking

**Why**: Rust runs in the Tauri process, directly accessing the filesystem. Safety must be enforced here because this is where actual operations happen. Lattice formalization is abstract — it doesn't need to be in the execution layer.

---

### System 2: JS Bridge (Constraint Lattice)

**Location**: `src/bridge/`

**Purpose**: **Formal Governance Reasoning**

**Components**:
- `constraint-lattice.js` — Meet, join, respectsLattice, detectDrift
- `swarmmind-verify.js` — Truth verification wrapper
- `agent-permissions.js` — Role-based permissions
- `__tests__/constraint-lattice.test.js` — Lattice operation tests

**What It Does**:
- Formalizes Paper B's constraint lattice
- Provides meet (greatest lower bound) operation
- Provides join (least upper bound) operation — placeholder
- Checks phenotype stability
- Calculates drift deformation scores

**What It Does NOT Do**:
- Direct filesystem access
- Runtime safety enforcement
- Tauri command execution

**Why**: Lattice operations are reasoning tools, not execution tools. They belong in the coordination layer (SwarmMind/Kilo), not the execution layer (Tauri).

---

## THE MAPPING

| Concept | Paper | Rust Implementation | JS Implementation |
|---------|-------|---------------------|-------------------|
| Hard constraints | B | `allowed_roots`, `blocked_roots`, `MAX_SCAN_DEPTH` | `ConstraintLattice.constraints` |
| Meet operation (∧) | B | `validate_path()` — combines all constraints | `meets(a, b)` — formal operation |
| Join operation (∨) | B | Negotiation via config | `joins(a, b)` — placeholder |
| Phenotype stability | C | Command role patterns | `respectsLattice(phenotype)` |
| Drift detection | D | Error handling, graceful degradation | `detectDrift()`, `calculateDeformationScore()` |
| Single entry point | E | `safety.rs` for all commands | N/A — coordination layer reads BOOTSTRAP.md |

---

## WHY THIS SPLIT IS CORRECT

### 1. Separation of Concerns

**Rust = Enforcement** (what MUST happen)
- Runtime safety
- Filesystem protection
- Hard constraint enforcement

**JS = Reasoning** (what SHOULD be checked)
- Lattice formalization
- Drift analysis
- Governance verification

### 2. Layer Alignment

Paper E describes layered propagation:
```
Constitutional Layer → Operational Layer → Behavioral Expression
```

**Rust = Operational Layer** (execution with constraints)
**JS = Constitutional Layer reasoning** (verifying alignment)

### 3. Security Principle

Safety-critical code should be:
- Minimal (only what's needed)
- Direct (no abstraction layers)
- Enforced (cannot be bypassed)

Lattice formalization adds abstraction — useful for reasoning, dangerous for enforcement.

---

## THE INTEGRATION POINT

The two systems connect through:

1. **Shared constraints**: JS lattice must use same constraint values as Rust
2. **Verification protocol**: JS lattice checks phenotype stability, Rust enforces it
3. **Evidence linking**: JS provides governance evidence, Rust provides operational evidence

**Current Gap**: No runtime connection. Bridge modules are specification-only, not wired into execution.

**Resolution Path**: 
- Wire `constraint-lattice.js` into SwarmMind cognitive trace viewer
- Use `check_read_only()` in Rust commands (✅ DONE)
- Verify constraint values match between systems

---

## WHAT NEEDS TO HAPPEN

### Immediate (Done)
- [x] Document this architecture decision
- [x] Enforce read_only_mode in Rust commands
- [x] Fix mock invoke bypass in app.js

### Short-term
- [ ] Wire bridge modules into Kilo execution
- [ ] Test constraint-lattice.js operations
- [ ] Verify Paper B mapping accuracy

### Long-term
- [ ] Create runtime connection between systems
- [ ] Formalize join operation (currently placeholder)
- [ ] Add deformation metric to detectDrift()

---

## THE VERDICT

**Fresh agent observation was correct.**

The split is intentional:
- Rust handles **execution-time safety**
- JS handles **governance-time reasoning**

Both are needed. Neither should absorb the other.

---

## FUTURE CONSIDERATION

If Tauri becomes too heavyweight, Rust safety could move to:
- Native library (called by any runtime)
- WASM module (portable safety layer)
- MCP server (governance enforcement service)

For now: Two-system architecture is correct.

---

**Architecture Status**: DOCUMENTED
**Decision By**: Primary session agent (governance-aware)
**Evidence**: Fresh agent review + discrepancy analysis
