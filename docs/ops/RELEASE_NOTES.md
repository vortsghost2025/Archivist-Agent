# Release Notes

## 2026-04-27

### Ownership Enforcement (Staged)

- Added opt-in `--enforce-ownership` to `lane-worker` (advisory remains default).
- Enforcement blocks only on active lease owner mismatch.
- Expired leases and missing ownership remain non-blocking with warning notes.
- Malformed ownership is quarantined.
- Added integration test for expired-lease warning propagation:
  - `scripts/test-ownership-enforcement-integration.js`
- Response validation now requires ownership metadata when enforcement is enabled.

See: `docs/ops/EXECUTOR_V3_CONTRACT.md` for contract-level details.

### Compact/Restore Continuity Probe

- Added explicit continuity probe in `scripts/compact-restore-test.js`:
  - records a `task_id`
  - records `expected_next_step`
  - compares against first `actual_next_action` post-restore
- Test now fails if expected next step and actual next action diverge.

### NFM-036: Operator Tool Overlap Drift (Staged Guardrail)

- Added staged dual-agent overlap contract (detect/warn/block-repeat/hard-protect shared paths):
  - `config/dual-agent-operating-contract.json`
- Added operator guidance and enforcement model documentation:
  - `docs/ops/DUAL_AGENT_CONCURRENCY_GUARDRAIL.md`
- Added Paper F continuation draft section:
  - `docs/failure-topology/PAPER_F_CONTINUATION_DUAL_AGENT_OVERLAP_GUARDRAIL.md`
- Added runnable proof test and wired it into CI governance checks:
  - `scripts/test-dual-agent-operating-contract.js`
- Enforcement remains staged; global blocking is not enabled by default.

### Verification Hardening: Code Hash + Concurrency Attack

- Added truth-critical write lease file support at `.locks/truth-critical.lock.json` for executor-side writes to verification-critical scripts.
- Added `code_version_hash` stamping in executor response governance metadata.
- Added semantic domain-gate check for code-version drift (`message code_version_hash` vs local verifier hash).
- Added adversarial concurrency proof test and wired it into CI:
  - `scripts/test-concurrency-attack-domain-gate.js`
