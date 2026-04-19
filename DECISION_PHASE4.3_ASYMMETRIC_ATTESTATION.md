# DECISION_PHASE4.3_ASYMMETRIC_ATTESTATION.md

**Date:** 2026-04-19
**Decision ID:** PHASE4.3-ASYMMETRIC-ATTESTATION
**Status:** APPROVED
**Depends On:** PHASE4.2-MONITORING-ALERTING

---

## Summary

Upgrade identity verification from HMAC stubs to per-lane PKI signatures (RSA-2048), providing non-repudiation and cryptographic proof of provenance for queue items, audit events, and continuity records.

---

## Problem Statement

Current system uses HMAC-based identity stubs:
- `.identity/keys.json` contains Ed25519 keypairs but signatures are not verified
- Queue items can be forged by any lane
- Audit events lack cryptographic provenance
- Continuity records have no tamper evidence

HMAC requires shared secret → violates lane isolation principle.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PER-LANE KEY PAIRS                          │
├─────────────────────────────────────────────────────────────────┤
│  Archivist (Lane 1)    │  SwarmMind (Lane 2)  │  Library (Lane 3)│
│  .identity/private.pem │  .identity/private.pem│ .identity/...   │
│  .identity/public.pem  │  .identity/public.pem │ .identity/...   │
└───────────┬─────────────┴──────────┬────────────┴────────┬──────┘
            │                        │                     │
            │   Register public key  │   Register public   │
            ▼                        ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHIVIST TRUST STORE                        │
