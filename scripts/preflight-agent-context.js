#!/usr/bin/env node
/**
 * Pre‑flight context validator for any new agent.
 *
 * 1. Loads the canonical lane manifest (`.global/lane-registry.json`).
 * 2. Verifies that every lane defined in the manifest has its required
 *    mailbox directories (inbox, outbox, processed) present on disk.
 * 3. Checks for presence of core scripts that agents rely on:
 *    - broadcast-normalizer.js
 *    - dispatch-task.js
 *    - lane-worker.js
 *    - full-lane-review-and-dispatch.js
 * 4. Prints a concise PASS/FAIL report and exits with 0 on success,
 *    non‑zero on any failure.
 *
 * This script should be run by any agent before it begins work; the CI
 * pipeline also invokes it (`check-context-drift.js`) to catch drift.
 */
"use strict";

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// Load manifest – this is the single source of truth.
// ------------------------------------------------------------
const MANIFEST_PATH = path.resolve(__dirname, '..', '.global', 'lane-registry.json');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (e) {
  console.error(`❌ Failed to load manifest at ${MANIFEST_PATH}: ${e.message}`);
  process.exit(1);
}

// ------------------------------------------------------------
// Helper utilities
// ------------------------------------------------------------
function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch (_) { return false; }
}

function checkMailbox(laneId, mailbox) {
  const errors = [];
  const inbox = mailbox.inbox;
  const outbox = mailbox.outbox;
  const processed = mailbox.processed;
  if (!dirExists(inbox)) errors.push(`Inbox missing: ${inbox}`);
  if (!dirExists(outbox)) errors.push(`Outbox missing: ${outbox}`);
  if (!dirExists(processed)) errors.push(`Processed missing: ${processed}`);
  return errors;
}

function checkCoreScripts() {
  const required = [
    'scripts/broadcast-normalizer.js',
    'scripts/dispatch-task.js',
    'scripts/lane-worker.js',
    'scripts/full-lane-review-and-dispatch.js'
  ];
  const missing = required.filter(rel => !fileExists(path.resolve(__dirname, '..', rel)));
  return missing;
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------
let exitCode = 0;
console.log('🔍 Pre‑flight context validation');
console.log(`📄 Manifest: ${MANIFEST_PATH}`);

Object.entries(manifest.lanes).forEach(([laneId, laneInfo]) => {
  const mailbox = laneInfo.mailboxes || {};
  const errors = checkMailbox(laneId, mailbox);
  if (errors.length) {
    exitCode = 1;
    console.error(`❌ Lane '${laneId}' mailbox errors:`);
    errors.forEach(err => console.error(`   - ${err}`));
  } else {
    console.log(`✅ Lane '${laneId}' mailboxes OK`);
  }
});

const missingScripts = checkCoreScripts();
if (missingScripts.length) {
  exitCode = 1;
  console.error('❌ Core script(s) missing:');
  missingScripts.forEach(s => console.error(`   - ${s}`));
} else {
  console.log('✅ All core scripts present');
}

if (exitCode === 0) {
  console.log('✔️  PRE‑FLIGHT PASS');
} else {
  console.error('🚨 PRE‑FLIGHT FAIL – see errors above');
}
process.exit(exitCode);
