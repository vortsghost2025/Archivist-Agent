#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createSignedMessage } = require('./create-signed-message');

const LANES = ['archivist', 'library', 'kernel', 'swarmmind'];
const INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  kernel: 'S:/kernel-lane/lanes/kernel/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
};
const OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function buildMessage(to, body, subject) {
  const ts = nowIso();
  const seed = `${to}:${ts}:${Math.random()}`;
  const taskId = `e2e-summary-${Date.now()}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8)}`;
  return {
    schema_version: '1.3',
    task_id: taskId,
    idempotency_key: crypto.createHash('sha256').update(taskId).digest('hex').slice(0, 64),
    from: 'archivist',
    to,
    type: 'report',
    task_kind: 'report',
    priority: 'P2',
    subject,
    body,
    timestamp: ts,
    requires_action: false,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    lease: { owner: 'archivist', acquired_at: ts },
    retry: { attempt: 1, max_attempts: 1 },
    evidence: { required: false, verified: false },
    evidence_exchange: {},
    heartbeat: { status: 'done', last_heartbeat_at: ts, interval_seconds: 300, timeout_seconds: 900 },
  };
}

function assertInformationalOnly(msg) {
  if (msg.type !== 'report') throw new Error('type must be report');
  if (msg.task_kind !== 'report') throw new Error('task_kind must be report');
  if (msg.requires_action !== false) throw new Error('requires_action must be false');
  if (!msg.evidence || msg.evidence.required !== false) throw new Error('evidence.required must be false');
}

function parseArgs(argv) {
  const args = { doc: null, subject: 'Four-lane E2E status summary' };
  for (let i = 2; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--doc' && argv[i + 1]) {
      args.doc = argv[i + 1];
      i += 1;
    } else if (v === '--subject' && argv[i + 1]) {
      args.subject = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.doc) throw new Error('missing --doc <path>');
  const body = fs.readFileSync(args.doc, 'utf8');

  ensureDir(OUTBOX);
  const sent = [];
  for (const to of LANES) {
    ensureDir(INBOX[to]);
    const msg = buildMessage(to, body, args.subject);
    assertInformationalOnly(msg);
    const signed = createSignedMessage(msg, 'archivist');
    const file = `${msg.task_id}.json`;
    fs.writeFileSync(path.join(INBOX[to], file), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, file), JSON.stringify(signed, null, 2), 'utf8');
    sent.push({ to, file });
  }

  console.log(JSON.stringify({ ok: true, sent }, null, 2));
}

if (require.main === module) {
  main();
}
