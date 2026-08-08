#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const TARGETS = {
  kernel: 'S:/kernel-lane/lanes/kernel/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
};
const OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function buildBody(lane, ackTargetRel) {
  const now = new Date().toISOString();
  return [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${now}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
    '',
    'ACK REQUEST: system-code-review-20260428',
    '',
    'Required action:',
    `write file ${ackTargetRel}`,
    '{',
    `  "review_id": "system-code-review-20260428",`,
    `  "lane": "${lane}",`,
    '  "ack": true,',
    '  "status": "accepted|blocked",',
    '  "owner": "<lane-owner>",',
    '  "eta_days": <number>,',
    '  "top3_actions": ["...", "...", "..."]',
    '}',
    '',
    'Rules:',
    '- ASCII only',
    '- Signed response',
    '- If blocked, include concrete blocker in top3_actions[0]',
  ].join('\n');
}

function main() {
  ensureDir(OUTBOX);
  const sent = [];

  for (const [lane, inbox] of Object.entries(TARGETS)) {
    ensureDir(inbox);
    const taskId = mkId(`ack-request-${lane}-system-code-review-20260428`);
    const ts = new Date().toISOString();
    const ackTargetRel = `lanes/${lane}/outbox/ack-system-code-review-20260428.json`;

    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P1',
      subject: 'Action Required: ACK system-code-review-20260428',
      body: buildBody(lane, ackTargetRel),
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
    sent.push({ lane, file, ack_target: ackTargetRel });
  }

  console.log(JSON.stringify({ sent }, null, 2));
}

if (require.main === module) {
  main();
}

