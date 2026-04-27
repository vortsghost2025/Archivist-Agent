#!/usr/bin/env node
'use strict';

// Reusable signed ops summary broadcaster.
// Purpose: send non-actionable lane summaries only.
// Safety invariant: this script must never emit actionable/task-dispatch messages.

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
const SCRIPT_PURPOSE = 'reusable signed ops summary broadcaster';

function nowIso() {
  return new Date().toISOString();
}

function mkId() {
  return `summary-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function buildMessage(to, body) {
  const ts = nowIso();
  const id = mkId();
  return {
    schema_version: '1.3',
    task_id: id,
    idempotency_key: crypto.createHash('sha256').update(id).digest('hex').slice(0, 64),
    from: 'archivist',
    to,
    type: 'report',
    task_kind: 'report',
    priority: 'P2',
    subject: 'Implementation Summary: locks + code hash + concurrency proof',
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
  const violations = [];
  if (msg.type !== 'report') violations.push('type must be "report"');
  if (msg.task_kind !== 'report') violations.push('task_kind must be "report"');
  if (msg.requires_action !== false) violations.push('requires_action must be false');
  if (!msg.evidence || msg.evidence.required !== false) violations.push('evidence.required must be false');
  if (!msg.evidence_exchange || Object.keys(msg.evidence_exchange).length !== 0) {
    violations.push('evidence_exchange must be an empty object');
  }
  if (violations.length > 0) {
    throw new Error(`Informational-only guard failed: ${violations.join('; ')}`);
  }
}

function main() {
  console.log(`[ops-broadcast] mode=informational-only purpose="${SCRIPT_PURPOSE}"`);
  const summaryBody =
`Completed in Archivist:
- Added truth-critical write lease support (.locks/truth-critical.lock.json) for executor writes to verification-critical scripts.
- Added code_version_hash utility and stamping in executor response governance metadata.
- Added domain-gate semantic check for code_version_hash drift (message hash vs local verifier hash).
- Added verification_path metadata and validation order checks.
- Added adversarial concurrency proof test: scripts/test-concurrency-attack-domain-gate.js.
- Wired concurrency proof test into CI.
- Verified test pass:
  node scripts/test-lane-worker-we4free.js
  node scripts/test-verification-domain-gate.js
  node scripts/test-verification-domain-integration.js
  node scripts/test-concurrency-attack-domain-gate.js`;

  ensureDir(OUTBOX);
  for (const to of LANES) {
    ensureDir(INBOX[to]);
    const msg = buildMessage(to, summaryBody);
    assertInformationalOnly(msg);
    const signed = createSignedMessage(msg, 'archivist');
    const file = `${msg.task_id}.json`;
    fs.writeFileSync(path.join(INBOX[to], file), JSON.stringify(signed, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTBOX, file), JSON.stringify(signed, null, 2), 'utf8');
    console.log(`sent ${file} -> ${to}`);
  }
}

if (require.main === module) main();

