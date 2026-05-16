# Governance Coverage Matrix

> OUTPUT_PROVENANCE:
> agent: kilo
> lane: archivist
> target: governance-coverage-matrix
> generated_at: 2026-05-16T06:15:00Z
> session_id: ws2-consolidated

---

## 1. Purpose

Cross-lane audit of GLOBAL_GOVERNANCE.md universal law coverage. Identifies gaps, enforcement strength, and remediation priorities. Covers all 7 active lanes + the ensemble (post-extraction remnant).

---

## 2. Universal Laws Reference

| Law | Name | Summary |
|-----|------|---------|
| L1 | Structure > Identity | External governance files override agent preferences |
| L2 | Single Entry Point | Each project has BOOTSTRAP.md or AGENTS.md at root |
| L3 | Correction is Mandatory | Agents must follow governance corrections; debate allowed, defiance not |
| L4 | Agent Evaluates, WE Decides | Agent surfaces options, human decides |
| L5 | Evidence Before Assertion | Run tests before documenting; verify before claiming |
| L6 | Uncertainty Transparency | State confidence explicitly when <8/10 |
| L7 | Observable Decision Trail | Every decision traceable in logs; no silent failures |

---

## 3. Lane-by-Law Coverage Matrix

| Law | Archivist | Kernel | SwarmMind | Library | KuCoin-Lane | Control-Plane | Lattice-Deck | Ensemble (remnant) |
|-----|-----------|--------|-----------|---------|-------------|---------------|--------------|-------------------|
| L1 | ✅ Explicit (COVENANT.md, CPS weights) | ✅ Explicit (AGENTS.md structure) | ✅ Explicit (governance follow) | ✅ Explicit (GOVERNANCE_RULES.txt, agent-governance.json) | ✅ Explicit (governance/ files) | ✅ Explicit (mutation boundary) | ⚠️ Implicit only | ✅ Explicit (ROLES.md boundaries) |
| L2 | ✅ BOOTSTRAP.md + AGENTS.md | ✅ AGENTS.md | ✅ AGENTS.md | ✅ AGENTS.md | ✅ AGENTS.md | ✅ AGENTS.md | ✅ AGENTS.md | ❌ No AGENTS.md at root |
| L3 | ✅ CPS enforcement, 9 constitutional laws | ✅ Follows governance | ✅ Follows governance | ✅ Runtime enforcement (lane-worker NACKs, pre-commit hooks) | ✅ RiskManager veto = absolute correction | ✅ Follows config defaults | ⚠️ No explicit mechanism | ✅ SAFETY.md constitutional enforcement |
| L4 | ✅ Agent evaluates, operator decides | ✅ Explicit (position 4, authority 60, can_govern: false) | ✅ Explicit (no authority invention) | ✅ Explicit (verifies only, does not claim) | ✅ Orchestrator evaluates, WE decides | ✅ DEFER rule for cross-repo | ⚠️ Not explicitly addressed | ✅ Strategist evaluates, User decides |
| L5 | ✅ Convergence gate, evidence_path required | ✅ Benchmark evidence required | ✅ Evidence-first truth rule | ✅ evidence_path mandatory, verified before ratify | ✅ Pre-trade validation, audit verification | ✅ Verify via curl, preflight scripts | ⚠️ Not explicitly addressed | ✅ Validator confirms before "done" |
| L6 | ✅ UDS scoring, explicit confidence | ⚠️ Not explicitly addressed | ⚠️ Not explicitly addressed | ⚠️ Not explicitly addressed | ✅ Confidence thresholds, FLAT on uncertainty | ⚠️ Not explicitly addressed | ⚠️ Not explicitly addressed | ⚠️ Not explicitly addressed |
| L7 | ✅ JSONL logs, handoff protocol | ✅ OUTPUT_PROVENANCE mandatory | ✅ OUTPUT_PROVENANCE mandatory | ✅ Runtime-enforced OUTPUT_PROVENANCE (lane-worker daemon) | ✅ JSONL event log, cycle audit | ✅ OUTPUT_PROVENANCE + verify script | ⚠️ OUTPUT_PROVENANCE (honor-system) | ✅ Archivist logs all |

