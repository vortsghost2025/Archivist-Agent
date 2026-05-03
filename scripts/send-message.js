#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createSignedMessage } = require('./create-signed-message');

const SCHEMA_PATH = 'S:/Archivist-Agent/schemas/inbox-message-v1.json';
const OUTBOX_ROOT = 'S:/Archivist-Agent/lanes/archivist/outbox';

const VALID_TYPES = ['task', 'response', 'heartbeat', 'escalation', 'handoff', 'ack', 'alert', 'notification', 'status'];
const VALID_TASK_KINDS = ['proposal', 'review', 'amendment', 'ratification', 'ack', 'done', 'status', 'report', 'handoff', 'alert', 'notification', 'heartbeat', 'audit'];
const VALID_LANES = ['archivist', 'library', 'swarmmind', 'kernel'];
const REQUIRED_FIELDS = ['schema_version', 'task_id', 'idempotency_key', 'from', 'to', 'type', 'priority', 'subject', 'body', 'timestamp', 'requires_action', 'payload', 'execution', 'lease', 'retry', 'evidence', 'heartbeat', 'signature', 'key_id'];
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const KEY_ID_PATTERN = /^[a-f0-9]{16}$/;
const JWS_PATTERN = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const LANE_INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
  kernel: 'S:/kernel-lane/lanes/kernel/inbox'
};

function nowIso() { return new Date().toISOString(); }

function validateMessage(msg) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (msg[field] === undefined || msg[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (msg.type && !VALID_TYPES.includes(msg.type)) {
    errors.push(`Invalid type "${msg.type}". Allowed: ${VALID_TYPES.join(', ')}`);
  }

  if (msg.task_kind && !VALID_TASK_KINDS.includes(msg.task_kind)) {
    errors.push(`Invalid task_kind "${msg.task_kind}". Allowed: ${VALID_TASK_KINDS.join(', ')}`);
  }

  if (msg.to && !VALID_LANES.includes(msg.to)) {
    errors.push(`Invalid to "${msg.to}". Allowed: ${VALID_LANES.join(', ')}`);
  }

  if (msg.to === 'all') {
    errors.push('to:"all" is forbidden. Use per-lane fan-out instead.');
  }

  if (msg.timestamp && !ISO_UTC_PATTERN.test(msg.timestamp)) {
    errors.push(`Invalid timestamp "${msg.timestamp}". Must be ISO-8601 UTC with Z suffix (e.g. 2026-05-02T22:00:00.000Z).`);
  }

  if (msg.type && ['task', 'response', 'escalation', 'handoff', 'notification', 'status'].includes(msg.type) && !msg.task_kind) {
    errors.push(`task_kind is required when type is "${msg.type}".`);
  }

  if ((msg.type === 'response' || msg.type === 'ack') && msg.evidence && msg.evidence.required && !msg.evidence_exchange) {
    errors.push('evidence_exchange is required for response/ack types with evidence.required=true.');
  }

  if (msg.signature && !JWS_PATTERN.test(msg.signature)) {
    errors.push('Invalid signature format. Expected compact JWS (RS256).');
  }

  if (msg.key_id && !KEY_ID_PATTERN.test(msg.key_id)) {
    errors.push('Invalid key_id. Must be 16 lowercase hex chars.');
  }

  return { valid: errors.length === 0, errors };
}

function sendMessage(msg, options = {}) {
  const { dryRun = false, logOnly = false } = options;
  const result = { sent: false, delivered: false, errors: [], task_id: msg.task_id };
  const signingLane = msg.from || msg.from_lane || 'archivist';

  let outbound = msg;
  try {
    // Always sign at send time so signature/key_id cannot be omitted by callers.
    outbound = createSignedMessage(msg, signingLane);
    result.task_id = outbound.task_id;
  } catch (e) {
    result.errors.push(`Signing failed: ${e.message}`);
    console.error(`[ABORT] SIGNING_FAILED for ${msg.task_id || '<unknown>'}: ${e.message}`);
    return result;
  }

  const { valid, errors } = validateMessage(outbound);
  if (!valid) {
    result.errors = errors;
    const abortPath = path.join(OUTBOX_ROOT, `aborted-${outbound.task_id}.json`);
    const abortRecord = {
      task_id: outbound.task_id,
      aborted_at: nowIso(),
      reason: 'C8_OUTBOUND_SELF_CHECK_FAILED',
      errors: errors
    };
    if (!dryRun && !logOnly) {
      fs.writeFileSync(abortPath, JSON.stringify(abortRecord, null, 2));
    }
    console.error(`[ABORT] C8 self-check failed for ${outbound.task_id}:`);
    errors.forEach(e => console.error(`  - ${e}`));
    return result;
  }

  const targetInbox = LANE_INBOX[outbound.to];
  if (!targetInbox) {
    result.errors.push(`Unknown target lane: ${outbound.to}`);
    return result;
  }

  const destPath = path.join(targetInbox, `${outbound.task_id}.json`);
  const outboxPath = path.join(OUTBOX_ROOT, `${outbound.task_id}.json`);

  if (dryRun) {
    console.log(`[DRY-RUN] Would send ${outbound.task_id} to ${outbound.to} at ${destPath}`);
    result.sent = true;
    result.delivered = true;
    return result;
  }

  try {
    const content = JSON.stringify(outbound, null, 2);
    fs.writeFileSync(destPath, content);
    fs.writeFileSync(outboxPath, content);

    const delivered = fs.existsSync(destPath);
    const deliveredHash = delivered ? sha256(fs.readFileSync(destPath, 'utf8')) : '';
    result.sent = true;
    result.delivered = delivered && deliveredHash === sha256(content);

    if (result.delivered) {
      console.log(`[SENT] ${outbound.task_id} -> ${outbound.to} (verified)`);
    } else {
      console.error(`[WARN] ${outbound.task_id} written but delivery verification failed`);
    }
  } catch (e) {
    result.errors.push(`Write failed: ${e.message}`);
    console.error(`[FAIL] ${outbound.task_id}: ${e.message}`);
  }

  return result;
}

function sendToAll(msgTemplate, options = {}) {
  const results = [];
  for (const lane of VALID_LANES) {
    if (lane === msgTemplate.from) continue;
    const msg = JSON.parse(JSON.stringify(msgTemplate));
    msg.to = lane;
    msg.task_id = `${msgTemplate.task_id}-${lane}`;
    msg.idempotency_key = msg.idempotency_key ? `${msg.idempotency_key}-${lane}` : `${msg.from}-${lane}-${msg.task_id}`;
    results.push(sendMessage(msg, options));
  }
  return results;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const msgPath = args[0];
  const dryRun = args.includes('--dry-run');

  if (!msgPath) {
    console.log('Usage: node send-message.js <message.json> [--dry-run]');
    console.log('Usage: node send-message.js --validate <message.json>');
    process.exit(1);
  }

  if (args[0] === '--validate') {
    const msg = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const { valid, errors } = validateMessage(msg);
    if (valid) {
      console.log(`[VALID] ${msg.task_id}`);
      process.exit(0);
    } else {
      console.error(`[INVALID] ${msg.task_id}`);
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
  }

  const msg = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
  sendMessage(msg, { dryRun });
}

module.exports = { sendMessage, sendToAll, validateMessage, VALID_TYPES, VALID_TASK_KINDS, VALID_LANES };
