#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LaneWorker } = require('./lane-worker');

function mkDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function setupWorker(tmpRoot, opts = {}) {
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
  mkDir(inbox);
  return new LaneWorker({
    repoRoot: tmpRoot,
    lane,
    dryRun: false,
    config,
    enforceOwnership: opts.enforceOwnership === true,
    schemaValidator: () => ({ valid: true, errors: [] }),
    signatureValidator: () => ({ valid: true, reason: null, details: null }),
  });
}

function writeMsg(inbox, name, msg) {
  fs.writeFileSync(path.join(inbox, name), JSON.stringify(msg, null, 2), 'utf8');
}

function baseMsg(ownership) {
  return {
    id: 'ownership-test',
    from: 'library',
    to: 'archivist',
    type: 'task',
    priority: 'P1',
    timestamp: new Date().toISOString(),
    requires_action: true,
    subject: 'ownership test',
    body: 'execute task',
    ownership,
  };
}

function runCase(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-enforce-'));
  try {
    fn(tmp);
    console.log(`[PASS] ${name}`);
  } finally {
    rmDir(tmp);
  }
}

const prevAgent = process.env.AGENT_INSTANCE_ID;
process.env.AGENT_INSTANCE_ID = 'archivist-fast';

// matching owner allowed
runCase('matching owner allowed', (tmp) => {
  const worker = setupWorker(tmp, { enforceOwnership: true });
  const inbox = worker.config.queues.inbox;
  writeMsg(inbox, 'match.json', baseMsg({
    owner_agent_id: 'archivist-fast',
    lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }));
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.action_required, 1);
  assert.strictEqual(summary.routed.blocked, 0);
});

// mismatched owner blocked
runCase('mismatched owner blocked', (tmp) => {
  const worker = setupWorker(tmp, { enforceOwnership: true });
  const inbox = worker.config.queues.inbox;
  writeMsg(inbox, 'mismatch.json', baseMsg({
    owner_agent_id: 'archivist-slow',
    lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }));
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.blocked, 1);
  assert.strictEqual(summary.routes[0].reason, 'OWNERSHIP_ENFORCED_MISMATCH');
});

// expired lease allowed with warning
runCase('expired lease allowed with warning', (tmp) => {
  const worker = setupWorker(tmp, { enforceOwnership: true });
  const inbox = worker.config.queues.inbox;
  writeMsg(inbox, 'expired.json', baseMsg({
    owner_agent_id: 'archivist-slow',
    lease_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  }));
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.action_required, 1);
  assert.strictEqual(summary.routed.blocked, 0);
  assert.ok((summary.routes[0].ownership_notes || []).includes('OWNERSHIP_LEASE_EXPIRED'));
});

// missing ownership allowed with warning
runCase('missing ownership allowed with warning', (tmp) => {
  const worker = setupWorker(tmp, { enforceOwnership: true });
  const inbox = worker.config.queues.inbox;
  const msg = baseMsg(undefined);
  delete msg.ownership;
  writeMsg(inbox, 'missing.json', msg);
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.action_required, 1);
  assert.strictEqual(summary.routed.blocked, 0);
  assert.ok((summary.routes[0].ownership_notes || []).includes('OWNERSHIP_MISSING'));
});

// malformed ownership quarantined
runCase('malformed ownership quarantined', (tmp) => {
  const worker = setupWorker(tmp, { enforceOwnership: true });
  const inbox = worker.config.queues.inbox;
  writeMsg(inbox, 'malformed.json', baseMsg({
    owner_agent_id: 12345,
    lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }));
  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.quarantine, 1);
  assert.strictEqual(summary.routes[0].reason, 'OWNERSHIP_MALFORMED');
});

if (prevAgent === undefined) delete process.env.AGENT_INSTANCE_ID;
else process.env.AGENT_INSTANCE_ID = prevAgent;
