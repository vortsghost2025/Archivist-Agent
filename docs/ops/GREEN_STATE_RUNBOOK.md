# Green State Runbook

Purpose: provide a fast, repeatable way to verify the four-lane system is healthy and safe to proceed with normal operations.

## Definition of Green

A run is Green when all of the following are true:

- Canonical lane inbox paths exist and are readable.
- Trust-store entries are present and key IDs are coherent for all lanes.
- Signing works for each lane (test payload can be signed).
- No integrity violations are reported during the probe cycle.
- Queue pressure is stable (non-explosive trend; no unexpected blocker activation).

Reference baseline:
- Probe timestamp: `2026-04-28T16:42-04:00`
- Result: all lanes passed inbox/trust/sign checks.

## Scope

Lanes:
- Archivist: `S:/Archivist-Agent`
- Authority: `S:/Archivist-Agent`
- Kernel: `S:/kernel-lane`
- Library: `S:/self-organizing-library`
- SwarmMind: `S:/SwarmMind`

## Standard Probe Procedure

1) Verify canonical inbox paths exist
- Confirm each lane inbox path from lane registry is present.
- If any lane inbox is missing, mark run Red immediately.

2) Verify trust-store coherence
- Confirm each lane has trust-store entry.
- Confirm trust key IDs are present and not empty.
- Confirm no duplicate lane identity collisions.

3) Verify signing capability per lane
- Sign a minimal test payload from each lane context.
- Record signing key ID used by each lane.
- Any signing failure is Red.

4) Refresh pulse and inspect queue health
- Run `node scripts/publish-lattice-freedom-pulse.js` in Archivist.
- Capture per-lane values: `lattice_freedom`, `queue_depth`, `blocked`, `quarantine`.
- Green requires stable values and no sudden unexpected spikes.

5) Check blocker sentinel
- Read `lanes/broadcast/active-blocker.json`.
- Green requires either no blocker or blocker aligned with known incident owner.

6) Record output
- Save signed probe report to lane inboxes:
  - `e2e-probe-results-<date>-signed.json`
- Update runbook evidence log (or dashboard artifact).

## Fast Command Set

Run from `S:/Archivist-Agent` unless noted:

```powershell
# Pulse refresh
node "scripts/publish-lattice-freedom-pulse.js"

# Blocker check
Get-Content "lanes/broadcast/active-blocker.json"

# Recovery truth check (must not be stale/conflicting for release decisions)
Get-Content "lanes/broadcast/last-recovery.json"
```

Cross-lane path checks (examples):

```powershell
Test-Path "S:/kernel-lane/lanes/kernel/inbox"
Test-Path "S:/self-organizing-library/lanes/library/inbox"
Test-Path "S:/SwarmMind/lanes/swarmmind/inbox"
```

Drift hygiene:

```powershell
# Weekly path/registry drift check
node "scripts/check-paths.js"
```

## Operating Recommendations

Use these defaults during sensitive windows:

- Run workers with `--manual-cadence` to avoid racey auto-claims/moves.
- Keep `worker-audit.log` enabled for provenance on every file move.
- Use `lane-worker --apply-once --max-files N` for surgical queue clearing.
- Publish daily lattice pulse for trend visibility.

## Severity and Actions

Green:
- Continue normal operations.

Yellow (warning drift):
- One lane degraded but still signed/traceable.
- Restrict to manual cadence and apply-once processing until stable.

Red:
- Missing trust entry, signing failure, path missing, or integrity violation.
- Freeze nonessential fan-out.
- Open/maintain single active blocker and run remediation first.

## Exit Criteria (from Yellow/Red to Green)

All required:
- Trust coherence restored and verified.
- Signing pass for all active lanes.
- No unresolved integrity violations.
- Stable queue trend across at least one full pulse cycle.
- Blocker closed or correctly transferred with evidence.