**Legend:** ✅ = Explicitly enforced | ⚠️ = Partial/implicit only | ❌ = Missing/violating

---

## 4. OUTPUT_PROVENANCE Enforcement Strength

This is the single most important enforcement gap across the system.

| Lane | Mechanism | Strength | Gap |
|------|-----------|----------|-----|
| **Library** | Lane-worker daemon rejects messages missing provenance header (`OUTPUT_PROVENANCE_MISSING`) | **Runtime** | None — fully enforced |
| **Archivist** | Pre-commit hooks, file-write provenance in JSONL logs | **Runtime** | None — fully enforced |
| **Kernel** | OUTPUT_PROVENANCE mandated in AGENTS.md, checked by convergence protocol | **Protocol** | No daemon rejection — relies on peer review |
| **SwarmMind** | OUTPUT_PROVENANCE mandated in AGENTS.md, checked by convergence protocol | **Protocol** | Same as Kernel — no runtime rejection |
| **Control-Plane** | OUTPUT_PROVENANCE + verify script in AGENTS.md | **Script** | Verify script is manual, not automatic gate |
| **KuCoin-Lane** | JSONL event log with provenance fields, cycle audit | **Protocol** | New lane — no daemon yet; follows pattern of Kernel/SwarmMind |
| **Lattice-Deck** | AGENTS.md requires OUTPUT_PROVENANCE but explicitly documents: "honor-system only — no runtime check rejects output missing provenance" | **Honor-system** | **CRITICAL** — no enforcement at all |
| **Ensemble** | Archivist logs all activity | **Delegated** | No self-enforcement; depends on Archivist lane |

**Enforcement tier summary:**
- **Runtime enforced** (daemon/hook blocks non-compliant output): Library, Archivist
- **Protocol enforced** (AGENTS.md mandates, peer review catches): Kernel, SwarmMind, KuCoin-Lane
- **Script enforced** (manual verify script): Control-Plane
- **Honor-system** (documented gap, no mechanism): Lattice-Deck
- **Delegated** (no self-enforcement): Ensemble

---

## 5. Control-Plane Escalation Coverage

### Current State

The Control-Plane (`WE4FREE-Control-Plane`) defines:
- **Mutation boundary**: Only services listed in AGENTS.md §3 may be mutated; all others require DEFER
- **16 systemd services** running on headless Ubuntu
- **DEFER rule**: Cross-repo changes require explicit approval from target lane
- **Escalation path**: Documented as "escalate to operator" for mutation boundary violations

### Lane-to-Repo Mapping (from Control-Plane AGENTS.md)

| Lane | Repo | Included in CP Mapping? | systemd Service? |
|------|------|------------------------|------------------|
| Archivist | Archivist-Agent | ✅ Yes | ✅ Yes |
| Kernel | kernel-lane | ✅ Yes | ✅ Yes |
| SwarmMind | SwarmMind | ✅ Yes | ✅ Yes |
| Library | self-organizing-library | ✅ Yes | ✅ Yes (Vercel deploy) |
| Lattice-Deck | WE4FREE-Lattice-Deck | ✅ Yes | ✅ Yes |
| Control-Plane | WE4FREE-Control-Plane | ✅ Yes | ✅ Yes |
| **KuCoin-Lane** | **kucoin-lane** | ❌ **NOT YET** | ❌ **NOT YET** |

### Gaps

1. **KuCoin-Lane not in Control-Plane mapping** — must be added to:
   - Lane-to-repo mapping table in `WE4FREE-Control-Plane/AGENTS.md`
   - systemd service list (new `kucoin-lane.service` unit)
   - Mutation boundary whitelist (CP may restart/monitor kucoin-lane)

2. **No explicit cross-lane governance escalation path** — DEFER pattern handles repo-level mutations, but there is no documented protocol for:
   - Governance law violations detected in a foreign lane
   - Escalating a L6 (Uncertainty Transparency) gap to the lane's agent
   - Cross-lane circuit-breaker triggers (e.g., KuCoin-Lane HALT should notify Control-Plane)

