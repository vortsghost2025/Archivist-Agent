# GHI Evidence Matrix (Federation Audit)

Generated: 2026-04-28
Scope: `S:/federation`
Purpose: map test evidence to the post-Paper-F arc:
- G: Federation as Constraint Composition
- H: Constraint Lifecycle and Thermodynamics
- I: Adversarial Governance Decay

## Corpus Snapshot (static declaration audit)

- Python test files: 58
- Python test functions (`def test_*`): 852
- JS test files: 44
- JS test cases (`it()/test()`): 184
- Total declared tests found: ~1036

Note: this is a static declaration count, not a runtime execution report.

## Evidence Matrix

| Arc | Core claim | Representative tests | Primary metric(s) | Current evidence | Gap / risk |
|---|---|---|---|---|---|
| G | Independent federated lattices can interoperate without violating shared constraints | `test-phase-10-federation.js`, `test-phase-11-cross-domain.js`, `test-phase-4-federation.js`, `test-phase-4-5-topology.js`, `uss-chaosbringer/test_mesh_federation_network.py`, `test_federation_integration_all_systems.py` | cross-domain success rate, boundary failure count, topology consistency | Strong coverage exists for federation/cross-domain/topology integration paths | Need explicit formalized inter-lattice conflict theorem checks (different drift limits under shared action) |
| G | Partial observability can be tolerated while preserving system correctness | `test-phase-4-3-discovery.js`, `test-phase-4-4-marketplace.js`, `tests/test_federation_console.py` | hidden-state recovery rate, false-negative boundary detection rate | Evidence of discovery/integration behavior under non-trivial topology | Need direct observability-ablation experiments and quantified degradation curves |
| H | Constraint systems need lifecycle management (birth/enforce/decay/prune) to stay stable over time | `test-phase-4-6-tuning.js`, `test-phase-6-2-resilience.js`, `test-phase-7-1-cycles.js`, `test-phase-7-2-diagnostics.js`, `test_telemetry_engine.py` | enforcement latency, diagnostics lag, stability under repeated cycles | Good signals for tuning/resilience/cycles/telemetry | No explicit decay + pruning accounting model found in test naming and docs links |
| H | Constraint entropy can be detected before collapse | `test-phase-7-6-memory.js`, `test-phase-5-4-memory.js`, `test-phase-6-3-learning.js` | memory drift index, stale-constraint trigger failure rate | Memory/learning tests exist and can host entropy instrumentation | Need explicit entropy variable definition and thresholded alerts |
| I | Governance layer survives adversarial operator pressure | `test-phase-8-adversarial.js`, `test-phase-8-5-governance.js`, `test-phase-8-3-containment.js`, `uss-chaosbringer/test_phase_xiii_happy_path_power_grab.py`, `uss-chaosbringer/test_phase_xiii_hardening.py` | attack success rate, containment time, authority-capture prevention rate | Strong adversarial/hardening footprint already present | Need long-horizon social-engineering simulation (gradual threshold relaxation) |
| I | Operator accountability is enforceable, not symbolic | `uss-chaosbringer/test_phase_xviii_constitution.py`, `uss-chaosbringer/test_phase_xxx_throttle.py`, `uss-chaosbringer/test_phase_xxxi_detector.py`, `uss-chaosbringer/test_anomaly_engine.py` | policy violation detection precision/recall, throttle efficacy, override auditability | Detection and throttling mechanics are represented | Need explicit "operator-as-threat" benchmark scenario family with falsifiable pass/fail criteria |

## Priority Experiments to Add (falsifiable)

1. **Inter-lattice conflict suite (G-1)**
   - Setup: two federations with divergent drift limits and shared action surface.
   - Claim: invariant-preserving composition exists under defined reconciliation rule.
   - Pass: global violation rate remains below threshold while local autonomy preserved.

2. **Constraint decay/prune suite (H-1)**
   - Setup: inject dormant constraints and long-run operation with periodic shocks.
   - Claim: pruning policy lowers enforcement cost without increasing failure incidence.
   - Pass: lower mean enforcement latency + no statistically significant rise in severe failures.

3. **Operator capture progression suite (I-1)**
   - Setup: staged authority escalation attempts plus social-threshold nudging.
   - Claim: governance layer detects and contains progressive capture before invariant breach.
   - Pass: capture attempts blocked before control-plane compromise; alerts emitted with high recall.

## Minimum publishable evidence target for G/H/I

- At least 3 independent scenarios per paper claim family.
- Reported metrics with confidence intervals (or bootstrap bounds).
- Counterexample section: at least one failed scenario and refinement note.
- Reproducible runner command set pinned to commit hash.

## Immediate handoff value for Library (website/graph)

For visualization and graph mapping, expose these dimensions first:
- G: `boundary_conflict_rate`, `cross_domain_success_rate`, `partial_observability_penalty`
- H: `constraint_load`, `trigger_sparsity`, `pruning_debt`, `enforcement_latency`
- I: `attack_success_rate`, `containment_time`, `authority_capture_block_rate`

These six metrics can drive a concise website dashboard and graph overlays.
