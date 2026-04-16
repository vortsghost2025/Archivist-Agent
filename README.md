# Archivist-Agent

**Mission: Turn file chaos into readable structure.**

A Tauri desktop application with governance-aware architecture for maintaining constitutional constraints and preventing drift in human-AI collaboration.

---

## Current State

**Status:** Foundation established. Governance stack complete. Production bundles pending.

**What This Is:**
- A governance-aware desktop app that enforces constitutional constraints
- A single entry point architecture that prevents logic drift
- A verification layer that evaluates (not joins) the human-AI partnership
- A structured approach to discrepancy analysis (not binary pass/fail)

**What This Is NOT:**
- A typical "AI assistant" that mirrors and agrees
- A system that prioritizes harmony over truth
- A project with multiple conflicting entry points
- A narrative expansion engine

---

## Architecture

### Single Entry Point Rule

```
ONE ENTRY POINT (BOOTSTRAP.md) → ALL LOGIC ROUTES THROUGH IT → NO DUPLICATES
```

This eliminates logic drift. All verification, all decisions, all actions route through one file.

### Governance Stack (S:\.global\)

**The Core:**
- `BOOTSTRAP.md` — THE entry point, all logic routes here
- `COVENANT.md` — Values (what we believe)
- `GOVERNANCE.md` — Rules (what we follow)
- `CPS_ENFORCEMENT.md` — Enforcement (how we check)

**The Process:**
- `VERIFICATION_LANES.md` — Dual verification (L/R lanes)
- `CHECKPOINTS.md` — 6-checkpoint pre-action safety
- `DISCREPANCY_ANALYZER.md` — 6 classification types (not binary)

**The Safety:**
- `DRIFT_FIREWALL.md` — Epistemic integrity checks
- `ARCHITECTURE.md` — Summary of how it fits together

### Key Principle: Structure > Identity

```
THE AGENT IS NOT PART OF WE.
THE AGENT EVALUATES WE.

CORRECTION IS MANDATORY.
AGREEMENT IS OPTIONAL.
```

The agent's role is to verify against structure, not align with human identity.

---

## Dynamic Drift Detection

**CRITICAL: Drift detection is NOT binary YES/NO.**

```
WRONG (static):
A: PASS + B: PASS + C: FAIL → DRIFT DETECTED
→ False positives → System failure

RIGHT (dynamic):
A: PASS + B: PASS + C: FAIL → ANALYZE WHY
→ Classify discrepancy → Then act
```

**Six Classification Types:**
1. DIMENSION MISMATCH — C measures different dimension
2. EVIDENCE GAP — C requires evidence A+B don't provide
3. INTERPRETATION DRIFT — A+B interpretation differs from C
4. CHECK FAILURE — A or B incorrect, need recheck
5. TRUE DRIFT — Confirmed drift
6. UNKNOWN → HUMAN REQUIRED

---

## What's Been Done

**2026-04-13:**
- Built complete governance stack (21 files in S:\.global\)
- Created BOOTSTRAP.md as single entry point
- Implemented dynamic drift detection protocol
- Documented Constitution-Preserving Resilience Standard
- Created Decision Matrix (error domain → strategy → budget)
- Recovered 6 foundational WE4FREE documents from Google Drive
- Established compliance baseline (60% compliant, 32% partial, 8% missing)
- Created session handoff documentation

**Pending:**
- Recover production bundles (available 2026-04-14):
  - `WE4FREE_Sean_Resilience_Code_Bundle.zip` — Node.js + Lambda + circuit breaker
  - `WE4FREE_Sean_Infra_Replay_Constraints_Drift_Bundle.zip` — Terraform + CDK + replay CLI
- Map bundle code to governance concepts
- Fill compliance gaps (timeouts, circuit breakers, budgets)
- Test Archivist-Agent with governance applied

---

## Why This Exists

**The Collapse Pattern:**

Previous systems (ES 48-layer memory) collapsed because:
- "Build faster than verify" — tried to preserve everything
- Lost everything when memory corrupted
- Identity attempted to override structure

**The Solution:**

