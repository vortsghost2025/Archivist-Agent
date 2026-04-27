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

function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-integration-'));
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

  const prev = process.env.AGENT_INSTANCE_ID;
  process.env.AGENT_INSTANCE_ID = 'archivist-fast';

  const worker = new LaneWorker({
    repoRoot: tmpRoot,
    lane,
    dryRun: false,
    config,
    enforceOwnership: true,
    schemaValidator: () => ({ valid: true, errors: [] }),
    signatureValidator: () => ({ valid: true, reason: null, details: null }),
  });

  const msg = {
    id: 'ownership-integration-expired',
    from: 'library',
    to: 'archivist',
    type: 'task',
    priority: 'P1',
    timestamp: new Date().toISOString(),
    requires_action: true,
    subject: 'expired lease integration',
    body: 'should be allowed with warning note',
    ownership: {
      owner_agent_id: 'archivist-slow',
      lease_expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  };
  fs.writeFileSync(path.join(inbox, 'expired-lease.json'), JSON.stringify(msg, null, 2), 'utf8');

  const summary = worker.processOnce();
  assert.strictEqual(summary.routed.action_required, 1, 'expired lease should route actionable task');
  assert.strictEqual(summary.routed.blocked, 0, 'expired lease should not block');

  const arFiles = fs.readdirSync(config.queues.actionRequired).filter((f) => f.endsWith('.json'));
  assert.strictEqual(arFiles.length, 1, 'downstream message should exist in action-required');
  const routed = JSON.parse(fs.readFileSync(path.join(config.queues.actionRequired, arFiles[0]), 'utf8'));
  const notes = routed._lane_worker && Array.isArray(routed._lane_worker.ownership_notes)
    ? routed._lane_worker.ownership_notes
    : [];
  assert.ok(notes.includes('OWNERSHIP_LEASE_EXPIRED'), 'ownership warning note missing');

  if (prev === undefined) delete process.env.AGENT_INSTANCE_ID;
  else process.env.AGENT_INSTANCE_ID = prev;

  console.log('[PASS] ownership enforce integration: expired lease warns and routes');
}

try {
  run();
} catch (err) {
  console.error('[FAIL]', err.message);
  process.exit(1);
}
