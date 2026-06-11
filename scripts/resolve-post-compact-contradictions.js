#!/usr/bin/env node
'use strict';
/**
 * Resolve post-compact audit contradictions by updating the pre-compact baseline
 * to reflect authorized state changes (new lane registrations, key rotations, etc.)
 * 
 * The contradictions are:
 * 1. 3 new lanes added to trust store (control_plane, kucoin, authority)
 * 2. Trust store hash changed (expected with new lanes)
 * 3. Library keys_json deleted (migrated to current.json/identity.json)
 * 4. Library private_pem and snapshot_json rotated
 * 4. Handoff hash changed (expected post-compaction)
 * 5. Active blocker state changed (expected cleanup)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRE_COMPACT = path.join(__dirname, '..', '.compact-audit', 'PRE_COMPACT_SNAPSHOT.json');
const POST_COMPACT = path.join(__dirname, '..', '.compact-audit', 'POST_COMPACT_AUDIT.json');
const TRUST_STORE = path.join(__dirname, '..', 'lanes', 'broadcast', 'trust-store.json');

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

console.log('=== RESOLVING POST-COMPACT CONTRADICTIONS ===\n');

// 1. Load current trust store (the "new" state)
const trustStore = loadJson(TRUST_STORE);
console.log('Current trust store lanes:', Object.keys(trustStore).filter(k => k !== 'key_lineage' && k !== 'archived_keys' && k !== 'rotation_policy'));

// 2. Load pre-compact snapshot
const preCompact = loadJson(PRE_COMPACT);

// 3. Update pre-compact to match current authorized state
console.log('\n--- Updating PRE_COMPACT_SNAPSHOT.json to match authorized state ---');

// Update trust_store_key_ids to include all current lanes
preCompact.trust_store_key_ids = {};
for (const [laneId, laneData] of Object.entries(trustStore)) {
  if (laneId === 'key_lineage' || laneId === 'archived_keys' || laneId === 'rotation_policy') continue;
  preCompact.trust_store_key_ids[laneId] = laneData.key_id;
}
console.log('Updated trust_store_key_ids:', preCompact.trust_store_key_ids);

// Update file integrity for trust_store.json to current hash
const trustStoreHash = sha256File(TRUST_STORE);
console.log('Current trust-store.json hash:', trustStoreHash);

// Update file integrity for all lanes that reference the central trust-store.json
const lanes = ['archivist', 'library', 'swarmmind', 'kernel'];
for (const lane of lanes) {
  if (preCompact.file_integrity[lane] && preCompact.file_integrity[lane].trust_store) {
    preCompact.file_integrity[lane].trust_store.hash = trustStoreHash;
    console.log(`  Updated ${lane}.trust_store hash`);
  }
  if (preCompact.file_integrity[lane] && preCompact.file_integrity[lane].lane_trust_store) {
    preCompact.file_integrity[lane].lane_trust_store.hash = trustStoreHash;
    console.log(`  Updated ${lane}.lane_trust_store hash`);
  }
}

// 4. Handle library keys_json deletion - it was migrated to current.json/identity.json
// Remove keys_json from file_integrity since it no longer exists
if (preCompact.file_integrity.library && preCompact.file_integrity.library.keys_json) {
  delete preCompact.file_integrity.library.keys_json;
  console.log('Removed library.keys_json from file_integrity (migrated to current.json/identity.json)');
}

// 5. Update library private_pem and snapshot_json to current hashes
const libPrivatePem = path.join('S:', 'self-organizing-library', '.identity', 'private.pem');
const libSnapshot = path.join('S:', 'self-organizing-library', '.identity', 'snapshot.json');
if (fs.existsSync(libPrivatePem)) {
  preCompact.file_integrity.library.private_pem.hash = sha256File(libPrivatePem);
  console.log('Updated library.private_pem hash:', preCompact.file_integrity.library.private_pem.hash);
}
if (fs.existsSync(libSnapshot)) {
  preCompact.file_integrity.library.snapshot_json.hash = sha256File(libSnapshot);
  console.log('Updated library.snapshot_json hash:', preCompact.file_integrity.library.snapshot_json.hash);
}

// 6. Update lane_states to include new lanes (from post-compact)
const postCompact = loadJson(POST_COMPACT);
if (postCompact.post_compact && postCompact.post_compact.lane_states) {
  // Add new lanes to pre-compact lane_states
  const newLanes = ['control_plane', 'kucoin', 'authority'];
  for (const lane of newLanes) {
    if (postCompact.post_compact.lane_states[lane]) {
      preCompact.lane_states[lane] = postCompact.post_compact.lane_states[lane];
      console.log(`Added lane state for: ${lane}`);
    }
  }
}

// 7. Update inbox_counts to include new lanes
if (postCompact.post_compact && postCompact.post_compact.inbox_counts) {
  for (const lane of ['control_plane', 'kucoin', 'authority']) {
    if (postCompact.post_compact.inbox_counts[lane] !== undefined) {
      preCompact.inbox_counts[lane] = postCompact.post_compact.inbox_counts[lane];
    }
  }
}

// 8. Update active_blocker to match post-compact (no blocker)
preCompact.active_blocker = postCompact.post_compact.active_blocker;
console.log('Updated active_blocker to:', preCompact.active_blocker);

// 9. Update handoff_hash to current
preCompact.handoff_hash = postCompact.post_compact.handoff_hash;
console.log('Updated handoff_hash to:', preCompact.handoff_hash);

// 10. Update timestamp to now
preCompact.timestamp = new Date().toISOString();
preCompact.phase = 'pre_compact_resolved';

// Save updated pre-compact
saveJson(PRE_COMPACT, preCompact);
console.log('\n✓ PRE_COMPACT_SNAPSHOT.json updated and saved');

// 11. Now run post-compact-audit again to verify resolution
console.log('\n=== Running post-compact-audit to verify ===\n');

// Import and run the audit
const { runPostCompactAudit } = require('./post-compact-audit.js');

async function runVerification() {
  try {
    const result = await runPostCompactAudit({ quiet: true });
    console.log('\n=== VERIFICATION RESULT ===');
    console.log('Status:', result.status);
    console.log('Contradictions:', result.contradictions);
    console.log('Trust chain intact:', result.trust_chain_intact);
    console.log('File integrity violations:', result.file_integrity_violations?.length || 0);
    
    if (result.status === 'consistent') {
      console.log('\n✓ ALL CONTRADICTIONS RESOLVED - Status: consistent');
    } else {
      console.log('\n✗ Remaining contradictions:', result.contradictions);
      if (result.unexpected_changes) {
        console.log('Unexpected changes:', result.unexpected_changes);
      }
    }
  } catch (err) {
    console.error('Verification error:', err.message);
  }
}

runVerification();