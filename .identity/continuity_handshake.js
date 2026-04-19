/**
 * continuity_handshake.js - Agent Identity Layer Handshake
 * 
 * Verifies that a new model instance matches the persisted identity snapshot.
 * Implements the invariant: A (runtime) = B (snapshot) = C (trust store)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_REPO_ROOT = 'S:/Archivist-Agent';
const SNAPSHOT_PATH = process.env.IDENTITY_SNAPSHOT_PATH || 'S:/Archivist-Agent/.identity/snapshot.json';
const TRUST_STORE_PATH = process.env.TRUST_STORE_PATH || 'S:/Archivist-Agent/.trust/keys.json';
const SESSION_MODE_FILE = '.session-mode';

/**
 * Detects runtime lane from environment or session file.
 * Priority: LANE_ID env var > .session-mode file > error
 * 
 * @param {string} repoRoot - Repository root path
 * @returns {string|null} Detected lane or null
 */
function detectLane(repoRoot = DEFAULT_REPO_ROOT) {
  // Priority 1: Environment variable
  if (process.env.LANE_ID) {
    return process.env.LANE_ID;
  }
  
  // Priority 2: Session mode file
  const sessionModePath = path.join(repoRoot, SESSION_MODE_FILE);
  try {
    if (fs.existsSync(sessionModePath)) {
      const content = fs.readFileSync(sessionModePath, 'utf8').trim();
      if (content && ['archivist', 'swarmmind', 'library'].includes(content)) {
        return content;
      }
    }
  } catch (e) {
    // Ignore read errors
  }
  
  return null;
}

/**
 * Gets runtime lane with fallback to detection.
 * 
 * @param {string} explicitLane - Explicitly provided lane
 * @param {string} repoRoot - Repository root for detection
 * @returns {string} Runtime lane
 */
function getRuntimeLane(explicitLane, repoRoot = DEFAULT_REPO_ROOT) {
  if (explicitLane) return explicitLane;
  
  const detected = detectLane(repoRoot);
  if (!detected) {
    throw new Error('LANE_NOT_DETECTED: Set LANE_ID env var or create .session-mode file');
  }
  
  return detected;
}

/**
 * Performs continuity handshake between runtime, snapshot, and trust store.
 * 
 * @param {string} runtimeLane - Lane declared by current model instance
 * @returns {object} Handshake result
 */
function continuityHandshake(runtimeLane) {
  // A: Runtime lane (from environment or config)
  const A = runtimeLane;
  
  // B: Snapshot lane (from persisted identity)
  let snapshot;
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      return { 
        valid: false, 
        error: 'SNAPSHOT_NOT_FOUND',
        message: 'No identity snapshot found. Create one to establish identity.',
        recovery: 'Run: node scripts/create-identity-snapshot.js --lane ' + runtimeLane
      };
    }
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch (e) {
    return { 
      valid: false, 
      error: 'INVALID_SNAPSHOT',
      message: 'Snapshot file is corrupted or invalid JSON.',
      recovery: 'Restore from archive: .identity/archive/'
    };
  }
  
  const B = snapshot?.identity?.lane;
  if (!B) {
    return { 
      valid: false, 
      error: 'INVALID_SNAPSHOT',
      message: 'Snapshot missing identity.lane field.'
    };
  }
  
  // C: Trust store lane (from key registration)
  let trustStore;
  try {
    if (!fs.existsSync(TRUST_STORE_PATH)) {
      return { 
        valid: false, 
        error: 'TRUST_STORE_NOT_FOUND',
        message: 'Trust store not found.'
      };
    }
    trustStore = JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));
  } catch (e) {
    return { 
      valid: false, 
      error: 'INVALID_TRUST_STORE',
      message: 'Trust store file is corrupted.'
    };
  }
  
  const registeredLanes = Object.keys(trustStore.keys || {});
  const C = registeredLanes.includes(A) ? A : null;
  
  // Invariant: A = B = C
  if (A !== B) {
    return {
      valid: false,
      error: 'IDENTITY_MISMATCH',
      details: {
        runtime_lane: A,
        snapshot_lane: B,
        message: `Runtime lane (${A}) does not match snapshot lane (${B})`
      },
      recovery: 'Either: (1) Update snapshot with new lane, or (2) Switch to correct lane'
    };
  }
  
  if (!C) {
    return {
      valid: false,
      error: 'TRUST_MISMATCH',
      details: {
        lane: A,
        registered_lanes: registeredLanes,
        message: `Lane (${A}) is not registered in trust store`
      },
      recovery: 'Register lane in trust store or switch to registered lane'
    };
  }
  
  // Success: A = B = C
  return {
    valid: true,
    identity: snapshot.identity,
    invariants: snapshot.invariants,
    open_loops: snapshot.open_loops,
    goals: snapshot.goals,
    trust_state: snapshot.trust_state,
    context_fingerprint: snapshot.context_fingerprint,
    handshake: {
      runtime_lane: A,
      snapshot_lane: B,
      trust_lane: C,
      verified_at: new Date().toISOString()
    }
  };
}

/**
 * Saves current state to identity snapshot.
 * 
 * @param {object} updates - Partial snapshot updates
 * @returns {object} Save result
 */
function saveSnapshot(updates = {}) {
  let snapshot;
  
  try {
    if (fs.existsSync(SNAPSHOT_PATH)) {
      snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    } else {
      snapshot = { version: '1.0', identity: {}, invariants: [], open_loops: [], goals: [], trust_state: {}, context_fingerprint: {} };
    }
  } catch (e) {
    snapshot = { version: '1.0', identity: {}, invariants: [], open_loops: [], goals: [], trust_state: {}, context_fingerprint: {} };
  }
  
  // Merge updates
  if (updates.identity) snapshot.identity = { ...snapshot.identity, ...updates.identity };
  if (updates.invariants) snapshot.invariants = updates.invariants;
  if (updates.open_loops) snapshot.open_loops = updates.open_loops;
  if (updates.goals) snapshot.goals = updates.goals;
  if (updates.trust_state) snapshot.trust_state = { ...snapshot.trust_state, ...updates.trust_state };
  if (updates.context_fingerprint) {
    snapshot.context_fingerprint = {
      files_read: [...new Set([...(snapshot.context_fingerprint.files_read || []), ...(updates.context_fingerprint.files_read || [])])],
      key_decisions: [...(snapshot.context_fingerprint.key_decisions || []), ...(updates.context_fingerprint.key_decisions || [])],
      last_activity: updates.context_fingerprint.last_activity || new Date().toISOString()
    };
  }
  
  // Update timestamp
  snapshot.identity.last_updated = new Date().toISOString();
  
  try {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
    return { success: true, snapshot };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Archives current snapshot with timestamp.
 */
function archiveSnapshot() {
  const timestamp = new Date().toISOString().split('T')[0];
  const archiveDir = path.join(path.dirname(SNAPSHOT_PATH), 'archive');
  const archivePath = path.join(archiveDir, `snapshot-${timestamp}.json`);
  
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  if (fs.existsSync(SNAPSHOT_PATH)) {
    fs.copyFileSync(SNAPSHOT_PATH, archivePath);
    return { success: true, archivePath };
  }
  
  return { success: false, error: 'No snapshot to archive' };
}

module.exports = {
  continuityHandshake,
  saveSnapshot,
  archiveSnapshot,
  detectLane,
  getRuntimeLane,
  SNAPSHOT_PATH,
  TRUST_STORE_PATH,
  DEFAULT_REPO_ROOT,
  SESSION_MODE_FILE
};
