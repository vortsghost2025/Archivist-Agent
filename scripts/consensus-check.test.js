#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const {
  consensusCheck,
  routeMessage,
  evaluateStructural,
  evaluateOperational,
  evaluateDrift,
  loadPolicy,
  DEFAULT_POLICY,
} = require('./consensus-check');

const SCHEMA_REQUIRED = [
  'schema_version', 'task_id', 'idempotency_key', 'from', 'to',
  'type', 'priority', 'subject', 'body', 'timestamp',
  'requires_action', 'payload', 'execution', 'lease', 'retry',
  'evidence', 'heartbeat', 'signature', 'key_id',
];

function makeValidMsg(overrides) {
  const base = {
    schema_version: '1.3',
    task_id: 'test-001',
    idempotency_key: crypto.createHash('sha256').update('test-001').digest('hex').slice(0, 64),
    from: 'archivist',
    to: 'kernel',
    type: 'task',
    task_kind: 'proposal',
    priority: 'P2',
    subject: 'Test message',
    body: 'Test body for consensus check',
    timestamp: new Date().toISOString(),
    requires_action: false,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'kilo', actor: 'lane' },
    lease: { owner: null, acquired_at: null, expires_at: null, renew_count: 0, max_renewals: 3 },
    retry: { attempt: 1, max_attempts: 3, last_error: null, last_attempt_at: null },
    evidence: { required: true, evidence_path: null, verified: false, verified_by: null, verified_at: null },
    heartbeat: { interval_seconds: 60, last_heartbeat_at: new Date().toISOString(), timeout_seconds: 900, status: 'in_progress' },
    signature: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJmcm9tIjoiYXJjaGl2aXN0IiwidG8iOiJrZXJuZWwiLCJ0aW1lc3RhbXAiOiIyMDI2LTA1LTA0VDIxOjI4OjAyLjYyN1oifQ.cGxhY2Vob2xkZXItYXJjaGl2aXN0LTE3Nzc5MzAwODI2MzI',
    key_id: '506c2d0838b6862c',
  };
  if (overrides) Object.assign(base, overrides);
  return base;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS:', name);
    passed++;
  } catch (err) {
    console.error('  FAIL:', name);
    console.error('    ', err.message);
    failed++;
  }
}

console.log('CONSENSUS-CHECK UNIT TESTS');
console.log('=========================');

test('loadPolicy returns DEFAULT_POLICY when file missing', () => {
  const p = loadPolicy('/nonexistent/path/policy.json');
  assert.strictEqual(p.structural_weight, DEFAULT_POLICY.structural_weight);
  assert.strictEqual(p.consensus_threshold, DEFAULT_POLICY.consensus_threshold);
});

test('loadPolicy loads from config/consensus-policy.json', () => {
  const p = loadPolicy(path.join(REPO_ROOT, 'config', 'consensus-policy.json'));
  assert.strictEqual(p.version, '1.0');
  assert.strictEqual(p.structural_weight, 1.0);
  assert.strictEqual(p.routing.proven_action, 'route');
});

test('evaluateStructural passes valid message against schema required fields', () => {
  const msg = makeValidMsg();
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.lane, 'L');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.score, 1.0);
  assert.strictEqual(result.errors.length, 0);
});

test('evaluateStructural fails on missing required fields', () => {
  const msg = { schema_version: '1.3', from: 'archivist' };
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.errors.length > 0, true);
  assert.strictEqual(result.score < 1.0, true);
});

test('evaluateStructural fails on invalid JWS signature format', () => {
  const msg = makeValidMsg({ signature: 'not-a-jws-signature' });
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  const sigErr = result.errors.find(e => e.field === 'signature');
  assert.ok(sigErr, 'should have signature error');
});

test('evaluateStructural fails on key_id mismatch with trust store', () => {
  const msg = makeValidMsg({ key_id: 'deadbeefdeadbeef' });
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  const keyErr = result.errors.find(e => e.field === 'key_id');
  assert.ok(keyErr, 'should have key_id error');
});

