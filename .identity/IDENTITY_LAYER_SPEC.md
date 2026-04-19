# Agent Identity Layer — Specification v0.2

## Overview

Defines a **signed** persistent identity layer that survives model switches, session resets, and context truncation. Implements the same trust pattern as artifact verification but at the agent identity level.

**v0.2 Change:** Identity snapshots are now signed JWS artifacts, eliminating trust-by-assumption.

## Core Invariant

```
v0.1: snapshot.lane === runtime.lane === trust.lane
v0.2: signed_snapshot.identity.lane === runtime.lane
      AND JWS verifies with issuer public key
      AND snapshot not expired/revoked
```

Same invariant. Stronger proof.

## Components

### 1. `identity_snapshot` (v0.2)

**Purpose:** Captures agent state at a point in time. Survives model switches. Now signed.

**Location:** `S:/Archivist-Agent/.identity/snapshot.json`

**Schema (v0.2):**
```json
{
  "version": "2.0",
  "identity": {
    "id": "archivist-agent-001",
    "lane": "archivist",
    "authority": 100,
    "created_at": "2026-04-19T00:00:00Z",
    "model_origin": "nvidia/glm5",
    "last_updated": "2026-04-19T19:30:00Z",
    "issued_by": "archivist",
    "key_id": "72036d1654b0034a",
    "expires_at": "2026-07-19T00:00:00Z"
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
  "open_loops": [...],
  "goals": [...],
  "context_fingerprint": {...}
}
```

**v0.2 Fields:**
- `issued_by`: Lane that signed this snapshot (usually self)
- `key_id`: Key ID from trust store used for verification
- `expires_at`: ISO timestamp when snapshot becomes invalid

### 2. `snapshot.jws`

**Purpose:** Signed JWS over the canonical snapshot payload.

**Location:** `S:/Archivist-Agent/.identity/snapshot.jws`

**Format:** Compact JWS (`header.payload.signature`)

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWS",
  "kid": "72036d1654b0034a"
}
```

### 3. `revocations.json`

**Purpose:** Tracks revoked snapshots and keys.

**Location:** `S:/Archivist-Agent/.identity/revocations.json`

**Schema:**
```json
{
  "version": "1.0",
  "revoked_snapshots": [
    { "identity_id": "...", "revoked_at": "...", "reason": "..." }
  ],
  "revoked_keys": [
    { "lane": "...", "key_id": "...", "revoked_at": "..." }
  ]
}
```

### 4. `continuity_handshake` (v0.2)

**Purpose:** Verifies that a new model instance matches the **signed** identity snapshot.

**Verification Order:**
```
1. Load snapshot.json
2. Load snapshot.jws
3. Parse JWS header
4. Extract issued_by, key_id, expires_at
5. Fetch issuer public key from trust store
6. Verify JWS over canonical snapshot payload
7. Check expiry
8. Check revocation list
9. Compare runtimeLane to snapshot.identity.lane
```

**Implementation:** See `continuity_handshake.js`

**Failure Reasons:** See `identity_reasons.js`

```
SNAPSHOT_NOT_FOUND
SNAPSHOT_SIGNATURE_MISSING
SNAPSHOT_SIGNATURE_INVALID
SNAPSHOT_PAYLOAD_MISMATCH
INVALID_JWS_FORMAT
MISSING_SNAPSHOT_LANE
MISSING_ISSUER
MISSING_KEY_ID
ISSUER_NOT_TRUSTED
ISSUER_KEY_REVOKED
KEY_ID_MISMATCH
IDENTITY_MISMATCH
SNAPSHOT_EXPIRED
SNAPSHOT_REVOKED
KEY_REVOKED
LANE_NOT_DETECTED
```

### 5. `rehydration_prompt`

**Purpose:** Instructions for new model to restore identity from signed snapshot.

**Location:** `S:/Archivist-Agent/.identity/REHYDRATE.md`

## Workflow (v0.2)

### On Session Start

```
┌─────────────────────────────────────────────────────────────┐
│ MODEL INSTANCE START                                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. DETECT RUNTIME LANE                                      │
│    - LANE_ID env var OR                                     │
│    - .session-mode file                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LOAD SIGNED SNAPSHOT                                     │
│    - snapshot.json (payload)                                │
│    - snapshot.jws (signature)                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. VERIFY SIGNATURE                                         │
│    - Parse JWS header                                       │
│    - Get issuer public key from trust store                 │
│    - Verify JWS over canonical payload                      │
│    - Check expiry                                           │
│    - Check revocation list                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. COMPARE LANES                                            │
│    runtime.lane === snapshot.identity.lane ?               │
│    ├─ MATCH ──► Continue to rehydration                     │
│    └─ MISMATCH ──► FAIL: IDENTITY_MISMATCH                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ (MATCH)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. RESUME IDENTITY                                          │
│    - Acknowledge invariants                                 │
│    - Resume open loops                                      │
│    - Align with goals                                       │
│    - Update context fingerprint                             │
└─────────────────────────────────────────────────────────────┘
```

### On Model Switch

```
OLD MODEL                    NEW MODEL
    │                            │
    ▼                            │
