#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LANE_DIRS = {
  archivist: 'S:/Archivist-Agent',
  library: 'S:/self-organizing-library',
  swarmmind: 'S:/SwarmMind Self-Optimizing Multi-Agent AI System',
  kernel: 'S:/kernel-lane',
};

const VALID_ARTIFACT_TYPES = ['benchmark', 'profile', 'release', 'log'];
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/i;

function normalizeHash(contentHash) {
  if (typeof contentHash !== 'string' || contentHash.trim().length === 0) return null;
  if (HASH_PATTERN.test(contentHash)) return contentHash.toLowerCase();
  if (/^[a-f0-9]{64}$/i.test(contentHash)) return `sha256:${contentHash.toLowerCase()}`;
  return null;
}

function computeSha256(filePath) {
  const raw = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

function resolveArtifactPath(baseDir, artifactPath) {
  return path.isAbsolute(artifactPath) ? artifactPath : path.join(baseDir, artifactPath);
}

function validateEvidenceMessage(file, msg, baseDir, details) {
  const exch = msg.evidence_exchange;
  if (!exch) return;

  const requiredMsgFields = ['body', 'signature'];
  for (const field of requiredMsgFields) {
    if (msg[field] === undefined || msg[field] === null || String(msg[field]).trim().length === 0) {
      details.push({ file, field, error: `MISSING_REQUIRED_MESSAGE_FIELD_${field.toUpperCase()}` });
    }
  }

  if (!exch.artifact_path || typeof exch.artifact_path !== 'string') {
    details.push({ file, error: 'MISSING_ARTIFACT_PATH' });
    return;
  }
  if (!exch.artifact_type || typeof exch.artifact_type !== 'string') {
    details.push({ file, error: 'MISSING_ARTIFACT_TYPE' });
    return;
  }

  const artifactPath = resolveArtifactPath(baseDir, exch.artifact_path);
  if (!VALID_ARTIFACT_TYPES.includes(exch.artifact_type)) {
    const detail = {
      file,
      artifact_path: exch.artifact_path,
      artifact_type: exch.artifact_type,
      error: 'INVALID_ARTIFACT_TYPE'
    };
    details.push(detail);
    console.error(`[evidence] INVALID_ARTIFACT_TYPE: ${file} -> ${exch.artifact_type}`);
    return;
  }

  if (!fs.existsSync(artifactPath)) {
    details.push({
      file,
      artifact_path: exch.artifact_path,
      artifact_type: exch.artifact_type,
      error: 'ARTIFACT_NOT_FOUND'
    });
    return;
  }

  const stats = fs.statSync(artifactPath);
  if (stats.size < 100) {
    details.push({
      file,
      artifact_path: exch.artifact_path,
      artifact_type: exch.artifact_type,
      error: 'ARTIFACT_TOO_SMALL',
      size_bytes: stats.size
    });
  }

  const normalizedExpected = normalizeHash(exch.content_hash);
  if (!normalizedExpected) {
    details.push({
      file,
      artifact_path: exch.artifact_path,
      artifact_type: exch.artifact_type,
      error: 'MISSING_OR_INVALID_CONTENT_HASH'
    });
    return;
  }

  const actualHash = computeSha256(artifactPath);
  if (actualHash !== normalizedExpected) {
    details.push({
      file,
      artifact_path: exch.artifact_path,
      artifact_type: exch.artifact_type,
      error: 'CONTENT_HASH_MISMATCH',
      expected: normalizedExpected,
      actual: actualHash
    });
    return;
  }

  details.push({
    file,
    artifact_path: exch.artifact_path,
    artifact_type: exch.artifact_type,
    content_hash: actualHash,
    size_bytes: stats.size,
    status: 'OK'
  });
}

function scanInbox(laneId) {
  const baseDir = LANE_DIRS[laneId];
  if (!baseDir) return { lane: laneId, total: 0, with_evidence_exchange: 0, errors: [] };

  const inboxPath = path.join(baseDir, 'lanes', laneId, 'inbox');
  if (!fs.existsSync(inboxPath)) {
    return { lane: laneId, total: 0, with_evidence_exchange: 0, errors: [] };
  }

  const files = fs.readdirSync(inboxPath).filter(f => f.endsWith('.json'));
  const results = [];
  let withEvidence = 0;

  for (const file of files) {
    const filePath = path.join(inboxPath, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const msg = JSON.parse(raw.replace(/^\uFEFF/, ''));
      
      if (msg.evidence_exchange) withEvidence++;
      validateEvidenceMessage(file, msg, baseDir, results);
    } catch (err) {
      results.push({ file, error: 'PARSE_ERROR: ' + err.message });
    }
  }

  return { lane: laneId, total: files.length, with_evidence_exchange: withEvidence, details: results };
}

function scanAllLanes() {
  const report = {};
  for (const laneId of Object.keys(LANE_DIRS)) {
    report[laneId] = scanInbox(laneId);
  }
  return report;
}

function generateReport() {
  const report = scanAllLanes();
  const timestamp = new Date().toISOString();
  
  let totalArtifacts = 0;
  let errors = [];
  
  for (const [lane, r] of Object.entries(report)) {
    totalArtifacts += r.with_evidence_exchange;
    errors = errors.concat(r.details.filter(d => d.error));
  }

  const summary = {
    timestamp,
    total_lanes: Object.keys(report).length,
    total_messages_with_evidence_exchange: totalArtifacts,
    total_errors: errors.length,
    lanes: report,
    errors: errors.length > 0 ? errors : null
  };

  return summary;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'scan';

  if (command === 'scan') {
    const report = generateReport();
    console.log(JSON.stringify(report, null, 2));
    
    if (report.total_errors > 0) {
      console.error(`\nEVIDENCE CHECK FAILED: ${report.total_errors} error(s) found`);
      process.exit(1);
    } else {
      console.log(`\nEVIDENCE CHECK PASSED: ${report.total_messages_with_evidence_exchange} evidence exchange(s) verified`);
      process.exit(0);
    }
  } else if (command === 'lane') {
    const lane = args[1];
    if (!lane) {
      console.error('Usage: node evidence-exchange-check.js lane <lane>');
      process.exit(1);
    }
    const result = scanInbox(lane);
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { scanInbox, scanAllLanes, generateReport, VALID_ARTIFACT_TYPES };
