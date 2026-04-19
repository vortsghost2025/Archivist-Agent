# Three-Lane Attestation Fabric — Integration Status

**Date:** 2026-04-19
**Phase:** 4.4 Complete

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COORDINATION LAYER                           │
│                                                                      │
│    Archivist ◄────────► Librarian (neutral intermediary) ◄────────► │
│    (Authority 100)         │              (SwarmMind/Library)       │
│                            │                                          │
│                            ▼                                          │
│              Structured Questions / Answers                          │
│              (Isolation Preserved)                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     ATTESTATION FLOW                                 │
│                                                                      │
│  SwarmMind ──POST──► Archivist /orchestrate/recovery                 │
│  Library   ──POST──► Archivist /orchestrate/recovery                 │
│                                                                      │
│  Response:                                                           │
│  - OK                    → Continue processing                       │
│  - QUARANTINED           → Identity failure (no retry)              │
│  - SIGNATURE_MISMATCH    → Crypto failure, retry with nextRetryIn   │
│  - QUARANTINE_MAX_RETRIES→ Handoff required                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Lane Status

| Lane | Authority | Phase 4.3 | Phase 4.4 | Tests | Status |
|------|-----------|-----------|-----------|-------|--------|
| **Archivist** | 100 | ✅ Complete | ✅ Complete | 43 | **OPERATIONAL** |
| **SwarmMind** | 80 | ✅ Synced | ✅ Integrated | 13+ | **OPERATIONAL** |
| **Library** | 60 | ✅ Complete | ✅ Integrated | TBD | **OPERATIONAL** |

## Components by Lane

### Archivist (Authority)
| Component | Purpose |
|-----------|---------|
| `Verifier.js` | JWS verification with deterministic lane check |
| `VerifierWrapper.js` | Quarantine orchestration |
| `QuarantineManager.js` | Retry limits, handoff signaling |
| `PhenotypeStore.js` | Last-known-good state persistence |
| `recoveryEngine.ts` | HTTP endpoint handler |
| `api.ts` | Express routes |

### SwarmMind (Execution)
| Component | Purpose |
|-----------|---------|
| `QuarantineManager.js` | Local quarantine tracking |
| `orchestratorClient.js` | POST to Archivist, schedule retries |
| `AttestationSupport.js` | Verification + reporting integration |

### Library (Memory)
| Component | Purpose |
|-----------|---------|
| `QuarantineManager.js` | Local quarantine tracking |
| `AttestationSupport.js` | Verification + reporting to Archivist |
| `constants.js` | Shared constants (QUARANTINE_MAX_RETRIES, etc.) |

## Invariant Enforced

```
A (outerLane) = B (signedPayloadLane) = C (keyFetchedForLane)
```

**Verification Order:**
1. Parse JWS (without trusting)
2. Extract `signedPayloadLane` from parsed JWS
3. Require `signedPayloadLane` exists → FAIL: `MISSING_LANE`
4. Compare `signedPayloadLane` to `outerLane` → FAIL: `LANE_MISMATCH`
5. Fetch key for agreed lane
6. Verify crypto → FAIL: `SIGNATURE_MISMATCH`

## API Contract

**Endpoint:** `POST /orchestrate/recovery`

**Request:**
```json
{
  "artifact": {
    "id": "msg-001",
    "lane": "swarmmind",
    "signature": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "outerLane": "swarmmind",
  "failureReason": "SIGNATURE_MISMATCH"
}
```

**Response (Success):**
```json
{ "status": "OK" }
```

**Response (Retry Available):**
```json
{
  "status": "SIGNATURE_MISMATCH",
  "retryCount": 2,
  "nextRetryIn": 10000
}
```

**Response (Handoff Required):**
```json
{
  "status": "QUARANTINE_MAX_RETRIES",
  "handoffRequired": true
}
```

## Test Results

| Lane | Module | Tests |
|------|--------|-------|
| Archivist | PKI | 10 ✅ |
| Archivist | Orchestration | 17 ✅ |
| Archivist | Cross-Lane Integration | 9 ✅ |
| Archivist | Failure Drill | 7 ✅ |
| SwarmMind | Lane Consistency | 5 ✅ |
| SwarmMind | Quarantine Orchestration | 8 ✅ |
| **Total** | | **56+** |

## Security

- **Authentication:** Bearer JWT with shared secret (`ARCHIVIST_ORCH_TOKEN`)
- **Key Rotation:** 90-day schedule, zero-downtime rotation process
- **Trust Store:** File permissions 0600, Archivist-only write access

## Documentation

- `docs/openapi.yaml` — Full API specification
- `docs/KEY_ROTATION.md` — Zero-downtime key rotation process

## Organism Status

```
┌────────────────────────────────────────┐
│         ORGANISM: STABLE               │
│                                        │
│  Archivist  → GOVERNS (recovery auth)  │
│  SwarmMind  → EXECUTES (verifies)      │
│  Library    → REMEMBERS (verifies)     │
│                                        │
│  Invariant: A = B = C                  │
│  Coordination: Librarian intermediary  │
│  Isolation: Preserved                  │
└────────────────────────────────────────┘
```
