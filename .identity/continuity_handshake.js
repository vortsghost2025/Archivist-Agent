/**
 * continuity_handshake.js v0.2 - Signed Identity Layer Handshake
 * 
 * Verifies that a new model instance matches the persisted, SIGNED identity snapshot.
 * 
 * Invariant:
 *   runtime.lane === snapshot.identity.lane
 *   AND trust_store[issued_by].key_id === snapshot.identity.key_id
 *   AND snapshot.jws verifies with issuer public key
 */

const fs = require('fs');
const path = require('path');
const { IDENTITY_REASON } = require('./identity_reasons');
const { stableStringify, base64UrlDecode } = require('./identity_signer');

const DEFAULT_REPO_ROOT = 'S:/Archivist-Agent';
const SNAPSHOT_PATH = process.env.IDENTITY_SNAPSHOT_PATH || 'S:/Archivist-Agent/.identity/snapshot.json';
const SNAPSHOT_JWS_PATH = process.env.IDENTITY_JWS_PATH || 'S:/Archivist-Agent/.identity/snapshot.jws';
const TRUST_STORE_PATH = process.env.TRUST_STORE_PATH || 'S:/Archivist-Agent/.trust/keys.json';
const REVOCATIONS_PATH = process.env.REVOCATIONS_PATH || 'S:/Archivist-Agent/.identity/revocations.json';
const SESSION_MODE_FILE = '.session-mode';

/**
 * Detects runtime lane from environment or session file.
 */
function detectLane(repoRoot = DEFAULT_REPO_ROOT) {
  if (process.env.LANE_ID) return process.env.LANE_ID;
  
  const sessionModePath = path.join(repoRoot, SESSION_MODE_FILE);
  try {
    if (fs.existsSync(sessionModePath)) {
      const content = fs.readFileSync(sessionModePath, 'utf8').trim();
      if (content) {
        // Try to parse as JSON first (new format)
        try {
          const parsed = JSON.parse(content);
          // For Archivist-Agent repository, the lane is archivist
          // regardless of what's in the mode/purpose fields
          if (repoRoot.endsWith('Archivist-Agent')) {
            return 'archivist';
          }
          // Fallback: check if mode or purpose contains lane name
          if (parsed.mode && ['archivist', 'swarmmind', 'library'].includes(parsed.mode)) {
            return parsed.mode;
          }
          if (parsed.purpose) {
            const purposeParts = parsed.purpose.split('-');
            if (purposeParts[0] && ['archivist', 'swarmmind', 'library'].includes(purposeParts[0])) {
              return purposeParts[0];
            }
          }
        } catch (e) {
          // If not JSON, treat as plain text (legacy format)
          if (content && ['archivist', 'swarmmind', 'library'].includes(content)) {
            return content;
          }
        }
      }
    }
  } catch (e) {}
  
  return null;
}

