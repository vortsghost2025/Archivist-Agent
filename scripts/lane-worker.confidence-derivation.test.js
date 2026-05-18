#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const { LaneWorker } = require('./lane-worker');

function makeValidMsg(overrides) {
  const base = {
    schema_version: '1.3',
    task_id: 'test-cd-001',
    idempotency_key: crypto.createHash('sha256').update('test-cd-001').digest('hex').slice(0, 64),
    from: 'archivist',
    to: 'kernel',
    type: 'assessment',
    task_kind: 'evaluation',
    priority: 'P2',
    subject: 'Confidence derivation test',
    body: 'OUTPUT_PROVENANCE: agent: test lane: archivist generated_at: 2026-05-18T02:00:00Z session_id: test\nTest body for confidence derivation check',
    timestamp: new Date().toISOString(),
    requires_action: false,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'kilo', actor: 'lane' },
    lease: { owner: null, acquired_at: null, expires_at: null, renew_count: 0, max_renewals: 3 },
    retry: { attempt: 1, max_attempts: 3, last_error: null, last_attempt_at: null },
    evidence: { required: false, evidence_path: null, verified: false, verified_by: null, verified_at: null },
    heartbeat: { interval_seconds: 60, last_heartbeat_at: new Date().toISOString(), timeout_seconds: 900, status: 'in_progress' },
    signature: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJmcm9tIjoiYXJjaGl2aXN0IiwidG8iOiJrZXJuZWwiLCJ0aW1lc3RhbXAiOiIyMDI2LTA1LTA0VDIxOjI4OjAyLjYyN1oifQ.cGxhY2Vob2xkZXItYXJjaGl2aXN0LTE3Nzc5MzAwODI2MzI',
    key_id: '506c2d0838b6862c',
    confidence: 8,
  };
  if (overrides) Object.assign(base, overrides);
  return base;
}

function makeSchemaValidatorResult(valid, errors) {
  return { valid: valid !== false, errors: errors || [] };
}

function makeSignatureResult(valid, reason) {
  return { valid: valid !== false, reason: reason || null };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(' PASS:', name);
    passed++;
  } catch (err) {
    console.error(' FAIL:', name);
    console.error(' ', err.message);
    failed++;
  }
}

const tmpDir = path.join(REPO_ROOT, 'context-buffer', 'cps_log_test_tmp');

function cleanupTmpCpsLog() {
  const testLog = path.join(tmpDir, 'cps_log.jsonl');
  if (fs.existsSync(testLog)) fs.unlinkSync(testLog);
  if (fs.existsSync(tmpDir)) try { fs.rmdirSync(tmpDir); } catch (_) {}
}

console.log('LANE-WORKER CONFIDENCE DERIVATION TESTS');
console.log('======================================');

test('high confidence without derivation gets PERFORMATIVE_CONFIDENCE flag', () => {
  const msg = makeValidMsg({ confidence: 8 });
  assert.strictEqual(msg._governance_flags, undefined, 'no flags before decideRoute');

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  assert.ok(Array.isArray(msg._governance_flags), '_governance_flags should be array after decideRoute');
  assert.ok(msg._governance_flags.includes('PERFORMATIVE_CONFIDENCE'), 'should include PERFORMATIVE_CONFIDENCE flag');
});

test('high confidence WITH derivation does NOT get flag', () => {
  const msg = makeValidMsg({
    confidence: 9,
    confidence_derivation: {
      what_measured: 'test coverage ratio',
      how_measured: 'jest --coverage output',
      what_produced: '0.87 branch coverage',
      how_mapped: 'linear scale: coverage * 10 = confidence',
    },
  });

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  const hasFlag = msg._governance_flags && msg._governance_flags.includes('PERFORMATIVE_CONFIDENCE');
  assert.ok(!hasFlag, 'should NOT include PERFORMATIVE_CONFIDENCE when derivation present');
});

test('low confidence is not affected by derivation check', () => {
  const msg = makeValidMsg({ confidence: 5, investigation: 'Examined 3 similar cases with partial evidence' });

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  assert.strictEqual(msg._governance_flags, undefined, 'low confidence should not trigger derivation check');
});

test('confidence_derivation as string is treated as missing', () => {
  const msg = makeValidMsg({ confidence: 8, confidence_derivation: 'measured by test' });

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  assert.ok(msg._governance_flags.includes('PERFORMATIVE_CONFIDENCE'), 'string derivation should be treated as invalid');
});

test('confidence_derivation as array is treated as missing', () => {
  const msg = makeValidMsg({ confidence: 7, confidence_derivation: ['item1', 'item2'] });

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  assert.ok(msg._governance_flags.includes('PERFORMATIVE_CONFIDENCE'), 'array derivation should be treated as invalid');
});

test('minimum valid derivation object (empty object) does NOT get flag', () => {
  const msg = makeValidMsg({ confidence: 8, confidence_derivation: {} });

  const worker = new LaneWorker({
    laneRoot: REPO_ROOT,
    dryRun: true,
    queues: {
      inbox: path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox'),
      actionRequired: path.join(REPO_ROOT, 'lanes', 'archivist', 'action-required'),
      inProgress: path.join(REPO_ROOT, 'lanes', 'archivist', 'in-progress'),
      processed: path.join(REPO_ROOT, 'lanes', 'archivist', 'processed'),
      blocked: path.join(REPO_ROOT, 'lanes', 'archivist', 'blocked'),
      quarantine: path.join(REPO_ROOT, 'lanes', 'archivist', 'quarantine'),
    },
  });

  const result = worker.decideRoute(msg, makeSchemaValidatorResult(), makeSignatureResult());

  const hasFlag = msg._governance_flags && msg._governance_flags.includes('PERFORMATIVE_CONFIDENCE');
  assert.ok(!hasFlag, 'empty object derivation satisfies structural check (semantic check is future phase)');
});

console.log('\n' + '='.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
