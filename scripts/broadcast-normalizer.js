#!/usr/bin/env node
/**
 * Broadcast Normalizer
 *
 * Scans the Archivist inbox for messages where `to` is the special value "all".
 * For each such broadcast, the script fans out a per‑lane copy to the four
 * canonical lanes (archivist, library, kernel, swarmmind) **excluding** the
 * sender lane.
 *
 * The original broadcast is archived in the `processed/` directory with
 * metadata indicating the normalization run, targets, and a timestamp.
 *
 * Usage:
 *   node scripts/broadcast-normalizer.js [--apply]
 *   --apply   actually write fan‑out messages and move the original;
 *             default (no flag) runs in dry‑run mode – logs only.
 */
"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Project root – one level up from scripts folder
const REPO_ROOT = path.resolve(__dirname, '..');

// Import helpers from the central schema validator module
const {
  normalizeMessageForSchema,
  validate,
  computeIdempotencyKey,
  deliverMessage,
  getCanonicalPath,
} = require(path.join(REPO_ROOT, 'src', 'lane', 'SchemaValidator'));

// Signing utility – same as used elsewhere (dispatch‑task, lane‑worker)
const { createSignedMessage } = require(path.join(REPO_ROOT, 'scripts', 'create-signed-message'));

// ---------------------------------------------------------------------------
// Configuration – canonical lane set
const CANONICAL_LANES = ['archivist', 'library', 'kernel', 'swarmmind'];

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[broadcast‑normalizer] ${ts} ${msg}`);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    log(`⚠️ Failed to read/parse ${filePath}: ${e.message}`);
    return null;
  }
}

/**
 * Expand a broadcast message into per‑lane copies.
 * Returns an array of results, one per target lane.
 */
function fanOut(message, sourcePath, runId, dryRun) {
  const results = [];
  const sender = (message.from || '').toLowerCase();
  const targets = CANONICAL_LANES.filter(l => l !== sender);

  // Compute a deterministic hash of the original payload – used for idempotency.
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex');

  targets.forEach(targetLane => {
    // Deep clone the original message so we can mutate safely.
    const copy = JSON.parse(JSON.stringify(message));
    copy.to = targetLane;
    // Preserve original task_id – used to compute deterministic idempotency.
    copy.idempotency_key = computeIdempotencyKey({
      task_id: copy.task_id,
      from: copy.from,
      to: copy.to,
      subject: copy.subject || '',
    });

    // Preserve a trace back to the source broadcast.
    copy.source_task_id = message.task_id;
    copy.source_message_hash = sourceHash;
    copy.normalizer_run_id = runId;

    // Fill missing required fields using the normalizer utility.
    const normalized = normalizeMessageForSchema(copy);
    const validation = validate(normalized);
    if (!validation.valid) {
      log(`⚠️ Fan‑out to ${targetLane} failed validation for ${path.basename(sourcePath)}: ${validation.errors.join(' | ')}`);
      results.push({ lane: targetLane, status: 'invalid', errors: validation.errors });
      return;
    }

    // Sign with the original sender identity.
    let signed;
    try {
      signed = createSignedMessage(normalized, message.from || sender);
    } catch (e) {
      log(`⚠️ Signing failed for lane ${targetLane}: ${e.message}`);
      results.push({ lane: targetLane, status: 'sign_error', error: e.message });
      return;
    }

    if (!dryRun) {
      const inboxPath = getCanonicalPath(targetLane);
      const delivery = deliverMessage(signed, inboxPath);
      results.push({ lane: targetLane, status: delivery.delivered ? 'ok' : 'delivery_failed', path: delivery.path, errors: delivery.validation_errors });
    } else {
      log(`Dry‑run: would write fan‑out to ${targetLane}`);
      results.push({ lane: targetLane, status: 'dry-run' });
    }
  });

  return results;
}

function archiveOriginal(sourcePath, message, runId) {
  const inboxDir = path.dirname(sourcePath);
  const processedDir = path.join(inboxDir, 'processed');
  ensureDir(processedDir);
  // Inject normalization metadata
  const meta = {
    normalized_broadcast: true,
    normalized_at: new Date().toISOString(),
    normalized_targets: CANONICAL_LANES.filter(l => l !== (message.from || '').toLowerCase()),
    normalizer_run_id: runId,
  };
  const archived = { ...message, ...meta };
  const destPath = path.join(processedDir, path.basename(sourcePath));
  fs.writeFileSync(destPath, JSON.stringify(archived, null, 2), 'utf8');
  // Remove original file
  fs.unlinkSync(sourcePath);
  log(`Archived original broadcast to ${destPath}`);
}

function run() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const runId = `norm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const archivistInbox = getCanonicalPath('archivist');
  if (!fs.existsSync(archivistInbox)) {
    log(`Inbox not found at ${archivistInbox}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(archivistInbox).filter(f => f.endsWith('.json'));
  if (entries.length === 0) {
    log('No JSON files in archivist inbox');
    return;
  }

  entries.forEach(file => {
    const fullPath = path.join(archivistInbox, file);
    const msg = readJson(fullPath);
    if (!msg) return; // parsing error handled inside readJson
    // Skip if already normalised.
    if (msg.normalized_broadcast) {
      log(`Skipping already normalised message ${file}`);
      return;
    }
    // Only handle explicit broadcast messages.
    if (msg.to !== 'all') return;

    log(`Normalising broadcast ${file} (task_id=${msg.task_id})`);
    fanOut(msg, fullPath, runId, dryRun);
    if (!dryRun) {
      archiveOriginal(fullPath, msg, runId);
    }
  });
}

if (require.main === module) {
  run();
}
