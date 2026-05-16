#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LANE_ROOTS = {
  archivist: 'S:/Archivist-Agent',
  kernel: 'S:/kernel-lane',
  library: 'S:/self-organizing-library',
  swarmmind: 'S:/SwarmMind',
};

const TRUST_STORE_PATH = path.join(__dirname, '..', 'lanes', 'broadcast', 'trust-store.json');
const LANE_REGISTRY_PATH = path.join(__dirname, '..', '.global', 'lane-registry.json');
const AUTONOMY_LEDGER_PATH = path.join(__dirname, '..', 'context-buffer', 'autonomy-ledger.jsonl');
const BLOCKER_PATH = path.join(__dirname, '..', 'lanes', 'broadcast', 'active-blocker.json');
const SCHEMA_VERSION = '1.0';

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return null; }
}

function gitInfo(root) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
    const lastHash = execSync('git log -1 --format=%h', { cwd: root, encoding: 'utf8' }).trim();
    const lastSubject = execSync('git log -1 --format=%s', { cwd: root, encoding: 'utf8' }).trim();
    const lastTime = execSync('git log -1 --format=%cI', { cwd: root, encoding: 'utf8' }).trim();
    let dirty = 0;
    try { dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(l => l).length; } catch (_) {}
    let unpushed = 0;
    try { unpushed = execSync('git log @{u}..HEAD --oneline', { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(l => l).length; } catch (_) {}
    return { branch, last_commit: lastHash, last_subject: lastSubject, last_commit_time: lastTime, dirty_files: dirty, unpushed_commits: unpushed };
  } catch (_) {
    return { branch: null, last_commit: null, last_subject: null, last_commit_time: null, dirty_files: null, unpushed_commits: null };
  }
}

function latestLedgerEntry() {
  try {
    const lines = fs.readFileSync(AUTONOMY_LEDGER_PATH, 'utf8').trim().split('\n');
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch (_) { return null; }
}

function countJsonRecursive(dir) {
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) count++;
      else if (entry.isDirectory()) count += countJsonRecursive(path.join(dir, entry.name));
    }
  } catch (_) {}
  return count;
}

