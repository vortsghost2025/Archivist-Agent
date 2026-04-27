# Dual Archivist Ownership Tags (Lightweight)

Use this in lane messages when two Archivist agents are live.

## Message Field

Attach an `ownership` object at top level:

```json
{
  "ownership": {
    "coordination_group": "archivist-dual",
    "owner_agent_id": "archivist-fast",
    "mode": "active",
    "lease_expires_at": "2026-04-27T13:30:00.000Z",
    "conflict_policy": "owner-wins-until-lease-expiry"
  }
}
```

## Recommended Values

- `coordination_group`: stable group id for the shared effort.
- `owner_agent_id`: the agent currently owning execution.
- `mode`: `active`, `handoff`, or `shadow`.
- `lease_expires_at`: hard timeout for ownership.
- `conflict_policy`: plain-text arbitration rule.

## Runtime Environment

`lane-worker` reads `AGENT_INSTANCE_ID` from environment to identify the active agent identity during ownership checks.

Example:

```bash
AGENT_INSTANCE_ID=archivist-fast node scripts/lane-worker.js --lane archivist --watch
```

With enforcement enabled:

```bash
AGENT_INSTANCE_ID=archivist-fast node scripts/lane-worker.js --lane archivist --watch --enforce-ownership
```

## Operating Pattern

- Many readers, one writer.
- Handoffs use a new `owner_agent_id` and new lease.
- Shadow agent can analyze but should not emit final contradictory writes.

## Current Behavior

`lane-worker.js` now records ownership metadata in `_lane_worker`:

- `ownership`
- `ownership_notes` (e.g. `OWNERSHIP_LEASE_EXPIRED`, `OWNERSHIP_OWNER_MISMATCH`)
- `ownership_enforcement_enabled`

This is advisory only (no hard-blocking), so it is safe to adopt incrementally.
