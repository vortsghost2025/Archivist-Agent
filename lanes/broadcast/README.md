# Broadcast Directory

Shared resources for all lanes.

## Contents

| File | Purpose |
|------|---------|
| `gate-schema.json` | Convergence Gate structure - ALL lane outputs must conform |
| `active-blocker.json` | Current system blocker (only ONE allowed at a time) |

## Convergence Gate

Every lane output MUST include:

```json
{
  "claim": "Single sentence stating what was done/found",
  "evidence": "Path to artifact or log entry proving the claim",
  "verified_by": "archivist|library|swarmmind|self|user",
  "contradictions": [],
  "status": "proven|unproven|conflicted|blocked"
}
```

### Routing Rules

| Status | Action |
|--------|--------|
| `proven` | Forward to coordinator |
| `conflicted` | Forward to coordinator (P0) |
| `blocked` | Forward to coordinator (P1) |
| `unproven` | Queue for verification |

## One-Blocker Rule

At any moment, only ONE blocker is active system-wide.

### Blocker Format

```json
{
  "id": "BLOCKER-001",
  "description": "What is blocking",
  "blocking_lanes": ["library"],
  "required_action": "What needs to happen",
  "created": "2026-04-20T19:00:00Z",
  "owner": "library"
}
```

### Protocol

1. Lane identifies blocker → writes to `active-blocker.json`
2. All lanes check blocker before starting new work
3. Only owner lane works on blocker
4. Other lanes queue tasks
5. On resolution, owner removes blocker file

---

**Lane-Relay Protocol Enforced**