function countInbox(root, lane) {
  const inboxDir = path.join(root, 'lanes', lane, 'inbox');
  let unprocessed = 0;
  try { unprocessed = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json') && !f.startsWith('heartbeat-')).length; } catch (_) {}
  let processed = 0;
  try { processed = countJsonRecursive(path.join(inboxDir, 'processed')); } catch (_) {}
  let invalid = 0;
  try { invalid = countJsonRecursive(path.join(inboxDir, 'quarantine')); } catch (_) {}
  return { unprocessed, processed, invalid };
}

function cpsScore(root) {
  const yamlPath = path.join(root, 'constitutional_constraints.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  try {
    const raw = fs.readFileSync(yamlPath, 'utf8');
    let total = 0;
    const listRe = /^-\s*name:\s*(\w+)[\s\S]*?weight:\s*(\d+)/gm;
    let m;
    while ((m = listRe.exec(raw)) !== null) { total += parseInt(m[2], 10); }
    if (total === 0) {
      const kvRe = /^(\w+):\s*(\d+)/gm;
      while ((m = kvRe.exec(raw)) !== null) { total += parseInt(m[2], 10); }
    }
    return total > 0 ? total : null;
  } catch (_) { return null; }
}

function buildIdentity(lane) {
  const root = LANE_ROOTS[lane];
  if (!root) return null;

  const registry = readJsonSafe(LANE_REGISTRY_PATH) || {};
  const laneInfo = (registry.lanes || {})[lane] || {};
  const trust = readJsonSafe(TRUST_STORE_PATH) || {};
  const trustEntry = trust[lane] || {};
  const presence = require('./agent-presence');
  const presStatus = presence.status(lane);
  const ledger = latestLedgerEntry();
  const health = ledger ? (ledger.health || {})[lane] : null;
  const git = gitInfo(root);
  const inbox = countInbox(root, lane);
  const cps = cpsScore(root);
  const blocker = readJsonSafe(BLOCKER_PATH);

  const lockData = presStatus.lock;

  const identity = {
    schema_version: SCHEMA_VERSION,
    emitted_at: new Date().toISOString(),
    generator: 'emit-identity.js',
    whoami: {
      lane_id: lane,
      role: laneInfo.role || 'unknown',
      repo: laneInfo.repo || null,
      local_path: laneInfo.local_path || root,
      key_id: trustEntry.key_id || null,
    },
    session: presStatus.agent_active && lockData ? {
      active: true,
      session_id: lockData.session_id,
      acquired_at: lockData.acquired_at,
      expires_at: lockData.expires_at || null,
    } : {
      active: false,
      session_id: null,
      acquired_at: null,
    },
    watcher: {
      mode: presStatus.watcher_mode,
      will_process: presStatus.watcher_will_process,
    },
    last_activity: {
      commit: git.last_commit,
      commit_subject: git.last_subject,
      commit_time: git.last_commit_time,
      branch: git.branch,
      dirty_files: git.dirty_files,
      unpushed_commits: git.unpushed_commits,
    },
    health: health ? {
      inbox_unread: health.i,
      outbox_pending: health.o,
      heartbeat_age_sec: Math.round(health.hb),
      garbage_collect: health.gc,
    } : null,
    inbox: inbox,
    governance: {
      cps_score: cps,
      active_blocker: blocker && blocker.active ? (blocker.owner || blocker.lane || 'unknown') : null,
    },
    system: ledger ? {
      topology_ok: (ledger.topology || {}).ok || null,
      drift_status: (ledger.drift || {}).status || null,
      drift_aligned: (ledger.drift || {}).aligned || null,
      drift_count: (ledger.drift || {}).drift_n || null,
      drift_regressions: (ledger.drift || {}).regress || null,
      ledger_time: ledger.ts,
    } : null,
  };

  return identity;
}

function toPlainText(identity) {
  const w = identity.whoami;
  const s = identity.session;
  const a = identity.last_activity;
  const h = identity.health;
  const i = identity.inbox;
  const g = identity.governance;
  const sys = identity.system;
  const watch = identity.watcher;

  const lines = [];
  lines.push(`=== ${w.lane_id.toUpperCase()} LANE IDENTITY ===`);
  lines.push(``);
  lines.push(`WHO AM I`);
  lines.push(`  Lane:        ${w.lane_id}`);
  lines.push(`  Role:        ${w.role}`);
  lines.push(`  Key ID:      ${w.key_id || 'none'}`);
  lines.push(`  Repo:        ${w.repo || 'none'}`);
  lines.push(`  Path:        ${w.local_path}`);
  lines.push(``);
  lines.push(`SESSION`);
  lines.push(`  Active:      ${s.active ? 'YES' : 'NO'}`);
  if (s.active) {
    lines.push(`  Session:     ${s.session_id}`);
    lines.push(`  Started:     ${s.acquired_at}`);
  }
  lines.push(`  Watcher:     ${watch.mode} (process: ${watch.will_process ? 'yes' : 'no'})`);
  lines.push(``);
  lines.push(`LAST ACTIVITY`);
  if (a.commit) {
    lines.push(`  Branch:      ${a.branch}`);
    lines.push(`  Commit:      ${a.commit} ${a.commit_subject}`);
    lines.push(`  When:        ${a.commit_time}`);
    lines.push(`  Dirty:       ${a.dirty_files} files`);
    lines.push(`  Unpushed:    ${a.unpushed_commits} commits`);
  } else {
    lines.push(`  (no git data)`);
  }
  lines.push(``);
  lines.push(`HEALTH`);
  if (h) {
    const hbHrs = (h.heartbeat_age_sec / 3600).toFixed(1);
    lines.push(`  Unread:      ${h.inbox_unread}`);
    lines.push(`  Outbox:      ${h.outbox_pending}`);
    lines.push(`  Heartbeat:   ${hbHrs}h ago`);
    lines.push(`  GC:          ${h.garbage_collect ? 'YES' : 'no'}`);
  } else {
    lines.push(`  (no ledger data)`);
  }
  lines.push(``);
  lines.push(`INBOX`);
  lines.push(`  Pending:     ${i.unprocessed}`);
  lines.push(`  Processed:   ${i.processed}`);
  lines.push(`  Invalid:     ${i.invalid}`);
  lines.push(``);
  lines.push(`GOVERNANCE`);
  lines.push(`  CPS Score:   ${g.cps_score !== null ? g.cps_score : 'unknown'}`);
  lines.push(`  Blocker:     ${g.active_blocker || 'none'}`);
  lines.push(``);
  if (sys) {
    lines.push(`SYSTEM`);
    lines.push(`  Topology:    ${sys.topology_ok === true ? 'OK' : sys.topology_ok === false ? 'FAIL' : 'unknown'}`);
    lines.push(`  Drift:       ${sys.drift_status || 'unknown'} (${sys.drift_aligned}/${sys.drift_aligned + sys.drift_count} aligned, ${sys.drift_regressions !== null ? sys.drift_regressions : '?'} regressions)`);
    lines.push(`  Ledger at:   ${sys.ledger_time}`);
  }

  lines.push(``);
  lines.push(`--- emitted ${identity.emitted_at} by ${identity.generator} v${SCHEMA_VERSION} ---`);
  return lines.join('\n');
}

function emit(lane, opts = {}) {
  const identity = buildIdentity(lane);
  if (!identity) {
    console.error(`Unknown lane: ${lane}`);
    return { ok: false, lane, error: 'unknown_lane' };
  }

  const stateDir = path.join(LANE_ROOTS[lane], 'lanes', lane, 'state');
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  const jsonPath = path.join(stateDir, 'IDENTITY.json');
  const txtPath = path.join(stateDir, 'IDENTITY.txt');

  fs.writeFileSync(jsonPath, JSON.stringify(identity, null, 2));
  fs.writeFileSync(txtPath, toPlainText(identity));

  if (!opts.quiet) {
    console.log(toPlainText(identity));
  }

  return { ok: true, lane, json_path: jsonPath, txt_path: txtPath };
}

function emitAll(opts = {}) {
  const results = {};
  for (const lane of Object.keys(LANE_ROOTS)) {
    results[lane] = emit(lane, { quiet: true, ...opts });
  }

  if (!opts.quiet) {
    console.log('=== ALL LANES IDENTITY SUMMARY ===');
    console.log('');
    console.log('Lane       | Active | Commit     | CPS | Inbox | Heartbeat | Drift');
    console.log('-----------|--------|------------|-----|-------|-----------|------');
    for (const [lane, r] of Object.entries(results)) {
      if (!r.ok) { console.log(`${lane.padEnd(10)} | ERROR`); continue; }
      const id = buildIdentity(lane);
      const active = id.session.active ? 'YES' : 'no ';
      const commit = (id.last_activity.commit || 'none').padEnd(10);
      const cps = (id.governance.cps_score !== null ? String(id.governance.cps_score) : '?').padEnd(3);
      const inbox = String(id.inbox.unprocessed).padEnd(5);
      const hb = id.health ? `${(id.health.heartbeat_age_sec / 3600).toFixed(0)}h` : '?';
      const drift = id.system ? (id.system.drift_status || '?').substring(0, 20) : '?';
      console.log(`${lane.padEnd(10)} | ${active}  | ${commit} | ${cps} | ${inbox} | ${hb.padEnd(9)} | ${drift}`);
    }
    console.log('');

    for (const lane of Object.keys(LANE_ROOTS)) {
      const id = buildIdentity(lane);
      console.log(toPlainText(id));
      console.log('');
    }
  }

  return results;
}

module.exports = { buildIdentity, emit, emitAll, toPlainText };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help') {
    console.log('Usage: node emit-identity.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  <lane>      Emit identity for one lane (archivist|kernel|library|swarmmind)');
    console.log('  all         Emit identity for all lanes');
    console.log('  json <lane> Emit JSON only (no text output)');
    console.log('  text <lane> Print text only (no file write)');
    console.log('');
    console.log('Output: lanes/<lane>/state/IDENTITY.json + IDENTITY.txt');
    process.exit(0);
  }

  if (cmd === 'all') {
    emitAll();
  } else if (cmd === 'json') {
    const lane = args[1];
    const id = buildIdentity(lane);
    if (id) console.log(JSON.stringify(id, null, 2));
    else { console.error(`Unknown lane: ${lane}`); process.exit(1); }
  } else if (cmd === 'text') {
    const lane = args[1];
    const id = buildIdentity(lane);
    if (id) console.log(toPlainText(id));
    else { console.error(`Unknown lane: ${lane}`); process.exit(1); }
  } else if (LANE_ROOTS[cmd]) {
    emit(cmd);
  } else {
    console.error(`Unknown command or lane: ${cmd}`);
    console.log('Valid lanes: ' + Object.keys(LANE_ROOTS).join(', '));
    process.exit(1);
  }
}
