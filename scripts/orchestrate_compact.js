#!/usr/bin/env node
'use strict';
/**
 * orchestrate_compact.js
 * Orchestrator that checks token usage and, when above a threshold, delegates the
 * compact operation to a sub‑agent (subcompact_worker.js). It follows the staged
 * write order and updates .compact-audit/meta.json.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const META_PATH = path.join('S:/Archivist-Agent/.compact-audit', 'meta.json');
const TOKEN_LIMIT = 128000; // same as used in compact manager
const TRIGGER_FRACTION = 0.80; // trigger compact at 80% of token budget

function loadMeta() {
  if (!fs.existsSync(META_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(META_PATH, 'utf8')); } catch (_) { return {}; }
}
function saveMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

const meta = loadMeta();
const usage = meta.last_token_usage || 0;
if (usage / TOKEN_LIMIT >= TRIGGER_FRACTION) {
  const ts = Date.now();
  const requestPath = `S:/Archivist-Agent/lanes/archivist/outbox/compact-request-${ts}.json`;
  const responsePath = `S:/Archivist-Agent/lanes/archivist/inbox/compact-response-${ts}.json`;
  const request = {
    request_ts: new Date().toISOString(),
    token_usage: usage,
    response_path: responsePath
  };
  // Write request file
  fs.writeFileSync(requestPath, JSON.stringify(request, null, 2), 'utf8');
  // Run sub‑agent synchronously
  const cmd = `node S:/Archivist-Agent/scripts/subcompact_worker.js ${requestPath}`;
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error('[orchestrate] Sub‑agent execution failed', e);
    process.exit(2);
  }
  // Load response
  if (!fs.existsSync(responsePath)) {
    console.error('[orchestrate] No response file from sub‑agent');
    process.exit(2);
  }
  const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
  // Update meta with new checkpoint info
  meta.last_checkpoint_ts = Date.now();
  meta.last_handoff_hash = response.handoff_hash || '';
  meta.compact_status = 'idle';
  saveMeta(meta);
  console.log('[orchestrate] Compact completed. Status:', response.status);
} else {
  console.log('[orchestrate] Token usage below threshold; no compact needed.');
}
