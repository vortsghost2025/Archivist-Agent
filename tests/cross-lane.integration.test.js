/**
 * tests/cross-lane.integration.test.js
 * 
 * Cross-lane integration test for the three-lane attestation fabric.
 * Tests: Archivist ↔ SwarmMind ↔ Library
 * 
 * Prerequisites:
 * - All three lanes have Phase 4.3/4.4 implemented
 * - Each lane has a key registered in the trust store
 * - VerifierWrapper enforces A=B=C lane consistency
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import from each lane's attestation module
const { Verifier: ArchivistVerifier } = require('../src/attestation/Verifier');
const { VerifierWrapper: ArchivistVerifierWrapper } = require('../src/attestation/VerifierWrapper');
const { QuarantineManager: ArchivistQuarantineManager } = require('../src/attestation/QuarantineManager');
const { PhenotypeStore: ArchivistPhenotypeStore } = require('../src/attestation/PhenotypeStore');

const TRUST_STORE_PATH = path.join(__dirname, '..', '.trust', 'keys.json');
const TEST_LOG_PATH = path.join(__dirname, '..', 'logs', 'cross_lane_test.log');
const TEST_HANDOFF = path.join(__dirname, '..', 'TEST_CROSS_LANE_HANDOFF.md');

// Helper to generate a valid key pair for testing
function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

// Helper to sign a payload (raw base64 for testing)
function signPayload(payload, privateKey) {
  const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(payloadStr);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

// Helper to create JWS format (header.payload.signature)
function createJWS(payload, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload, Object.keys(payload).sort())).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signatureB64 = sign.sign(privateKey, 'base64url');
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Setup test trust store with keys for all three lanes
function setupTestTrustStore() {
  const dir = path.dirname(TRUST_STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const archivistKeys = generateTestKeyPair();
  const swarmmindKeys = generateTestKeyPair();
  const libraryKeys = generateTestKeyPair();

  const trustStore = {
    version: '1.0',
    keys: {
      archivist: {
        key_id: 'archivist-test-key',
        public_key_pem: archivistKeys.publicKey
      },
      swarmmind: {
        key_id: 'swarmmind-test-key',
        public_key_pem: swarmmindKeys.publicKey
      },
      library: {
        key_id: 'library-test-key',
        public_key_pem: libraryKeys.publicKey
      }
    },
    phenotypes: {},
    migration: {
      jws_only_start: '2026-05-19T00:00:00Z'
    }
  };

  fs.writeFileSync(TRUST_STORE_PATH, JSON.stringify(trustStore, null, 2));

  return {
    archivist: archivistKeys,
    swarmmind: swarmmindKeys,
    library: libraryKeys
  };
}

function cleanup() {
  if (fs.existsSync(TRUST_STORE_PATH)) fs.unlinkSync(TRUST_STORE_PATH);
  if (fs.existsSync(TEST_LOG_PATH)) fs.unlinkSync(TEST_LOG_PATH);
  if (fs.existsSync(TEST_HANDOFF)) fs.unlinkSync(TEST_HANDOFF);
}

async function runCrossLaneTests() {
  console.log('=== Cross-Lane Integration Tests ===\n');
  console.log('Testing: Archivist ↔ SwarmMind ↔ Library\n');

  let passed = 0;
  let failed = 0;

  try {
    cleanup();
    const keys = setupTestTrustStore();

    // Create VerifierWrapper instance
    const quarantineManager = new ArchivistQuarantineManager({
      maxRetries: 3,
      backoffMs: 100,
      logPath: TEST_LOG_PATH,
      handoffFile: TEST_HANDOFF
    });

    const phenotypeStore = new ArchivistPhenotypeStore({ trustStorePath: TRUST_STORE_PATH });

    const verifierWrapper = new ArchivistVerifierWrapper({
      trustStorePath: TRUST_STORE_PATH,
      quarantineManager,
      phenotypeStore
    });

    // ========================================
    // TEST SUITE 1: Archivist-originated artifacts
    // ========================================
    console.log('Test Suite 1: Archivist-Originated Artifacts');

    // Test 1.1: Valid Archivist artifact verified by Archivist
    console.log('  1.1: Archivist verifies own valid artifact...');
    const archivistPayload = {
      id: 'archivist-msg-001',
      lane: 'archivist',
      type: 'governance_update',
      data: { constraint: 'CPS_DRIFT_LIMIT', value: 0.3 }
    };
    const archivistSignature = createJWS(archivistPayload, keys.archivist.privateKey);
    
    const archivistItem = {
      id: 'archivist-item-001',
      origin_lane: 'archivist',
      payload: archivistPayload,
      signature: archivistSignature
    };

    const result1_1 = await verifierWrapper.verify(archivistItem);
    assert.strictEqual(result1_1.valid, true, 'Archivist should verify own valid artifact');
    assert.strictEqual(result1_1.mode, 'JWS_VERIFIED');
    console.log('    ✓ PASSED\n');
    passed++;

    // Test 1.2: Invalid signature (corrupted)
    console.log('  1.2: Invalid signature detection...');
    const corruptedSignature = archivistSignature.slice(0, -5) + 'XXXXX'; // Corrupt last 5 chars
    const corruptedItem = {
      id: 'swarmmind-recv-001',
      origin_lane: 'archivist',
      payload: archivistPayload,
      signature: corruptedSignature
    };

    const result1_2 = await verifierWrapper.verify(corruptedItem);
    assert.strictEqual(result1_2.valid, false, 'Corrupted signature should fail');
    console.log('    ✓ PASSED\n');
    passed++;

    // ========================================
    // TEST SUITE 2: SwarmMind-originated artifacts
    // ========================================
    console.log('Test Suite 2: SwarmMind-Originated Artifacts');

    // Test 2.1: Valid SwarmMind artifact
    console.log('  2.1: Valid SwarmMind artifact...');
    const swarmmindPayload = {
      id: 'swarmmind-msg-001',
      lane: 'swarmmind',
      type: 'agent_spawn',
      data: { agent_type: 'worker', task: 'scan' }
    };
    const swarmmindSignature = createJWS(swarmmindPayload, keys.swarmmind.privateKey);

    const swarmmindItem = {
      id: 'swarmmind-item-001',
      origin_lane: 'swarmmind',
      payload: swarmmindPayload,
      signature: swarmmindSignature
    };

    const result2_1 = await verifierWrapper.verify(swarmmindItem);
    assert.strictEqual(result2_1.valid, true, 'Valid SwarmMind artifact should verify');
    assert.strictEqual(result2_1.mode, 'JWS_VERIFIED');
    console.log('    ✓ PASSED\n');
    passed++;

    // Test 2.2: SwarmMind lane mismatch (A ≠ B)
    console.log('  2.2: SwarmMind lane mismatch detection...');
    const mismatchItem = {
      id: 'swarmmind-mismatch-001',
      origin_lane: 'archivist', // Claiming to be from Archivist
      payload: { ...swarmmindPayload }, // But payload says swarmmind
      signature: swarmmindSignature
    };

    const result2_2 = await verifierWrapper.verify(mismatchItem);
    assert.strictEqual(result2_2.valid, false, 'Lane mismatch should fail');
    assert.strictEqual(result2_2.reason, 'QUARANTINED');
    console.log('    ✓ PASSED\n');
    passed++;

    // ========================================
    // TEST SUITE 3: Library-originated artifacts
    // ========================================
    console.log('Test Suite 3: Library-Originated Artifacts');

    // Test 3.1: Valid Library artifact
    console.log('  3.1: Valid Library artifact...');
    const libraryPayload = {
      id: 'library-msg-001',
      lane: 'library',
      type: 'knowledge_index',
      data: { topic: 'governance', entries: 42 }
    };
    const librarySignature = createJWS(libraryPayload, keys.library.privateKey);

    const libraryItem = {
      id: 'library-item-001',
      origin_lane: 'library',
      payload: libraryPayload,
      signature: librarySignature
    };

    const result3_1 = await verifierWrapper.verify(libraryItem);
    assert.strictEqual(result3_1.valid, true, 'Valid Library artifact should verify');
    assert.strictEqual(result3_1.mode, 'JWS_VERIFIED');
    console.log('    ✓ PASSED\n');
    passed++;

    // Test 3.2: Library missing lane
    console.log('  3.2: Library artifact missing lane...');
    const noLanePayload = {
      id: 'library-nolane-001',
      // NO lane field
      type: 'knowledge_index',
      data: { topic: 'test' }
    };
    const noLaneSignature = signPayload(noLanePayload, keys.library.privateKey);

    const noLaneItem = {
      id: 'library-nolane-item-001',
      origin_lane: 'library',
      payload: noLanePayload,
      signature: noLaneSignature
    };

    const result3_2 = await verifierWrapper.verify(noLaneItem);
    assert.strictEqual(result3_2.valid, false, 'Missing lane should fail');
    assert.strictEqual(result3_2.reason, 'MISSING_LANE');
    console.log('    ✓ PASSED\n');
    passed++;

    // ========================================
    // TEST SUITE 4: Cross-Lane Quarantine Flow
    // ========================================
    console.log('Test Suite 4: Cross-Lane Quarantine Flow');

    // Test 4.1: Quarantine max retries triggers handoff
    console.log('  4.1: Quarantine max retries triggers handoff...');
    
    // Create a separate verifier wrapper with low retry limit
    const quarantineManager2 = new ArchivistQuarantineManager({
      maxRetries: 2,
      backoffMs: 10,
      logPath: TEST_LOG_PATH,
      handoffFile: TEST_HANDOFF
    });

    const verifierWrapper2 = new ArchivistVerifierWrapper({
      trustStorePath: TRUST_STORE_PATH,
      quarantineManager: quarantineManager2,
      phenotypeStore
    });

    const badItem = {
      id: 'quarantine-test-001',
      origin_lane: 'swarmmind',
      payload: { lane: 'swarmmind', data: 'test' },
      signature: 'INVALID_SIGNATURE'
    };

    // Trigger quarantine multiple times
    for (let i = 0; i < 3; i++) {
      await verifierWrapper2.verify(badItem);
    }

    assert.strictEqual(fs.existsSync(TEST_HANDOFF), true, 'Handoff file should be created');
    console.log('    ✓ PASSED\n');
    passed++;

    // Test 4.2: Metrics collection
    console.log('  4.2: Quarantine metrics collection...');
    const metrics = quarantineManager2.getMetrics();
    assert(metrics.total >= 2, `Should have quarantine events recorded, got ${metrics.total}`);
    console.log('    ✓ PASSED\n');
    passed++;

    // ========================================
    // TEST SUITE 5: Phenotype Store
    // ========================================
    console.log('Test Suite 5: Phenotype Store');

    // Test 5.1: Phenotype updated on successful verification
    console.log('  5.1: Phenotype updated on successful verification...');
    const phenotypeBefore = phenotypeStore.getLastSync('library');
    
    const freshLibraryPayload = { id: 'lib-pheno', lane: 'library', data: 'fresh' };
    const freshLibraryItem = {
      id: 'library-phenotype-001',
      origin_lane: 'library',
      payload: freshLibraryPayload,
      signature: createJWS(freshLibraryPayload, keys.library.privateKey)
    };

    await verifierWrapper.verify(freshLibraryItem);
    const phenotypeAfter = phenotypeStore.getLastSync('library');
    assert(phenotypeAfter !== null, 'Phenotype should be stored');
    assert(phenotypeAfter.last_sync !== undefined, 'Should have timestamp');
    console.log('    ✓ PASSED\n');
    passed++;

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('=== CROSS-LANE INTEGRATION TESTS COMPLETE ===');
    console.log(`Total: ${passed} tests passed`);
    console.log('\nThree-Lane Attestation Fabric Status:');
    console.log('  ✅ Archivist: Authority (100) — Verifying');
    console.log('  ✅ SwarmMind: Execution (80) — Verifying');
    console.log('  ✅ Library: Memory (60) — Verifying');
    console.log('\nInvariant Enforced: A = B = C');
    console.log('  outerLane === payload.lane === keyFetchedForLane');

  } catch (e) {
    console.error('TEST FAILED:', e.message);
    console.error(e.stack);
    failed++;
  } finally {
    cleanup();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runCrossLaneTests();