test('evaluateStructural passes when key_id matches trust store for from lane', () => {
  const msg = makeValidMsg({ from: 'library', key_id: '2eec06be0befc8d5' });
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  const keyErr = result.errors.find(e => e.field === 'key_id');
  assert.strictEqual(keyErr, undefined);
});

test('evaluateStructural fails on invalid type enum', () => {
  const msg = makeValidMsg({ type: 'decision' });
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  const typeErr = result.errors.find(e => e.field === 'type');
  assert.ok(typeErr, 'should have type error');
});

test('evaluateStructural fails on unsupported schema version', () => {
  const msg = makeValidMsg({ schema_version: '2.0' });
  const result = evaluateStructural(msg, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  const verErr = result.errors.find(e => e.field === 'schema_version');
  assert.ok(verErr, 'should have schema_version error');
});

test('evaluateStructural returns score 0 for null message', () => {
  const result = evaluateStructural(null, { required: SCHEMA_REQUIRED });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.score, 0);
});

test('evaluateOperational returns score 0 for null message', () => {
  const result = evaluateOperational(null, { dryRun: true });
  assert.strictEqual(result.lane, 'R');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.score, 0);
});

test('evaluateDrift reads CPS score from log', () => {
  const policy = loadPolicy(path.join(REPO_ROOT, 'config', 'consensus-policy.json'));
  const result = evaluateDrift(policy, REPO_ROOT);
  assert.strictEqual(result.active, true);
  assert.strictEqual(typeof result.cps_score, 'number');
  assert.strictEqual(result.level, 'normal');
});

test('evaluateDrift returns unknown when log missing', () => {
  const policy = Object.assign({}, DEFAULT_POLICY, {
    drift_integration: { enabled: true, cps_threshold_warning: 30, cps_threshold_critical: 50, cps_log_path: 'nonexistent.jsonl' },
  });
  const result = evaluateDrift(policy, REPO_ROOT);
  assert.strictEqual(result.active, true);
  assert.strictEqual(result.cps_score, null);
  assert.strictEqual(result.level, 'unknown');
});

test('evaluateDrift returns inactive when disabled', () => {
  const policy = Object.assign({}, DEFAULT_POLICY, {
    drift_integration: { enabled: false },
  });
  const result = evaluateDrift(policy, REPO_ROOT);
  assert.strictEqual(result.active, false);
  assert.strictEqual(result.level, 'none');
});

test('consensusCheck returns proven for valid message with normal drift', () => {
  const msg = makeValidMsg();
  const result = consensusCheck(msg, {
    schema: { required: SCHEMA_REQUIRED },
    repoRoot: REPO_ROOT,
    dryRun: true,
    lane: 'archivist',
  });
  assert.ok(['proven', 'conflicted', 'unproven', 'blocked', 'proven_with_drift_warning'].includes(result.status));
  assert.ok(typeof result.weighted_score === 'number');
  assert.strictEqual(result.drift.level, 'normal');
  assert.strictEqual(result.structural.lane, 'L');
  assert.strictEqual(result.operational.lane, 'R');
});

test('consensusCheck returns blocked when drift is critical', () => {
  const policy = Object.assign({}, DEFAULT_POLICY, {
    drift_integration: { enabled: true, cps_threshold_warning: 10, cps_threshold_critical: 15, cps_log_path: 'context-buffer/cps_log.jsonl' },
  });
  const msg = makeValidMsg();
  const result = consensusCheck(msg, {
    policy,
    schema: { required: SCHEMA_REQUIRED },
    repoRoot: REPO_ROOT,
    dryRun: true,
  });
  assert.strictEqual(result.status, 'blocked');
  assert.strictEqual(result.routing_action, 'hold');
});

test('consensusCheck returns conflicted when structural fails', () => {
  const msg = makeValidMsg({ type: 'decision', key_id: 'badkeyidbadkeyid' });
  const result = consensusCheck(msg, {
    schema: { required: SCHEMA_REQUIRED },
    repoRoot: REPO_ROOT,
    dryRun: true,
  });
  assert.ok(['conflicted', 'blocked'].includes(result.status));
});