┌─────────────────┐              │
│ Sign Snapshot   │              │
│ (current state) │              │
└───────┬─────────┘              │
        │                        │
        ▼                        │
   [Model Switch]                │
        │                        │
        └────────────────────────┤
                                 ▼
                       ┌─────────────────┐
                       │ Load Snapshot   │
                       │ Verify JWS      │
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
│   ├── snapshot.json      # Current identity payload
│   ├── snapshot.jws       # Signed JWS (v0.2)
│   ├── revocations.json   # Revocation list (v0.2)
│   ├── identity_signer.js # Signing utilities
│   ├── identity_reasons.js# Failure reasons
│   ├── continuity_handshake.js # Handshake logic
│   ├── REHYDRATE.md       # Rehydration instructions
│   ├── IDENTITY_LAYER_SPEC.md # This file
│   ├── test-identity-layer.js # Tests
│   └── archive/
│       ├── snapshot-2026-04-19.json
│       └── snapshot-2026-04-19.jws
├── .trust/
│   └── keys.json          # Trust store (public keys)
├── scripts/
│   └── sign-snapshot.js   # Signing script
└── BOOTSTRAP.md           # Governance entry point
```

## Signing Procedure

To sign a snapshot:

```bash
# Set passphrase (from secure storage)
export LANE_KEY_PASSPHRASE=<passphrase>

# Sign the snapshot
node scripts/sign-snapshot.js
```

This produces `snapshot.jws` with a compact JWS over the canonical payload.

## Testing

```bash
# Run identity layer tests
node .identity/test-identity-layer.js
```

Tests verify:
1. Valid signed handshake succeeds
2. Wrong lane fails with IDENTITY_MISMATCH
3. Snapshot has v0.2 required fields
4. JWS file exists and is valid
5. JWS verifies with trust store public key
6. Key ID matches trust store
7. Revocations file is valid
8. Snapshot not expired
9. Lane detection works
10. Invariant chain preserved
11. Goals loaded correctly
12. Context fingerprint exists

## Security Considerations

### Why Sign Identity?

v0.1 used trust-by-assumption: if a snapshot file existed, we trusted it.

v0.2 requires cryptographic proof:
- Snapshot was signed by a trusted key
- Snapshot has not been tampered with
- Snapshot has not expired
- Snapshot/key has not been revoked

### Key Storage

Private keys are encrypted at rest with passphrase derived from environment:
- `LANE_KEY_PASSPHRASE` must be set for signing
- Private keys stored in `.identity/private.pem`
- Never commit private keys to git

### Expiry

Snapshots expire after 90 days by default. Expired snapshots require re-signing.

### Revocation

If a key is compromised:
1. Add to `revocations.json`
2. Generate new keypair
3. Re-sign all active snapshots

## Integration with Existing System

| Existing Component | Identity Layer Integration |
|--------------------|---------------------------|
| `keys.json` | Trust verification for identity handshake |
| `BOOTSTRAP.md` | Referenced in rehydration prompt |
| `A = B = C invariant` | Applied to signed identity verification |
| `QuarantineManager` | Identity failures trigger quarantine |
| `PhenotypeStore` | Extended to track identity phenotype |

## Changelog

### v0.2 (2026-04-19)
- Added signed JWS over snapshot payload
- Added `issued_by`, `key_id`, `expires_at` fields
- Added `revocations.json` for revocation tracking
- Added `identity_signer.js` for signing utilities
- Added `identity_reasons.js` for failure classification
- Updated handshake to verify JWS before trusting payload
- Updated tests for signed verification

### v0.1 (2026-04-19)
- Initial specification
- Unsigned snapshot
- Basic handshake
- Rehydration prompt
