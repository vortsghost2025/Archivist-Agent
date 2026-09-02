#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHECKER = path.join(__dirname, 'check-trust-store-consistency.js');

function writeTopLevelFixture(dir, name, lanes) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(lanes, null, 2));
  return p;
}

function writeNestedFixture(dir, name, lanes) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify({ keys: lanes }, null, 2));
  return p;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runCheckerStatus(args) {
  let code = 0;
  let out = '';
  try {
    out = execSync(`node ${CHECKER} ${args}`, { encoding: 'utf8' });
  } catch (e) {
    code = e.status || 1;
    out = e.stdout || '';
  }
  return { code, out };
}

function testTopLevelMatchingStoresPass() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code === 0, 'top-level matching stores should pass');
  assert(out.trim() === 'CONSISTENT', 'should output CONSISTENT');
}

function testTopLevelDifferingActiveKidFails() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k2', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'top-level differing active kid should fail');
  assert(out.includes('ACTIVE_KEY_ID_MISMATCH'), 'should report ACTIVE_KEY_ID_MISMATCH');
}

function testNestedSchemaStillWorks() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeNestedFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeNestedFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code === 0, 'nested schema matching should pass');
  assert(out.trim() === 'CONSISTENT', 'should output CONSISTENT');
}

function testActiveVersusRevokedFailsWithStateMismatch() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'REVOKED' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'ACTIVE vs REVOKED should fail');
  assert(out.includes('STATE_MISMATCH'), 'should report STATE_MISMATCH');
}

function testActiveVersusDormantFailsWithStateMismatch() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'DORMANT' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'ACTIVE vs DORMANT should fail');
  assert(out.includes('STATE_MISMATCH'), 'should report STATE_MISMATCH');
}

function testMetadataContainersAreIgnored() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', {
    library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' },
    key_lineage: { reconciled_at: 'now' },
    archived_keys: { old: { key_id: 'old' } },
    rotation_policy: { rotation_days: 90 }
  });
  const b = writeTopLevelFixture(dir, 'b.json', {
    library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' },
    key_lineage: { reconciled_at: 'now' },
    archived_keys: { old: { key_id: 'old' } },
    rotation_policy: { rotation_days: 90 }
  });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code === 0, 'metadata container differences should not cause divergence');
  assert(out.trim() === 'CONSISTENT', 'should output CONSISTENT');
}

function testActualTrustStoresProduceLibraryDivergence() {
  const archivist = '/home/we4free/agent/repos/Archivist-Agent/lanes/broadcast/trust-store.json';
  const library = '/home/we4free/agent/repos/self-organizing-library/lanes/broadcast/trust-store.json';
  const { code, out } = runCheckerStatus(`${archivist} ${library}`);
  assert(code !== 0, 'actual stores should diverge');
  assert(out.includes('lane=library'), 'should report library lane');
  assert(out.includes('ACTIVE_KEY_ID_MISMATCH'), 'should report ACTIVE_KEY_ID_MISMATCH for library');
}

function testNoKeyMaterialInOutput() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE', public_key_pem: 'SECRET' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { out } = runCheckerStatus(`${a} ${b}`);
  assert(!out.includes('SECRET'), 'output must not contain key material');
}

function testActualTrustStoreFilesRemainByteIdentical() {
  const archivist = '/home/we4free/agent/repos/Archivist-Agent/lanes/broadcast/trust-store.json';
  const library = '/home/we4free/agent/repos/self-organizing-library/lanes/broadcast/trust-store.json';
  const aRaw = fs.readFileSync(archivist);
  const bRaw = fs.readFileSync(library);
  runCheckerStatus(`${archivist} ${library}`);
  assert(fs.readFileSync(archivist).equals(aRaw), 'archivist trust store must remain byte-identical');
  assert(fs.readFileSync(library).equals(bRaw), 'library trust store must remain byte-identical');
}

function testJsonSummaryModeWithTopLevel() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeTopLevelFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeTopLevelFixture(dir, 'b.json', { library: { key_id: 'k2', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b} --json`);
  assert(code !== 0, 'json mode should still fail on divergence');
  const parsed = JSON.parse(out);
  assert(Array.isArray(parsed.divergences), 'json output should have divergences array');
  assert(parsed.divergences.length === 1, 'should have one divergence');
}

function testNestedDifferingActiveKidFails() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeNestedFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeNestedFixture(dir, 'b.json', { library: { key_id: 'k2', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'nested differing active kid should fail');
  assert(out.includes('ACTIVE_KEY_ID_MISMATCH'), 'should report ACTIVE_KEY_ID_MISMATCH');
}

function runAll() {
  const tests = [
    testTopLevelMatchingStoresPass,
    testTopLevelDifferingActiveKidFails,
    testNestedSchemaStillWorks,
    testActiveVersusRevokedFailsWithStateMismatch,
    testActiveVersusDormantFailsWithStateMismatch,
    testMetadataContainersAreIgnored,
    testActualTrustStoresProduceLibraryDivergence,
    testNoKeyMaterialInOutput,
    testActualTrustStoreFilesRemainByteIdentical,
    testJsonSummaryModeWithTopLevel,
    testNestedDifferingActiveKidFails
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      t();
      passed++;
      console.log(`PASS: ${t.name}`);
    } catch (e) {
      console.log(`FAIL: ${t.name}: ${e.message}`);
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);
  process.exit(passed === tests.length ? 0 : 1);
}

if (require.main === module) runAll();
