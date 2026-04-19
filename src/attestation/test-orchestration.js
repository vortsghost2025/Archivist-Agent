/**
 * test-orchestration.js - Phase 4.4 Orchestration Layer Tests
 * 
 * Tests for PhenotypeStore, QuarantineManager, and VerifierWrapper.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PhenotypeStore } = require('./PhenotypeStore');
const { QuarantineManager } = require('./QuarantineManager');
const { VerifierWrapper } = require('./VerifierWrapper');
const { Verifier } = require('./Verifier');

const TEST_TRUST_STORE = path.join(__dirname, '..', '..', '.trust', 'test_keys.json');
const TEST_LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'test_quarantine.log');
const TEST_HANDOFF = path.join(__dirname, '..', '..', 'TEST_HANDOFF.md');

function setupTestTrustStore() {
  const dir = path.dirname(TEST_TRUST_STORE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TEST_TRUST_STORE, JSON.stringify({
    version: '1.0',
    keys: {
      archivist: { key_id: 'test-key-1', public_key_pem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----' }
    },
    phenotypes: {},
    migration: { jws_only_start: '2026-05-19T00:00:00Z' }
  }, null, 2));
}

function cleanup() {
  if (fs.existsSync(TEST_TRUST_STORE)) fs.unlinkSync(TEST_TRUST_STORE);
  if (fs.existsSync(TEST_LOG_PATH)) fs.unlinkSync(TEST_LOG_PATH);
  if (fs.existsSync(TEST_HANDOFF)) fs.unlinkSync(TEST_HANDOFF);
}

async function runTests() {
  console.log('=== Phase 4.4 Orchestration Layer Tests ===\n');

  let passed = 0;
  let failed = 0;

  try {
    cleanup();
    setupTestTrustStore();

    console.log('Testing PhenotypeStore...');
    
    const phenotypeStore = new PhenotypeStore({ trustStorePath: TEST_TRUST_STORE });
    
    const hash1 = phenotypeStore.setLastSync('archivist', { version: '1.0', items: 5 });
    assert(hash1.startsWith('sha256:'), 'Hash should start with sha256:');
    
    const last = phenotypeStore.getLastSync('archivist');
    assert(last !== null, 'Should retrieve last sync');
    assert(last.hash === hash1, 'Hash should match');
    
    const compare = phenotypeStore.compareWithLast('archivist', { version: '1.0', items: 5 });
    assert(compare.match === true, 'Same state should match');
    
    const compareDiff = phenotypeStore.compareWithLast('archivist', { version: '1.0', items: 10 });
    assert(compareDiff.match === false, 'Different state should not match');
    
    console.log('  ✓ PhenotypeStore: 4 tests passed\n');
    passed += 4;

    console.log('Testing QuarantineManager...');
    
    const quarantineManager = new QuarantineManager({
      maxRetries: 3,
      backoffMs: 100,
      logPath: TEST_LOG_PATH,
      handoffFile: TEST_HANDOFF
    });
    
    const item1 = { id: 'item-1', origin_lane: 'swarmmind', payload: { lane: 'swarmmind' } };
    
    const result1 = quarantineManager.quarantine(item1, 'SIGNATURE_INVALID');
    assert(result1.status === 'QUARANTINED', 'First quarantine should succeed');
    assert(result1.retryCount === 1, 'Retry count should be 1');
    assert(quarantineManager.isQuarantined('item-1') === true, 'Item should be quarantined');
    
    const result2 = quarantineManager.quarantine(item1, 'SIGNATURE_INVALID');
    assert(result2.retryCount === 2, 'Retry count should increment');
    
    const result3 = quarantineManager.quarantine(item1, 'SIGNATURE_INVALID');
    assert(result3.status === 'MAX_RETRIES_EXCEEDED', 'Should hit max retries');
    assert(result3.handoffRequired === true, 'Should require handoff');
    assert(fs.existsSync(TEST_HANDOFF), 'Handoff file should be created');
    
    const metrics = quarantineManager.getMetrics();
    assert(metrics.total >= 3, `Total should count quarantine calls, got ${metrics.total}`);
    assert(metrics.maxExceeded >= 1, 'Should have at least one max exceeded');
    
    console.log('  ✓ QuarantineManager: 7 tests passed\n');
    passed += 7;

    console.log('Testing VerifierWrapper...');
    
    const verifierWrapper = new VerifierWrapper({
      trustStorePath: TEST_TRUST_STORE,
      quarantineManager: new QuarantineManager({
        maxRetries: 3,
        backoffMs: 100,
        logPath: TEST_LOG_PATH,
        handoffFile: TEST_HANDOFF
      }),
      phenotypeStore: phenotypeStore
    });
    
    const missingLane = { 
      id: 'test-1', 
      signature: 'fake.sig', 
      origin_lane: 'archivist', 
      payload: {} 
    };
    const r1 = await verifierWrapper.verify(missingLane);
    assert(r1.valid === false, 'Missing lane should fail');
    assert(r1.reason === 'MISSING_LANE', 'Reason should be MISSING_LANE');
    
    const laneMismatch = { 
      id: 'test-2', 
      signature: 'fake.sig', 
      origin_lane: 'archivist', 
      payload: { lane: 'swarmmind' } 
    };
    const r2 = await verifierWrapper.verify(laneMismatch);
    assert(r2.valid === false, 'Lane mismatch should fail');
    assert(r2.reason === 'QUARANTINED' || r2.reason === 'LANE_MISMATCH', 'Should quarantine or mismatch');
    
    console.log('  ✓ VerifierWrapper: 4 tests passed\n');
    passed += 4;

    console.log('Testing Metrics Integration...');
    
    const finalMetrics = verifierWrapper.getMetrics();
    assert(finalMetrics.quarantine !== undefined, 'Should have quarantine metrics');
    assert(finalMetrics.phenotypes !== undefined, 'Should have phenotype data');
    
    console.log('  ✓ Metrics Integration: 2 tests passed\n');
    passed += 2;

    console.log('=== ALL TESTS PASSED ===');
    console.log(`Total: ${passed} tests passed`);

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

runTests();
