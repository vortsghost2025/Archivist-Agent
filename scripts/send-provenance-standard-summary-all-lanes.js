#!/usr/bin/env node
'use strict';

/**
 * Broadcast schema-valid, signed informational summary to all lane inboxes.
 * Includes mandatory output provenance header in message body.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const LANES = ['archivist', 'library', 'kernel', 'swarmmind'];
const INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  kernel: 'S:/kernel-lane/lanes/kernel/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox'
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
    `session_id: ${process.env.SESSION_ID || 'unknown'}`
  ].join('\n');
}

function buildBody() {
  const lines = [
    provenanceHeader(),
    '',
    'Summary Broadcast',
    '- Implemented mandatory final output provenance header standard in lane docs.',
    '- Added helper script: scripts/provenance-header.js (prints header or prepends to stdin body).',
    '- Added broadcast script: scripts/send-provenance-standard-summary-all-lanes.js.',
    '- Hardened message schema normalization path in Archivist send stack.',
    '',
    'Required final output header format:',
    'OUTPUT_PROVENANCE:',
    'agent: <agent-runtime-or-model>',
    'lane: <lane-id>',
    'generated_at: <ISO-8601 timestamp>',
    'session_id: <session-id-or-unknown>',
    '',
    'No action required; informational status update.'
  ];
  return lines.join('\n');
}

function main() {
  const body = buildBody();
  ensureDir(OUTBOX);

  const sent = [];
  for (const lane of LANES) {
    const taskId = mkId(`summary-provenance-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'status',
      task_kind: 'status',
      priority: 'P2',
      subject: 'STATUS: Provenance header standard enabled',
      body,
      requires_action: false,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      heartbeat: { status: 'done' },
      evidence: { required: false, verified: false },
      evidence_exchange: { artifact_path: null, artifact_type: 'log', delivered_at: ts }
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
