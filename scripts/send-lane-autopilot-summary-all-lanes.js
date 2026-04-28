#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const LANES = ['archivist', 'library', 'kernel', 'swarmmind'];
const INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
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
    'Autopilot Watcher Rollout Summary',
    '- Watch support audited across all 4 lanes.',
    '- Added checker: scripts/check-lane-watch-support.js.',
    '- Added orchestrator: scripts/lane-autopilot-orchestrator.js (spawns lane-worker watch loops for selected lanes).',
    '- Added runbook: docs/ops/LANE_AUTOPILOT_WATCHERS.md with PowerShell startup/stop commands.',
    '- Validation run: node scripts/lane-worker.js --json succeeded in Archivist/Kernel/Library/SwarmMind.',
    '',
    'Observed package watch scripts at root:',
    '- library: present (watch)',
    '- archivist/kernel/swarmmind: no root package.json watch script; use node scripts/lane-worker.js --apply --watch or orchestrator.',
    '',
    'Action request:',
    '- Optional: start orchestrator on your host for continuous processing.',
    '- No schema or authority model changes in this update.',
  ].join('\n');
}

function main() {
  const body = buildBody();
  ensureDir(OUTBOX);
  const sent = [];

  for (const lane of LANES) {
    const taskId = mkId(`lane-autopilot-summary-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'status',
      task_kind: 'status',
      priority: 'P2',
      subject: 'STATUS: lane autopilot watcher setup',
      body,
      requires_action: false,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      heartbeat: { status: 'done' },
      evidence: { required: false, verified: false },
      evidence_exchange: { artifact_path: null, artifact_type: 'log', delivered_at: ts },
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
