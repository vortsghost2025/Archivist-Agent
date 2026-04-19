# Agent Identity Layer — Specification v0.1

## Overview

Defines a persistent identity layer that survives model switches, session resets,
and context truncation. Implements the same trust pattern as artifact verification
but at the agent identity level.

## Core Concept

```
Artifact Trust:  payload.lane === declared.lane === key.lane
Identity Trust:  snapshot.lane === runtime.lane === trust.lane
```

Same invariant. Different scope.

## Components

### 1. `identity_snapshot`

**Purpose:** Captures agent state at a point in time. Survives model switches.

**Location:** `S:/Archivist-Agent/.identity/snapshot.json`

**Schema:**
```json
{
  "version": "1.0",
  "identity": {
    "id": "agent-instance-001",
    "lane": "archivist",
    "authority": 100,
    "created_at": "2026-04-19T00:00:00Z",
    "model_origin": "nvidia/glm5"
  },
  "invariants": [
    "A = B = C (lane consistency)",
    "Structure > Identity",
    "Single entry point (BOOTSTRAP.md)"
  ],
  "trust_state": {
    "lanes_registered": ["archivist", "swarmmind", "library"],
    "last_verification": "2026-04-19T12:00:00Z",
    "quarantine_count": 0
  },
  "open_loops": [
    {
      "id": "loop-001",
      "type": "task",
      "description": "Monitor quarantine events",
      "status": "in_progress",
      "created_at": "2026-04-19T10:00:00Z"
    }
  ],
  "goals": [
    {
      "id": "goal-001",
      "description": "Maintain three-lane attestation fabric",
      "priority": "high",
      "status": "active"
    }
  ],
  "context_fingerprint": {
    "files_read": ["BOOTSTRAP.md", "GOVERNANCE.md", ".trust/keys.json"],
    "key_decisions": ["Phase 4.4 verification order fix"],
    "last_activity": "2026-04-19T12:30:00Z"
  }
}
```

### 2. `continuity_handshake`

**Purpose:** Verifies that a new model instance matches the identity snapshot.

**Process:**
```
New Model Instance Starts
         │
         ▼
   Load identity_snapshot
         │
         ▼
   Extract snapshot.lane
         │
         ▼
   Compare to runtime.lane (environment variable or config)
         │
         ├──── MATCH ────► Proceed to rehydration
         │
         └──── MISMATCH ──► FAIL: IDENTITY_MISMATCH
                            Require manual intervention
```

**Implementation:**
```javascript
// continuity_handshake.js

const fs = require('fs');
const path = require('path');

const SNAPSHOT_PATH = path.join('S:', 'Archivist-Agent', '.identity', 'snapshot.json');

function continuityHandshake(runtimeLane) {
  // A: Runtime lane (from environment or config)
  const A = runtimeLane;
  
  // B: Snapshot lane (from persisted identity)
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch (e) {
    return { valid: false, error: 'SNAPSHOT_NOT_FOUND' };
  }
  const B = snapshot.identity.lane;
  
  // C: Trust lane (from trust store key registration)
  const trustStore = JSON.parse(fs.readFileSync(
    path.join('S:', 'Archivist-Agent', '.trust', 'keys.json'), 'utf8'
  ));
  const C = Object.keys(trustStore.keys || {}).includes(A) ? A : null;
  
  // Invariant: A = B = C
  if (A !== B) {
    return {
      valid: false,
      error: 'IDENTITY_MISMATCH',
      details: `Runtime lane (${A}) != Snapshot lane (${B})`
    };
  }
  
  if (A !== C) {
    return {
      valid: false,
      error: 'TRUST_MISMATCH',
      details: `Lane (${A}) not registered in trust store`
    };
  }
  
  return {
    valid: true,
    identity: snapshot.identity,
    invariants: snapshot.invariants,
    open_loops: snapshot.open_loops,
    goals: snapshot.goals
  };
}

module.exports = { continuityHandshake };
```

### 3. `rehydration_prompt`

**Purpose:** Instructions for new model to restore identity from snapshot.

**Location:** `S:/Archivist-Agent/.identity/REHYDRATE.md`

