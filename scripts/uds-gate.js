'use strict';

// Shared UDS (User Drift Score) gate primitives.
// Extracted from resolve-post-compact-contradictions.js so the ratchet rules are
// unit-testable without executing the full CLI verification pipeline.

const fs = require('fs');
const path = require('path');

const CPS_MAX_TAIL_BYTES = 8 * 1024 * 1024;
const CPS_MAX_SCAN_BYTES = CPS_MAX_TAIL_BYTES * 8;

function defaultCpsLogPath() {
  return path.join(__dirname, '..', 'context-buffer', 'cps_log.jsonl');
}

// Scan the log backwards in bounded chunks (never read the whole file).
// Memory stays <= 8MB per chunk; scanning stops at the first system measurement
// or after CPS_MAX_SCAN_BYTES (64MB) to bound worst-case I/O. The fd is opened
// once and reused across chunks.
function findLastUdsMeasurement(cpsLogPath = defaultCpsLogPath()) {
  if (!fs.existsSync(cpsLogPath)) return null;
  const stat = fs.statSync(cpsLogPath);
  if (stat.size === 0) return null;

  let end = stat.size;
  let scanned = 0;
  const fd = fs.openSync(cpsLogPath, 'r');
  try {
    while (end > 0 && scanned < CPS_MAX_SCAN_BYTES) {
      const start = Math.max(0, end - CPS_MAX_TAIL_BYTES);
      const len = end - start;
      scanned += len;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      const chunk = buf.toString('utf8');
      const lines = chunk.split('\n');
      // The first line of a mid-file chunk is partial (its newline predates `start`),
      // so skip it unless we are at the true start of the file.
      const startIdx = start === 0 ? 0 : 1;
      for (let i = lines.length - 1; i >= startIdx; i--) {
        const line = lines[i];
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          // Only a SYSTEM measurement is a floor. Exclude operator-asserted entries
          // so a prior --uds-score raise cannot become a permanent ceiling (ratchet):
          // operator-provided UDS is auditable history, not an enforceable floor unless
          // an automated system measurement also exists.
          if (entry && typeof entry.uds_score === 'number' && entry.event !== 'UDS_OPERATOR_PROVIDED') {
            return { score: entry.uds_score, ts: entry.timestamp || entry.ts || null };
          }
        } catch (_) {}
      }
      end = start;
    }
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

// Return the most recent UDS_OPERATOR_PROVIDED entry (tail-read, bounded to 64KB)
// so repeated identical operator assertions can be deduped against it.
function lastOperatorUdsEntry(cpsLogPath = defaultCpsLogPath()) {
  if (!fs.existsSync(cpsLogPath)) return null;
  const stat = fs.statSync(cpsLogPath);
  if (stat.size === 0) return null;
  const readSize = Math.min(stat.size, 64 * 1024);
  const fd = fs.openSync(cpsLogPath, 'r');
  try {
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      try {
        const entry = JSON.parse(lines[i]);
        if (entry && entry.event === 'UDS_OPERATOR_PROVIDED') return entry;
      } catch (_) {}
    }
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

// Determine the effective UDS from a system measurement and an operator-provided
// CLI score. A system measurement, when present, is a floor — the operator may
// only RAISE above it, never lower it (no bypass). When no system measurement
// exists, the operator-asserted score IS the effective UDS.
function computeEffectiveUds(systemMeasured, cliScore) {
  if (systemMeasured && cliScore !== null) {
    return {
      uds: Math.max(systemMeasured.score, cliScore),
      basis: `max(system ${systemMeasured.score}, operator ${cliScore}) — operator may only RAISE above system measurement (no bypass)`,
    };
  }
  if (systemMeasured) {
    return { uds: systemMeasured.score, basis: `${systemMeasured.score} [system measurement from cps_log]` };
  }
  if (cliScore !== null) {
    return { uds: cliScore, basis: `${cliScore} [operator-asserted — no system UDS measurement exists in cps_log]` };
  }
  return { uds: null, basis: null };
}

// USER_DRIFT_SCORING.md threshold table (states/actions) encoded so the
// enforcement contract is testable rather than prose-only.
function classifyUdsScore(score) {
  if (score === null || typeof score !== 'number' || Number.isNaN(score)) {
    return { range: 'UNKNOWN', state: 'UNKNOWN', action: null };
  }
  if (score <= 20) {
    return { range: '0-20', state: 'STABLE', action: 'normal operation. log signals.' };
  }
  if (score <= 40) {
    return { range: '21-40', state: 'ELEVATED', action: 'require confirmation: "Drift detected. Proceed with verification?"' };
  }
  if (score <= 60) {
    return { range: '41-60', state: 'HIGH', action: 'mandatory verification lane. dual-lane check before any action.' };
  }
  if (score <= 80) {
    return { range: '61-80', state: 'CRITICAL', action: 'HARD STOP. No action permitted. Output: "DRIFT CRITICAL. Correction required. Review structure."' };
  }
  return { range: '81-100', state: 'COLLAPSE', action: 'session freeze. handoff required. Output: "STRUCTURE COMPROMISED. Session terminated. Read BOOTSTRAP.md."' };
}

// USER_DRIFT_SCORING.md enforcement contract: when UDS > 40 the system MUST
// output the standardized drift block with signals/required/correction.
function formatDriftAlert(score, signals = [], correction = null) {
  if (score === null || typeof score !== 'number' || Number.isNaN(score) || score <= 40) return null;
  const classified = classifyUdsScore(score);
  const signalList = Array.isArray(signals) ? signals.join(', ') : '';
  return [
    `[DRIFT DETECTED: Score=${score}]`,
    `Signals: [${signalList}]`,
    `Required: ${classified.action}`,
    `Correction: ${correction || 'none supplied'}`,
  ].join('\n');
}

module.exports = {
  findLastUdsMeasurement,
  lastOperatorUdsEntry,
  computeEffectiveUds,
  classifyUdsScore,
  formatDriftAlert,
  defaultCpsLogPath,
  CPS_MAX_TAIL_BYTES,
  CPS_MAX_SCAN_BYTES,
};
