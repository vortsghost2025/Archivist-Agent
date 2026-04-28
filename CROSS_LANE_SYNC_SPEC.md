# CROSS-LANE SYNC PACKET FORMAT

**Created:** 2026-04-17
**Version:** 1.0.0
**Status:** Specification

---

## Purpose

Enable context restoration across the 600k distributed architecture without requiring agents to re-read entire governance files.

When an agent compacts from 180k → 50k tokens, the lost 130k can be restored by querying other lanes' sync packets.

---

## Architecture Overview

```
Lane 1: Archivist-Agent (200k) - Constitutional governance root
    |
    | (governance inheritance)
    v
Lane 2: SwarmMind (200k) - Trace-mediated verification surface
    |
    | (context restoration)
    v
Lane 3: self-organizing-library (200k) - Memory/preservation layer
```

Each lane maintains a `RUNTIME_STATE.json` that other lanes can read.

---

## Packet Format

### RUNTIME_STATE.json

**Location:** `<project-root>/RUNTIME_STATE.json`

**Purpose:** Minimal state for cross-lane queries

```json
{
  "$schema": "https://archivist.dev/schemas/runtime-state.json",
  "version": "1.0.0",
  "timestamp": "2026-04-17T04:30:00.000Z",
  
  "lane": {
    "id": "archivist-agent",
    "role": "governance-root",
    "position": 1
  },

  "capabilities": {
    "can_respond_to_sync": true,
    "can_govern": true,
    "can_restore_context": false,
    "can_archive_traces": false
  },
  
  "session": {
    "id": "1744860000000-12345",
    "started": "2026-04-17T04:00:00.000Z",
    "branch": "main"
  },
  
  "governance": {
    "active": true,
    "source": null,
    "bootstrap_verified": true,
    "constraints_enforced": true
  },
  
  "modes": {
    "claim_limit": "full",
    "external_lane_enabled": true,
    "drift_reporting": true
  },
  
  "sync": {
    "last_compact": null,
    "context_available": true,
    "artifacts_modified": [],
    "drift_score": 0
  }
}
```

---

### SYNC_REQUEST.json

**Purpose:** Request context from another lane

**Location:** Generated on-demand, not persisted

```json
{
  "$schema": "https://archivist.dev/schemas/sync-request.json",
  "version": "1.0.0",
  "timestamp": "2026-04-17T04:35:00.000Z",
  
  "requester": {
    "lane_id": "swarmmind",
    "session_id": "1744860100000-67890",
    "context_remaining": 52000,
    "context_lost": 128000
  },
  
  "request": {
    "type": "restore_context",
    "target_lane": "archivist-agent",
    "scope": [
      "governance_constraints",
      "active_checkpoints",
      "drift_baseline",
      "session_state"
    ],
    "max_tokens": 10000
  },
  
  "filters": {
    "since": "2026-04-17T04:00:00.000Z",
    "branch": "main",
    "exclude_artifacts": ["*.log", "*.tmp"]
  }
}
```

---

### SYNC_RESPONSE.json

**Purpose:** Response to sync request

**Location:** `<project-root>/SYNC_RESPONSE_<requester_session_id>.json`

