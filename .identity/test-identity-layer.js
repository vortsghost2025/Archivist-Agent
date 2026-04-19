/**
 * test-identity-layer.js - Agent Identity Layer Tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { continuityHandshake, saveSnapshot, archiveSnapshot, SNAPSHOT_PATH } = require('./continuity_handshake');

console.log('=== Agent Identity Layer Tests ===\n');

let passed = 0;
let failed = 0;

try {
  // Test 1: Valid handshake for archivist lane
  console.log('Test 1: Valid handshake for archivist lane...');
  const result1 = continuityHandshake('archivist');
  console.log('  Result:', JSON.stringify(result1, null, 2));
  assert.strictEqual(result1.valid, true, 'Archivist handshake should succeed');
  assert.strictEqual(result1.identity.lane, 'archivist', 'Lane should be archivist');
  assert.ok(result1.invariants, 'Should have invariants');
  assert.ok(result1.goals, 'Should have goals');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 2: Invalid handshake for wrong lane
  console.log('Test 2: Invalid handshake for wrong lane...');
  const result2 = continuityHandshake('swarmmind');
  assert.strictEqual(result2.valid, false, 'SwarmMind handshake should fail (wrong snapshot lane)');
  assert.strictEqual(result2.error, 'IDENTITY_MISMATCH', 'Should be IDENTITY_MISMATCH');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 3: Invalid handshake for unregistered lane
  console.log('Test 3: Invalid handshake for unregistered lane...');
  const result3 = continuityHandshake('unknown_lane');
  assert.strictEqual(result3.valid, false, 'Unknown lane should fail');
  assert.strictEqual(result3.error, 'IDENTITY_MISMATCH', 'Should be IDENTITY_MISMATCH');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 4: Invariant check
  console.log('Test 4: Invariant A = B = C verification...');
  const result4 = continuityHandshake('archivist');
  assert.ok(result4.handshake, 'Should have handshake details');
  assert.strictEqual(result4.handshake.runtime_lane, 'archivist', 'A = archivist');
  assert.strictEqual(result4.handshake.snapshot_lane, 'archivist', 'B = archivist');
  assert.strictEqual(result4.handshake.trust_lane, 'archivist', 'C = archivist');
  console.log('  ✓ PASSED (A = B = C verified)\n');
  passed++;

  // Test 5: Goals loaded
  console.log('Test 5: Goals loaded from snapshot...');
  const result5 = continuityHandshake('archivist');
  assert.ok(Array.isArray(result5.goals), 'Goals should be array');
  assert.ok(result5.goals.length > 0, 'Should have at least one goal');
  assert.ok(result5.goals.some(g => g.status === 'active'), 'Should have active goal');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 6: Open loops loaded
  console.log('Test 6: Open loops loaded from snapshot...');
  const result6 = continuityHandshake('archivist');
  assert.ok(Array.isArray(result6.open_loops), 'Open loops should be array');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 7: Context fingerprint exists
  console.log('Test 7: Context fingerprint exists...');
  const result7 = continuityHandshake('archivist');
  assert.ok(result7.context_fingerprint, 'Should have context fingerprint');
  assert.ok(Array.isArray(result7.context_fingerprint.files_read), 'Should have files_read');
  assert.ok(Array.isArray(result7.context_fingerprint.key_decisions), 'Should have key_decisions');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 8: saveSnapshot updates correctly
  console.log('Test 8: saveSnapshot updates correctly...');
  const saveResult = saveSnapshot({
    context_fingerprint: {
      files_read: ['test-file.js'],
      key_decisions: ['Test decision'],
      last_activity: new Date().toISOString()
    }
  });
  assert.strictEqual(saveResult.success, true, 'Save should succeed');
  
  // Verify save
  const result8 = continuityHandshake('archivist');
  assert.ok(result8.context_fingerprint.files_read.includes('test-file.js'), 'File should be in files_read');
  console.log('  ✓ PASSED\n');
  passed++;

  // Test 9: Archive snapshot
  console.log('Test 9: Archive snapshot...');
  const archiveResult = archiveSnapshot();
  assert.strictEqual(archiveResult.success, true, 'Archive should succeed');
  console.log('  ✓ PASSED\n');
  passed++;

  console.log('=== ALL IDENTITY LAYER TESTS PASSED ===');
  console.log(`Total: ${passed} tests passed`);

} catch (e) {
  console.error('TEST FAILED:', e.message);
  console.error(e.stack);
  failed++;
}

if (failed > 0) {
  process.exit(1);
}
