#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LANE_CONFIG = [
  { lane: 'archivist', root: 'S:/Archivist-Agent' },
  { lane: 'kernel', root: 'S:/kernel-lane' },
  { lane: 'library', root: 'S:/self-organizing-library' },
  { lane: 'swarmmind', root: 'S:/SwarmMind' },
];

const BROADCAST_DIR = 'S:/Archivist-Agent/lanes/broadcast';

function countJson(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((ent) => ent.isFile() && ent.name.toLowerCase().endsWith('.json'))
      .length;
  } catch (_) {
    return 0;
  }
}

function computeLaneMetrics({ lane, root }) {
  const inboxRoot = path.join(root, 'lanes', lane, 'inbox');
  const queueDepth =
    countJson(inboxRoot) +
    countJson(path.join(inboxRoot, 'action-required')) +
    countJson(path.join(inboxRoot, 'in-progress'));
  const blocked = countJson(path.join(inboxRoot, 'blocked'));
  const quarantine = countJson(path.join(inboxRoot, 'quarantine'));
  const latticeFreedom = Math.max(0, queueDepth - blocked - quarantine);

  return {
    lane,
    lattice_freedom: latticeFreedom,
    queue_depth: queueDepth,
    blocked,
    quarantine,
    line: `lane=${lane} lattice_freedom=${latticeFreedom} queue_depth=${queueDepth} blocked=${blocked} quarantine=${quarantine}`,
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const generatedAt = new Date().toISOString();
  const dateKey = generatedAt.slice(0, 10);
  const metrics = LANE_CONFIG.map(computeLaneMetrics);
  const payload = {
    generated_at: generatedAt,
    source: 'scripts/publish-lattice-freedom-pulse.js',
    metrics,
    format_hint: 'lattice_freedom=<n>, queue_depth=<n>, blocked=<n>, quarantine=<n>',
  };

  ensureDir(BROADCAST_DIR);
  const datedPath = path.join(BROADCAST_DIR, `lattice-freedom-pulse-${dateKey}.json`);
  const latestPath = path.join(BROADCAST_DIR, 'lattice-freedom-pulse-latest.json');
  fs.writeFileSync(datedPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), 'utf8');

  process.stdout.write(`${generatedAt}\n`);
  for (const item of metrics) process.stdout.write(`${item.line}\n`);
  process.stdout.write(`broadcast_file=${latestPath}\n`);
}

if (require.main === module) {
  main();
}