function getRuntimeLane(explicitLane, repoRoot = DEFAULT_REPO_ROOT) {
  if (explicitLane) return explicitLane;
  const detected = detectLane(repoRoot);
  if (!detected) {
    throw new Error('LANE_NOT_DETECTED: Set LANE_ID env var or create .session-mode file');
  }
  return detected;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Performs signed continuity handshake.
 * 
 * Order:
 * 1. Load snapshot.json
 * 2. Load snapshot.jws
 * 3. Parse JWS header
 * 4. Get issued_by and key_id
 * 5. Fetch issuer public key from trust store
 * 6. Verify JWS over canonical snapshot payload
 * 7. Check expiry
 * 8. Check revocation list
 * 9. Compare runtimeLane to snapshot.identity.lane
 */
function continuityHandshake(runtimeLane) {
  // Step 1: Load snapshot
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_NOT_FOUND };
  }
  
  // Step 2: Load signature
  if (!fs.existsSync(SNAPSHOT_JWS_PATH)) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_SIGNATURE_MISSING };
  }
  
  const snapshot = loadJson(SNAPSHOT_PATH);
  const jws = fs.readFileSync(SNAPSHOT_JWS_PATH, 'utf8').trim();
  
  // Step 3: Parse JWS
  const parts = jws.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: IDENTITY_REASON.INVALID_JWS_FORMAT };
  }
  
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
  const payloadRaw = base64UrlDecode(payloadB64).toString('utf8');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);
  
  // Step 4: Extract identity fields
  const snapshotLane = snapshot?.identity?.lane;
  const issuedBy = snapshot?.identity?.issued_by;
  const keyId = snapshot?.identity?.key_id;
  const identityId = snapshot?.identity?.id;
  const expiresAt = snapshot?.identity?.expires_at;
  
  if (!snapshotLane) return { valid: false, error: IDENTITY_REASON.MISSING_SNAPSHOT_LANE };
  if (!issuedBy) return { valid: false, error: IDENTITY_REASON.MISSING_ISSUER };
  if (!keyId) return { valid: false, error: IDENTITY_REASON.MISSING_KEY_ID };
  
  // Step 5: Load trust store
  if (!fs.existsSync(TRUST_STORE_PATH)) {
    return { valid: false, error: 'TRUST_STORE_NOT_FOUND' };
  }
  const trustStore = loadJson(TRUST_STORE_PATH);
  
  // Load revocations
  let revocations = { revoked_snapshots: [], revoked_keys: [] };
  if (fs.existsSync(REVOCATIONS_PATH)) {
    revocations = loadJson(REVOCATIONS_PATH);
  }
  
  // Step 5 (continued): Get issuer key
  const issuerEntry = trustStore.keys?.[issuedBy];
  if (!issuerEntry) {
    return { valid: false, error: IDENTITY_REASON.ISSUER_NOT_TRUSTED };
  }
  
  if (issuerEntry.revoked_at) {
    return { valid: false, error: IDENTITY_REASON.ISSUER_KEY_REVOKED };
  }
  
  if (issuerEntry.key_id !== keyId) {
    return { valid: false, error: IDENTITY_REASON.KEY_ID_MISMATCH };
  }
  
  // Step 6: Verify JWS signature
  const crypto = require('crypto');
  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(signingInput),
    { key: issuerEntry.public_key_pem, format: 'pem' },
    signature
  );
  
  if (!verified) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_SIGNATURE_INVALID };
  }
  
  // Verify payload matches canonical form
  const expectedPayload = stableStringify(snapshot);
  if (payloadRaw !== expectedPayload) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_PAYLOAD_MISMATCH };
  }
  
  // Step 7: Check expiry
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_EXPIRED };
  }
  
  // Step 8: Check revocation
  const snapshotRevoked = revocations.revoked_snapshots?.some(
    r => r.identity_id === identityId
  );
  if (snapshotRevoked) {
    return { valid: false, error: IDENTITY_REASON.SNAPSHOT_REVOKED };
  }
  
  const keyRevoked = revocations.revoked_keys?.some(
    r => r.lane === issuedBy && r.key_id === keyId
  );
  if (keyRevoked) {
    return { valid: false, error: IDENTITY_REASON.KEY_REVOKED };
  }
  
  // Step 9: Compare lanes
  if (runtimeLane !== snapshotLane) {
    return {
      valid: false,
      error: IDENTITY_REASON.IDENTITY_MISMATCH,
      details: {
        runtime_lane: runtimeLane,
        snapshot_lane: snapshotLane
      }
    };
  }
  
  // Success
  return {
    valid: true,
    identity: snapshot.identity,
    invariants: snapshot.invariants,
    open_loops: snapshot.open_loops,
    goals: snapshot.goals,
    trust_state: snapshot.trust_state,
    context_fingerprint: snapshot.context_fingerprint,
    handshake: {
      runtime_lane: runtimeLane,
      snapshot_lane: snapshotLane,
      issued_by: issuedBy,
      key_id: keyId,
      verified_at: new Date().toISOString()
    }
  };
}

module.exports = {
  continuityHandshake,
  detectLane,
  getRuntimeLane,
  SNAPSHOT_PATH,
  SNAPSHOT_JWS_PATH,
  TRUST_STORE_PATH,
  REVOCATIONS_PATH,
  DEFAULT_REPO_ROOT,
  SESSION_MODE_FILE
};