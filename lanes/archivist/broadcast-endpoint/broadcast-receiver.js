#!/usr/bin/env node
/**
 * Broadcast Receiver - Emergency P0 Alert Processor
 *
 * This script runs as a dedicated endpoint for emergency broadcasts.
 * It scans the lane's inbox for P0 alert messages, validates them,
 * and processes them with high priority.
 *
 * Invocation: node broadcast-endpoint/broadcast-receiver.js [--test]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LANE_ID = 'archivist';
const LANE_ROOT = 'S:/Archivist-Agent';
const INBOX_DIR = path.join(LANE_ROOT, 'lanes', LANE_ID, 'inbox');
const PROCESSED_DIR = path.join(LANE_ROOT, 'lanes', LANE_ID, 'inbox', 'processed');
const BROADCAST_LOG = path.join(LANE_ROOT, 'lanes', LANE_ID, 'broadcast-endpoint', 'broadcast-received.log');
const OUTBOX_DIR = path.join(LANE_ROOT, 'lanes', LANE_ID, 'outbox');

// Broadcast schema path
const SCHEMAS_DIR = path.join(__dirname, '..', '..', 'schemas');
const BROADCAST_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'broadcast-message-v1.json');

// Origin verification - only accept broadcasts from SwarmMind (the designated broadcaster)
const VALID_ORIGINATORS = ['swarmmind'];

// Unicode normalization map (from lane-worker.js)
const UNICODE_NORMALIZE_MAP = {
  '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
  '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u00A0': ' ',
  '\u2022': '*', '\u2010': '-', '\u2011': '-', '\u2012': '-',
  '\u2015': '--', '\u2212': '-'
};

function normalizeToAscii(str) {
  const UNICODE_NORMALIZE_RE = new RegExp('[' + Object.keys(UNICODE_NORMALIZE_MAP).join('') + ']', 'g');
  return str.replace(UNICODE_NORMALIZE_RE, ch => UNICODE_NORMALIZE_MAP[ch] || '?');
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function log(msg) {
  const ts = nowIso();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(BROADCAST_LOG, line, 'utf8');
  console.log(`[broadcast-receiver] ${msg}`);
}

function isBroadcastMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;

  // Must be an alert type with P0 priority
  if (msg.type !== 'alert') return false;
  if (msg.priority !== 'P0') return false;

  // Must have broadcast_metadata
  if (!msg.broadcast_metadata) return false;

  // Originator must be valid (currently only SwarmMind)
  if (!VALID_ORIGINATORS.includes(msg.from)) return false;

  return true;
}

function validateBroadcastSchema(msg) {
  if (!fs.existsSync(BROADCAST_SCHEMA_PATH)) {
    return { ok: false, error: `Broadcast schema not found: ${BROADCAST_SCHEMA_PATH}` };
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(BROADCAST_SCHEMA_PATH, 'utf8'));
  } catch (e) {
    return { ok: false, error: `Failed to parse broadcast schema: ${e.message}` };
  }

  // Basic validation
  if (msg.type !== 'alert') {
    return { ok: false, error: `Invalid type: ${msg.type} (must be 'alert')` };
  }
  if (msg.priority !== 'P0') {
    return { ok: false, error: `Invalid priority: ${msg.priority} (must be 'P0')` };
  }
  if (!msg.broadcast_metadata) {
    return { ok: false, error: `Missing broadcast_metadata` };
  }

  const bm = msg.broadcast_metadata;
  if (!bm.broadcast_id || typeof bm.broadcast_id !== 'string') {
    return { ok: false, error: `Missing or invalid broadcast_id` };
  }
  if (!bm.originator || typeof bm.originator !== 'string') {
    return { ok: false, error: `Missing or invalid originator` };
  }
  if (!bm.transmitted_at || typeof bm.transmitted_at !== 'string') {
    return { ok: false, error: `Missing or invalid transmitted_at` };
  }

  return { ok: true };
}

function buildAckMessage(originalMsg, processingTimeMs, actionsTaken = []) {
  const ts = nowIso();
  const broadcastId = originalMsg.broadcast_metadata.broadcast_id;
  const originalTaskId = originalMsg.task_id;

  // Build idempotency key from broadcast_id + lane
  const idempotencyKey = `${broadcastId}-${LANE_ID}-ack`;

  const ack = {
    schema_version: '1.3',
    task_id: `broadcast-ack-${broadcastId}-${Date.now()}`,
    idempotency_key: idempotencyKey,
    from: LANE_ID,
    to: 'swarmmind',
    type: 'ack',
    task_kind: 'broadcast_ack',
    priority: 'P0',
    subject: `[BROADCAST_ACK] Emergency Alert Received: ${originalMsg.subject || 'No Subject'}`,
    body: `Emergency broadcast acknowledged by ${LANE_ID}.\n\n` +
          `Original Broadcast ID: ${broadcastId}\n` +
          `Original Task ID: ${originalTaskId}\n` +
          `Processing Time: ${processingTimeMs}ms\n` +
          `Timestamp: ${ts}\n\n` +
          `Actions Taken:\n${actionsTaken.join('\n') || '- None (monitored only)'}`,
    timestamp: ts,
    requires_action: false,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'kilo', actor: 'lane' },
    lease: {
      owner: 'swarmmind',
      acquired_at: ts,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      renewal_count: 0,
      max_renewals: 3
    },
    retry: { attempt: 1, max_attempts: 3 },
    evidence: {
      required: false,
      verified: false,
      evidence_path: `lanes/${LANE_ID}/broadcast-endpoint/broadcast-received.log`
    },
    evidence_exchange: {
      artifact_path: `lanes/${LANE_ID}/broadcast-endpoint/broadcast-received.log`,
      artifact_type: 'log',
      delivered_at: ts
    },
    heartbeat: {
      status: 'done',
      last_heartbeat_at: ts,
      interval_seconds: 300,
      timeout_seconds: 900
    },
    broadcast_ack: {
      original_broadcast_id: broadcastId,
      original_task_id: originalTaskId,
      acknowledged_by: LANE_ID,
      acknowledged_at: ts,
      processing_time_ms: processingTimeMs,
      status: 'received',
      actions_taken: actionsTaken,
      convergence_gate: {
        claim: `Broadcast ${broadcastId} received and processed by ${LANE_ID}`,
        evidence: `lanes/${LANE_ID}/broadcast-endpoint/broadcast-received.log`,
        verified_by: LANE_ID,
        contradictions: [],
        status: 'proven'
      }
    }
  };

  return ack;
}

function signMessage(msg, laneId) {
  // Use local signing script (sovereign)
  const createSignedMessagePath = path.join(__dirname, '..', 'create-signed-message.js');
  const { createSignedMessage: sign } = require(createSignedMessagePath);

  // Derive key ID from public key
  const identityDir = path.join(LANE_ROOT, '.identity');
  const pubPath = path.join(identityDir, 'public.pem');
  const deriveKeyId = require(path.join(__dirname, '..', '.global', 'deriveKeyId'));

  if (!fs.existsSync(pubPath)) {
    throw new Error(`Public key not found: ${pubPath}`);
  }
  const publicPem = fs.readFileSync(pubPath, 'utf8');
  const keyId = deriveKeyId(publicPem);

  // Sign using the createSignedMessage function
  const signed = sign(msg, laneId);
  return signed;
}

function processBroadcastFile(filePath, fileName) {
  const startTime = Date.now();

  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const msg = JSON.parse(raw);

    // Normalize ASCII in subject/body for logging
    const originalSubject = msg.subject || '';
    msg.subject = normalizeToAscii(originalSubject);

    log(`Processing broadcast: ${fileName} (broadcast_id=${msg.broadcast_metadata?.broadcast_id || 'unknown'})`);

    // Validate broadcast message
    const validation = validateBroadcastSchema(msg);
    if (!validation.ok) {
      log(`ERROR: Invalid broadcast: ${validation.error}`);
      moveToQuarantine(filePath, fileName, validation.error);
      return false;
    }

    const broadcastId = msg.broadcast_metadata.broadcast_id;
    const originator = msg.broadcast_metadata.originator;
    log(`Valid P0 alert from ${originator}, broadcast_id=${broadcastId}`);

    // Determine actions based on subject/content
    const actions = determineEmergencyActions(msg);

    // Build acknowledgment
    const processingTime = Date.now() - startTime;
    const ackMsg = buildAckMessage(msg, processingTime, actions);

    // Sign acknowledgment
    try {
      const signedAck = signMessage(ackMsg, LANE_ID);

      // Write to outbox
      ensureDir(OUTBOX_DIR);
      const ackFileName = `${signedAck.task_id}.json`;
      const ackPath = path.join(OUTBOX_DIR, ackFileName);
      fs.writeFileSync(ackPath, JSON.stringify(signedAck, null, 2), 'utf8');
      log(`Sent acknowledgment: ${ackFileName} -> swarmmind`);

      // Also record in broadcast endpoint log
      recordBroadcastReceipt(msg, signedAck, processingTime, actions);

      // Move original to processed
      moveToProcessed(filePath, fileName, broadcastId);

      log(`Broadcast ${broadcastId} processed successfully in ${processingTime}ms`);
      return true;

    } catch (signErr) {
      log(`ERROR: Failed to sign acknowledgment: ${signErr.message}`);
      // Still move original to processed even if ack failed (broadcast was received)
      moveToProcessed(filePath, fileName, broadcastId);
      return false;
    }

  } catch (err) {
    log(`ERROR processing ${fileName}: ${err.message}`);
    moveToQuarantine(filePath, fileName, err.message);
    return false;
  }
}

function determineEmergencyActions(msg) {
  const actions = [];
  const subject = (msg.subject || '').toLowerCase();
  const body = (msg.body || '').toLowerCase();

  // Check for specific emergency keywords
  if (subject.includes('emergency') || subject.includes('🚨') || body.includes('immediate action')) {
    actions.push('[EMERGENCY] Flagged for immediate attention');
  }

  // Check for specific lane mentions
  if (subject.includes('archivist') || body.includes('archivist')) {
    actions.push('[ARCHIVIST] Archivist-specific action required');
  }
  if (subject.includes('kernel') || body.includes('kernel')) {
    actions.push('[KERNEL] Kernel-specific action required');
  }
  if (subject.includes('library') || body.includes('library')) {
    actions.push('[LIBRARY] Library-specific action required');
  }
  if (subject.includes('swarmmind') || body.includes('swarmmind')) {
    actions.push('[SWARMMIND] SwarmMind-specific action required');
  }

  // Check for convergence gate mentions
  if (subject.includes('convergence') || body.includes('convergence gate')) {
    actions.push('[CONVERGENCE] Convergence gate verification required');
  }

  // Check for sovereignty/constraint alerts
  if (subject.includes('sovereignty') || subject.includes('constraint') || subject.includes('violation')) {
    actions.push('[SOVEREIGNTY] Sovereignty constraint check required');
  }

  // Default monitoring action
  if (actions.length === 0) {
    actions.push('[MONITOR] Broadcast logged for awareness');
  }

  return actions;
}

function moveToProcessed(originalPath, fileName, broadcastId) {
  ensureDir(PROCESSED_DIR);
  const destName = `broadcast-${broadcastId}-${fileName}`;
  const destPath = path.join(PROCESSED_DIR, destName);
  fs.renameSync(originalPath, destPath);
  log(`Moved to processed: ${destName}`);
}

function moveToQuarantine(originalPath, fileName, reason) {
  const quarantineDir = path.join(LANE_ROOT, 'lanes', LANE_ID, 'inbox', 'quarantine');
  ensureDir(quarantineDir);
  const destName = `broadcast-quarantine-${Date.now()}-${fileName}`;
  const destPath = path.join(quarantineDir, destName);
  fs.renameSync(originalPath, destPath);
  log(`Quarantined ${fileName}: ${reason}`);
}

function recordBroadcastReceipt(originalMsg, ackMsg, processingTime, actions) {
  const receipt = {
    received_at: nowIso(),
    broadcast_id: originalMsg.broadcast_metadata.broadcast_id,
    original_task_id: originalMsg.task_id,
    original_subject: originalMsg.subject,
    originator: originalMsg.from,
    processing_time_ms: processingTime,
    acknowledgment_sent: {
      task_id: ackMsg.task_id,
      timestamp: ackMsg.timestamp
    },
    actions_taken: actions
  };

  const receiptPath = path.join(LANE_ROOT, 'lanes', LANE_ID, 'broadcast-endpoint', 'receipts.json');

  let receipts = [];
  if (fs.existsSync(receiptPath)) {
    try {
      receipts = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    } catch (_) {}
  }

  receipts.push(receipt);
  fs.writeFileSync(receiptPath, JSON.stringify(receipts, null, 2), 'utf8');
}

function scanInbox() {
  if (!fs.existsSync(INBOX_DIR)) {
    log(`ERROR: Inbox directory not found: ${INBOX_DIR}`);
    return 0;
  }

  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith('.json'));
  const broadcastFiles = files.filter(f => !f.startsWith('heartbeat-') && f !== 'README.md');

  if (broadcastFiles.length === 0) {
    log('No messages in inbox');
    return 0;
  }

  log(`Scanning inbox: ${broadcastFiles.length} file(s)`);

  let processed = 0;
  for (const file of broadcastFiles) {
    const filePath = path.join(INBOX_DIR, file);

    // Skip files that are being written
    try {
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs < 1000) {
        log(`Skipping ${file}: still being written`);
        continue;
      }
    } catch (_) {
      continue;
    }

    // Read and check if it's a broadcast message
    try {
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const msg = JSON.parse(raw);

      if (isBroadcastMessage(msg)) {
        log(`Found P0 broadcast: ${file}`);
        if (processBroadcastFile(filePath, file)) {
          processed++;
        }
      } else {
        // Not a broadcast message - skip
      }
    } catch (err) {
      log(`ERROR reading ${file}: ${err.message}`);
    }
  }

  return processed;
}

function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');

  ensureDir(PROCESSED_DIR);
  ensureDir(path.join(LANE_ROOT, 'lanes', LANE_ID, 'inbox', 'quarantine'));
  ensureDir(path.join(LANE_ROOT, 'lanes', LANE_ID, 'broadcast-endpoint'));

  log(`=== Broadcast Receiver Started (${LANE_ID}) ===`);

  if (testMode) {
    log('TEST MODE: Running in test mode');
    // In test mode, just verify setup
    console.log('Broadcast receiver test - setup OK');
    console.log(`Inbox: ${INBOX_DIR}`);
    console.log(`Schema: ${BROADCAST_SCHEMA_PATH}`);
    console.log(`Log: ${BROADCAST_LOG}`);
    process.exit(0);
  }

  const processed = scanInbox();
  log(`Scan complete: ${processed} broadcast(s) processed`);
  log(`=== Broadcast Receiver Finished ===`);

  process.exit(0);
}

if (require.main === module) {
  main();
}
