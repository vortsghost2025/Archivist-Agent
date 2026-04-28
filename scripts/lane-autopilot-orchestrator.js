#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const LANE_CONFIG = {
  archivist: { root: 'S:/Archivist-Agent' },
  kernel: { root: 'S:/kernel-lane' },
  library: { root: 'S:/self-organizing-library' },
  swarmmind: { root: 'S:/SwarmMind' },
};

function parseArgs(argv) {
  const out = {
    lanes: Object.keys(LANE_CONFIG),
    pollSeconds: 10,
    manualCadence: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--lanes' && argv[i + 1]) {
      out.lanes = argv[i + 1]
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--poll-seconds' && argv[i + 1]) {
      out.pollSeconds = Math.max(1, Number(argv[i + 1]) || out.pollSeconds);
      i += 1;
      continue;
    }
    if (arg === '--manual-cadence') {
      out.manualCadence = true;
      continue;
    }
  }

  return out;
}

function now() {
  return new Date().toISOString();
}

function log(lane, message) {
  process.stdout.write(`[${now()}] [${lane}] ${message}\n`);
}

function startLaneWorker(lane, pollSeconds, manualCadence) {
  const cfg = LANE_CONFIG[lane];
  if (!cfg) throw new Error(`Unknown lane: ${lane}`);

  const args = [
    path.join('scripts', 'lane-worker.js'),
    '--lane', lane,
    '--watch',
    '--poll-seconds', String(pollSeconds),
  ];
  if (manualCadence) args.push('--manual-cadence');
  else args.push('--apply');

  const child = spawn('node', args, {
    cwd: cfg.root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) log(lane, text);
  });
  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) log(lane, `ERR ${text}`);
  });

  return child;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lanes = args.lanes.filter((lane) => Boolean(LANE_CONFIG[lane]));

  if (lanes.length === 0) {
    throw new Error('No valid lanes selected. Use --lanes archivist,kernel,library,swarmmind');
  }

  const children = new Map();
  const shuttingDown = { value: false };

  function launch(lane) {
    const child = startLaneWorker(lane, args.pollSeconds, args.manualCadence);
    children.set(lane, child);
    log(lane, `started lane-worker pid=${child.pid}`);

    child.on('exit', (code, signal) => {
      log(lane, `exited code=${code} signal=${signal || 'none'}`);
      children.delete(lane);

      if (shuttingDown.value) return;
      setTimeout(() => {
        if (!shuttingDown.value) {
          log(lane, 'restarting lane-worker after exit');
          launch(lane);
        }
      }, 2000);
    });
  }

  function shutdown(signalName) {
    if (shuttingDown.value) return;
    shuttingDown.value = true;
    log('orchestrator', `received ${signalName}, stopping children`);
    for (const [lane, child] of children.entries()) {
      try {
        log(lane, `stopping pid=${child.pid}`);
        child.kill('SIGTERM');
      } catch (_) {}
    }
    setTimeout(() => process.exit(0), 500);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const mode = args.manualCadence ? 'manual-cadence' : 'continuous-apply';
  log('orchestrator', `starting lanes=${lanes.join(',')} poll=${args.pollSeconds}s mode=${mode}`);
  for (const lane of lanes) {
    launch(lane);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[orchestrator] FATAL: ${err.message}`);
    process.exit(1);
  }
}
