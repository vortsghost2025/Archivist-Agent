#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findLastUdsMeasurement,
  lastOperatorUdsEntry,
  computeEffectiveUds,
  classifyUdsScore,
  formatDriftAlert,
} = require('./uds-gate');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL: ${name} — ${err.message}`);
    fail++;
  }
}

function makeLog(entries) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uds-')), 'cps_log.jsonl');
  fs.writeFileSync(p, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  return p;
}

const systemEntry = (score, ts) => ({ timestamp: ts, event: 'CPS_MEASURED', uds_score: score });
const operatorEntry = (score, claimed, ts) => ({
  timestamp: ts,
  event: 'UDS_OPERATOR_PROVIDED',
  uds_score: score,
  operator_claimed: claimed,
  measured_score: null,
});

console.log(`\n=== uds-gate.js tests ===\n`);

console.log('1. System measurement scanning (ratchet rules)');
test('findLastUdsMeasurement returns the last SYSTEM measurement, skipping operator entries', () => {
  const log = makeLog([
    systemEntry(20, '2026-08-06T01:00:00Z'),
    operatorEntry(48, 48, '2026-08-06T06:30:05Z'),
    systemEntry(35, '2026-08-06T07:00:00Z'),
  ]);
  const result = findLastUdsMeasurement(log);
  assert(result, 'must find a measurement');
  assert.strictEqual(result.score, 35, 'must be the last system measurement, not the operator entry');
  assert.strictEqual(result.ts, '2026-08-06T07:00:00Z');
});

test('operator-only log yields no SYSTEM measurement (no permanent raise-ratchet)', () => {
  const log = makeLog([
    operatorEntry(48, 48, '2026-08-06T06:30:05Z'),
    operatorEntry(60, 60, '2026-08-06T07:00:00Z'),
  ]);
  assert.strictEqual(findLastUdsMeasurement(log), null, 'operator assertions are NOT a system floor');
});

test('empty and missing logs yield null', () => {
  const emptyLog = makeLog([]);
  assert.strictEqual(findLastUdsMeasurement(emptyLog), null);
  assert.strictEqual(findLastUdsMeasurement(path.join(os.tmpdir(), 'does-not-exist-xyz.jsonl')), null);
});

test('non-numeric uds_score entries are ignored', () => {
  const log = makeLog([{ event: 'CPS_MEASURED', uds_score: 'N/A' }, systemEntry(42, '2026-08-06T01:00:00Z')]);
  const result = findLastUdsMeasurement(log);
  assert.strictEqual(result.score, 42);
});

console.log('\n2. Operator entry discovery');
test('lastOperatorUdsEntry returns the most recent UDS_OPERATOR_PROVIDED entry', () => {
  const log = makeLog([
    systemEntry(20, '2026-08-06T01:00:00Z'),
    operatorEntry(48, 48, '2026-08-06T06:30:05Z'),
    systemEntry(30, '2026-08-06T07:00:00Z'),
  ]);
  const op = lastOperatorUdsEntry(log);
  assert(op, 'must find the operator entry');
  assert.strictEqual(op.operator_claimed, 48);
  assert.strictEqual(op.event, 'UDS_OPERATOR_PROVIDED');
});

test('lastOperatorUdsEntry returns null when no operator entry exists', () => {
  const log = makeLog([systemEntry(20, '2026-08-06T01:00:00Z')]);
  assert.strictEqual(lastOperatorUdsEntry(log), null);
});

console.log('\n3. Effective UDS computation (floor semantics)');
test('operator may RAISE above a system measurement', () => {
  const result = computeEffectiveUds({ score: 30 }, 55);
  assert.strictEqual(result.uds, 55);
  assert.match(result.basis, /RAISE/);
});

test('operator may NOT lower below a system measurement (floor)', () => {
  const result = computeEffectiveUds({ score: 60 }, 20);
  assert.strictEqual(result.uds, 60, 'effective UDS must stay at the system floor');
});

test('system measurement alone is the effective UDS', () => {
  const result = computeEffectiveUds({ score: 25 }, null);
  assert.strictEqual(result.uds, 25);
});

test('operator score is effective when no system measurement exists', () => {
  const result = computeEffectiveUds(null, 48);
  assert.strictEqual(result.uds, 48);
});

test('both absent yields null (fail-closed, never assume 0)', () => {
  const result = computeEffectiveUds(null, null);
  assert.strictEqual(result.uds, null);
  assert.strictEqual(result.basis, null);
});

test('classifyUdsScore: 0-20 is STABLE', () => {
  assert.strictEqual(classifyUdsScore(0).state, 'STABLE');
  assert.strictEqual(classifyUdsScore(20).state, 'STABLE');
});

test('classifyUdsScore: 21-40 is ELEVATED', () => {
  assert.strictEqual(classifyUdsScore(21).state, 'ELEVATED');
  assert.strictEqual(classifyUdsScore(40).state, 'ELEVATED');
});

test('classifyUdsScore: 41-60 is HIGH', () => {
  assert.strictEqual(classifyUdsScore(41).state, 'HIGH');
  assert.strictEqual(classifyUdsScore(60).state, 'HIGH');
});

test('classifyUdsScore: 61-80 is CRITICAL', () => {
  assert.strictEqual(classifyUdsScore(61).state, 'CRITICAL');
  assert.strictEqual(classifyUdsScore(80).state, 'CRITICAL');
});

test('classifyUdsScore: 81-100 is COLLAPSE, null is UNKNOWN', () => {
  assert.strictEqual(classifyUdsScore(81).state, 'COLLAPSE');
  assert.strictEqual(classifyUdsScore(100).state, 'COLLAPSE');
  assert.strictEqual(classifyUdsScore(null).state, 'UNKNOWN');
});

test('formatDriftAlert: UDS > 40 emits standardized block', () => {
  const alert = formatDriftAlert(55, ['opaque-request', 'skip-verification'], 'missing UDS evaluation before action');
  assert.ok(alert.includes('[DRIFT DETECTED: Score=55]'));
  assert.ok(alert.includes('Signals: [opaque-request, skip-verification]'));
  assert.ok(alert.includes('Required: '));
  assert.ok(alert.includes('Correction: missing UDS evaluation before action'));
});

test('formatDriftAlert: UDS <= 40 and null return null (no alert)', () => {
  assert.strictEqual(formatDriftAlert(40), null);
  assert.strictEqual(formatDriftAlert(0), null);
  assert.strictEqual(formatDriftAlert(null), null);
});

test('formatDriftAlert: critical range carries HARD STOP action', () => {
  const alert = formatDriftAlert(70);
  assert.ok(alert.includes('HARD STOP'));
});

console.log('\n========================================');
console.log(`UDS Gate Tests — PASS: ${pass}  FAIL: ${fail}  TOTAL: ${pass + fail}`);
console.log('========================================\n');

if (fail > 0) process.exit(1);
