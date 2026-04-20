# FreeAgent Bypass Register

Date: 2026-04-19
Phase: 3

## Purpose

Documents all potential bypass paths that have been eliminated or explicitly allowed.

---

## Eliminated Bypass Paths

### 1. HMAC Fallback (ELIMINATED)

**Original behavior:** Items with HMAC signature could be accepted during migration window.

**Elimination:**
- `Verifier.verifyHMAC()` removed
- `Verifier.isHMACAccepted()` removed  
- `Queue.js` HMAC branches removed

**Evidence:**
```bash
grep -r "verifyHMAC" src/
# Returns only comments
```

**Anchor policy:** `fallback_policy.hmac_accepted: false`

---

### 2. Recovery Override (ELIMINATED)

**Original behavior:** RecoveryEngine could potentially override local verification failure.

**Elimination:**
- `VerifierWrapper.js` logs "ignored" for recovery responses
- Local verification result is authoritative
- Recovery is informational only

**Code:**
```javascript
console.log('[RECOVERY] RecoveryEngine response ignored - local verification is authoritative');
```

**Anchor policy:** `fallback_policy.recovery_override_allowed: false`

---

### 3. Missing Signature Acceptance (ELIMINATED)

**Original behavior:** Unsigned items could be accepted in legacy mode.

**Elimination:**
- `Queue.js` throws `SIGNER_REQUIRED`
- `VerifierWrapper.js` returns `MISSING_SIGNATURE`

**Code:**
```javascript
throw new Error('SIGNER_REQUIRED: JWS signing required - HMAC fallback removed');
```

**Anchor policy:** `fallback_policy.missing_signature_mode: "REJECT"`

---

### 4. Malformed JWS Throw (ELIMINATED)

**Original behavior:** Malformed JWS could cause uncaught exception.

**Elimination:**
- `VerifierWrapper._parseJWS()` wrapped in try/catch
- Returns structured rejection instead of throwing

**Code:**
```javascript
try {
  const parsed = this._parseJWS(item.signature);
} catch (e) {
  return { valid: false, reason: 'QUARANTINED', note: 'JWS parse failed' };
}
```

**Anchor policy:** `fallback_policy.malformed_jws_mode: "QUARANTINE"`

---

## No Bypass Paths Allowed

The following patterns are **FORBIDDEN** in production phenotype:

| Pattern | Status | Consequence |
|---------|--------|-------------|
| Accepting HMAC | FORBIDDEN | Anchor validation fails |
| Recovery override | FORBIDDEN | Log warning, local result authoritative |
| Missing signature valid | FORBIDDEN | Queue throws, blocks transition |
| Uncaught JWS parse exception | FORBIDDEN | Structured rejection returned |

---

## Explicitly Allowed Paths

| Path | Condition | Status |
|------|-----------|--------|
| JWS verification | Valid signature, matching lanes | Allowed |
| Self-verification | Lane's own key in trust store | Allowed |
| Recovery notification | After local rejection | Allowed (informational only) |

---

## Verification Order Enforcement

**Critical invariant:** Lane comparison before crypto.

| Step | Check | Bypass if skipped |
|------|-------|-------------------|
| 1 | Extract outer lane | Lane mismatch could be missed |
| 2 | Parse JWS header | Malformed could throw |
| 3 | Extract payload lane | Lane mismatch could be missed |
| 4 | Compare lanes | **CRITICAL** - must happen before crypto |
| 5 | Verify crypto | Expensive, skip if lane mismatch |

**Test coverage:** `scripts/edge-case-test.js` verifies Step 4 executes before Step 5.

---

## Trust Store Bypass Prevention

### Key Revocation

**Mechanism:** `revoked_at` field in trust store

**Check order:**
1. Key exists in trust store
2. Key ID matches header
3. Key not revoked (`!revoked_at`)
4. Signature valid

**Bypass prevented:** Revoked keys cannot verify even with valid signature.

### Key ID Mismatch

**Mechanism:** `header.kid` must match `trust_store.keys[lane].key_id`

**Check:** `VerifierWrapper.js` validates key ID before signature

**Bypass prevented:** Attacker cannot reuse valid signature with different key ID.

---

## Audit Trail

All rejections logged to:
- `S:/Archivist-Agent/logs/quarantine.log` (quarantine events)
- Console output (immediate visibility)

Log format:
```json
{
  "timestamp": "2026-04-19T...",
  "itemId": "...",
  "lane": "...",
  "reason": "QUARANTINED",
  "note": "...",
  "retryCount": 1
}
```

---

Last updated: 2026-04-19
