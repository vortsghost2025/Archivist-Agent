#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const TARGET_LANES = ['kernel', 'library', 'swarmmind'];
const INBOX = {
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

function bodyFor(lane) {
  const now = new Date().toISOString();
  return [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${now}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
    '',
    `LOAD STEP 1 (${lane})`,
    '- Process this task and respond with a concise status packet.',
    '- Include: processed count, current blocker, next smallest action.',
    '- Keep response ASCII-only.',
  ].join('\n');
}

function main() {
  ensureDir(OUTBOX);
  const sent = [];

  for (const lane of TARGET_LANES) {
    const taskId = mkId(`load-step1-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P2',
      subject: 'LOAD STEP 1: process and report',
      body: bodyFor(lane),
      requires_action: true,
      allow_cross_instance: true,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      heartbeat: { status: 'pending' },
      evidence: { required: false, verified: false },
      evidence_exchange: { artifact_path: null, artifact_type: 'report', delivered_at: ts },
    });

    const signed = createSignedMessage(msg, 'archivist');
    const fileName = `${taskId}.json`;

    ensureDir(INBOX[lane]);
    fs.writeFileSync(path.join(INBOX[lane], fileName), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
    sent.push({ lane, file: fileName, key_id: signed.key_id });
  }

  console.log(JSON.stringify({ sent }, null, 2));
}

if (require.main === module) {
  main();
}
