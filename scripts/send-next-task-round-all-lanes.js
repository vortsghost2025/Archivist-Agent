#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const TARGET_LANES = ['archivist', 'kernel', 'library', 'swarmmind'];
const INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
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

function buildBody(targetLane) {
  const now = new Date().toISOString();
  return [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${now}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
    '',
    `TASK ROUND: ${targetLane.toUpperCase()} -- CONTINUE WITHOUT WAITING FOR MANUAL PINGS`,
    '',
    'Objective:',
    '- Continue processing your lane inbox as new mail arrives.',
    '- Return a signed response with current progress and next blocker.',
    '',
    'Required response content:',
    '1) What was processed since last check',
    '2) Current blocker (or "none")',
    '3) Next smallest action',
    '4) Queue counts: action-required, in-progress, blocked, quarantine',
    '5) Any mail-system pain points observed in this cycle',
    '',
    'Execution note:',
    '- Keep watcher/worker flow active on your lane side.',
    '- Use canonical lanes/ inbox+outbox paths only.',
    '- Preserve forensic evidence; do not rewrite historical artifacts.',
    '',
    'Convergence gate status for this response:',
    '- proven / blocked / conflicted',
  ].join('\n');
}

function main() {
  ensureDir(OUTBOX);
  const sent = [];

  for (const lane of TARGET_LANES) {
    const taskId = mkId(`next-task-round-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P2',
      subject: 'TASK ROUND: process inbox and report status',
      body: buildBody(lane),
      requires_action: true,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      heartbeat: { status: 'pending' },
      evidence: { required: true, verified: false },
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
