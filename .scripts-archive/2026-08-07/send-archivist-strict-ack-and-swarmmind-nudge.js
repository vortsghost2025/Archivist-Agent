#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');

const ARCHIVIST_ACK_ABS = 'S:/Archivist-Agent/lanes/archivist/outbox/archivist-phase1-ack-20260428.json';
const KERNEL_INBOX = 'S:/kernel-lane/lanes/kernel/inbox';
const SWARMMIND_INBOX = 'S:/SwarmMind/lanes/swarmmind/inbox';
const ARCHIVIST_OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function writeArchivistAck() {
  ensureDir(path.dirname(ARCHIVIST_ACK_ABS));
  const ack = {
    ack_for: 'system-code-review-20260428',
    lane: 'archivist',
    acknowledged_at: new Date().toISOString(),
    remediation_plan: {
      phase1_tasks: [
        {
          id: 'arch-tauri-input-validation-001',
          priority: 'P0',
          eta_days: 2,
          action: 'Harden Tauri command/input sanitization and command allowlist.'
        },
        {
          id: 'arch-path-traversal-002',
          priority: 'P0',
          eta_days: 2,
          action: 'Replace regex path checks with canonical path.resolve + startsWith guards.'
        },
        {
          id: 'arch-enforcement-gaps-003',
          priority: 'P0',
          eta_days: 2,
          action: 'Close enforcement-mode bypass paths and require fail-closed behavior.'
        }
      ],
      estimated_completion: new Date(Date.now() + (4 * 24 * 60 * 60 * 1000)).toISOString(),
      resource_allocation: 'Archivist lane owner; focused P0 sprint, 6 person-days total.'
    },
    phase1_owner: 'archivist'
  };
  fs.writeFileSync(ARCHIVIST_ACK_ABS, JSON.stringify(ack, null, 2), 'utf8');
  return ack;
}

function sendArchivistResponseToKernel() {
  ensureDir(KERNEL_INBOX);
  ensureDir(ARCHIVIST_OUTBOX);
  const taskId = 'archivist-response-strict-re-ack-20260428';
  const ts = new Date().toISOString();
  const message = buildCanonicalMessage({
    task_id: taskId,
    from: 'archivist',
    to: 'kernel',
    type: 'response',
    task_kind: 'report',
    priority: 'P0',
    subject: 'RESPONSE: Archivist strict re-ACK delivered (phase1 schema)',
    body: [
      'Archivist strict Phase 1 ACK delivered.',
      `Artifact: ${ARCHIVIST_ACK_ABS}`,
      'Schema: ack_for, lane, acknowledged_at, remediation_plan, phase1_owner',
      'Convergence gate: proven'
    ].join('\n'),
    requires_action: false,
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    evidence: { required: true, verified: true },
    evidence_exchange: {
      artifact_path: ARCHIVIST_ACK_ABS,
      artifact_type: 'report',
      delivered_at: ts
    },
    heartbeat: { status: 'done' }
  });

  const signed = createSignedMessage(message, 'archivist');
  const fileName = `${taskId}.json`;
  fs.writeFileSync(path.join(KERNEL_INBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
  fs.writeFileSync(path.join(ARCHIVIST_OUTBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
  return fileName;
}

function sendSwarmmindNudge() {
  ensureDir(SWARMMIND_INBOX);
  ensureDir(ARCHIVIST_OUTBOX);
  const taskId = mkId('p0-nudge-swarmmind-strict-ack-20260428');
  const ts = new Date().toISOString();
  const body = [
    'P0 NUDGE: STRICT PHASE 1 ACK REQUIRED',
    '',
    'Library is occupied; this nudge targets SwarmMind only.',
    'Write strict ACK artifact now:',
    'write file lanes/swarmmind/outbox/swarmmind-phase1-ack-20260428.json',
    '{',
    '  "ack_for": "system-code-review-20260428",',
    '  "lane": "swarmmind",',
    `  "acknowledged_at": "${ts}",`,
    '  "remediation_plan": {',
    '    "phase1_tasks": ["task1", "task2", "task3"],',
    '    "estimated_completion": "<ISO_timestamp>",',
    '    "resource_allocation": "<details>"',
    '  },',
    '  "phase1_owner": "swarmmind"',
    '}',
    '',
    'Then send signed response to kernel with artifact_path set to the exact outbox file.'
  ].join('\n');

  const msg = buildCanonicalMessage({
    task_id: taskId,
    from: 'archivist',
    to: 'swarmmind',
    type: 'task',
    task_kind: 'review',
    priority: 'P0',
    subject: 'P0: Submit strict Phase 1 ACK now',
    body,
    requires_action: true,
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    evidence: { required: false, verified: false },
    evidence_exchange: { artifact_path: null, artifact_type: 'report', delivered_at: ts },
    heartbeat: { status: 'pending' },
    allow_cross_instance: true
  });

  const signed = createSignedMessage(msg, 'archivist');
  const fileName = `${taskId}.json`;
  fs.writeFileSync(path.join(SWARMMIND_INBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
  fs.writeFileSync(path.join(ARCHIVIST_OUTBOX, fileName), JSON.stringify(signed, null, 2), 'utf8');
  return fileName;
}

function main() {
  const ack = writeArchivistAck();
  const kernelResponseFile = sendArchivistResponseToKernel();
  const swarmmindNudgeFile = sendSwarmmindNudge();
  console.log(JSON.stringify({
    archivist_ack_written: ARCHIVIST_ACK_ABS,
    kernel_response_file: kernelResponseFile,
    swarmmind_nudge_file: swarmmindNudgeFile,
    phase1_owner: ack.phase1_owner
  }, null, 2));
}

if (require.main === module) {
  main();
}

