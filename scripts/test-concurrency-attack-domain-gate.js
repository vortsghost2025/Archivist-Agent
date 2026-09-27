#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { LaneWorker } = require('./lane-worker');
const { getCodeVersionHash } = require('./code-version-hash');

function mkDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function buildWorker(tmpRoot) {
  const lane = 'archivist';
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
  return {
    worker: new LaneWorker({
      repoRoot: tmpRoot,
      lane,
      dryRun: false,
      config,
      schemaValidator: () => ({ valid: true, errors: [] }),
      signatureValidator: () => ({ valid: true, reason: null, details: null }),
    }),
    config,
  };
}

function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrency-attack-'));
  const { worker, config } = buildWorker(tmpRoot);
  const outbox = path.join(tmpRoot, 'outbox');
  mkDir(outbox);
  const artifact = path.join(outbox, 'result.json');
  fs.writeFileSync(artifact, JSON.stringify({ ok: true }), 'utf8');

  const now = Date.now();
  const oldHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const localHash = getCodeVersionHash(tmpRoot);
  assert.notStrictEqual(oldHash, localHash, 'Test precondition: old hash must differ from local hash');

  const msg = {
    id: 'concurrency-attack',
    from: 'swarmmind',
    to: 'archivist',
    type: 'response',
    task_kind: 'report',
    priority: 'P1',
    timestamp: new Date(now).toISOString(),
    dispatch_timestamp: new Date(now - 60_000).toISOString(),
    execution_timestamp: new Date(now).toISOString(),
    requires_action: false,
    subject: 'concurrency attack simulation',
    body: 'result generated under older code hash',
    evidence_exchange: {
      artifact_path: artifact,
      delivered_at: new Date(now).toISOString(),
    },
    _governance: {
      code_version_hash: oldHash,
    },
  };

  fs.writeFileSync(path.join(config.queues.inbox, 'concurrency-attack.json'), JSON.stringify(msg, null, 2), 'utf8');
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.processed, 1, 'Post-exec mismatch should preserve execution in processed');
  const files = fs.readdirSync(config.queues.processed).filter((f) => f.endsWith('.json'));
  assert.strictEqual(files.length, 1);
  const routed = JSON.parse(fs.readFileSync(path.join(config.queues.processed, files[0]), 'utf8'));

  assert.strictEqual(routed._lane_worker.reason, 'INVALID_DOMAIN_POST_EXECUTION');
  assert.strictEqual(routed._lane_worker.verification_outcome, 'INVALID_DOMAIN');
  assert.strictEqual(routed._lane_worker.domain_gate_executed, true);
  assert.strictEqual(routed._lane_worker.domain_validation.semantic.code_version_hash_valid, false);
  assert.strictEqual(routed._lane_worker.domain_validation.execution_preserved, true);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('Concurrency attack domain-gate: PASS (hash drift forced INVALID_DOMAIN_POST_EXECUTION)');
}

if (require.main === module) main();

