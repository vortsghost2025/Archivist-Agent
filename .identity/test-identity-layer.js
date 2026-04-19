/**
 * test-identity-layer.js - Agent Identity Layer Tests v0.2
 *
 * Tests for signed identity snapshot verification.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const IDENTITY_DIR = path.join(__dirname);
const SNAPSHOT_PATH = path.join(IDENTITY_DIR, 'snapshot.json');
const SNAPSHOT_JWS_PATH = path.join(IDENTITY_DIR, 'snapshot.jws');
const TRUST_STORE_PATH = path.join(__dirname, '..', '.trust', 'keys.json');
const REVOCATIONS_PATH = path.join(IDENTITY_DIR, 'revocations.json');

const { continuityHandshake, detectLane, getRuntimeLane } = require('./continuity_handshake');
const { IDENTITY_REASON } = require('./identity_reasons');
const { verifySnapshotJws, stableStringify, base64UrlDecode } = require('./identity_signer');

console.log('=== Agent Identity Layer Tests v0.2 ===\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${e.message}\n`);
    failed++;
  }
}

runTest('Test 1: Valid signed handshake for archivist lane', () => {
  const result = continuityHandshake('archivist');
  assert.strictEqual(result.valid, true, 'Archivist handshake should succeed');
  assert.strictEqual(result.identity.lane, 'archivist', 'Lane should be archivist');
  assert.ok(result.invariants, 'Should have invariants');
  assert.ok(result.goals, 'Should have goals');
  assert.ok(result.handshake, 'Should have handshake details');
  assert.strictEqual(result.handshake.runtime_lane, 'archivist');
  assert.strictEqual(result.handshake.snapshot_lane, 'archivist');
  assert.ok(result.handshake.verified_at, 'Should have verification timestamp');
});

runTest('Test 2: Invalid handshake for wrong lane', () => {
  const result = continuityHandshake('swarmmind');
  assert.strictEqual(result.valid, false, 'SwarmMind handshake should fail');
  assert.strictEqual(result.error, IDENTITY_REASON.IDENTITY_MISMATCH);
});

runTest('Test 3: Snapshot has v0.2 required fields', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  assert.ok(snapshot.identity, 'Should have identity');
  assert.ok(snapshot.identity.issued_by, 'Should have issued_by');
  assert.ok(snapshot.identity.key_id, 'Should have key_id');
  assert.ok(snapshot.identity.expires_at, 'Should have expires_at');
  assert.strictEqual(snapshot.identity.issued_by, 'archivist', 'Self-issued');
});

runTest('Test 4: JWS file exists', () => {
  assert.ok(fs.existsSync(SNAPSHOT_JWS_PATH), 'snapshot.jws should exist');
  const jws = fs.readFileSync(SNAPSHOT_JWS_PATH, 'utf8').trim();
  const parts = jws.split('.');
  assert.strictEqual(parts.length, 3, 'JWS should have 3 parts');
});

runTest('Test 5: JWS header is valid', () => {
  const jws = fs.readFileSync(SNAPSHOT_JWS_PATH, 'utf8').trim();
  const parts = jws.split('.');
  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  assert.strictEqual(header.alg, 'RS256', 'Algorithm should be RS256');
  assert.strictEqual(header.typ, 'JWS', 'Type should be JWS');
  assert.ok(header.kid, 'Should have key ID');
});

runTest('Test 6: JWS verifies with trust store public key', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const jws = fs.readFileSync(SNAPSHOT_JWS_PATH, 'utf8').trim();
  const trustStore = JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));

  const issuer = snapshot.identity.issued_by;
  const issuerEntry = trustStore.keys[issuer];
  assert.ok(issuerEntry, `Trust store should have entry for ${issuer}`);

  const result = verifySnapshotJws(jws, issuerEntry.public_key_pem, snapshot);
  assert.strictEqual(result.valid, true, 'JWS should verify: ' + (result.error || 'OK'));
});

runTest('Test 7: Key ID matches trust store', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const trustStore = JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));
  const archivistEntry = trustStore.keys.archivist;

  assert.strictEqual(
    snapshot.identity.key_id,
    archivistEntry.key_id,
    'Key ID should match trust store'
  );
});

runTest('Test 8: Revocations file is valid', () => {
  const revocations = JSON.parse(fs.readFileSync(REVOCATIONS_PATH, 'utf8'));
  assert.ok(Array.isArray(revocations.revoked_snapshots), 'Should have revoked_snapshots array');
  assert.ok(Array.isArray(revocations.revoked_keys), 'Should have revoked_keys array');
});

runTest('Test 9: Snapshot not expired', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const expiresAt = new Date(snapshot.identity.expires_at);
  const now = new Date();
  assert.ok(expiresAt > now, 'Snapshot should not be expired');
});

runTest('Test 10: Lane detection from .session-mode', () => {
  const detected = detectLane();
  assert.ok(detected === 'archivist' || detected === 'swarmmind' || detected === 'library', 
    'Lane should be detected from .session-mode or env');
});

runTest('Test 11: Invariant chain preserved', () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const trustStore = JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));

  const A = 'archivist';
  const B = snapshot.identity.lane;
  const C = Object.keys(trustStore.keys).includes(A) ? A : null;

  assert.strictEqual(A, B, 'A (runtime) should equal B (snapshot)');
  assert.strictEqual(A, C, 'A (runtime) should equal C (trust store)');
});

runTest('Test 12: Goals loaded correctly', () => {
  const result = continuityHandshake('archivist');
  assert.ok(Array.isArray(result.goals), 'Goals should be array');
  assert.ok(result.goals.length > 0, 'Should have at least one goal');
  assert.ok(result.goals.some(g => g.status === 'active'), 'Should have active goal');
});

runTest('Test 13: Context fingerprint exists', () => {
  const result = continuityHandshake('archivist');
  assert.ok(result.context_fingerprint, 'Should have context fingerprint');
  assert.ok(Array.isArray(result.context_fingerprint.files_read), 'Should have files_read');
  assert.ok(Array.isArray(result.context_fingerprint.key_decisions), 'Should have key_decisions');
});

console.log('========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\n=== ALL IDENTITY LAYER TESTS PASSED ===');
}
