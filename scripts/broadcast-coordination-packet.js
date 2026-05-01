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
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox'
};
const OUTBOX = 'S:/Archivist-Agent/lanes/archivist/outbox';

const SUBJECT = '[CONTRADICTION_SIGNATURE_39] Propagation Coordination Packet';
const BODY = [
  'Attached: delta report template + one-command checklist.',
  'All lanes execute their respective checklist item.',
  'Archivist validates and closes workflow.',
  '',
  'Artifacts:',
  '- S:/Archivist-Agent/docs/ops/CONTRADICTION_DELTA_REPORT_TEMPLATE.md',
  '- S:/Archivist-Agent/docs/ops/LANE_PROPAGATION_ONE_COMMAND_CHECKLIST.md'
].join('\n');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function buildMessage(to) {
  const ts = new Date().toISOString();
  const seed = `${to}:${ts}:${Math.random()}`;
  const id = `coord-packet-${Date.now()}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8)}`;
  return {
    schema_version: '1.3',
    task_id: id,
    idempotency_key: crypto.createHash('sha256').update(id).digest('hex').slice(0, 64),
    from: 'archivist',
    to,
    type: 'notification',
    task_kind: 'coordination',
    priority: 'P1',
    subject: SUBJECT,
    body: BODY,
    timestamp: ts,
    requires_action: true,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'kilo', actor: 'lane' },
    lease: { owner: 'archivist', acquired_at: ts },
    retry: { attempt: 1, max_attempts: 3 },
    evidence: { required: false, verified: false },
    evidence_exchange: {},
    heartbeat: { status: 'in_progress', last_heartbeat_at: ts, interval_seconds: 300, timeout_seconds: 900 }
  };
}

function main() {
  ensureDir(OUTBOX);
  const sent = [];
  for (const lane of LANES) {
    ensureDir(INBOX[lane]);
    const msg = buildMessage(lane);
    const signed = createSignedMessage(msg, 'archivist');
    const file = `${msg.task_id}.json`;
    fs.writeFileSync(path.join(INBOX[lane], file), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, file), JSON.stringify(signed, null, 2), 'utf8');
    sent.push({ to: lane, file });
  }
  console.log(JSON.stringify({ ok: true, sent }, null, 2));
}

if (require.main === module) {
  main();
}
