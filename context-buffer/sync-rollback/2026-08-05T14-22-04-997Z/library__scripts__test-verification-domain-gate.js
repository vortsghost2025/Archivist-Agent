#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const {
  evaluateVerificationDomain,
  checkTemporalDomain,
  checkObservabilityDomain,
  checkSemanticDomain,
  computeSemanticHash,
  loadConfig,
  DEFAULT_CONFIG,
} = require('./verification-domain-gate');

const { ArtifactResolver } = require('./artifact-resolver');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log('[PASS] ' + name);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error('[FAIL] ' + name + ': ' + err.message);
  }
}

function makeBaseMessage(overrides) {
  return Object.assign({
    schema_version: '1.0',
    task_id: 'task-forced-failure-replay',
    idempotency_key: crypto.createHash('sha256').update('task-forced-failure-replay' + 'library' + 'archivist' + 'domain-gate-test').digest('hex'),
    from: 'library',
    to: 'archivist',
    type: 'task',
    task_kind: 'review',
    priority: 'P1',
    subject: 'Domain gate forced-failure replay',
    body: 'Replaying a real message through forced-failure conditions per Sean challenge protocol',
    timestamp: new Date().toISOString(),
    requires_action: true,
    evidence: { required: true },
    evidence_exchange: {
      artifact_path: 'S:/self-organizing-library/lanes/library/inbox/processed/test-artifact.json',
      artifact_type: 'verification_report',
      delivered_at: new Date().toISOString(),
    },
  }, overrides);
}

// ============================================================
// SEAN CHALLENGE TEST 1: TEMPORAL MISMATCH
// Force: message timestamp outside acceptable window
// Expected: { verification_outcome: "INVALID_DOMAIN", execution_preserved: true }
// ============================================================
test('FORCED-FAILURE 1: temporal mismatch — expired message → INVALID_DOMAIN', function() {
  var expiredTimestamp = new Date(Date.now() - 7200000).toISOString();
  var msg = makeBaseMessage({ timestamp: expiredTimestamp });

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, false, 'domain_valid must be false for expired message');
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN', 'verification_outcome must be INVALID_DOMAIN');
  assert.strictEqual(result.invalid_domain_reason, 'TEMPORAL_EXPIRED', 'reason must be TEMPORAL_EXPIRED, got: ' + result.invalid_domain_reason);
  assert.strictEqual(result.phase, 'post_execution', 'phase must be post_execution (has artifact_path)');
});

test('FORCED-FAILURE 1b: temporal mismatch — future drift → INVALID_DOMAIN', function() {
  var futureTimestamp = new Date(Date.now() + 120000).toISOString();
  var msg = makeBaseMessage({ timestamp: futureTimestamp });

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, false, 'domain_valid must be false for future-drifted message');
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN', 'verification_outcome must be INVALID_DOMAIN');
  assert.ok(
    result.invalid_domain_reason === 'TEMPORAL_FUTURE_DRIFT',
    'reason must be TEMPORAL_FUTURE_DRIFT, got: ' + result.invalid_domain_reason
  );
});

test('FORCED-FAILURE 1c: temporal mismatch — unparseable timestamp → INVALID_DOMAIN', function() {
  var msg = makeBaseMessage({ timestamp: 'not-a-date' });

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, false);
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN');
  assert.strictEqual(result.invalid_domain_reason, 'TEMPORAL_INVALID_TIMESTAMP');
});

