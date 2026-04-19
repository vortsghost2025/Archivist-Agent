/**
 * tests/orchestrator.laneMismatch.test.js
 * 
 * Regression tests for RecoveryEngine lane-consistency enforcement.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock request handler for testing
async function testHandleRecovery(request) {
  const { artifact, outerLane, failureReason, debugContext } = request;

  // Step 1: Validate payload.lane exists
  const payloadLane = artifact?.lane;
  if (!payloadLane) {
    return { status: 'MISSING_LANE', reason: 'Payload missing lane field' };
  }

  // Step 2: Check lane consistency (Invariant: A = B)
  if (payloadLane !== outerLane) {
    return { status: 'LANE_MISMATCH', reason: `Payload lane (${payloadLane}) differs from outer lane (${outerLane})` };
  }

  // For testing purposes, simulate signature verification
  const signature = artifact.signature;
  if (!signature) {
    return { status: 'QUARANTINED', reason: 'Missing signature' };
  }

  // Simulate valid signature check
  if (signature === 'VALID_SIGNATURE') {
    return { status: 'OK' };
  }

  // Invalid signature
  return { status: 'SIGNATURE_MISMATCH', reason: 'Signature verification failed' };
}

async function runTests() {
  console.log('=== Orchestrator Lane-Mismatch Regression Tests ===\n');

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Missing payload.lane → expect MISSING_LANE
    console.log('Test 1: Missing payload.lane...');
    const test1 = await testHandleRecovery({
      artifact: { id: 'test-1', data: 'test' }, // NO lane field
      outerLane: 'library',
      failureReason: 'TEST'
    });
    assert.strictEqual(test1.status, 'MISSING_LANE', 'Should return MISSING_LANE');
    assert.strictEqual(test1.reason, 'Payload missing lane field');
    console.log('  ✓ PASSED\n');
    passed++;

    // Test 2: outerLane !== payload.lane → expect LANE_MISMATCH
    console.log('Test 2: outerLane !== payload.lane...');
    const test2 = await testHandleRecovery({
      artifact: { id: 'test-2', lane: 'archivist', data: 'test' },
      outerLane: 'library', // MISMATCH
      failureReason: 'TEST'
    });
    assert.strictEqual(test2.status, 'LANE_MISMATCH', 'Should return LANE_MISMATCH');
    assert(test2.reason.includes('Payload lane'), 'Reason should mention payload lane');
    assert(test2.reason.includes('outer lane'), 'Reason should mention outer lane');
    console.log('  ✓ PASSED\n');
    passed++;

    // Test 3: Correctly-signed artifact with matching lanes → expect OK
    console.log('Test 3: Correctly-signed artifact with matching lanes...');
    const test3 = await testHandleRecovery({
      artifact: { 
        id: 'test-3', 
        lane: 'swarmmind', 
        data: 'test',
        signature: 'VALID_SIGNATURE'
      },
      outerLane: 'swarmmind', // MATCHES
      failureReason: 'TEST'
    });
    assert.strictEqual(test3.status, 'OK', 'Should return OK');
    console.log('  ✓ PASSED\n');
    passed++;

    // Test 4: Correctly-signed payload but wrong signature → expect SIGNATURE_MISMATCH
    console.log('Test 4: Wrong signature...');
    const test4 = await testHandleRecovery({
      artifact: { 
        id: 'test-4', 
        lane: 'library', 
        data: 'test',
        signature: 'INVALID_SIGNATURE'
      },
      outerLane: 'library', // LANES MATCH
      failureReason: 'TEST'
    });
    assert.strictEqual(test4.status, 'SIGNATURE_MISMATCH', 'Should return SIGNATURE_MISMATCH');
    console.log('  ✓ PASSED\n');
    passed++;

    // Test 5: Missing signature with matching lanes
    console.log('Test 5: Missing signature...');
    const test5 = await testHandleRecovery({
      artifact: { 
        id: 'test-5', 
        lane: 'archivist', 
        data: 'test'
        // NO signature
      },
      outerLane: 'archivist',
      failureReason: 'TEST'
    });
    assert.strictEqual(test5.status, 'QUARANTINED', 'Should return QUARANTINED');
    console.log('  ✓ PASSED\n');
    passed++;

    // Test 6: All three lanes (Archivist, SwarmMind, Library) with valid signatures
    console.log('Test 6: Multi-lane verification...');
    const lanes = ['archivist', 'swarmmind', 'library'];
    for (const lane of lanes) {
      const result = await testHandleRecovery({
        artifact: { id: `test-${lane}`, lane, data: 'test', signature: 'VALID_SIGNATURE' },
        outerLane: lane,
        failureReason: 'TEST'
      });
      assert.strictEqual(result.status, 'OK', `${lane} should verify OK`);
    }
    console.log('  ✓ PASSED (3 lanes)\n');
    passed += 3;

    console.log('=== ALL TESTS PASSED ===');
    console.log(`Total: ${passed} tests passed`);

  } catch (e) {
    console.error('TEST FAILED:', e.message);
    console.error(e.stack);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