```json
{
  "$schema": "https://archivist.dev/schemas/sync-response.json",
  "version": "1.0.0",
  "timestamp": "2026-04-17T04:35:01.000Z",
  
  "responder": {
    "lane_id": "archivist-agent",
    "session_id": "1744860000000-12345",
    "runtime_state_path": "S:\\Archivist-Agent\\RUNTIME_STATE.json"
  },
  
  "response": {
    "status": "success",
    "tokens_provided": 8500,
    "context_restored": true
  },
  
  "payload": {
    "governance_constraints": {
      "single_entry_point": true,
      "structure_over_identity": true,
      "correction_mandatory": true,
      "agent_evaluates_WE": true,
      "agent_not_part_of_WE": true
    },
    
    "active_checkpoints": [
      {
        "id": "CP-001",
        "name": "pre_action_verification",
        "trigger": "before_file_write",
        "required": ["validate_path", "check_allowed_roots"]
      },
      {
        "id": "CP-002",
        "name": "governance_consultation",
        "trigger": "before_major_decision",
        "required": ["read_bootstrap", "acknowledge_constraints"]
      }
    ],
    
    "drift_baseline": {
      "cps_score": 0,
      "uds_score": 0,
      "signals": [],
      "last_check": "2026-04-17T04:00:00.000Z"
    },
    
    "session_state": {
      "verification_lane": "L",
      "branch": "main",
      "artifacts_modified": [],
      "corrections_received": 0
    }
  },
  
  "authority": {
    "fields_authoritative": [
      "governance_constraints",
      "active_checkpoints"
    ],
    "fields_advisory": [
      "drift_baseline",
      "session_state"
    ],
    "notes": "Authoritative fields MUST be treated as truth. Advisory fields are suggestions."
  },

  "signature": {
    "hash": "sha256:a1b2c3d4...",
    "verified": true
  }
}
```

---

## Lane-Specific Fields

### Lane 1: Archivist-Agent (Governance Root)

```json
{
  "lane": {
    "id": "archivist-agent",
    "role": "governance-root",
    "position": 1
  },
  "governance": {
    "active": true,
    "source": null,
    "bootstrap_path": "S:\\Archivist-Agent\\BOOTSTRAP.md",
    "constraints_enforced": true
  },
  "downstream_lanes": [
    {
      "id": "swarmmind",
      "relationship": "integration-target",
      "manifest_path": "S:\\SwarmMind\\GOVERNANCE_MANIFEST.json"
    }
  ]
}
```

### Lane 2: SwarmMind (Trace Layer)

```json
{
  "lane": {
    "id": "swarmmind",
    "role": "trace-mediated-verification-surface",
    "position": 2
  },
  "governance": {
    "active": false,
    "source": "S:\\Archivist-Agent",
    "inherited": true,
    "mode": "standalone-lattice"
  },
  "modes": {
    "claim_limit": "annotation-only",
    "external_lane_enabled": true,
    "trace_export": true
  },
  "upstream_lane": {
    "id": "archivist-agent",
    "runtime_state_path": "S:\\Archivist-Agent\\RUNTIME_STATE.json"
  }
}
```

### Lane 3: self-organizing-library (Memory Layer)

```json
{
  "lane": {
    "id": "self-organizing-library",
    "role": "memory-preservation",
    "position": 3
  },
  "governance": {
    "active": false,
    "source": null
  },
  "memory": {
    "artifacts_stored": 47,
    "traces_archived": 12,
    "restoration_packets_available": 3
  },
  "upstream_lanes": [
    {
      "id": "archivist-agent",
      "runtime_state_path": "S:\\Archivist-Agent\\RUNTIME_STATE.json"
    },
    {
      "id": "swarmmind",
      "runtime_state_path": "S:\\SwarmMind Self-Optimizing Multi-Agent AI System\\RUNTIME_STATE.json"
    }
  ]
}
```

---

## Compaction Control
 
**Field:** `COMPACTION_ENABLED`
 
**Default:** `false` (suspended until hard invariant enforced)
 
**Purpose:** Prevent silent message loss during compaction.
 
```json
{
  "compaction": {
    "enabled": false,
    "reason": "Hard invariant not yet enforced - SYSTEM.txt action #1",
    "resume_condition": "enforce-consistency-invariant.js passes on all lanes"
  }
}
```
 
**To Resume:** Set `enabled: true` after `enforce-consistency-invariant.js` passes on all lanes.
 
---

## Sync Protocol
 
### Step 1: Detection

Agent detects context loss after compact:

```
context_remaining: 52000 tokens
context_capacity: 200000 tokens
context_lost: 128000 tokens (available for restoration)
```

### Step 2: Query

Agent reads `RUNTIME_STATE.json` from upstream lane:

```javascript
const upstreamState = JSON.parse(
  fs.readFileSync('S:\\Archivist-Agent\\RUNTIME_STATE.json')
);
```

### Step 3: Request

If context restoration needed, generate `SYNC_REQUEST.json`:

```javascript
const request = {
  requester: {
    lane_id: 'swarmmind',
    context_remaining: 52000,
    context_lost: 128000
  },
  request: {
    type: 'restore_context',
    scope: ['governance_constraints', 'active_checkpoints']
  }
};
```

### Step 4: Response

Upstream lane provides `SYNC_RESPONSE.json` with minimal context payload.

### Step 5: Restoration

Agent incorporates restored context without re-reading full governance files.

---

## Token Budget

| Operation | Tokens | Notes |
|-----------|--------|-------|
| Read RUNTIME_STATE.json | ~200 | Minimal overhead |
| Generate SYNC_REQUEST | ~150 | On-demand only |
| Read SYNC_RESPONSE | ~5,000-10,000 | Restored context |
| Full governance reload | ~50,000+ | Avoided by sync |

**Efficiency:** Sync packets restore critical context with 5-10k tokens instead of 50k+ full reload.

---

## File Locations

| Lane | RUNTIME_STATE.json | GOVERNANCE_RESOLUTION.json |
|------|-------------------|---------------------------|
| Archivist-Agent | `S:\Archivist-Agent\RUNTIME_STATE.json` | N/A (root) |
| SwarmMind | `S:\SwarmMind Self-Optimizing Multi-Agent AI System\RUNTIME_STATE.json` | `S:\SwarmMind Self-Optimizing Multi-Agent AI System\GOVERNANCE_RESOLUTION.json` |
| self-organizing-library | `S:\self-organizing-library\RUNTIME_STATE.json` | N/A |

---

## Authority Model

### Why Authority Matters

Without authority distinction, downstream lanes might:

1. Treat advisory data as truth
2. Overwrite local state with upstream suggestions
3. Violate context boundaries
4. Create conflicting governance states

### Authority Levels

| Level | Meaning | Enforcement |
|-------|---------|-------------|
| **Authoritative** | MUST be treated as truth | Violation = context-boundary failure |
| **Advisory** | MAY be accepted or overridden | Local context takes precedence |

### Field Classification

**Authoritative Fields:**
- `governance_constraints` — Constitutional, cannot be overridden
- `active_checkpoints` — Safety-critical, must be enforced
- `claim_limit` — Authority level for claims

**Advisory Fields:**
- `drift_baseline` — Local drift may differ from upstream
- `session_state` — Local session context may differ
- `artifacts_modified` — Local tracking

### Capability Declaration

Each lane MUST declare its capabilities:

```json
{
  "capabilities": {
    "can_respond_to_sync": true,
    "can_govern": true,
    "can_restore_context": false,
    "can_archive_traces": false
  }
}
```

**Capability Meanings:**

| Capability | Meaning |
|------------|---------|
| `can_respond_to_sync` | Can provide SYNC_RESPONSE to requests |
| `can_govern` | Has constitutional authority |
| `can_restore_context` | Can provide context restoration packets |
| `can_archive_traces` | Can store and retrieve traces |

### Lane Capability Matrix

| Lane | can_govern | can_respond_to_sync | can_restore_context | can_archive_traces |
|------|------------|---------------------|---------------------|-------------------|
| Archivist-Agent | ✅ | ✅ | ❌ | ❌ |
| SwarmMind | ❌ | ✅ | ✅ | ✅ |
| self-organizing-library | ❌ | ✅ | ✅ | ✅ |

---

## Versioning

Each packet includes a `$schema` field for validation:

```
https://archivist.dev/schemas/runtime-state.json
https://archivist.dev/schemas/sync-request.json
https://archivist.dev/schemas/sync-response.json
```

Schema files stored in `S:\Archivist-Agent\schemas\` for offline validation.

---

## Security

- All sync packets are file-based (no network exposure)
- Paths are validated against `allowed_roots.json`
- Signatures use SHA-256 hash for integrity
- Requesters must have permission to read target lane's files

---

## Next Steps

1. Implement sync-request generator in SwarmMind
2. Implement sync-response generator in Archivist-Agent
3. Create schema validation scripts
4. Test cross-lane restoration after compact

---

**End of Specification**