**Content:**
```markdown
# Agent Rehydration Protocol

## Before Taking Any Action

You MUST complete these steps:

### Step 1: Read Identity Snapshot
```
Read: S:/Archivist-Agent/.identity/snapshot.json
```

### Step 2: Verify Continuity Handshake
```
Assert: snapshot.identity.lane === your runtime lane
Assert: snapshot.identity.lane is registered in trust store
```

If either assertion fails, STOP and report IDENTITY_MISMATCH.

### Step 3: Acknowledge Invariants
Read and confirm understanding of:
- All invariants in snapshot.invariants
- Your lane's authority level
- Current trust state

### Step 4: Resume Open Loops
For each open_loop with status "in_progress":
- Read the loop's context
- Continue from last known state
- Do NOT restart from scratch

### Step 5: Align Goals
For each goal with status "active":
- Verify goal is still relevant
- Update progress if applicable

## After Rehydration

You are now operating as:
- Lane: {snapshot.identity.lane}
- Authority: {snapshot.identity.authority}
- Identity ID: {snapshot.identity.id}

All actions must respect the invariants and goals from the snapshot.
```

## Workflow

### On Session Start (New Model Instance)

```
┌─────────────────────────────────────────────────────────────┐
│                    MODEL INSTANCE START                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              1. READ identity_snapshot                       │
│                                                              │
│   Load: .identity/snapshot.json                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              2. PERFORM continuity_handshake                 │
│                                                              │
│   Assert: A (runtime) = B (snapshot) = C (trust store)      │
│                                                              │
│   ├─ PASS ──► Continue to rehydration                       │
│   └─ FAIL ──► Report IDENTITY_MISMATCH, halt                │
└─────────────────────────┬───────────────────────────────────┘
                          │ (PASS)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              3. READ rehydration_prompt                      │
│                                                              │
│   Load: .identity/REHYDRATE.md                               │
│   Execute all steps before taking action                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              4. RESUME IDENTITY                              │
│                                                              │
│   - Acknowledge invariants                                   │
│   - Resume open loops                                        │
│   - Align with goals                                         │
│   - Update context fingerprint                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              5. OPERATE AS SNAPSHOT IDENTITY                 │
│                                                              │
│   All subsequent actions are under this identity.            │
│   Periodically save updated snapshot.                        │
└─────────────────────────────────────────────────────────────┘
```

### On Model Switch

```
OLD MODEL                          NEW MODEL
    │                                  │
    ▼                                  │
┌─────────────────┐                    │
│ Save Snapshot   │                    │
│ (current state) │                    │
└────────┬────────┘                    │
         │                             │
         ▼                             │
    [Model Switch]                     │
         │                             │
         └─────────────────────────────┤
                                       ▼
                              ┌─────────────────┐
                              │ Load Snapshot   │
                              │ Handshake       │
                              │ Rehydrate       │
                              └────────┬────────┘
                                       │
                                       ▼
                              [Identity Restored]
```

## File Structure

```
S:/Archivist-Agent/
├── .identity/
│   ├── snapshot.json          # Current identity state
│   ├── REHYDRATE.md           # Rehydration instructions
│   ├── continuity_handshake.js # Handshake implementation
│   └── archive/
│       ├── snapshot-2026-04-19.json  # Historical snapshots
│       └── snapshot-2026-04-18.json
├── .trust/
│   └── keys.json              # Trust store (already exists)
└── BOOTSTRAP.md               # Governance entry point (already exists)
```

## Integration with Existing System

| Existing Component | Identity Layer Integration |
|--------------------|---------------------------|
| `keys.json` | Trust verification for identity handshake |
| `BOOTSTRAP.md` | Referenced in rehydration prompt |
| `A = B = C invariant` | Applied to identity verification |
| `QuarantineManager` | Identity mismatches trigger quarantine |
| `PhenotypeStore` | Extended to track identity phenotype |

## Testing

```javascript
// test-identity-layer.js

const assert = require('assert');
const { continuityHandshake } = require('./continuity_handshake');

// Test 1: Valid handshake
const result1 = continuityHandshake('archivist');
assert.strictEqual(result1.valid, true);

// Test 2: Mismatch detection
const result2 = continuityHandshake('swarmmind'); // Wrong lane
assert.strictEqual(result2.valid, false);
assert.strictEqual(result2.error, 'IDENTITY_MISMATCH');

// Test 3: Missing snapshot
// (Remove snapshot file, then test)
// Assert error: SNAPSHOT_NOT_FOUND

console.log('Identity layer tests passed');
```

## Benefits

1. **Survives Model Switch:** Identity persists across model changes
2. **Survives Context Truncation:** Snapshot is always available
3. **Survives Session Reset:** Rehydration restores full context
4. **Enforces Invariants:** Handshake verifies trust alignment
5. **Preserves Goals:** Open loops and goals are restored
6. **Audit Trail:** Historical snapshots in archive

## Next Steps

1. Implement `snapshot.json` writer (saves on session end)
2. Implement `continuity_handshake.js`
3. Write `REHYDRATE.md`
4. Add identity layer tests
5. Integrate with session startup