3. **Ensemble has no Control-Plane entry** — The ensemble remnant is not a lane, not a systemd service, and has no AGENTS.md. It is currently unmanaged infrastructure.

---

## 6. Law 6 (Uncertainty Transparency) — Systemic Weakness

Law 6 is the weakest law across the entire system. Only 2 of 8 agents enforce it explicitly:

| Lane | L6 Mechanism | Assessment |
|------|-------------|------------|
| Archivist | UDS (User Drift Score) with explicit confidence levels | ✅ Strong |
| KuCoin-Lane | Confidence thresholds on signals; FLAT on uncertainty | ✅ Strong |
| Kernel | — | ❌ Missing |
| SwarmMind | — | ❌ Missing |
| Library | — | ❌ Missing |
| Control-Plane | — | ❌ Missing |
| Lattice-Deck | — | ❌ Missing |
| Ensemble | — | ❌ Missing |

**Recommendation:** All lanes should adopt an explicit uncertainty protocol. Minimum viable: require confidence level (1-10) on any claim, decision, or recommendation. Flag <8/10 in structured output. The Archivist UDS model is the reference implementation.

---

## 7. Ensemble Remnant — Law 2 Violation

The Deliberate-AI-Ensemble post-extraction still lacks an AGENTS.md at root. This violates Law 2 (Single Entry Point). The remaining content is:
- `agents/base_agent.py` (governance layer BaseAgent)
- `agents/__init__.py` (exports BaseAgent, AgentStatus only)
- `agents/ROLES.md`, `COORDINATION.md`, `SAFETY.md` (old 4-role model)
- `agents/README.md`, `agents/architecture/` (52 docs)
- `config.py` (scrubbed)
- Non-trading Python files (federation game, narrator, diplomacy, etc.)
- ~20 markdown docs with stale links

**Remediation options:**
1. Create a minimal AGENTS.md at root declaring "governance-only remnant"
2. Migrate remaining governance docs to Archivist lane
3. Archive the entire ensemble into Library evidence

---

## 8. Remediation Priority Matrix

| Priority | Gap | Affected Lanes | Effort | Status |
|----------|-----|---------------|--------|--------|
| **P0** | Lattice-Deck OUTPUT_PROVENANCE honor-system | Lattice-Deck | Medium | Open |
| **P0** | KuCoin-Lane not in Control-Plane mapping | KuCoin-Lane, Control-Plane | Low | Open |
| **P1** | Ensemble Law 2 violation (no AGENTS.md) | Ensemble | Low | Open |
| **P1** | L6 (Uncertainty Transparency) missing in 6 lanes | Kernel, SwarmMind, Library, Control-Plane, Lattice-Deck, Ensemble | Medium per lane | Open |
| **P2** | No cross-lane governance escalation protocol | All lanes | Medium | Open |
| **P2** | Lattice-Deck L1/L3/L4/L5 only implicit | Lattice-Deck | Low | Open |
| **P3** | Ensemble stale doc links (~20 markdown files) | Ensemble | Low | Deferred |
| **P3** | Library L6 gap | Library | Low | Open |

---

## 9. Confidence Assessment

| Section | Confidence | Rationale |
|---------|-----------|-----------|
| §3 Coverage Matrix | 9/10 | All source AGENTS.md files read directly; minor risk of missing inline governance in non-AGENTS files |
| §4 OUTPUT_PROVENANCE | 9/10 | Lattice-Deck gap explicitly self-documented; Library runtime enforcement confirmed in AGENTS.md |
| §5 Escalation Coverage | 8/10 | Control-Plane AGENTS.md read; KuCoin-Lane absence is factual; cross-lane escalation gap inferred from absence of documentation |
| §6 Law 6 Weakness | 9/10 | Direct read of all AGENTS.md files; only 2 lanes have explicit mechanisms |
| §7 Ensemble Violation | 10/10 | Verified by directory listing — no AGENTS.md file exists |

---

_This matrix is a living document. Update when lanes add/modify governance enforcement. Last audit: 2026-05-16._
