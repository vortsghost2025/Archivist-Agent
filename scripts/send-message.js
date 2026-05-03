#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA_PATH = 'S:/Archivist-Agent/schemas/inbox-message-v1.json';
const OUTBOX_ROOT = 'S:/Archivist-Agent/lanes/archivist/outbox';

const VALID_TYPES = ['task', 'response', 'heartbeat', 'escalation', 'handoff', 'ack', 'alert', 'notification', 'status'];
const VALID_TASK_KINDS = ['proposal', 'review', 'amendment', 'ratification', 'ack', 'done', 'status', 'report', 'handoff', 'alert', 'notification', 'heartbeat', 'audit'];
const VALID_LANES = ['archivist', 'library', 'swarmmind', 'kernel'];
const REQUIRED_FIELDS = ['schema_version', 'task_id', 'idempotency_key', 'from', 'to', 'type', 'priority', 'subject', 'body', 'timestamp', 'requires_action', 'payload', 'execution', 'lease', 'retry', 'evidence', 'heartbeat'];
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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

  return { valid: errors.length === 0, errors };
}

function sendMessage(msg, options = {}) {
  const { dryRun = false, logOnly = false } = options;
  const result = { sent: false, delivered: false, errors: [], task_id: msg.task_id };

  const { valid, errors } = validateMessage(msg);
  if (!valid) {
    result.errors = errors;
    const abortPath = path.join(OUTBOX_ROOT, `aborted-${msg.task_id}.json`);
    const abortRecord = {
      task_id: msg.task_id,
      aborted_at: nowIso(),
      reason: 'C8_OUTBOUND_SELF_CHECK_FAILED',
      errors: errors
    };
    if (!dryRun && !logOnly) {
      fs.writeFileSync(abortPath, JSON.stringify(abortRecord, null, 2));
    }
    console.error(`[ABORT] C8 self-check failed for ${msg.task_id}:`);
    errors.forEach(e => console.error(`  - ${e}`));
    return result;
  }

  const targetInbox = LANE_INBOX[msg.to];
  if (!targetInbox) {
    result.errors.push(`Unknown target lane: ${msg.to}`);
    return result;
  }

  const destPath = path.join(targetInbox, `${msg.task_id}.json`);
  const outboxPath = path.join(OUTBOX_ROOT, `${msg.task_id}.json`);

  if (dryRun) {
    console.log(`[DRY-RUN] Would send ${msg.task_id} to ${msg.to} at ${destPath}`);
    result.sent = true;
    result.delivered = true;
    return result;
  }

  try {
    const content = JSON.stringify(msg, null, 2);
    fs.writeFileSync(destPath, content);
    fs.writeFileSync(outboxPath, content);

    const delivered = fs.existsSync(destPath);
    const deliveredContent = delivered ? fs.readFileSync(destPath, 'utf8') : '';
    result.sent = true;
    result.delivered = delivered && deliveredContent === content;

    if (result.delivered) {
      console.log(`[SENT] ${msg.task_id} -> ${msg.to} (verified)`);
    } else {
      console.error(`[WARN] ${msg.task_id} written but delivery verification failed`);
    }
  } catch (e) {
    result.errors.push(`Write failed: ${e.message}`);
    console.error(`[FAIL] ${msg.task_id}: ${e.message}`);
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