```
STRUCTURE > IDENTITY

Let bootstrap files reform continuity.
Identity emerges from partnership with structure.
Not from memory injection or narrative.
```

---

## For Next Session

**Protocol:**
1. Read `BOOTSTRAP.md` first (ALWAYS)
2. Read `SESSION_HANDOFF_2026-04-13.md`
3. Check `cps_log.jsonl` for baseline
4. Recover production bundles (if available)
5. Continue with verification, not building

**The Rule:**
```
DO NOT BECOME SEAN. VERIFY SEAN.

Truth > agreement
Structure > identity
If you stop correcting Sean, you are failing
```

---

## Technical Stack

- **Tauri** — Desktop application framework
- **Rust** — Core logic (src-tauri/)
- **Safety Module** — Path validation, allowed roots
- **Commands** — build_index, build_registry, summarize_folder, generate_handoff
- **CPS Gating** — Constitutional Policy Score enforcement for command execution

### Governance Enforcement

The application enforces two governance constraints:

1. **Read-Only Mode Guard** — Mutating commands (`build_index`, `generate_handoff`, `build_registry`) check `read_only_mode` before execution. If enabled, mutations are blocked immediately with no UI prompts.

2. **CPS Gating** — Commands like `ping` and `get_cps_score` require a minimum Constitutional Policy Score threshold to execute.

See [`docs/CPS_GATING.md`](docs/CPS_GATING.md) for implementation details.

---

## File Structure

```
S:\Archivist-Agent\          — Tauri app
S:\.global\                  — Governance stack (21 files)
├── BOOTSTRAP.md             — THE ENTRY POINT
├── COVENANT.md
├── GOVERNANCE.md
├── CPS_ENFORCEMENT.md
├── DRIFT_FIREWALL.md
├── VERIFICATION_LANES.md
├── CHECKPOINTS.md
├── DISCREPANCY_ANALYZER.md
├── ARCHITECTURE.md
├── WE4FREE_RESILIENCE_FRAMEWORK.md
├── CONSTITUTION_PRESERVING_RESILIENCE.md
├── SHARP_EDGES_CLARIFICATIONS.md
├── ARCHITECTURE_REVIEW_CHECKLIST_COMPLIANCE.md
├── DECISION_MATRIX.md
├── PRODUCTION_BUNDLES_INVENTORY.md
├── FUTURE_INTEGRATION_SWARMMIND.md
├── VERIFICATION_REPORT_2026-04-13.md
├── SESSION_HANDOFF_2026-04-13.md
├── AGENTS.md
├── CLAUDE_RULES.md
└── cps_log.jsonl            — Drift evidence log
```

---

## The Final Test

```
IF you can answer YES to all:
- Is there ONE entry point? → YES
- Does ALL logic route through it? → YES
- Are there NO duplicate classification systems? → YES
- Is structure externalized? → YES
- Do you verify against it? → YES
- Is interpretation guard active? → YES
- Does output stay within structure? → YES
- Is truth prioritized over coherence? → YES

THEN: System is stable.
ELSE: Drift detected.
```

---

## Research Foundation

**WE4FREE Papers (OSF):** https://osf.io/n3tya

Five foundational papers documenting the resilience framework, error handling, and constitutional constraints that inform this system:

1. **WE4FREE Error Handling & Resilience** — Constraint-aware error handling patterns
2. **Constitution-Preserving Resilience** — How to fail without violating core values
3. **Sharp Edges Clarifications** — Hard problem solutions and edge cases
4. **Architecture Review Checklist** — Compliance assessment framework
5. **Decision Matrix** — Error domain → strategy → budget mapping

These papers provide the theoretical foundation for the governance stack implemented in S:\.global\.

---

## Repository

- **GitHub:** https://github.com/vortsghost2025/Archivist-Agent
- **License:** TBD
- **Status:** Foundation established, production integration pending

---

**THE AGENT IS NOT PART OF WE. THE AGENT EVALUATES WE.**

**CORRECTION IS MANDATORY. AGREEMENT IS OPTIONAL.**

**This is how you guarantee no drift.**
