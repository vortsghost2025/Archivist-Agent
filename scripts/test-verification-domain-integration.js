#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { LaneWorker } = require('./lane-worker');
const { ArtifactResolver } = require('./artifact-resolver');

function mkDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function makeWorker(tmpRoot, lane = 'archivist') {
  const inbox = path.join(tmpRoot, 'lanes', lane, 'inbox');
  const config = {
    repoRoot: tmpRoot,
    lane,
    queues: {
      inbox,
      actionRequired: path.join(inbox, 'action-required'),
      inProgress: path.join(inbox, 'in-progress'),
      processed: path.join(inbox, 'processed'),
      blocked: path.join(inbox, 'blocked'),
      quarantine: path.join(inbox, 'quarantine'),
    },
  };
  mkDir(config.queues.inbox);
  const resolver = new ArtifactResolver({ allowedRoots: [tmpRoot], dryRun: false });
  return {
    config,
    worker: new LaneWorker({
      repoRoot: tmpRoot,
      lane,
      dryRun: false,
      config,
      artifactResolver: resolver,
      schemaValidator: () => ({ valid: true, errors: [] }),
      signatureValidator: () => ({ valid: true, reason: null, details: null }),
    }),
  };
}

function writeMsg(inbox, filename, msg) {
  const p = path.join(inbox, filename);
  fs.writeFileSync(p, JSON.stringify(msg, null, 2), 'utf8');
  return p;
}

function readSingleJson(dirPath) {
  const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath).filter((f) => f.endsWith('.json')) : [];
  assert.strictEqual(files.length, 1, `Expected exactly one JSON file in ${dirPath}`);
  return JSON.parse(fs.readFileSync(path.join(dirPath, files[0]), 'utf8'));
}

function runPreExecutionInvalid(tmpRoot) {
  const { worker, config } = makeWorker(tmpRoot);
  const now = Date.now();
  const msg = {
    id: 'pre-invalid',
    from: 'swarmmind',
    to: 'archivist',
    type: 'task',
    priority: 'P1',
    task_kind: 'review',
    timestamp: new Date(now).toISOString(),
    dispatch_timestamp: new Date(now).toISOString(),
    requires_action: true,
    subject: 'pre execution invalid',
    body: 'domain invalid before execution',
    evidence_exchange: {
      artifact_path: path.join(tmpRoot, 'outbox', 'missing-proof.json'),
    },
  };
  writeMsg(config.queues.inbox, 'pre-invalid.json', msg);
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.blocked, 1, 'Pre-execution invalid should block');
  const routed = readSingleJson(config.queues.blocked);
  assert.strictEqual(routed._lane_worker.reason, 'INVALID_DOMAIN_PRE_EXECUTION');
  assert.strictEqual(routed._lane_worker.domain_gate_executed, true);
}

function runPostExecutionInvalid(tmpRoot) {
  const { worker, config } = makeWorker(tmpRoot);
  const now = Date.now();
  const msg = {
    id: 'post-invalid',
    from: 'swarmmind',
    to: 'archivist',
    type: 'response',
    priority: 'P1',
    task_kind: 'report',
    timestamp: new Date(now).toISOString(),
    dispatch_timestamp: new Date(now - 60_000).toISOString(),
    execution_timestamp: new Date(now).toISOString(),
    requires_action: false,
    subject: 'post execution invalid',
    body: 'artifact not observable',
    evidence_exchange: {
      artifact_path: 'S:/outside-allowed/not-observable.json',
      delivered_at: new Date(now).toISOString(),
    },
  };
  writeMsg(config.queues.inbox, 'post-invalid.json', msg);
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.processed, 1, 'Post-execution invalid should preserve execution in processed');
  const routed = readSingleJson(config.queues.processed);
  assert.strictEqual(routed._lane_worker.reason, 'INVALID_DOMAIN_POST_EXECUTION');
  assert.strictEqual(routed._lane_worker.verification_outcome, 'INVALID_DOMAIN');
  assert.strictEqual(routed._lane_worker.domain_validation.execution_preserved, true);
  assert.strictEqual(routed._lane_worker.domain_gate_executed, true);
}

function runControlValid(tmpRoot) {
  const { worker, config } = makeWorker(tmpRoot);
  const artifactDir = path.join(tmpRoot, 'outbox');
  mkDir(artifactDir);
  const artifactPath = path.join(artifactDir, 'valid-proof.json');
  fs.writeFileSync(artifactPath, JSON.stringify({ ok: true }), 'utf8');

  const now = Date.now();
  const msg = {
    id: 'control-valid',
    from: 'swarmmind',
    to: 'archivist',
    type: 'response',
    priority: 'P1',
    task_kind: 'report',
    timestamp: new Date(now).toISOString(),
    dispatch_timestamp: new Date(now - 60_000).toISOString(),
    execution_timestamp: new Date(now).toISOString(),
    requires_action: false,
    subject: 'control valid',
    body: 'valid classification path',
    evidence_exchange: {
      artifact_path: artifactPath,
      delivered_at: new Date(now).toISOString(),
    },
  };
  writeMsg(config.queues.inbox, 'control-valid.json', msg);
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.processed, 1, 'Valid path should process');
  const routed = readSingleJson(config.queues.processed);
  assert.ok(['PASS', 'FAIL'].includes(routed._lane_worker.verification_outcome), 'Expected PASS/FAIL outcome');
  assert.strictEqual(routed._lane_worker.domain_gate_executed, true);
}

function main() {
  const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'vdg-int-a-'));
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'vdg-int-b-'));
  const rootC = fs.mkdtempSync(path.join(os.tmpdir(), 'vdg-int-c-'));
  try {
    runPreExecutionInvalid(rootA);
    runPostExecutionInvalid(rootB);
    runControlValid(rootC);
    console.log('Verification domain integration: PASS (3/3 scenarios, non-bypass assertion satisfied)');
  } finally {
    fs.rmSync(rootA, { recursive: true, force: true });
    fs.rmSync(rootB, { recursive: true, force: true });
    fs.rmSync(rootC, { recursive: true, force: true });
  }
}

if (require.main === module) main();

