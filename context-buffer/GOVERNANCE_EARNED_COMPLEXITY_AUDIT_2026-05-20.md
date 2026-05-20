OUTPUT_PROVENANCE:
  agent: archivist
  lane: archivist
  generated_at: "2026-05-20T03:24:28Z"
  session_id: archivist-2026-05-20-audit

---

# Governance Earned-Complexity Audit Report

**Auditor:** Archivist Lane (operator-mandated; CP excluded per conflict-of-interest)
**Date:** 2026-05-20
**Authority:** Operator directive — "earned-field compression, not vibes cuts"
**Framework:** `S:/Archivist-Agent/context-buffer/Yes. That critique deserves to land.txt`
**Schema Version:** v1.6
**Status:** PROVEN

---

## 0. Executive Summary

This audit evaluates every governance mechanism against one question: **does it earn its complexity?** The operator's framework requires that expensive rules have either a body count (real operational triggers), a live consumer (code that reads/enforces it), or a clearly bounded high-severity risk they are preventing.

**Key findings:**

| Mechanism | Operational Triggers | Live Consumers | Verdict |
|-----------|---------------------|----------------|---------|
| CPS Enforcement | 0 production BLOCKs | 4 call sites (gates never fire) | **DEMOTE** |
| UDS Scoring | 0 score computations | 0 enforcement consumers | **DEMOTE** |
| Convergence Gates | Real enforcement | 6+ live consumers | **RETAIN, compress** |
| Output Provenance | Widespread adoption | 8+ enforcement points | **RETAIN** (gold standard) |
| Schema v1.6 (23 fields) | Mix of live and dead | 14-15 load-bearing, 4-5 dead | **COMPRESS** (19→14 required) |
| Governance Docs (17 files) | 4 canonical, 13 redundant/aspirational | 4 load-bearing roots | **CONSOLIDATE** (17→4+annexes) |

**New proposal:** Lane State Model — ACTIVE / DORMANT / EXPERIMENTAL / ARCHIVED

---

## 1. CPS Enforcement — DEMOTE from enforcement to informational

### Evidence

- **CPS log** (`context-buffer/cps_log.jsonl`): 42 entries total
  - 1 initial score report (score=19, May 4)
  - ~21 BLOCK events — all from **test runs** (`caller: "cps_threshold_check(test_recompute)"`)
  - 0 production BLOCK events — CPS has **never blocked anything in operations**
  - ~20 PERFORMATIVE_CONFIDENCE events (confidence contract scanner, not CPS enforcement)
- **Rust code** (`constitution.rs`): Loads constraints from YAML, computes weighted sum once at startup via `Lazy` static. `dynamic_adjustments` and `drift_signals` fields in log schema are **always 0 and []** — dynamic dimension designed but never implemented.
- **Threshold gate** (`cps_check.rs`): `cps_threshold_check(10)` called in 4 places (lib.rs:32, build_index.rs:32, build_registry.rs:78, generate_handoff.rs:23). Score starts at 19 with threshold 10 — the gate **cannot fire** under normal operation.
- **CPS_ENFORCEMENT.md** (296 lines): Describes an elaborate post-response enforcement loop (correction check, alignment check, drift check, scoring, trend analysis). **No code implements this loop.** The document describes an aspirational system, not an operational one.

### Recommendation

