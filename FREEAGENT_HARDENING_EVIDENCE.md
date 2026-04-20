# FreeAgent Hardening Evidence

Date: 2026-04-19
Phase: 3
Owner: Archivist (implementation), Library (documentation)

## Verification Hardening Results

### Test Execution

| Test | SwarmMind | Library | Result |
|------|-----------|---------|--------|
| Wrong payload.lane | PASS | PASS | QUARANTINE |
| Wrong header.kid | PASS | PASS | QUARANTINE |
| Tampered snapshot | PASS | PASS | HALT |
| Revoked key | PASS | PASS | HALT |

**Commands:**
```bash
cd "S:/SwarmMind Self-Optimizing Multi-Agent AI System"
node scripts/test-hardening-drill.js

cd "S:/self-organizing-library"
node scripts/security-drill.js
```

---

## Fallback Surface Elimination Checklist

### ✅ No alternate verification path remains callable in production

**Evidence:**
- `verifyHMAC()` removed from `Verifier.js` (both lanes)
- `isHMACAccepted()` removed from `Verifier.js` (both lanes)
- HMAC code paths deleted from `Queue.js` (both lanes)

**Verification:**
```bash
grep -r "verifyHMAC\|isHMACAccepted" src/
# Should return only comments indicating removal
```

### ✅ No recovery path can override local deterministic rejection

**Evidence:**
- `VerifierWrapper.js` logs "RecoveryEngine response ignored - local verification is authoritative"
- Recovery response is informational only
- Local verification result is the final decision

**Code:** `src/attestation/VerifierWrapper.js:129-133`
```javascript
// RecoveryEngine CANNOT override local deterministic failure
// "Provable" guarantees require this to be locally verifiable
console.log('[RECOVERY] RecoveryEngine response ignored - local verification is authoritative');
```

### ✅ No legacy acceptance mode can return valid on missing signature

**Evidence:**
- `Queue.js` throws `SIGNER_REQUIRED: JWS signing required - HMAC fallback removed`
- `VerifierWrapper.js` returns `MISSING_SIGNATURE` with `note: 'HMAC fallback removed - SIGNATURE_REQUIRED'`
- Anchor `fallback_policy.missing_signature_mode: "REJECT"`

**Code:** `src/queue/Queue.js:95`
```javascript
throw new Error('SIGNER_REQUIRED: JWS signing required - HMAC fallback removed');
```

### ✅ Deterministic failures always terminate or quarantine

**Evidence:**
- VerifierWrapper returns structured `{ valid: false, reason: 'QUARANTINED', ... }` (no throw)
- Queue throws on verification failure (blocks transition)
- Governed-start exits on identity verification failure

**Code:** `src/attestation/VerifierWrapper.js:48`
```javascript
try {
  const parsed = this._parseJWS(item.signature);
} catch (e) {
  // Malformed JWS → structured rejection, no throw
  return { valid: false, reason: 'QUARANTINED', note: 'JWS parse failed: ' + e.message };
}
```

---

## Status Semantics

Current implementation uses:

| Status | Meaning | Example |
|--------|---------|---------|
| `valid: true` | SUCCESS | Signature verified, lane match |
| `valid: false` | FAILURE/QUARANTINE | Any rejection |
| `reason: 'QUARANTINED'` | QUARANTINE | Lane mismatch, malformed JWS |
| `reason: 'MISSING_SIGNATURE'` | REJECT | Unsigned artifact |

### Gap Analysis vs. Outcome Protocol

The outcome protocol proposal defines:

| Status | Current | Proposed |
|--------|---------|----------|
| SUCCESS | `valid: true` | `status: "SUCCESS"` |
| FAILURE | `valid: false` (some cases) | `status: "FAILURE"` |
| ESCALATE | Not implemented | `status: "ESCALATE"` |
| DEFER | Not implemented | `status: "DEFER"` |
| QUARANTINE | `reason: 'QUARANTINED'` | `status: "QUARANTINE"` |

**Recommendation:** The proposed outcome protocol is more expressive and should be adopted in Phase 4 or 5.

---

## Verification Order Enforcement

**Invariant:** Lane comparison MUST happen BEFORE crypto verification.

**Implementation:** `src/attestation/VerifierWrapper.js:76-80`

```javascript
// Step 5: Lane identity enforcement (A = B = C)
// CRITICAL: This MUST happen BEFORE cryptographic verification
if (outerLane !== payloadLane) {
  return { valid: false, reason: 'QUARANTINED', note: `Signed payload lane (${payloadLane}) differs from outer lane (${outerLane})` };
}
```

**Test Evidence:** `scripts/edge-case-test.js` confirms runtime rejects lane mismatch at Step 5 before crypto.

---

## Key Revocation Handling

**Implementation:** Trust store `revoked_at` field checked before signature verification.

**Code:** `src/attestation/Verifier.js` (key lookup)

```javascript
const keyEntry = this.trustStore.keys[laneId];
if (!keyEntry) {
  return { valid: false, error: VERIFY_REASON.KEY_NOT_FOUND };
}
if (keyEntry.revoked_at) {
  return { valid: false, error: VERIFY_REASON.KEY_REVOKED };
}
```

**Test:** Hardening drill scenario 4 (revoked key) → HALT

---

## Evidence Traceability

Every rejection produces:

1. **Reason code** (`VERIFY_REASON.*`)
2. **Note** (human-readable explanation)
3. **Item ID** (for audit trail)
4. **Lane** (for cross-lane debugging)
5. **Timestamp** (in quarantine log)

**Log location:** `S:/Archivist-Agent/logs/quarantine.log`

---

## Gate Status

| Requirement | Status |
|-------------|--------|
| Malformed JWS structured rejection | ✅ Complete |
| No fallback path re-accepts | ✅ Complete |
| Revoked keys rejected | ✅ Complete |
| Lane/key-id mismatch enforced | ✅ Complete |
| Hardening drill passes | ✅ 4/4 scenarios |

---

Last updated: 2026-04-19
