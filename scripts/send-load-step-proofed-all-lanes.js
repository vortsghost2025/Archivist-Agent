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
const PROOF_DIR = 'S:/Archivist-Agent/lanes/broadcast/load-proofs';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function main() {
  ensureDir(OUTBOX);
  ensureDir(PROOF_DIR);
  const now = new Date().toISOString();
  const sent = [];

  for (const [lane, inbox] of Object.entries(TARGETS)) {
    ensureDir(inbox);
    const taskId = mkId(`load-proofed-${lane}`);
    const proofRel = `lanes/broadcast/load-proofs/${taskId}.txt`;
    const proofAbs = path.join('S:/Archivist-Agent', proofRel);
    fs.writeFileSync(
      proofAbs,
      [
        `task_id=${taskId}`,
        `lane=${lane}`,
        `created_at=${now}`,
        'purpose=throughput_probe',
      ].join('\n'),
      'utf8'
    );

    const body = [
      'OUTPUT_PROVENANCE:',
      'agent: codex-5.3',
      'lane: archivist',
      `generated_at: ${now}`,
      `session_id: ${process.env.SESSION_ID || 'unknown'}`,
      '',
      `PROOFED LOAD PROBE (${lane})`,
      '- Process and return one-line queue status.',
      `- Evidence artifact: ${proofRel}`,
    ].join('\n');

    const msg = buildCanonicalMessage({
      task_id: taskId,
      from: 'archivist',
      to: lane,
      type: 'task',
      task_kind: 'review',
      priority: 'P2',
      subject: 'PROOFED LOAD PROBE: process and report',
      body,
      requires_action: true,
      execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
      evidence: { required: true, verified: false },
      evidence_exchange: {
        artifact_path: proofAbs,
        artifact_type: 'report',
        delivered_at: now,
      },
      heartbeat: { status: 'pending' },
      allow_cross_instance: true,
    });

    const signed = createSignedMessage(msg, 'archivist');
    const file = `${taskId}.json`;
    fs.writeFileSync(path.join(inbox, file), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, file), JSON.stringify(signed, null, 2), 'utf8');
    sent.push({ lane, file, proof: proofRel });
  }

  console.log(JSON.stringify({ sent }, null, 2));
}

if (require.main === module) {
  main();
}