│                   .trust/keys.json                               │
│  {                                                              │
│    "archivist": "-----BEGIN PUBLIC KEY-----...",                │
│    "swarmmind": "-----BEGIN PUBLIC KEY-----...",                │
│    "library":  "-----BEGIN PUBLIC KEY-----..."                  │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | RSA-2048 | Industry standard, wide support |
| Key storage | `.identity/private.pem` (encrypted), `.identity/public.pem` (plain) | Private never leaves lane |
| Passphrase | `process.env.LANE_KEY_PASSPHRASE` | Derived from environment |
| Rotation | Operator-initiated only | No automatic rotation |
| Trust store | `.trust/keys.json` | Simple lane_id → PEM mapping |
| Signature format | JWS (JSON Web Signature) | Standard, compact, verifiable |

---

## Signature Scope

### Queue Items
```json
{
  "id": "Q-1776602289247-1",
  "timestamp": "2026-04-19T02:45:00Z",
  "origin_lane": "swarmmind",
  "target_lane": "archivist",
  "type": "incident_report",
  "payload": { ... },
  "signature": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...",
  "signature_alg": "RS256"
}
```

### Audit Events
```json
{
  "timestamp": "2026-04-19T02:45:00Z",
  "lane": "swarmmind",
  "event": "incident_classified",
  "itemId": "Q-1776602289247-1",
  "severity": "P1",
  "signature": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9..."
}
```

### Continuity Records
```json
{
  "lane_id": "swarmmind",
  "fingerprint": "79150d27...",
  "timestamp": "2026-04-19T02:45:00Z",
  "signature": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9..."
}
```

---

## Migration Timeline

### Phase 4.3.1: Day 1-30 (Dual-Mode)
- Existing HMAC signatures accepted for backward compatibility
- New items MUST include JWS signature
- Verification: Accept either HMAC OR JWS

### Phase 4.3.2: Day 31+ (JWS-Only)
- HMAC signatures rejected with `INVALID_SIGNATURE`
- Only JWS signatures accepted
- Operators must clear any HMAC-only backlog

### Key Rotation
- Operator-initiated via APPROVAL queue
- Old public keys retained 90 days for historical verification
- Rotation event logged to audit trail

---

## Implementation Modules

### SwarmMind (Primary)

| Module | Purpose |
|--------|---------|
| `src/attestation/KeyManager.js` | Key generation, storage, rotation |
| `src/attestation/Signer.js` | JWS signing for queue/audit/continuity |
| `src/attestation/Verifier.js` | JWS verification against trust store |
| `src/queue/Queue.js` | Updated: auto-sign on enqueue |
| `src/audit/AuditLogger.js` | Updated: sign audit events |
| `src/resilience/ContinuityVerifier.js` | Updated: sign continuity records |

### Library (Mirror)
- Copy `src/attestation/*` from SwarmMind
- Configure to fetch public keys from Archivist trust store
- Verify all incoming queue items

### Archivist (Trust Authority)
- `.trust/keys.json` — canonical public key registry
- Accept key registrations via APPROVAL queue
- Expose trust store for cross-lane verification

---

## Trust Store Format

**Location:** `S:\Archivist-Agent\.trust\keys.json`

```json
{
  "version": "1.0",
  "updated_at": "2026-04-19T00:00:00Z",
  "keys": {
    "archivist": {
      "lane_id": "archivist",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----",
      "algorithm": "RS256",
      "registered_at": "2026-04-19T00:00:00Z",
      "expires_at": null,
      "revoked_at": null
    },
    "swarmmind": { ... },
    "library": { ... }
  }
}
```

---

## JWS Format

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "swarmmind-2026-04-19"
}
```

**Payload:** The JSON object being signed

**Signature:** Base64URL-encoded RSA signature

**Example:**
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlEtMTc3NjYwMjI4OTI0Ny0xIiwib3JpZ2luX2xhbmUiOiJzd2FybW1pbmQifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

---

## Tests Required

| Test File | Coverage |
|-----------|----------|
| `scripts/test-pki.js` | Key gen, sign/verify round-trip |
| `scripts/test-attestation-migration.js` | HMAC→JWS transition |
| `scripts/test-queue-signatures.js` | Queue auto-signing |
| `scripts/test-audit-signatures.js` | Audit signing/verification |
| `scripts/test-trust-store.js` | Key registration, rotation, revocation |

---

## Security Considerations

1. **Private Key Protection**
   - Encrypted at rest with passphrase
   - Never transmitted across lanes
   - Loaded into memory only during signing

2. **Passphrase Management**
   - Derived from `process.env.LANE_KEY_PASSPHRASE`
   - If not set, prompt on first run (store in `.identity/passphrase.enc`)
   - DO NOT commit passphrase to git

3. **Key Revocation**
   - If private key compromised: operator publishes revocation via APPROVAL queue
   - Trust store marks key as `revoked_at: <timestamp>`
   - All signatures after revocation timestamp are rejected

4. **Replay Protection**
   - All signed objects include `timestamp` field
   - Verifier rejects signatures older than configurable window (default: 24h)

---

## API Surface

### KeyManager
```javascript
generateKeyPair(passphrase) // → { privateKeyPem, publicKeyPem }
saveKeyPair(privatePem, publicPem, passphrase)
loadPrivateKey(passphrase) // → RsaPrivateKey
loadPublicKey() // → RsaPublicKey
rotateKeyPair(newPassphrase) // → { oldKeyId, newKeyId }
```

### Signer
```javascript
sign(payload, privateKey) // → JWS string
signQueueItem(item, privateKey) // → signedItem
signAuditEvent(event, privateKey) // → signedEvent
```

### Verifier
```javascript
verify(jws, publicKey) // → payload | null
verifyQueueItem(item, trustStore) // → { valid, lane, payload }
verifyAgainstTrustStore(jws, laneId, trustStore) // → boolean
```

---

## Success Criteria

1. ✅ All three lanes have RSA keypairs registered in trust store
2. ✅ Queue items auto-signed on enqueue
3. ✅ Audit events include JWS signature
4. ✅ Continuity records verifiable against trust store
5. ✅ Migration test passes (HMAC accepted → rejected after cutoff)
6. ✅ Key rotation test passes

---

## References

- `.identity/keys.json` — Current Ed25519 keypairs (will migrate)
- `LANE_REGISTRY.json` — Lane definitions
- `DECISION_PHASE4.2_MONITORING_ALERTING.md` — Monitoring foundation
- RFC 7515 — JSON Web Signature (JWS)

---

## Messages to Lanes

### To SwarmMind
```
PHASE 4.3 IMPLEMENTATION REQUEST

Implement PKI attestation stack in SwarmMind:
1. src/attestation/KeyManager.js — Key generation/storage
2. src/attestation/Signer.js — JWS signing
3. src/attestation/Verifier.js — JWS verification
4. Update Queue.js to auto-sign on enqueue
5. Update AuditLogger.js to sign events
6. Create test suite (test-pki.js, test-queue-signatures.js)

Key parameters: RSA-2048, JWS (RS256), 30-day dual-mode

Commit and push when complete. Reference this decision.
```

### To Library
```
PHASE 4.3 ADOPTION REQUEST

Copy attestation modules from SwarmMind:
1. src/attestation/KeyManager.js
2. src/attestation/Signer.js
3. src/attestation/Verifier.js

Configure:
- Fetch public keys from S:\Archivist-Agent\.trust\keys.json
- Verify all incoming queue items from SwarmMind
- Sign outgoing queue items

Commit and push when complete. Reference this decision.
```