test('routeMessage returns route for proven status', () => {
  const msg = makeValidMsg();
  const consensus = { routing_action: 'route', status: 'proven' };
  const routing = routeMessage(msg, consensus);
  assert.strictEqual(routing.action, 'route');
  assert.ok(routing.reason.includes('proven'));
});

test('routeMessage returns escalate for conflicted status', () => {
  const msg = makeValidMsg();
  const consensus = { routing_action: 'escalate', status: 'conflicted' };
  const routing = routeMessage(msg, consensus);
  assert.strictEqual(routing.action, 'escalate');
  assert.ok(routing.reason.includes('conflicted'));
});

test('routeMessage returns block for blocked status', () => {
  const msg = makeValidMsg();
  const consensus = { routing_action: 'block', status: 'blocked' };
  const routing = routeMessage(msg, consensus);
  assert.strictEqual(routing.action, 'block');
  assert.strictEqual(routing.target, null);
});

test('routeMessage defaults to hold for unknown action', () => {
  const msg = makeValidMsg();
  const consensus = { routing_action: 'unknown_action', status: 'unproven' };
  const routing = routeMessage(msg, consensus);
  assert.strictEqual(routing.action, 'hold');
});

test('consensusCheck passes operational when execution gate has would_verify=true (dry-run)', () => {
  const msg = makeValidMsg();
  const result = consensusCheck(msg, {
    schema: { required: SCHEMA_REQUIRED },
    repoRoot: REPO_ROOT,
    dryRun: true,
  });
  if (result.operational.errors.length > 0) {
    const execErrors = result.operational.errors.filter(e => e.domain === 'execution_gate');
    for (const e of execErrors) {
      assert.fail('Execution gate should not error when would_verify=true in dryRun: ' + e.error);
    }
  }
  assert.strictEqual(result.operational.valid, true);
  assert.strictEqual(result.status, 'proven');
  const routing = routeMessage(msg, result);
  assert.strictEqual(routing.action, 'route');
});

test('consensusCheck includes checked_at and policy_version', () => {
  const msg = makeValidMsg();
  const result = consensusCheck(msg, {
    schema: { required: SCHEMA_REQUIRED },
    repoRoot: REPO_ROOT,
    dryRun: true,
  });
  assert.ok(result.checked_at);
  assert.strictEqual(result.policy_version, '1.0');
});

console.log('---');
console.log('Results:', passed, 'passed,', failed, 'failed,', passed + failed, 'total');

if (failed > 0) {
  process.exit(1);
}

console.log('\nINTEGRATION TEST: Real inbox message');
console.log('====================================');

const heartbeatPath = path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox', 'heartbeat-archivist.json');
if (fs.existsSync(heartbeatPath)) {
  try {
    const realMsg = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
    const result = consensusCheck(realMsg, {
      schema: { required: SCHEMA_REQUIRED },
      repoRoot: REPO_ROOT,
      dryRun: true,
      lane: 'archivist',
    });
    const routing = routeMessage(realMsg, result);
    console.log('  Heartbeat message consensus:', result.status);
    console.log('  Weighted score:', result.weighted_score);
    console.log('  Lane L (structural):', result.structural.valid ? 'PASS' : 'FAIL', '(score:', result.structural.score + ')');
    if (result.structural.errors.length > 0) {
      for (const e of result.structural.errors) console.log('    ERROR:', e.field, '-', e.error);
    }
    console.log('  Lane R (operational):', result.operational.valid ? 'PASS' : 'FAIL', '(score:', result.operational.score + ')');
    if (result.operational.errors.length > 0) {
      for (const e of result.operational.errors) console.log('    ERROR:', e.domain || e.field, '-', e.error);
    }
    console.log('  Drift:', result.drift.level, result.drift.cps_score !== null ? '(CPS: ' + result.drift.cps_score + ')' : '(no data)');
    console.log('  Routing:', routing.action, '-', routing.reason);
    passed++;
  } catch (err) {
    console.error('  FAIL: Integration test -', err.message);
    failed++;
  }
} else {
  console.log('  SKIP: No heartbeat message found in inbox');
}

console.log('---');
console.log('Total Results:', passed, 'passed,', failed, 'failed');

process.exit(failed > 0 ? 1 : 0);
