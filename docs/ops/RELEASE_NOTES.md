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