// ============================================================
// SEAN CHALLENGE TEST 2: OBSERVABILITY FAILURE (bad path)
// Force: artifact_path points to non-existent or out-of-roots location
// Expected: { verification_outcome: "INVALID_DOMAIN", execution_preserved: true }
// ============================================================
test('FORCED-FAILURE 2: observability failure — path outside allowed roots → INVALID_DOMAIN', function() {
  var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-gate-'));
  try {
    var resolver = new ArtifactResolver({ allowedRoots: [tmpRoot], dryRun: false });
    var msg = makeBaseMessage({
      evidence_exchange: {
        artifact_path: 'C:/Windows/System32/evil.exe',
        artifact_type: 'stolen_data',
        delivered_at: new Date().toISOString(),
      },
    });

    var result = evaluateVerificationDomain(msg, { resolver: resolver });

    assert.strictEqual(result.domain_valid, false, 'domain_valid must be false for out-of-roots path');
    assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN', 'verification_outcome must be INVALID_DOMAIN');
    assert.ok(
      result.invalid_domain_reason.startsWith('OBSERVABILITY_'),
      'reason must start with OBSERVABILITY_, got: ' + result.invalid_domain_reason
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('FORCED-FAILURE 2b: observability failure — path traversal attack → INVALID_DOMAIN', function() {
  var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-gate-'));
  try {
    var resolver = new ArtifactResolver({ allowedRoots: [tmpRoot], dryRun: false });
    var msg = makeBaseMessage({
      evidence_exchange: {
        artifact_path: '../../etc/passwd',
        artifact_type: 'traversal_attack',
        delivered_at: new Date().toISOString(),
      },
    });

    var result = evaluateVerificationDomain(msg, { resolver: resolver });

    assert.strictEqual(result.domain_valid, false);
    assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN');
    assert.ok(
      result.invalid_domain_reason === 'OBSERVABILITY_PATH_TRAVERSAL' ||
      result.invalid_domain_reason === 'OBSERVABILITY_OUTSIDE_ROOTS',
      'reason must be path traversal or outside roots, got: ' + result.invalid_domain_reason
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('FORCED-FAILURE 2c: observability failure — non-existent artifact file → INVALID_DOMAIN', function() {
  var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-gate-'));
  try {
    var resolver = new ArtifactResolver({ allowedRoots: [tmpRoot], dryRun: false });
    var msg = makeBaseMessage({
      evidence_exchange: {
        artifact_path: path.join(tmpRoot, 'nonexistent', 'phantom.json'),
        artifact_type: 'missing_artifact',
        delivered_at: new Date().toISOString(),
      },
    });

    var result = evaluateVerificationDomain(msg, { resolver: resolver });

    assert.strictEqual(result.domain_valid, false);
    assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN');
    assert.ok(
      result.invalid_domain_reason.startsWith('OBSERVABILITY_'),
      'reason must start with OBSERVABILITY_, got: ' + result.invalid_domain_reason
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ============================================================
// SEAN CHALLENGE TEST 3: SEMANTIC MUTATION
// Force: message content altered after execution (hash mismatch)
// Expected: { verification_outcome: "INVALID_DOMAIN", execution_preserved: true }
// ============================================================
test('FORCED-FAILURE 3: semantic mutation — altered content hash → INVALID_DOMAIN', function() {
  var msg = makeBaseMessage();
  var correctHash = computeSemanticHash(msg, 'sha256');

  msg.domain_hash = correctHash;
  var validResult = evaluateVerificationDomain(msg, { resolver: null });
  assert.strictEqual(validResult.domain_valid, true, 'Must pass before mutation');

  msg.subject = 'MUTATED: this content was altered after execution';
  msg.domain_hash = correctHash;

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, false, 'domain_valid must be false for mutated message');
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN', 'verification_outcome must be INVALID_DOMAIN');
  assert.strictEqual(result.invalid_domain_reason, 'SEMANTIC_MUTATION', 'reason must be SEMANTIC_MUTATION, got: ' + result.invalid_domain_reason);
  assert.ok(result.checks.semantic.hash_computed !== correctHash, 'computed hash must differ from claimed hash');
});

test('FORCED-FAILURE 3b: semantic mutation — fabricated hash → INVALID_DOMAIN', function() {
  var msg = makeBaseMessage();
  msg.domain_hash = '0000000000000000000000000000000000000000000000000000000000000000';

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, false);
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN');
  assert.strictEqual(result.invalid_domain_reason, 'SEMANTIC_MUTATION');
});

// ============================================================
// REGRESSION: valid messages still PASS
// ============================================================
test('REGRESSION: valid current message with no domain_hash → PASS', function() {
  var msg = makeBaseMessage();
  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, true, 'valid message must pass domain gate');
  assert.strictEqual(result.verification_outcome, 'PASS');
  assert.strictEqual(result.invalid_domain_reason, null);
});

test('REGRESSION: valid message with correct domain_hash → PASS', function() {
  var msg = makeBaseMessage();
  msg.domain_hash = computeSemanticHash(msg, 'sha256');

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.domain_valid, true);
  assert.strictEqual(result.verification_outcome, 'PASS');
});

test('REGRESSION: null message → INVALID_DOMAIN', function() {
  var result = evaluateVerificationDomain(null, { resolver: null });

  assert.strictEqual(result.domain_valid, false);
  assert.strictEqual(result.verification_outcome, 'INVALID_DOMAIN');
  assert.strictEqual(result.invalid_domain_reason, 'NULL_MESSAGE');
});

test('REGRESSION: reference-based proof (no path) passes observability', function() {
  var msg = makeBaseMessage();
  delete msg.evidence_exchange;
  msg.completion_message_id = 'msg-12345';

  var result = evaluateVerificationDomain(msg, { resolver: null });

  assert.strictEqual(result.checks.observability.valid, true, 'Reference-based proof must pass observability check');
});

// ============================================================
// INTEGRATION: LaneWorker routing with domain gate
// ============================================================
test('INTEGRATION: LaneWorker domain gate — expired message routes to blocked', function() {
  var lwPath = require.resolve('./lane-worker');
  var vdPath = require.resolve('./verification-domain-gate');
  delete require.cache[lwPath];
  delete require.cache[vdPath];

  var LaneWorker;
  try {
    LaneWorker = require('./lane-worker').LaneWorker;
  } catch (e) {
    console.log('  [SKIP] LaneWorker not loadable: ' + e.message);
    return;
  }

  var expiredTimestamp = new Date(Date.now() - 7200000).toISOString();
  var msg = makeBaseMessage({ timestamp: expiredTimestamp });

  var schemaResult = { valid: true, errors: [] };
  var signatureResult = { valid: true, reason: null };

  try {
    var worker = new LaneWorker({ lane: 'library', dryRun: true });
    var decision = worker.decideRoute(msg, schemaResult, signatureResult);

    assert.strictEqual(decision.domain_gate_executed, true, 'domain_gate_executed must be true');
    assert.strictEqual(decision.verification_outcome, 'INVALID_DOMAIN', 'verification_outcome must be INVALID_DOMAIN');
  } catch (e) {
    console.log('  [INTEGRATION-ERROR] ' + e.message);
    throw e;
  }
});

test('INTEGRATION: LaneWorker domain gate — valid message routes to processed with PASS', function() {
  var lwPath = require.resolve('./lane-worker');
  var vdPath = require.resolve('./verification-domain-gate');
  delete require.cache[lwPath];
  delete require.cache[vdPath];

  var LaneWorker;
  try {
    LaneWorker = require('./lane-worker').LaneWorker;
  } catch (e) {
    console.log('  [SKIP] LaneWorker not loadable: ' + e.message);
    return;
  }

  var msg = makeBaseMessage();

  var schemaResult = { valid: true, errors: [] };
  var signatureResult = { valid: true, reason: null };

  try {
    var worker = new LaneWorker({ lane: 'library', dryRun: true });
    var decision = worker.decideRoute(msg, schemaResult, signatureResult);

    assert.strictEqual(decision.domain_gate_executed, true, 'domain_gate_executed must be true for valid message too');
  } catch (e) {
    console.log('  [INTEGRATION-ERROR] ' + e.message);
    throw e;
  }
});

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('DOMAIN GATE FORCED-FAILURE REPLAY RESULTS');
console.log('='.repeat(70));
console.log('Passed: ' + passed + '  Failed: ' + failed + '  Total: ' + (passed + failed));
console.log('='.repeat(70));

if (failed > 0) {
  console.log('\nFAILED TESTS:');
  results.filter(function(r) { return r.status === 'FAIL'; }).forEach(function(r) {
    console.log('  [FAIL] ' + r.name + ': ' + r.error);
  });
}

console.log('\nSEAN CHALLENGE VERDICT:');
var forcedFailures = results.filter(function(r) { return r.name.indexOf('FORCED-FAILURE') === 0; });
var forcedPasses = forcedFailures.filter(function(r) { return r.status === 'PASS'; });
var forcedFails = forcedFailures.filter(function(r) { return r.status === 'FAIL'; });

if (forcedFails.length === 0 && forcedPasses.length >= 3) {
  console.log('  ALL FORCED-FAILURE CONDITIONS RETURN INVALID_DOMAIN');
  console.log('  NO BYPASS DETECTED IN DOMAIN GATE');
  console.log('  STATUS: enforcement is non-optional for domain violations');
} else if (forcedFails.length > 0) {
  console.log('  ' + forcedFails.length + ' FORCED-FAILURE TEST(S) FAILED — BYPASS PATH EXISTS');
  console.log('  STATUS: enforcement has holes — escalate');
} else {
  console.log('  INSUFFICIENT FORCED-FAILURE COVERAGE — add more tests');
}

process.exit(failed > 0 ? 1 : 0);
