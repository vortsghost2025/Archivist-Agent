#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LANES = [
  { id: 'archivist', root: 'S:/Archivist-Agent' },
  { id: 'kernel', root: 'S:/kernel-lane' },
  { id: 'library', root: 'S:/self-organizing-library' },
  { id: 'swarmmind', root: 'S:/SwarmMind' },
];

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function laneStatus(lane) {
  const packagePath = path.join(lane.root, 'package.json');
  const pkg = readJsonIfExists(packagePath);
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const hasPackageWatch = Boolean(scripts.watch);

  const watcherPath = path.join(lane.root, 'scripts', 'inbox-watcher.js');
  const laneWorkerPath = path.join(lane.root, 'scripts', 'lane-worker.js');

  return {
    lane: lane.id,
    root: lane.root,
    package_json_found: Boolean(pkg),
    package_watch_script: hasPackageWatch ? scripts.watch : null,
    watcher_script_found: fs.existsSync(watcherPath),
    lane_worker_found: fs.existsSync(laneWorkerPath),
  };
}

function main() {
  const report = {
    generated_at: new Date().toISOString(),
    checks: LANES.map(laneStatus),
  };

  const outPath = path.join(
    'S:/Archivist-Agent/context-buffer',
    `lane-watch-support-${Date.now()}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ outPath, report }, null, 2));
}

if (require.main === module) {
  main();
}
