#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHECKER = path.join(__dirname, 'check-trust-store-consistency.js');

function writeFixture(dir, name, keys) {
  const p = path.join(dir, name);
  const data = { keys };
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runChecker(args) {
  return execSync(`node ${CHECKER} ${args}`, { encoding: 'utf8' });
}

function runCheckerStatus(args) {
  let code = 0;
  let out = '';
  try {
    out = runChecker(args);
  } catch (e) {
    code = e.status || 1;
    out = e.stdout || '';
  }
  return { code, out };
}

function testMatchingStoresPass() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code === 0, 'matching stores should pass');
  assert(out.trim() === 'CONSISTENT', 'should output CONSISTENT');
}

function testDifferingActiveKidFails() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k2', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'differing active kid should fail');
  assert(out.includes('ACTIVE_KEY_ID_MISMATCH'), 'should report ACTIVE_KEY_ID_MISMATCH');
}

function testAlgorithmMismatchFails() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'RS256', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'algorithm mismatch should fail');
  assert(out.includes('ALGORITHM_MISMATCH'), 'should report ALGORITHM_MISMATCH');
}

function testMissingLaneReported() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', {});
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code !== 0, 'missing lane should cause divergence');
  assert(out.includes('library'), 'missing lane should be reported');
}

function testArchivedDifferencesDoNotReplaceActive() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', {
    library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' },
    archived_keys: { old1: { key_id: 'old1', algorithm: 'RS256' } }
  });
  const b = writeFixture(dir, 'b.json', {
    library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' },
    archived_keys: { old2: { key_id: 'old2', algorithm: 'RS256' } }
  });
  const { code, out } = runCheckerStatus(`${a} ${b}`);
  assert(code === 0, 'archived differences should not cause divergence when active matches');
  assert(out.trim() === 'CONSISTENT', 'should output CONSISTENT');
}

function testNoKeyMaterialInOutput() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE', public_key_pem: 'SECRET' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { out } = runCheckerStatus(`${a} ${b}`);
  assert(!out.includes('SECRET'), 'output must not contain key material');
}

function testInputFilesByteIdentical() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const aRaw = fs.readFileSync(a);
  const bRaw = fs.readFileSync(b);
  runCheckerStatus(`${a} ${b}`);
  assert(fs.readFileSync(a).equals(aRaw), 'file a must remain byte-identical');
  assert(fs.readFileSync(b).equals(bRaw), 'file b must remain byte-identical');
}

function testJsonSummaryMode() {
  const dir = fs.mkdtempSync('/tmp/trust-test-');
  const a = writeFixture(dir, 'a.json', { library: { key_id: 'k1', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const b = writeFixture(dir, 'b.json', { library: { key_id: 'k2', algorithm: 'EdDSA', lane_state: 'ACTIVE' } });
  const { code, out } = runCheckerStatus(`${a} ${b} --json`);
  assert(code !== 0, 'json mode should still fail on divergence');
  const parsed = JSON.parse(out);
  assert(Array.isArray(parsed.divergences), 'json output should have divergences array');
  assert(parsed.divergences.length === 1, 'should have one divergence');
}

function runAll() {
  const tests = [
    testMatchingStoresPass,
    testDifferingActiveKidFails,
    testAlgorithmMismatchFails,
    testMissingLaneReported,
    testArchivedDifferencesDoNotReplaceActive,
    testNoKeyMaterialInOutput,
    testInputFilesByteIdentical,
    testJsonSummaryMode
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
