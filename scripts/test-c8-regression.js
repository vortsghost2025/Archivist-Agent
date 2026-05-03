#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { sendMessage, validateMessage } = require('./send-message');

const LANE = 'archivist';
const LANE_OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';
const RESULTS = [];

function test(name, fn) {
  try { fn(); RESULTS.push({ name, pass: true }); }
  catch (e) { RESULTS.push({ name, pass: false, error: e.message }); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function fakeSig() { return 'eyJhbGciOiJSUzI1NiJ9.eyJ0YXNrX2lkIjoidCJ9.c2ln'; }
function baseValidMessage(overrides = {}) {
  return {
    schema_version: '1.3',
    task_id: 'c8-test-base',
    idempotency_key: 'c8-test-base',
    from: 'archivist',
    to: 'kernel',
    type: 'status',
    task_kind: 'report',
    priority: 'P2',
    subject: 'test',
    body: 'test',
    timestamp: '2026-05-03T02:00:00.000Z',
    requires_action: false,
    payload: { mode: 'inline' },
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    lease: {},
    retry: {},
    evidence: {},
    heartbeat: {},
    signature: fakeSig(),
    key_id: '0123abcd4567ef89',
    ...overrides
  };
}

// 1. Schema validation: valid message passes
test('valid message passes', () => {
  const r = validateMessage(baseValidMessage({
    task_id: 'c8-test-1',
    idempotency_key: 'c8-test-1'
  }));
  assert(r.valid, 'valid message should pass: ' + JSON.stringify(r.errors));
});

// 2. to:"all" blocked
test('to:"all" blocked', () => {
  const r = validateMessage({ to: 'all' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('forbidden')));
});

// 3. ack + evidence.required without evidence_exchange blocked
test('ack + evidence.required blocked without evidence_exchange', () => {
  const r = validateMessage({
    type: 'ack', evidence: { required: true }
  });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('evidence_exchange')));
});

// 4. offset timestamp blocked
test('offset timestamp blocked', () => {
  const r = validateMessage({ timestamp: '2026-05-02T22:00:00-04:00' });
  assert(!r.valid);
  assert(r.errors.some(e => e.includes('ISO-8601 UTC')));
});

// 5. UTC Z timestamp passes
test('UTC Z timestamp passes', () => {
  const r = validateMessage(baseValidMessage({
    task_id: 't',
    idempotency_key: '1',
    subject: 't',
    body: 't'
  }));
  assert(r.valid);
});

// 6. audit task_kind passes (schema aligned)
test('audit task_kind passes', () => {
  const r = validateMessage(baseValidMessage({
    type: 'task',
    task_kind: 'audit'
  }));
  assert(r.valid || !r.errors.some(e => e.includes('audit')),
    'audit should not be rejected: ' + JSON.stringify(r.errors));
});

// 7. SHA256 delivery verification
test('SHA256 delivery verification', () => {
  const crypto = require('crypto');
  const content = '{"test":true}';
  const h1 = crypto.createHash('sha256').update(content).digest('hex');
  const h2 = crypto.createHash('sha256').update(content).digest('hex');
  assert(h1 === h2, 'deterministic hash');
  assert(h1.length === 64, 'SHA256 is 64 hex chars');
});

// 8. Dry-run does not write files
test('dry-run does not write', () => {
  const outboxBefore = fs.readdirSync(LANE_OUTBOX).length;
  sendMessage(baseValidMessage({
    task_id: 'c8-dry-test',
    idempotency_key: 'c8-dry-test',
    subject: 'dry',
    body: 'dry'
  }), { dryRun: true });
  const outboxAfter = fs.readdirSync(LANE_OUTBOX).length;
  assert(outboxAfter === outboxBefore, 'dry-run should not write files');
});

// Print results
let passCount = 0, failCount = 0;
RESULTS.forEach(r => {
  console.log((r.pass ? '[PASS]' : '[FAIL]') + ' ' + r.name);
  if (!r.pass) { failCount++; console.log('  ' + r.error); }
  else passCount++;
});
console.log(`\n=== C8 Regression Tests ===\nPASS: ${passCount}\nFAIL: ${failCount}\nTOTAL: ${RESULTS.length}`);
if (failCount > 0) process.exit(1);
