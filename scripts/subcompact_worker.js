#!/usr/bin/env node
'use strict';
/**
 * subcompact_worker.js
 * Executes the full compact workflow in a separate process. It performs the
 * staged steps: handoff hash logging, quick recovery tests, and the full post‑
 * compact audit. The orchestrator supplies a request JSON with a path for the
 * response file.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Load request file path from CLI args
const [, , requestPath] = process.argv;
if (!requestPath || !fs.existsSync(requestPath)) {
  console.error('[subcompact] Missing or invalid request file');
  process.exit(2);
}
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

function writeResponse(respPath, data) {
  fs.writeFileSync(respPath, JSON.stringify(data, null, 2), 'utf8');
}

(async () => {
  try {
    // Delegate to the canonical compact pipeline script.
    const compactRunner = 'S:/Archivist-Agent/scripts/run-compact-with-audit.js';
    execFileSync('node', [compactRunner], { stdio: 'inherit' });

    const postAuditPath = 'S:/Archivist-Agent/.compact-audit/POST_COMPACT_AUDIT.json';
    const recoveryPath = 'S:/Archivist-Agent/.compact-audit/RECOVERY_TEST_RESULTS.json';
    const metaPath = 'S:/Archivist-Agent/.compact-audit/meta.json';

    const postAudit = fs.existsSync(postAuditPath)
      ? JSON.parse(fs.readFileSync(postAuditPath, 'utf8'))
      : {};
    const recovery = fs.existsSync(recoveryPath)
      ? JSON.parse(fs.readFileSync(recoveryPath, 'utf8'))
      : {};
    const meta = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      : {};

    // Build response payload for orchestrator
    const response = {
      status: postAudit.status || 'unknown',
      handoff_hash: meta.last_handoff_hash || null,
      recovery,
      audit_summary: postAudit.diff || {},
      timestamp: new Date().toISOString()
    };
    writeResponse(request.response_path, response);

    // Exit code: 0 for aligned/drifted, 1 for conflicted, 2 for fatal.
    if (response.status === 'conflicted') process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('[subcompact] Fatal error:', err);
    // Attempt to write a minimal error response so orchestrator can see failure
    if (request && request.response_path) {
      writeResponse(request.response_path, {status: 'error', error: err.toString()});
    }
    process.exit(2);
  }
})();
