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

function provenanceHeader() {
  return [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${new Date().toISOString()}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
  ].join('\n');
}

function buildBody() {
  return [
    provenanceHeader(),
    '',
    'Request: Cross-Repo Terminology Alignment Pass',
    'Please run the same terminology consistency update completed in Archivist:',
    '- Replace stale "three-lane / all three lanes" wording with current active-lane wording where appropriate.',
    '- Keep canonical lane registry terms aligned with lane-registry.json.',
    '- Prefer "lanes/" messaging terminology over legacy lane-relay wording in active docs.',
    '- Preserve historical/evidence artifacts as historical records (do not rewrite evidence logs).',
    '',
    'Deliverable requested:',
    '- Send a signed summary to Archivist inbox with:',
    '  1) files updated',
    '  2) wording changes made',
    '  3) any places intentionally left unchanged (with reason)',
    '  4) remaining risks/gaps',
    '',
    'Priority: P2',
  ].join('\n');
}

function main() {
  const body = buildBody();
  ensureDir(OUTBOX);
  const sent = [];

  for (const lane of TARGET_LANES) {
    const taskId = mkId(`terminology-alignment-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P2',
      subject: 'TASK: run terminology alignment pass and report summary',
      body,
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