1. **DEMOTE CPS from enforcement to informational.** Keep the startup score computation (it's cheap, ~112 lines of Rust). Remove the threshold gate from the 4 call sites — a gate that can never fire is dead code that adds cognitive load.
2. **Fold CPS_ENFORCEMENT.md** (296 lines) into BOOTSTRAP.md as a ~10-line section: "CPS score is computed at startup from `constitutional_constraints.yaml`. Score is informational. No operational enforcement is gated on it."
3. **Remove `dynamic_adjustments` and `drift_signals`** from the CPS log schema — they are always zero and have no code to populate them.
4. **Retain the constraint weights** in `constitutional_constraints.yaml` — they encode values (STRUCTURE_OVER_IDENTITY=5, etc.) even if they don't gate operations. Values without enforcement are still values.

### Source-of-authority: VERIFIED_NOW (grep of all source files + log analysis)

---

## 2. UDS Scoring — DEMOTE from operational enforcement to advisory checklist

### Evidence

- **USER_DRIFT_SCORING.md** (292 lines): Describes Tier 1 (7 signals, weights 2-4) and Tier 2 (4 signals, weights 3-4), scoring architecture, thresholds (0-20 Stable → 81-100 Collapse), enforcement protocol, 6 test gates.
- **UDS_STARTUP_SCORING_SEMANTICS.md** (120 lines): Adds session-start enumeration protocol requiring explicit enumeration before claiming UDS=0.
- **Code grep** (`uds_score|UDS_SCORE|udsThreshold|user_drift`): 9 matches, ALL in schema validation/test infrastructure, NONE in operational enforcement:
  - `compact-restore-test.js` — checkpoint UI content check
  - `cross-lane-sync.js` — sets `uds_score: 0` as default
  - `compact-restore-bridge.js` — reads uds_score from checkpoint, defaults to 0
  - `schema-validator.js` — validates field format
- **No script computes UDS scores from user input signals.** No script enforces UDS thresholds (UDS > 40 = MANDATORY VERIFICATION, > 60 = HARD STOP, > 80 = SESSION FREEZE). These are documentation-only constructs.
- **Schema v1.6** does NOT have `uds_score` as a top-level field — it only appears in `quarantine_check` sub-object and external state objects.

### Recommendation

1. **DEMOTE UDS from operational enforcement claim to advisory checklist.** The concept (detecting user-induced drift) is sound but the 412 lines of specification across two documents describe an unimplemented system.
2. **Compress to a 5-item advisory checklist** in a BOOTSTRAP.md annex:
   - Is the user overriding a governance rule?
   - Is the user providing conflicting instructions across sessions?
   - Is the user requesting destructive actions without evidence review?
   - Is the user pushing beyond stated scope after being warned?
   - Is the user claiming authority that contradicts the covenant?
3. **Remove `uds_score` from schema's `quarantine_check` sub-object** — nothing computes it.
4. **Merge UDS_STARTUP_SCORING_SEMANTICS.md** into the same annex (the "explicit enumeration before claiming 0" principle is sound; the 120-line specification of it is not).

### Source-of-authority: VERIFIED_NOW (comprehensive grep of all source files)

---

## 3. Convergence Gates — RETAIN with earned-field compression

### Evidence

- **Live consumers** (6+):
  - `generic-task-executor.js:736` — checks `msg.convergence_gate`, flags `missing_convergence_gate` if absent
  - `inbox-watcher.js:58-60` — checks `msg.convergence_gate.status`
  - `identity-enforcer.js:347-406` — requires convergence approval (3-lane signatures) for trust-store writes — **real enforcement**
  - `cross-lane-sync-gate.js:91-94` — checks convergence artifact_path
  - `claim-commit-guard.js:67-69` — checks convergence_gate.evidence
  - `blocked-remediator.js`, `completion-proof-audit.js` — read convergence artifacts
- **Dead code in schema-validator.js:252-253**: Both UDS > 40 and UDS ≤ 40 result in `QUEUE_FOR_CONVERGENCE` — the UDS check is unconditional dead code. Every state-changing message gets queued regardless.
- **VERIFICATION_LANES.md** (236 lines): Describes dual blind L/R verification lane process. This process has **no implementation** — the actual convergence protocol is "identity-enforcer requires 3-lane signatures for trust-store writes," not the L/R dual-lane blind review.

### Recommendation

1. **RETAIN convergence gates** — they have real enforcement teeth (trust-store writes, claim commits, cross-lane sync).
2. **Simplify schema-validator.js**: Replace the two-branch QUEUE_FOR_CONVERGENCE logic with a single unconditional queue for state-changing messages. The UDS-conditional branching is dead code.
3. **Document the actual convergence protocol**: "Convergence requires N-of-M lane signatures (currently 3-of-5 for trust-store writes). Implemented by identity-enforcer.js." Replace the aspirational L/R dual-lane blind review description in VERIFICATION_LANES.md.
4. **Fold VERIFICATION_LANES.md** (236 lines) into BOOTSTRAP.md as a ~15-line section describing the actual implemented protocol.

### Source-of-authority: VERIFIED_NOW (grep of all consumer scripts + code reading)

---

## 4. Output Provenance — RETAIN (gold standard)

### Evidence

- **Widespread live enforcement** (8+ points):
  - `lane-worker.js:673` — **BLOCKS** messages missing OUTPUT_PROVENANCE
  - `autonomous-executor.js:150-156` — **BLOCKS** execution without valid provenance
  - `send-message.js:83` — errors on missing provenance
  - `generic-task-executor.js:11` — imports and uses provenance functions
  - `headless-self-audit.js:558` — checks provenance in file content
  - `pre-handoff-provenance-check.js` — validates before handoff
  - `sync-canonical-scripts.js:49-51` — verifies provenance module integrity
  - `provenance-header.js` — helper for building provenance headers
- **OUTPUT_PROVENANCE_CONTRACT.md** (48 lines): Simple, load-bearing contract. Explicitly states: "This block is required for Sean's accessibility, low-vision workflow, and multi-agent governance traceability. It is not decorative."

### Recommendation

1. **RETAIN without modification.** This is the most load-bearing governance mechanism in the codebase. It has real enforcement, real consumers, and a clear accessibility justification.
2. **No compression needed.** The contract is already 48 lines — appropriately minimal.

### Source-of-authority: VERIFIED_NOW (grep of all enforcement scripts + contract reading)

---

## 5. Schema v1.6 Per-Field Audit — COMPRESS

### Evidence Summary

| Field | Required? | Live Consumers | Verdict |
|-------|-----------|----------------|---------|
| `schema_version` | YES | All validators | **KEEP required** |
| `task_id` | YES | All processors | **KEEP required** |
| `idempotency_key` | YES | Dedup logic | **KEEP required** |
| `from` | YES | Identity chain | **KEEP required** |
| `to` | YES | Routing | **KEEP required** |
| `type` | YES | Dispatch | **KEEP required** |
| `priority` | YES | Queue ordering | **KEEP required** |
| `subject` | YES | Dashboard display | **KEEP required** |
| `body` | YES | Content | **KEEP required** |
| `timestamp` | YES | Ordering, TTL | **KEEP required** |
| `requires_action` | YES | Dashboard routing | **KEEP required** |
| `signature` | YES | Verification | **KEEP required** |
| `key_id` | YES | Key lookup | **KEEP required** |
| `convergence_gate` | YES | 6+ consumers | **KEEP required** |
| `evidence` | YES | Claim-commit-guard, execution-gate | **KEEP required** |
| `confidence_derivation` | YES | lane-worker enforcement | **MAKE conditionally required** (when confidence >= 7) |
| `uncertainty` | YES | operator-dashboard-filter, inbox-watcher | **KEEP required** — live consumers |
| `review` | YES | operator-dashboard-filter, inbox-watcher | **KEEP required** — live consumers |
| `delivery_verification` | YES | execution-gate BLOCKS | **KEEP required** — live enforcement |
| `lease` (5 sub-fields) | YES | outbox-write-guard ENFORCES | **DEMOTE to optional** — has consumers but not every message needs a lease |
| `retry` (5 sub-fields) | YES | Test-only consumer | **DEMOTE to optional** — no operational retry logic reads these |
| `prior_attempts` | YES | store-journal only | **DEMOTE to optional** — single marginal consumer |
| `canonical_paths` | N/A | path-normalization-guard (1 ref) | **DEMOTE to optional** — could be hardcoded |
| `uds_score` (in quarantine_check) | N/A | Nothing computes it | **REMOVE from quarantine_check** |

### Recommendation

1. **Reduce 19 required fields to ~15.** Core envelope (14 fields) + convergence_gate + evidence remain required.
2. **Move to optional**: `lease`, `retry`, `prior_attempts`, `canonical_paths`.
3. **Make `confidence_derivation` conditionally required** when confidence >= 7.
4. **Remove `uds_score` from `quarantine_check`** sub-object.
5. **Remove `dynamic_adjustments` and `drift_signals` from CPS log schema** (always zero).

### Source-of-authority: VERIFIED_NOW (per-field grep of all 23 properties across entire scripts/ directory)

---

## 6. Governance Document Consolidation — 17 → 4 Canonical Roots + Annexes

### Current State

17 governance documents totaling ~3,800 lines. Many describe aspirational systems without code implementations. Significant redundancy (BOOTSTRAP.md and GOVERNANCE.md overlap heavily).

### Proposed Structure

**4 Canonical Roots** (load-bearing, must be read to operate):

| Root | Current Lines | Target Lines | Content |
|------|--------------|-------------|---------|
| BOOTSTRAP.md | 814 | ~400 | Entry point + laws + invariants + operational rules (absorbs GOVERNANCE.md, CPS summary, UDS checklist, verification protocol summary) |
| COVENANT.md | 94 | ~94 | Values layer — unchanged |
| CHECKPOINTS.md | 339 | ~280 | Operational safety gate — remove UDS/CPS enforcement references that lack implementations |
| ARCHITECTURE.md | 326 | ~200 | Technical overview — update to reflect audit findings (CPS informational, UDS advisory, convergence = N-of-M signatures) |

**Annexes** (reference material, not required reading):

| Annex | Source | Compressed Lines | Content |
|-------|--------|-----------------|---------|
| A: CPS Reference | CPS_ENFORCEMENT.md (296 lines) | ~15 | Score computation, constraint weights, informational status |
| B: Drift Advisory Checklist | USER_DRIFT_SCORING.md (292) + UDS_STARTUP_SCORING_SEMANTICS.md (120) | ~25 | 5-item drift checklist, enumeration principle |
| C: Verification Protocol | VERIFICATION_LANES.md (236) | ~20 | Actual N-of-M signature protocol (not aspirational L/R blind review) |
| D: Drift Firewall Principles | DRIFT_FIREWALL.md (469) | ~50 | Five failure modes, epistemic hygiene principles |
| E: Confidence Derivation | CONFIDENCE_DERIVATION_CONTRACT.md (141) | ~50 | Principle + enforcement mechanism (live code) |
| F: Evidence Chain | EVIDENCE_CHAIN_REQUIREMENT.md (163) | ~50 | Requirement + examples |
| G: Compact Context Handoff | COMPACT_CONTEXT_HANDOFF.md (131) | ~131 | Operational reference (already concise) |
| H: Governance Quarantine Format | GOVERNANCE_QUARANTINE_FORMAT.md | as-is | Newly created, actively used |

**Dropped/Merged:**
- GOVERNANCE.md (234 lines) → merged into BOOTSTRAP.md
- AGENTS.md (41 lines) → redirect file, merge or drop

### Net Effect

- **Before:** 17 docs, ~3,800 lines, heavy redundancy, aspirational systems described as operational
- **After:** 4 roots (~975 lines) + 8 annexes (~340 lines) = ~1,315 lines total
- **Reduction:** ~65% fewer lines, zero redundancy, all aspirational content clearly labeled as annexes

### Source-of-authority: VERIFIED_NOW (all 17 docs read in full this audit cycle)

---

## 7. Lane State Model — NEW PROPOSAL

### Problem

Lanes currently have no explicit state. The system treats all registered lanes (archivist, authority, kernel, swarmmind, library, control_plane) as equally active. In reality:
- **archivist + authority**: actively producing commits and messages
- **control_plane**: actively enforcing governance
- **kernel**: headless runner on Ubuntu, intermittent activity
- **swarmmind**: registered but low activity
- **library**: registered but low activity
- **kucoin**: private lane, intermittent

Without explicit states, every lane is assumed equally available for convergence signatures, message routing, and operational expectations. This creates false assumptions.

### Proposal: Four Lane States

| State | Description | Convergence Eligible | Message Routing | Heartbeat Expected |
|-------|-------------|---------------------|-----------------|-------------------|
| **ACTIVE** | Lane is producing commits, processing inbox, sending messages | YES | Full | YES (interval per lane config) |
| **DORMANT** | Lane exists but is not currently active (e.g., no current task, between sessions) | NO | Queue only, no dispatch | Optional (may send intermittent keep-alive) |
| **EXPERIMENTAL** | Lane is being set up or tested — not yet trusted for production convergence | NO | Queue only | Optional |
| **ARCHIVED** | Lane is decommissioned — identity retained for audit trail, no operational role | NO | Reject (auto-archive inbound messages) | NO |

### Transition Rules

```
ACTIVE → DORMANT:     No heartbeat for 2x expected interval, or explicit dormancy declaration
DORMANT → ACTIVE:     Heartbeat resumes, or explicit activation declaration + inbox processed
ACTIVE → EXPERIMENTAL: Not a valid transition (must go DORMANT first)
EXPERIMENTAL → ACTIVE: Convergence review (3-of-5 signatures from ACTIVE lanes)
ACTIVE/DORMANT → ARCHIVED: Operator decision only. Irreversible for identity purposes.
ARCHIVED → (any):     Not allowed. Archived lanes retain keys for verification but cannot resume.
```

### Implementation

1. **Add `lane_state` field to `trust-store.json`** entries. Current entries get `lane_state: "ACTIVE"` (archivist, authority, control_plane) or `lane_state: "DORMANT"` (kernel, swarmmind, library).
2. **identity-enforcer.js** checks `lane_state` before counting convergence signatures — only ACTIVE lanes count toward the N-of-M threshold.
3. **inbox-watcher.js** respects lane state for routing decisions — DORMANT lanes get messages queued but not dispatched; ARCHIVED lanes auto-archive inbound messages.
4. **heartbeat.js** updates `lane_state` based on heartbeat presence (ACTIVE if recent, DORMANT if stale).
5. **kucoin lane** — private, EXERIMENTAL or DORMANT depending on operator preference.

### Current Lane State Assignments (Proposed)

| Lane | Proposed State | Rationale |
|------|---------------|-----------|
| archivist | ACTIVE | Primary producing lane |
| authority | ACTIVE | Governance enforcement lane |
| control_plane | ACTIVE | Governance infrastructure |
| kernel | DORMANT | Headless runner, intermittent |
| swarmmind | DORMANT | Low activity |
| library | DORMANT | Low activity |
| kucoin | EXPERIMENTAL | Private lane, operator-decided |

### Rationale

Lanes are authority separations and failure-containment surfaces, not just commit producers. The operator's exterior read specifically says: "Don't cut lanes — add explicit states." This proposal preserves all lane identities while making operational expectations explicit. A DORMANT lane is not broken — it's between tasks. An ARCHIVED lane is not deleted — its identity and key history remain for audit and verification.

### Source-of-authority: INFERRED from operator directive + VERIFIED_NOW from trust-store.json and lane directory analysis

---

## 8. Summary of All Recommendations

### Actions by Priority

**P0 — Demote unimplemented enforcement claims (removes false confidence):**
1. Remove CPS threshold gates from 4 Rust call sites (dead code — gate cannot fire)
2. Remove `uds_score` from schema `quarantine_check` sub-object (nothing computes it)
3. Remove `dynamic_adjustments`/`drift_signals` from CPS log schema (always zero)
4. Simplify schema-validator.js QUEUE_FOR_CONVERGENCE to unconditional (remove dead UDS branching)

**P1 — Schema compression (reduces required field count):**
5. Move `lease`, `retry`, `prior_attempts`, `canonical_paths` from required to optional in schema v1.6→v1.7
6. Make `confidence_derivation` conditionally required (when confidence >= 7)

**P2 — Document consolidation (reduces cognitive load):**
7. Merge GOVERNANCE.md into BOOTSTRAP.md
8. Compress BOOTSTRAP.md from 814 → ~400 lines (remove duplicate sections)
9. Fold CPS_ENFORCEMENT.md → BOOTSTRAP.md annex (~15 lines)
10. Fold USER_DRIFT_SCORING.md + UDS_STARTUP_SCORING_SEMANTICS.md → BOOTSTRAP.md annex (~25 lines)
11. Fold VERIFICATION_LANES.md → BOOTSTRAP.md annex (~20 lines, describe actual protocol)
12. Compress DRIFT_FIREWALL.md → annex (~50 lines, principles only)
13. Update CHECKPOINTS.md — remove UDS/CPS enforcement references
14. Update ARCHITECTURE.md — reflect audit findings
15. Drop AGENTS.md redirect file

**P3 — Lane state model (adds operational clarity):**
16. Add `lane_state` field to trust-store.json entries
17. Update identity-enforcer.js — only ACTIVE lanes count for convergence
18. Update inbox-watcher.js — respect lane state for routing
19. Update heartbeat.js — auto-transition DORMANT based on heartbeat staleness
20. Set initial lane states per proposed assignment table

### What NOT to Change

- **Output Provenance** — gold standard, no changes
- **Convergence gate mechanism** — keep, just simplify dead branching
- **Ed25519 signing/verification** — working, no changes
- **Core schema envelope** (14 fields) — load-bearing, stays required
- **Constraint weights in constitutional_constraints.yaml** — encode values even without enforcement
- **CPS score computation** — keep as informational, just remove the gate
- **Lane identities** — never delete, only change state

---

## 9. Provenance Chain

- **Evidence source:** Comprehensive grep of all Rust source files, all scripts in scripts/, all 17 governance docs, schema v1.6, cps_log.jsonl, trust-store.json, lane directories
- **Audit authority:** Operator directive, framework document (`Yes. That critique deserves to land.txt`)
- **Conflict of interest:** CP excluded from auditing itself (operator mandate)
- **Confidence:** HIGH — all findings verified by code grep and file reading, not inferred
- **Contradictions:** None found
- **Status:** PROVEN

---

*End of report. Recommendations require operator approval before execution, particularly P2 (document consolidation modifies S:/.global/) and P3 (lane state model adds new infrastructure).*
