#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LANES = [
  { name: 'archivist', root: 'S:/Archivist-Agent' },
  { name: 'library', root: 'S:/self-organizing-library' },
  { name: 'kernel', root: 'S:/kernel-lane' },
  { name: 'swarmmind', root: 'S:/SwarmMind' }
];

const OUTPUT_DIR = 'S:/Archivist-Agent/context-buffer';
const JSON_OUT = path.join(OUTPUT_DIR, 'agent-health-snapshot-latest.json');
const MD_OUT = path.join(OUTPUT_DIR, 'agent-health-snapshot-latest.md');

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function heartbeatStatus(lane) {
  const file = path.join(lane.root, 'lanes', lane.name, 'inbox', `heartbeat-${lane.name}.json`);
  if (!fs.existsSync(file)) {
    return { status: 'missing', age_seconds: null, file };
  }
  const msg = safeReadJson(file);
  const ts = msg && msg.timestamp ? new Date(msg.timestamp).getTime() : fs.statSync(file).mtimeMs;
  const age = Math.floor((Date.now() - ts) / 1000);
  return {
    status: age > 900 ? 'stale' : 'alive',
    age_seconds: age,
    file
  };
}

function inboxCounts(lane) {
  const inbox = path.join(lane.root, 'lanes', lane.name, 'inbox');
  const processed = path.join(inbox, 'processed');
  const actionRequired = path.join(inbox, 'action-required');
  const quarantine = path.join(inbox, 'quarantine');
  const countJson = (dir) => {
    try {
      return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
    } catch (_) {
      return 0;
    }
  };
  return {
    inbox_json: countJson(inbox),
    processed_json: countJson(processed),
    action_required_json: countJson(actionRequired),
    quarantine_json: countJson(quarantine)
  };
}

function gatherProcesses() {
  const cmd = [
    'Get-Process |',
    "Where-Object { $_.ProcessName -match 'node|kilo|cursor' } |",
    'Select-Object ProcessName, Id, WorkingSet64 |',
    'ConvertTo-Json -Depth 2'
  ].join(' ');
  const raw = execSync(`powershell -NoProfile -Command "${cmd}"`, { encoding: 'utf8' });
  const parsed = raw.trim() ? JSON.parse(raw) : [];
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row) => ({
    image: `${row.ProcessName || 'unknown'}.exe`,
    pid: Number(row.Id) || null,
    session: 'n/a',
    mem_usage: `${Math.round((Number(row.WorkingSet64) || 0) / 1024)} K`
  }));
}

function formatMd(snapshot) {
  const lines = [];
  lines.push('# Agent Health Snapshot');
  lines.push('');
  lines.push(`Generated: ${snapshot.generated_at}`);
  lines.push('');
  lines.push('## Lane Status');
  lines.push('');
  for (const lane of snapshot.lanes) {
    lines.push(`- ${lane.name}: heartbeat=${lane.heartbeat.status} age=${lane.heartbeat.age_seconds}s inbox=${lane.counts.inbox_json} action-required=${lane.counts.action_required_json} quarantine=${lane.counts.quarantine_json}`);
  }
  lines.push('');
  lines.push('## Process Inventory (node/kilo/cursor)');
  lines.push('');
  if (snapshot.processes.length === 0) {
    lines.push('- none found');
  } else {
    for (const p of snapshot.processes) {
      lines.push(`- ${p.image} pid=${p.pid} mem=${p.mem_usage}`);
    }
  }
  lines.push('');
  lines.push('## Suggested Actions');
  lines.push('');
  lines.push('- If any heartbeat is stale (>900s), refresh lane heartbeat and re-check.');
  lines.push('- If action-required grows, drain it before processed backlog.');
  lines.push('- If process memory pressure rises, raise watcher poll interval.');
  return lines.join('\n') + '\n';
}

function main() {
  const lanes = LANES.map((lane) => ({
    name: lane.name,
    heartbeat: heartbeatStatus(lane),
    counts: inboxCounts(lane)
  }));
  const snapshot = {
    generated_at: new Date().toISOString(),
    lanes,
    processes: gatherProcesses()
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(MD_OUT, formatMd(snapshot), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    json: JSON_OUT,
    markdown: MD_OUT,
    lane_status: lanes.map((l) => ({ name: l.name, heartbeat: l.heartbeat.status }))
  }, null, 2));
}

if (require.main === module) {
  main();
}
