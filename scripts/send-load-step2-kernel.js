#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const INBOX_BY_LANE = {
  kernel: 'S:/kernel-lane/lanes/kernel/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
};
const OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function main() {
  const lane = (process.argv[2] || 'kernel').toLowerCase();
  if (!INBOX_BY_LANE[lane]) {
    throw new Error('Unsupported lane. Use: kernel or library');
  }
  const taskId = mkId(`load-step2-${lane}`);
  const ts = new Date().toISOString();
  const body = [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${ts}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
    '',
    `LOAD STEP 2 (${lane})`,
    '- Process this task and return an ASCII-only status packet.',
    '- Include: processed count, blocker, next action, queue counts.',
  ].join('\n');

  const msg = buildCanonicalMessage({
    task_id: taskId,
    from: 'archivist',
    to: lane,
    type: 'task',
    task_kind: 'review',
    priority: 'P2',
    subject: `LOAD STEP 2: ${lane} throughput probe`,
    body,
    requires_action: true,
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    heartbeat: { status: 'pending' },
    evidence: { required: false, verified: false },
    evidence_exchange: { artifact_path: null, artifact_type: 'report', delivered_at: ts },
  });

  const signed = createSignedMessage(msg, 'archivist');
  const fileName = `${taskId}.json`;
  ensureDir(INBOX_BY_LANE[lane]);
  ensureDir(OUTBOX);
  fs.writeFileSync(path.join(INBOX_BY_LANE[lane], fileName), JSON.stringify(signed, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUTBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
  console.log(JSON.stringify({ lane, file: fileName, key_id: signed.key_id }, null, 2));
}

if (require.main === module) {
  main();
}
