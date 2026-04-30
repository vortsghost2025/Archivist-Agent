#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const TARGETS = {
  kernel: 'S:/kernel-lane/lanes/kernel/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
};
const OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function buildBody(lane) {
  const ackTargetRel = `lanes/${lane}/outbox/ack-system-code-review-20260428.json`;
  return [
    'ACK REPAIR REQUEST: system-code-review-20260428',
    '',
    'Previous ack file contains placeholders and is not valid.',
    'Overwrite it with concrete values only.',
    '',
    `write file ${ackTargetRel}`,
    '{',
    '  "review_id": "system-code-review-20260428",',
    `  "lane": "${lane}",`,
    '  "ack": true,',
    '  "status": "accepted",',
    `  "owner": "${lane}",`,
    '  "eta_days": 2,',
    '  "top3_actions": ["action1", "action2", "action3"],',
    `  "timestamp": "${new Date().toISOString()}"`,
    '}',
  ].join('\n');
}

function main() {
  ensureDir(OUTBOX);
  const sent = [];
  for (const [lane, inbox] of Object.entries(TARGETS)) {
    ensureDir(inbox);
    const taskId = mkId(`ack-repair-${lane}-system-code-review-20260428`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P1',
      subject: 'Action Required: Repair ACK payload',
      body: buildBody(lane),
      requires_action: true,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      evidence: { required: false, verified: false },
      evidence_exchange: { artifact_path: null, artifact_type: 'report', delivered_at: ts },
      heartbeat: { status: 'pending' },
      allow_cross_instance: true,
    });
    const signed = createSignedMessage(msg, 'archivist');
    const file = `${taskId}.json`;
    fs.writeFileSync(path.join(inbox, file), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, file), JSON.stringify(signed, null, 2), 'utf8');
    sent.push({ lane, file });
  }
  console.log(JSON.stringify({ sent }, null, 2));
}

if (require.main === module) {
  main();
}

