/**
* Verifier.js - Phase 4.3 JWS Verification
*
* Verifies JSON Web Signatures against public keys from trust store.
* ENFORCEMENT: JWS-only, A = B = C lane consistency check
*/

const crypto = require('crypto');
const fs = require('fs');
const { TRUST_STORE_PATH, TRUST_STORE_VERSION, VERIFY_REASON } = require('./constants');
const { stableStringify } = require('./stableStringify');

class Verifier {
  constructor(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'allowLegacy')) {
      throw new Error('allowLegacy is removed: JWS-only enforcement is mandatory');
    }
    if (Object.prototype.hasOwnProperty.call(options, 'hmacCutoffDate')) {
      throw new Error('hmacCutoffDate is removed: HMAC fallback is disabled');
    }
    this.trustStorePath = options.trustStorePath || TRUST_STORE_PATH;
    this.trustStore = null;
    this._loadTrustStore();
  }

_defaultTrustStorePath() {
return TRUST_STORE_PATH;
}

  _loadTrustStore() {
    if (!fs.existsSync(this.trustStorePath)) {
      this.trustStore = { keys: {}, migration: {} };
      return;
    }
    try {
      const raw = fs.readFileSync(this.trustStorePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Normalize trust store format: support both nested { keys: {...} } and
      // flat { laneId: {...} } formats (broadcast trust store uses flat format)
      if (parsed.keys && typeof parsed.keys === 'object') {
        this.trustStore = parsed;
      } else {
        // Flat format: lane IDs are top-level keys
        this.trustStore = { keys: {}, migration: {} };
        for (const [laneId, entry] of Object.entries(parsed)) {
          if (entry && typeof entry === 'object' && entry.public_key_pem) {
            this.trustStore.keys[laneId] = entry;
          }
        }
      }

      // Schema version check (only if explicitly set)
      if (this.trustStore.version && this.trustStore.version !== TRUST_STORE_VERSION) {
        throw new Error(`Trust store version mismatch: expected ${TRUST_STORE_VERSION}, got ${this.trustStore.version}`);
      }

      // Ensure migration object exists
      if (!this.trustStore.migration) {
        this.trustStore.migration = {};
      }
    } catch (e) {
      if (e.message.includes('version') || e.message.includes('missing')) {
        throw e;
      }
      this.trustStore = { keys: {}, migration: {} };
    }
  }

reloadTrustStore() {
this._loadTrustStore();
}

_base64UrlDecode(str) {
let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
while (base64.length % 4) {
base64 += '=';
}
return Buffer.from(base64, 'base64');
}

_parseJWS(jws) {
const parts = jws.split('.');
if (parts.length !== 3) {
return null;
}
return {
header: JSON.parse(this._base64UrlDecode(parts[0]).toString('utf8')),
payload: JSON.parse(this._base64UrlDecode(parts[1]).toString('utf8')),
signature: parts[2],
signingInput: `${parts[0]}.${parts[1]}`
};
}

getPublicKey(laneId) {
const keyEntry = this.trustStore.keys?.[laneId];
if (!keyEntry) return null;
if (keyEntry.revoked_at) return null;
return keyEntry.public_key_pem;
}

verify(jws, publicKey) {
try {
const parsed = this._parseJWS(jws);
if (!parsed) return { valid: false, error: VERIFY_REASON.SIGNATURE_MISMATCH };

if (parsed.header.alg !== 'RS256') {
return { valid: false, error: VERIFY_REASON.UNSUPPORTED_ALGORITHM };
}

if (parsed.payload.exp && parsed.payload.exp < Math.floor(Date.now() / 1000)) {
return { valid: false, error: 'SIGNATURE_EXPIRED' };
}

const signature = this._base64UrlDecode(parsed.signature);
const keyObject = crypto.createPublicKey(publicKey);
const verified = crypto.verify(
  'RSA-SHA256',
  Buffer.from(parsed.signingInput),
  keyObject,
  signature
);

if (!verified) {
return { valid: false, error: VERIFY_REASON.SIGNATURE_MISMATCH };
}

return { valid: true, payload: parsed.payload, header: parsed.header };
} catch (e) {
return { valid: false, error: VERIFY_REASON.VERIFICATION_ERROR, message: e.message };
}
}

/**
* Verify JWS against trust store with lane consistency enforcement.
* Enforces: outer lane (A) = payload.lane (B) = signed identity (C)
*
* @param {string} jws - The JWS string to verify
* @param {string} laneId - The expected lane identity (outer lane)
* @returns {object} Verification result
*/
verifyAgainstTrustStore(jws, laneId) {
  // Step 1: Parse JWS to extract payload (with structured error handling)
  let parsed;
  try {
    parsed = this._parseJWS(jws);
  } catch (e) {
    return { valid: false, error: VERIFY_REASON.SIGNATURE_MISMATCH, note: `JWS parse error: ${e.message}` };
  }
  if (!parsed) {
    return { valid: false, error: VERIFY_REASON.SIGNATURE_MISMATCH };
  }

// Step 2: Check lane field presence
if (!parsed.payload.lane) {
return { valid: false, error: VERIFY_REASON.MISSING_LANE };
}

// Step 3: Enforce A = B = C invariant
if (parsed.payload.lane !== laneId) {
return {
valid: false,
error: VERIFY_REASON.LANE_MISMATCH,
note: `payload lane (${parsed.payload.lane}) differs from outer lane (${laneId})`
};
}

// Step 4: Fetch public key
const publicKey = this.getPublicKey(laneId);
if (!publicKey) {
return { valid: false, error: VERIFY_REASON.KEY_NOT_FOUND };
}

// Step 5: Crypto verification
return this.verify(jws, publicKey);
}

/**
* Normalize legacy queue item with origin_lane field.
* If item has origin_lane but no lane, copy it.
* If both exist and differ, reject.
*
* @param {object} item - Queue item to normalize
* @returns {object} Normalized item
* @throws {Error} If lane fields conflict
*/
_normalizeLaneField(item) {
if (item.lane && item.origin_lane && item.lane !== item.origin_lane) {
throw new Error(`Lane field conflict: lane="${item.lane}" vs origin_lane="${item.origin_lane}"`);
}

if (!item.lane && item.origin_lane) {
item.lane = item.origin_lane;
}

return item;
}

verifyQueueItem(item) {
// Normalize legacy field
try {
item = this._normalizeLaneField(item);
} catch (e) {
return { valid: false, error: VERIFY_REASON.LANE_MISMATCH, note: e.message };
}

if (!item.signature) {
// HMAC fallback removed - enforce JWS-only
return { valid: false, error: VERIFY_REASON.MISSING_SIGNATURE, note: 'HMAC fallback removed - SIGNATURE_REQUIRED' };
}

const laneId = item.lane || item.origin_lane;
if (!laneId) {
return { valid: false, error: VERIFY_REASON.MISSING_LANE };
}

const result = this.verifyAgainstTrustStore(item.signature, laneId);

if (result.valid) {
return { ...result, mode: 'JWS_VERIFIED' };
}

return result;
}

  verifyAuditEvent(event) {
    if (!event.signature) {
      return { valid: false, error: VERIFY_REASON.MISSING_SIGNATURE };
    }

const laneId = event.lane;
if (!laneId) {
return { valid: false, error: VERIFY_REASON.MISSING_LANE };
}

return this.verifyAgainstTrustStore(event.signature, laneId);
}

// HMAC acceptance check removed - JWS-only enforcement
// Migration status getter removed - migration complete

getTrustStoreStats() {
const lanes = Object.keys(this.trustStore.keys || {});
const registered = lanes.filter(l => this.trustStore.keys[l]?.public_key_pem?.startsWith('-----BEGIN'));
const pending = lanes.filter(l => this.trustStore.keys[l]?.public_key_pem === 'PENDING_GENERATION');
const revoked = lanes.filter(l => this.trustStore.keys[l]?.revoked_at);

return {
total_lanes: lanes.length,
registered: registered.length,
pending: pending.length,
revoked: revoked.length,
registered_lanes: registered,
pending_lanes: pending
};
}

// HMAC verification removed - JWS-only enforcement active

/**
* Add a trusted key at runtime (for dynamic trust updates, e.g., self-verification)
* Does NOT persist to trust store file.
* @param {string} laneId
* @param {string} publicKeyPem
* @param {string} [keyId]
*/
addTrustedKey(laneId, publicKeyPem, keyId) {
if (!this.trustStore.keys) this.trustStore.keys = {};
this.trustStore.keys[laneId] = {
public_key_pem: publicKeyPem,
key_id: keyId || null,
registered_at: new Date().toISOString(),
revoked_at: null
};
}
}

module.exports = { Verifier };
