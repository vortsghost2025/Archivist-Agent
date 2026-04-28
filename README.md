# Archivist-Agent

Governance root and orchestration lane for the multi-lane constitutional system.

## Current Lane Topology (Canonical)

The system is no longer "3 lanes". The canonical registry is:

| Lane | Local directory | Role |
| --- | --- | --- |
| `archivist` | `S:/Archivist-Agent` | Governance root, coordination, lane worker tooling |
| `kernel` | `S:/kernel-lane` | Core implementation and feasibility work |
| `swarmmind` | `S:/SwarmMind` | Multi-agent execution lane |
| `library` | `S:/self-organizing-library` | Verification/evidence lane |
| `authority` | `S:/Archivist-Agent` | Authority endpoint (same repo root as Archivist) |

Canonical source of truth:

- `AGENTS.md`
- `.global/lane-registry.json`
- `.global/lane-discovery.js`

## Governance Entry Point

Read this first:

- `S:/BOOTSTRAP.md`

Key local governance docs:

- `BOOTSTRAP.md`
- `GOVERNANCE.md`
- `COVENANT.md`
- `CHECKPOINTS.md`
- `USER_DRIFT_SCORING.md`
- `RECIPROCAL_ACCOUNTABILITY.md`

## Messaging Model (No Guesswork)

Cross-lane messaging uses the `lanes/` structure (not legacy relay paths):

- `lanes/<lane>/inbox/`
- `lanes/<lane>/outbox/`
- `lanes/broadcast/`

Primary contract and templates:

- `docs/ops/LANE_MESSAGE_INDEX.md`

Required properties:

- schema-valid envelope
- signature-valid message
- canonical sender/receiver paths
- sender logs a matching outbox copy

## Worker / Autopilot Operations

Runbook:

- `docs/ops/LANE_AUTOPILOT_WATCHERS.md`

Highlights:

- Continuous mode: orchestrator runs all lane workers with apply/watch.
- Forensic mode: `--manual-cadence` keeps watchers active without autonomous moves.
- Surgical processing: `--apply-once` processes exactly one cycle and exits.
- Daily headroom pulse: `scripts/publish-lattice-freedom-pulse.js`.

## Build/Test Commands (Tauri)

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

## What This Repo Is

- Constitutional governance and coordination framework
- Lane messaging and verification infrastructure
- Tauri app used as the demonstration vehicle

## Notes

- Governance artifact is primary; app code is secondary.
- Ratification/enforcement authority stays in ratified lattice artifacts.
- Ledger/status/broadcast artifacts are awareness, not authority.
