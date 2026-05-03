#!/usr/bin/env node
/*
 * Simple test for broadcast-normalizer.js
 *
 * Steps:
 *   1. Create a unique broadcast message with `to: "all"` in the archivist inbox.
 *   2. Run the normalizer with `--apply`.
 *   3. Verify fan‑out copies exist in library, kernel, and swarmmind inboxes.
 *   4. Verify each copy validates against the schema and carries a signature.
 *   5. Verify the original broadcast is archived in `processed/` with metadata.
 *   6. Clean up all created artefacts.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const { validate } = require(path.join(REPO_ROOT, 'src', 'lane', 'SchemaValidator'));

// Helper to write a broadcast message
function writeBroadcast(taskId) {
  const now = new Date().toISOString();
  const msg = {
    schema_version: '1.3',
    task_id: taskId,
    idempotency_key: crypto.createHash('sha256').update(taskId + 'archivistall' + now).digest('hex').slice(0, 64),
    from: 'archivist',
    to: 'all',
    type: 'task',
    task_kind: 'proposal',
    priority: 'P2',
    subject: 'Test broadcast',
    body: 'This is a test broadcast message to all lanes.',
    timestamp: now,
    requires_action: true,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    lease: { owner: 'archivist', acquired_at: now },
    retry: { attempt: 1, max_attempts: 3 },
    evidence: { required: false, verified: false },
    evidence_exchange: {},
    heartbeat: { status: 'pending', last_heartbeat_at: now, interval_seconds: 300, timeout_seconds: 900 },
  };
  const inbox = path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox');
  const filePath = path.join(inbox, `${taskId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(msg, null, 2), 'utf8');
  return filePath;
}

function runNormalizer() {
  const result = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'broadcast-normalizer.js'), '--apply'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(result.stderr);
    throw new Error(`Normalizer exited with code ${result.status}`);
  }
  // console.log(result.stdout);
}

function checkFanOut(taskId, targetLane) {
  const inbox = path.join(REPO_ROOT, 'lanes', targetLane, 'inbox');
  const filePath = path.join(inbox, `${taskId}.json`);
  assert.ok(fs.existsSync(filePath), `Fan‑out file missing for ${targetLane}`);
  const msg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const validation = validate(msg);
  assert.ok(validation.valid, `Schema invalid for ${targetLane}: ${validation.errors.join(' | ')}`);
  assert.ok(msg.signature, `Missing signature in ${targetLane}`);
  return filePath;
}

function checkArchive(originalFilePath, taskId) {
  const processedDir = path.join(path.dirname(originalFilePath), 'processed');
  const archivedPath = path.join(processedDir, path.basename(originalFilePath));
  assert.ok(fs.existsSync(archivedPath), 'Archived broadcast not found');
  const archived = JSON.parse(fs.readFileSync(archivedPath, 'utf8'));
  assert.strictEqual(archived.normalized_broadcast, true, 'Archive missing normalized_broadcast flag');
  assert.ok(Array.isArray(archived.normalized_targets), 'Archive missing normalized_targets');
  return archivedPath;
}

function cleanup(paths) {
  paths.forEach(p => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  });
}

(function main() {
  const uniqueId = `broadcast-test-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const broadcastPath = writeBroadcast(uniqueId);
  try {
    runNormalizer();
    // Verify fan‑out copies
    const fanOutPaths = [];
    ['library', 'kernel', 'swarmmind'].forEach(lane => {
      fanOutPaths.push(checkFanOut(uniqueId, lane));
    });
    // Verify archive
    const archivedPath = checkArchive(broadcastPath, uniqueId);
    // Clean up created files
    cleanup([...fanOutPaths, archivedPath]);
    console.log('PASS broadcast-normalizer.test.js');
  } catch (e) {
    // Attempt cleanup on failure
    const toCleanup = [];
    ['library', 'kernel', 'swarmmind'].forEach(lane => {
      const p = path.join(REPO_ROOT, 'lanes', lane, 'inbox', `${uniqueId}.json`);
      toCleanup.push(p);
    });
    const processed = path.join(REPO_ROOT, 'lanes', 'archivist', 'inbox', 'processed', `${uniqueId}.json`);
    toCleanup.push(processed);
    cleanup(toCleanup);
    console.error(e);
    process.exit(1);
  }
})();
