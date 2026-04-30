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

function buildBody() {
  const now = new Date().toISOString();
  return [
    'OUTPUT_PROVENANCE:',
    'agent: codex-5.3',
    'lane: archivist',
    `generated_at: ${now}`,
    `session_id: ${process.env.SESSION_ID || 'unknown'}`,
    '',
    'RECOVERY STATUS CORRECTION -- CONFLICTED (NOT PROVEN)',
    '',
    'This corrects earlier narrative summaries that implied full recovery convergence.',
    'Canonical recovery artifacts currently show CONFLICTED status.',
    '',
    'Evidence:',
    '- S:/Archivist-Agent/.compact-audit/POST_COMPACT_AUDIT.json -> status=conflicted',
    '- S:/Archivist-Agent/.compact-audit/RECOVERY_TEST_RESULTS.json -> passed=10/11, all_passed=false',
    '- S:/Archivist-Agent/lanes/broadcast/last-recovery.json -> verdict=CONFLICTED',
    '',
    'Blocking reason:',
    '- Lane liveness check is not passing at required threshold.',
    '',
    'Required next steps:',
    '1) Re-run recovery suite after lane liveness is restored:',
    '   node scripts/recovery-test-suite.js',
    '2) Refresh and publish last-recovery broadcast from latest results.',
    '3) Do not mark convergence-close or Phase-2 readiness until verdict is PROVEN.',
    '',
    'Convergence Gate:',
    '{',
    '  "claim": "Recovery remains CONFLICTED; convergence-close is deferred until recovery verdict is PROVEN.",',
    '  "evidence": "S:/Archivist-Agent/.compact-audit/POST_COMPACT_AUDIT.json; S:/Archivist-Agent/.compact-audit/RECOVERY_TEST_RESULTS.json; S:/Archivist-Agent/lanes/broadcast/last-recovery.json",',
    '  "verified_by": "archivist",',
    '  "contradictions": [],',
    '  "status": "conflicted"',
    '}',
  ].join('\n');
}

function main() {
  const body = buildBody();
  ensureDir(OUTBOX);
  const sent = [];

  for (const lane of TARGET_LANES) {
    const taskId = mkId(`recovery-correction-${lane}`);
    const ts = new Date().toISOString();
    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'status',
      task_kind: 'status',
      priority: 'P1',
      subject: 'STATUS CORRECTION: recovery verdict is CONFLICTED',
      body,
      requires_action: false,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      heartbeat: { status: 'done' },
      evidence: { required: true, verified: true },
      evidence_exchange: { artifact_path: 'S:/Archivist-Agent/.compact-audit/POST_COMPACT_AUDIT.json', artifact_type: 'report', delivered_at: ts },
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
