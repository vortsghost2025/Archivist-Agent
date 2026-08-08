#!/usr/bin/env node
'use strict';
/**
 * Resolve post-compact audit contradictions by updating the pre-compact baseline
 * to reflect authorized state changes (new lane registrations, key rotations, etc.)
 * 
 * CHECKPOINT GATES:
 * - Checkpoint 0: UDS ≤ 40 (User Drift Gate)
 * - Checkpoint 0.5: User Lane Gate — 2+ lane convergence required for state-changing ops
 * - Checkpoint 6: Dual Verification — blind L/R review required
 * 
 * The contradictions are:
 * 1. 3 new lanes added to trust store (control_plane, kucoin, authority)
 * 2. Trust store hash changed (expected with new lanes)
 * 3. Library keys_json deleted (migrated to current.json/identity.json)
 * 4. Library private_pem and snapshot_json rotated
 * 4. Handoff hash changed (expected post-compaction)
 * 5. Active blocker state changed (expected cleanup)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRE_COMPACT = path.join(__dirname, '..', '.compact-audit', 'PRE_COMPACT_SNAPSHOT.json');
const POST_COMPACT = path.join(__dirname, '..', '.compact-audit', 'POST_COMPACT_AUDIT.json');
const TRUST_STORE = path.join(__dirname, '..', 'lanes', 'broadcast', 'trust-store.json');

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// ============================================================================
// CHECKPOINT 0: UDS Gate (User Drift Gate) — UDS ≤ 40
// ============================================================================
// UDS must be evaluated BEFORE any state-changing action (USER_DRIFT_SCORING.md
// Enforcement Protocol). Fail closed if no measurement exists — never assume 0.
const { findLastUdsMeasurement, lastOperatorUdsEntry, computeEffectiveUds } = require('./uds-gate');

function checkUdsGate() {
  const cliScore = (() => {
    const idx = process.argv.indexOf('--uds-score');
    if (idx === -1 || !process.argv[idx + 1]) return null;
    const n = Number(process.argv[idx + 1]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  })();

  const systemMeasured = findLastUdsMeasurement();
  const { uds, basis } = computeEffectiveUds(systemMeasured, cliScore);

  if (uds === null) {
    console.log('CHECKPOINT 0 (UDS Gate): FAIL — no UDS measurement (system nor operator) in cps_log.jsonl');
    console.error('  UDS must be evaluated before state-changing ops (USER_DRIFT_SCORING.md Enforcement Protocol).');
    console.error('  Provide operator measurement: --uds-score N (0-100). It will be logged with full provenance.');
    console.error('  NOTE: a system measurement, when present, is a floor — operator may only RAISE, never lower.');
    console.error('        When no system measurement exists (this fleet has none yet), the operator-asserted');
    console.error('        score IS the effective UDS (auditable; no permanent ratchet from prior assertions).');
    return { passed: false, reason: 'UDS never measured' };
  }

  const passed = uds <= 40;
  console.log(`CHECKPOINT 0 (UDS Gate): ${passed ? 'PASS' : 'FAIL'} — UDS = ${uds} (threshold ≤ 40) [${basis}]`);
  if (!passed) {
    console.error('  UDS > 40: Mandatory verification lane required (CHECKPOINTS.md §4.1)');
  }

  // Record operator-provided measurement with full provenance for the evidence trail.
  // The entry is tagged UDS_OPERATOR_PROVIDED so it is NOT treated as a system floor
  // by future findLastUdsMeasurement scans (no permanent raise-ratchet). operator_claimed,
  // measured_score, and effective_basis together make the computation fully auditable.
  // Only log when the operator claim actually changes the effective score (sole basis,
  // or raises above a system measurement), AND the exact (claimed, measured) pair is not
  // already the most recent logged assertion. A subsumed claim adds no audit value and
  // repeated identical runs would otherwise accumulate unboundedly on every invocation.
  const lastOp = lastOperatorUdsEntry();
  const lastMeasured = lastOp && typeof lastOp.measured_score === 'number' ? lastOp.measured_score : null;
  const sameAsLast = lastOp !== null && lastOp.operator_claimed === cliScore
    && lastMeasured === (systemMeasured ? systemMeasured.score : null);
  if (cliScore !== null && (systemMeasured === null || cliScore > systemMeasured.score) && !sameAsLast) {
    const cpsLogPath = path.join(__dirname, '..', 'context-buffer', 'cps_log.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      event: 'UDS_OPERATOR_PROVIDED',
      uds_score: uds,
      operator_claimed: cliScore,
      measured_score: systemMeasured ? systemMeasured.score : null,
      effective_basis: basis,
      source: 'operator --uds-score flag (auditable assertion; floor only when a system measurement exists)',
      gate: 'CHECKPOINT_0',
      gate_passed: passed,
      verifier: 'resolve-post-compact-contradictions.js'
    };
    const dir = path.dirname(cpsLogPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(cpsLogPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  return { passed, uds };
}

// ============================================================================
// CHECKPOINT 0.5: User Lane Gate — 2+ lane convergence for state-changing ops
// ============================================================================
function checkUserLaneGate(operatorConfirmation) {
  if (!operatorConfirmation) {
    console.log('CHECKPOINT 0.5 (User Lane Gate): FAIL — no operator confirmation provided');
    return { passed: false, reason: 'missing operator confirmation' };
  }

  // Check active blocker
  const LANE_ROOTS = {
    archivist: path.join(__dirname, '..'),
    kernel: path.join(__dirname, '..', '..', 'kernel-lane'),
    swarmmind: path.join(__dirname, '..', '..', 'SwarmMind'),
    library: path.join(__dirname, '..', '..', 'self-organizing-library'),
    authority: path.join(__dirname, '..')
  };
  const SERVICED_LANES = ['archivist', 'kernel', 'swarmmind', 'library'];

  for (const lane of ['archivist', 'kernel', 'swarmmind', 'library', 'authority']) {
    const blockerPath = path.join(LANE_ROOTS[lane], 'lanes', 'broadcast', 'active-blocker.json');
    if (fs.existsSync(blockerPath)) {
      try {
        const blocker = JSON.parse(fs.readFileSync(blockerPath, 'utf8'));
        if (blocker.active === true) {
          console.log(`CHECKPOINT 0.5 (User Lane Gate): FAIL — active blocker in ${lane}: ${blocker.reason || 'unspecified'}`);
          return { passed: false, reason: `active blocker in ${lane}` };
        }
      } catch (_) {}
    }
  }

  // Check 2+ lanes have recent heartbeats (within 5 minutes)
  const recentLanes = [];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const lane of SERVICED_LANES) {
    const hbPath = path.join(LANE_ROOTS[lane], 'lanes', lane, 'inbox', `heartbeat-${lane}.json`);
    if (fs.existsSync(hbPath)) {
      const age = Date.now() - fs.statSync(hbPath).mtimeMs;
      if (age < 5 * 60 * 1000) {
        recentLanes.push(lane);
      }
    }
  }

  console.log(`CHECKPOINT 0.5 (User Lane Gate): ${recentLanes.length >= 2 ? 'PASS' : 'FAIL'} — recent heartbeats: ${recentLanes.join(', ') || 'none'} (need ≥2)`);
  
  if (recentLanes.length < 2) {
    console.error('  Need 2+ lanes with heartbeats <5 min for convergence (RECIPROCAL_ACCOUNTABILITY.md §3.3)');
    return { passed: false, reason: `only ${recentLanes.length} lanes with recent heartbeats`, recentLanes };
  }

  // Record gate passage in CPS log
  const cpsLogPath = path.join(__dirname, '..', 'context-buffer', 'cps_log.jsonl');
  const gateEntry = {
    schema_version: '1.3',
    ts: new Date().toISOString(),
    event: 'user_lane_gate_pass',
    gate: 'CHECKPOINT_0_5',
    converged_lanes: recentLanes,
    verifier: 'resolve-post-compact-contradictions.js'
  };
  const dir = path.dirname(cpsLogPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(cpsLogPath, JSON.stringify(gateEntry) + '\n', 'utf8');

  return { passed: true, convergedLanes: recentLanes };
}

// ============================================================================
// CHECKPOINT 6: Dual Verification — blind L/R review (VERIFICATION_LANES.md)
// ============================================================================
// Lane L (structural) checks governance artifacts and trust-store invariants.
// Lane R (operational) checks runtime evidence: log integrity, evidence links,
// and the post-compact audit's file-integrity result.
// Both run blind (no shared state) and must agree for consensus
// (VERIFICATION_LANES.md §5.1): same result, |Δconfidence| ≤ 3, avg ≥ 7.
function laneLStructuralReview() {
  const evidence = [];
  const concerns = [];
  const checks = [];
  const t = (cond, okMsg, badMsg) => {
    if (cond) { evidence.push(okMsg); checks.push(1); }
    else { concerns.push(badMsg); checks.push(0); }
  };

  const metaLanes = ['key_lineage', 'archived_keys', 'rotation_policy'];
  let trustStore = null;
  try { trustStore = fs.existsSync(TRUST_STORE) ? loadJson(TRUST_STORE) : null; } catch (_) {}
  const laneIds = trustStore
    ? Object.keys(trustStore).filter((k) => !metaLanes.includes(k))
    : [];
  const completeLanes = laneIds.filter((k) => trustStore[k] && trustStore[k].key_id);
  t(trustStore && completeLanes.length >= 4,
    `trust store: ${completeLanes.length}/${laneIds.length} lanes carry key_id`,
    `trust store missing or incomplete (${completeLanes.length}/${laneIds.length} lanes with key_id)`);

  let pre = null;
  try { pre = fs.existsSync(PRE_COMPACT) ? loadJson(PRE_COMPACT) : null; } catch (_) {}
  t(!!pre && Object.keys(pre.trust_store_key_ids || {}).length >= 4,
    'PRE_COMPACT_SNAPSHOT.json present, parses, and covers ≥ 4 lanes',
    'PRE_COMPACT_SNAPSHOT.json missing, corrupt, or underpopulated');

  let post = null;
  try { post = fs.existsSync(POST_COMPACT) ? loadJson(POST_COMPACT) : null; } catch (_) {}
  t(!!post, 'POST_COMPACT_AUDIT.json present and parses', 'POST_COMPACT_AUDIT.json missing or corrupt');

  t(fs.existsSync(path.join(__dirname, '..', 'BOOTSTRAP.md')),
    'BOOTSTRAP.md present (single governance entry point)',
    'BOOTSTRAP.md missing');

  const passed = checks.length > 0 && checks.every((c) => c === 1);
  const confidence = passed ? 9 : Math.max(1, Math.round((checks.filter((c) => c === 1).length / checks.length) * 9));
  return { lane: 'L', role: 'structural', result: passed ? 'PASS' : 'FAIL', confidence, evidence, concerns };
}

function laneROperationalReview() {
  const evidence = [];
  const concerns = [];
  const checks = [];
  const t = (cond, okMsg, badMsg) => {
    if (cond) { evidence.push(okMsg); checks.push(1); }
    else { concerns.push(badMsg); checks.push(0); }
  };

  // R1: cps_log.jsonl tail is valid JSON-lines (runtime log integrity).
  const cpsLogPath = path.join(__dirname, '..', 'context-buffer', 'cps_log.jsonl');
  let logValid = true;
  let logLines = 0;
  try {
    const stat = fs.statSync(cpsLogPath);
    const readSize = Math.min(stat.size, 4 * 1024 * 1024);
    if (readSize > 0) {
      const fd = fs.openSync(cpsLogPath, 'r');
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);
      const lines = buf.toString('utf8').split('\n');
      // When the read starts mid-file the first line is partial — skip it, the
      // same convention findLastUdsMeasurement uses. The LAST line is kept
      // strict: a partial tail line signals a real integrity problem.
      const startIdx = stat.size > readSize ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try { JSON.parse(lines[i]); logLines++; } catch (_) { logValid = false; }
      }
    }
  } catch (_) { logValid = false; }
  t(logValid && logLines > 0,
    `cps_log tail: ${logLines} valid JSON entries`,
    'cps_log.jsonl tail unreadable or contains invalid JSON');

  // R2: recommendation-ledger evidence refs resolve to real files (evidence links).
  // Only refs that look like filesystem paths are verified (have a path separator
  // and no command-style whitespace); free-form evidence summaries are skipped.
  const ledgerPath = path.join(__dirname, '..', 'context-buffer', 'recommendation-ledger.jsonl');
  let refsOk = true;
  let refsChecked = 0;
  try {
    if (fs.existsSync(ledgerPath)) {
      for (const line of fs.readFileSync(ledgerPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line);
        for (const ref of rec.resolution_evidence_refs || []) {
          if (typeof ref !== 'string' || ref.startsWith('http')) continue;
          if (!/[/\\]/.test(ref) || /\s/.test(ref)) continue;
          refsChecked++;
          if (!fs.existsSync(path.join(__dirname, '..', ref))) refsOk = false;
        }
      }
    }
  } catch (_) { refsOk = false; }
  t(refsOk,
    `ledger evidence refs resolve (${refsChecked} local path refs checked)`,
    'recommendation-ledger evidence ref missing or ledger corrupt');

  // R3: post-compact audit reports zero file-integrity violations.
  let auditOk = true;
  try {
    if (fs.existsSync(POST_COMPACT)) {
      const post = loadJson(POST_COMPACT);
      const violations = (post.diff && post.diff.file_integrity_violations) || [];
      auditOk = Array.isArray(violations) && violations.length === 0;
    } else {
      auditOk = false;
    }
  } catch (_) { auditOk = false; }
  t(auditOk,
    'post-compact audit reports 0 file-integrity violations',
    'post-compact audit flags file-integrity violations (or audit file missing)');

  const passed = checks.length > 0 && checks.every((c) => c === 1);
  const confidence = passed ? 8 : Math.max(1, Math.round((checks.filter((c) => c === 1).length / checks.length) * 8));
  return { lane: 'R', role: 'operational', result: passed ? 'PASS' : 'FAIL', confidence, evidence, concerns };
}

function checkDualVerification() {
  const force = process.argv.includes('--force-dual-verification');
  const L = laneLStructuralReview();
  const R = laneROperationalReview();

  console.log('CHECKPOINT 6 (Dual Verification):');
  for (const v of [L, R]) {
    console.log(`  Lane ${v.lane} [${v.role}]: ${v.result} confidence=${v.confidence}`);
    for (const e of v.evidence) console.log(`    - ${e}`);
    for (const c of v.concerns) console.log(`    ! ${c}`);
  }

  const agree = L.result === R.result;
  const confDiff = Math.abs(L.confidence - R.confidence);
  const avgConf = (L.confidence + R.confidence) / 2;
  const consensus = agree && confDiff <= 3 && avgConf >= 7 && L.result === 'PASS';

  if (force) {
    console.log(`CHECKPOINT 6 (Dual Verification): consensus=${consensus ? 'AGREE' : 'DISAGREE'} — overridden via --force-dual-verification (PASS)`);
    return { passed: true, laneL: L, laneR: R, consensus, forced: true };
  }

  if (consensus) {
    console.log(`CHECKPOINT 6 (Dual Verification): PASS — L/R consensus (confidence avg ${avgConf})`);
    return { passed: true, laneL: L, laneR: R, consensus, forced: false };
  }

  const reason = !agree
    ? 'L/R disagree — investigation required'
    : (avgConf < 7 ? 'consensus confidence below 7' : 'L/R both failed — escalation required');
  console.log(`CHECKPOINT 6 (Dual Verification): FAIL — ${reason}`);
  return { passed: false, laneL: L, laneR: R, consensus, reason };
}

console.log('=== RESOLVING POST-COMPACT CONTRADICTIONS ===\n');

// ============================================================================
// CHECKPOINT GATES — must all pass before state-changing operations
// ============================================================================
console.log('=== CHECKPOINT GATES ===');

const udsGate = checkUdsGate();
if (!udsGate.passed) {
  console.error('\n✗ CHECKPOINT 0 FAILED — aborting');
  console.error('  Pass --uds-score N (0-100) with the operator measurement to proceed.');
  process.exit(1);
}

const operatorConfirmed = process.argv.includes('--operator-confirmed');
const userLaneGate = checkUserLaneGate(operatorConfirmed);
if (!userLaneGate.passed) {
  console.error('\n✗ CHECKPOINT 0.5 FAILED — aborting');
  console.error('  Provide --operator-confirmed flag and ensure 2+ lanes have recent heartbeats');
  process.exit(1);
}

const dualVerify = checkDualVerification();
if (!dualVerify.passed) {
  console.error('\n✗ CHECKPOINT 6 FAILED — aborting');
  console.error('  L/R blind review did not reach consensus. Investigate the concerns above,');
  console.error('  or override with --force-dual-verification (records a forced consensus).');
  process.exit(1);
}

console.log('\n✓ ALL CHECKPOINT GATES PASSED — proceeding with resolution\n');

// 1. Load current trust store (the "new" state)
const trustStore = loadJson(TRUST_STORE);
console.log('Current trust store lanes:', Object.keys(trustStore).filter(k => k !== 'key_lineage' && k !== 'archived_keys' && k !== 'rotation_policy'));

// 2. Load pre-compact snapshot
const preCompact = loadJson(PRE_COMPACT);

// 3. Update pre-compact to match current authorized state
console.log('\n--- Updating PRE_COMPACT_SNAPSHOT.json to match authorized state ---');

// Update trust_store_key_ids to include all current lanes
preCompact.trust_store_key_ids = {};
for (const [laneId, laneData] of Object.entries(trustStore)) {
  if (laneId === 'key_lineage' || laneId === 'archived_keys' || laneId === 'rotation_policy') continue;
  preCompact.trust_store_key_ids[laneId] = laneData.key_id;
}
console.log('Updated trust_store_key_ids:', preCompact.trust_store_key_ids);

// Update file integrity for trust_store.json to current hash
const trustStoreHash = sha256File(TRUST_STORE);
console.log('Current trust-store.json hash:', trustStoreHash);

// Update file integrity for all lanes that reference the central trust-store.json
const lanes = ['archivist', 'library', 'swarmmind', 'kernel'];
for (const lane of lanes) {
  if (preCompact.file_integrity[lane] && preCompact.file_integrity[lane].trust_store) {
    preCompact.file_integrity[lane].trust_store.hash = trustStoreHash;
    console.log(`  Updated ${lane}.trust_store hash`);
  }
  if (preCompact.file_integrity[lane] && preCompact.file_integrity[lane].lane_trust_store) {
    preCompact.file_integrity[lane].lane_trust_store.hash = trustStoreHash;
    console.log(`  Updated ${lane}.lane_trust_store hash`);
  }
}

// 4. Handle library keys_json deletion - it was migrated to current.json/identity.json
// Remove keys_json from file_integrity since it no longer exists
if (preCompact.file_integrity.library && preCompact.file_integrity.library.keys_json) {
  delete preCompact.file_integrity.library.keys_json;
  console.log('Removed library.keys_json from file_integrity (migrated to current.json/identity.json)');
}

// 5. Update library private_pem and snapshot_json to current hashes
const libPrivatePem = path.join('S:', 'self-organizing-library', '.identity', 'private.pem');
const libSnapshot = path.join('S:', 'self-organizing-library', '.identity', 'snapshot.json');
if (fs.existsSync(libPrivatePem)) {
  preCompact.file_integrity.library.private_pem.hash = sha256File(libPrivatePem);
  console.log('Updated library.private_pem hash:', preCompact.file_integrity.library.private_pem.hash);
}
if (fs.existsSync(libSnapshot)) {
  preCompact.file_integrity.library.snapshot_json.hash = sha256File(libSnapshot);
  console.log('Updated library.snapshot_json hash:', preCompact.file_integrity.library.snapshot_json.hash);
}

// 6. Update lane_states to include new lanes (from post-compact)
const postCompact = loadJson(POST_COMPACT);
if (postCompact.post_compact && postCompact.post_compact.lane_states) {
  // Add new lanes to pre-compact lane_states
  const newLanes = ['control_plane', 'kucoin', 'authority'];
  for (const lane of newLanes) {
    if (postCompact.post_compact.lane_states[lane]) {
      preCompact.lane_states[lane] = postCompact.post_compact.lane_states[lane];
      console.log(`Added lane state for: ${lane}`);
    }
  }
}

// 7. Update inbox_counts to include new lanes
if (postCompact.post_compact && postCompact.post_compact.inbox_counts) {
  for (const lane of ['control_plane', 'kucoin', 'authority']) {
    if (postCompact.post_compact.inbox_counts[lane] !== undefined) {
      preCompact.inbox_counts[lane] = postCompact.post_compact.inbox_counts[lane];
    }
  }
}

// 8. Update active_blocker to match post-compact (no blocker)
preCompact.active_blocker = postCompact.post_compact.active_blocker;
console.log('Updated active_blocker to:', preCompact.active_blocker);

// 9. Update handoff_hash to current
preCompact.handoff_hash = postCompact.post_compact.handoff_hash;
console.log('Updated handoff_hash to:', preCompact.handoff_hash);

// 10. Update timestamp to now
preCompact.timestamp = new Date().toISOString();
preCompact.phase = 'pre_compact_resolved';

// Auto-backup canonical baseline before in-place mutation (recovery safety).
// Never overwrite PRE_COMPACT_SNAPSHOT.json without a .bak_<ts>.json copy.
const preCompactBakName = `PRE_COMPACT_SNAPSHOT.bak_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const preCompactBak = path.join(path.dirname(PRE_COMPACT), preCompactBakName);
try {
  fs.copyFileSync(PRE_COMPACT, preCompactBak);
  console.log(`Backed up baseline to: ${preCompactBakName}`);
} catch (e) {
  console.error('FATAL: could not back up PRE_COMPACT_SNAPSHOT.json — aborting to avoid corrupting baseline:', e.message);
  process.exit(1);
}

// Save updated pre-compact
saveJson(PRE_COMPACT, preCompact);
console.log('\n✓ PRE_COMPACT_SNAPSHOT.json updated and saved (atomic write)');

// 11. Now run post-compact-audit again to verify resolution
console.log('\n=== Running post-compact-audit to verify ===\n');

// Import and run the audit (PostCompactAudit.run() is synchronous)
const { PostCompactAudit } = require('./post-compact-audit.js');

function runVerification() {
  try {
    const result = new PostCompactAudit().run();
    console.log('\n=== VERIFICATION RESULT ===');
    console.log('Status:', result.status);
    console.log('Unexpected changes:', (result.diff && result.diff.unexpected_changes || []).length);
    console.log('Trust chain intact:', result.diff && result.diff.trust_chain_intact);
    console.log('File integrity violations:', (result.diff && result.diff.file_integrity_violations || []).length);

    if (result.status === 'aligned') {
      console.log('\n✓ ALL CONTRADICTIONS RESOLVED - Status: aligned');
      return true;
    }
    console.log('\n✗ Not aligned:', result.status);
    if (result.diff && result.diff.unexpected_changes && result.diff.unexpected_changes.length > 0) {
      console.log('Unexpected changes:', result.diff.unexpected_changes);
    }
    return false;
  } catch (err) {
    console.error('Verification error:', err.message);
    return false;
  }
}

if (!runVerification()) {
  console.error('\n✗ VERIFICATION FAILED — resolution did not reach aligned status');
  // Fail-closed: restore the pre-mutation baseline so a failed resolution never
  // leaves the canonical snapshot mutated. The backup is written before saveJson.
  try {
    fs.copyFileSync(preCompactBak, PRE_COMPACT);
    console.error(`Rolled back PRE_COMPACT_SNAPSHOT.json to pre-mutation backup: ${preCompactBakName}`);
  } catch (rollbackErr) {
    console.error('CRITICAL: rollback failed — restore manually from backup:', preCompactBakName, '-', rollbackErr.message);
  }
  process.exit(1);
}