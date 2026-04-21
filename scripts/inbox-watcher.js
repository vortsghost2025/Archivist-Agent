#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

const SKIP_FILENAMES = new Set([
  'heartbeat.json', 'watcher.log', 'watcher.pid', 'readme.md'
]);

const HEARTBEAT_PATTERN = /^heartbeat-.+\.json$/i;
const INBOX_MSG_PATTERN = /^\d{4}-/;

function isValidInboxMessage(filename) {
  const lower = filename.toLowerCase();
  if (SKIP_FILENAMES.has(lower)) return false;
  if (HEARTBEAT_PATTERN.test(lower)) return false;
  if (!INBOX_MSG_PATTERN.test(filename)) return false;
  return filename.endsWith('.json');
}

const DEFAULT_CONFIG = {
  laneName: 'archivist',
  inboxPath: path.join(__dirname, '..', 'lanes', 'archivist', 'inbox'),
  processedPath: path.join(__dirname, '..', 'lanes', 'archivist', 'inbox', 'processed'),
  outboxPath: path.join(__dirname, '..', 'lanes', 'archivist', 'outbox'),
  expiredPath: path.join(__dirname, '..', 'lanes', 'archivist', 'inbox', 'expired'),
  canonicalPaths: {
    archivist: 'S:/Archivist-Agent/lanes/archivist/inbox/',
    library: 'S:/self-organizing-library/lanes/library/inbox/',
    swarmmind: 'S:/SwarmMind Self-Optimizing Multi-Agent AI System/lanes/swarmmind/inbox/',
    kernel: 'S:/kernel-lane/lanes/kernel/inbox/'
  }
};

class InboxWatcher {
  constructor(overrides) {
    this.config = Object.assign({}, DEFAULT_CONFIG, overrides || {});
    this.processedKeys = new Set();
  }

  ensureDirs() {
    for (const dir of [this.config.inboxPath, this.config.processedPath,
                       this.config.outboxPath, this.config.expiredPath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  loadProcessedKeys() {
    try {
      const files = fs.readdirSync(this.config.processedPath);
      for (const f of files) {
        if (f.endsWith('.json')) {
          this.processedKeys.add(f);
        }
      }
    } catch (e) {
      // Empty on first run
    }
  }

  scan() {
    this.ensureDirs();
    this.loadProcessedKeys();

    let files;
    try {
      files = fs.readdirSync(this.config.inboxPath);
    } catch (e) {
      console.error('[watcher] Cannot read inbox:', e.message);
      return [];
    }

    const messages = [];

    for (const filename of files) {
      if (!isValidInboxMessage(filename)) continue;
      if (this.processedKeys.has(filename)) continue;

      const filePath = path.join(this.config.inboxPath, filename);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const msg = JSON.parse(raw);
        msg._sourceFile = filename;
        msg._sourcePath = filePath;
        messages.push(msg);
      } catch (e) {
        console.error(`[watcher] Cannot parse ${filename}:`, e.message);
        this.moveToProcessed(filename, filePath);
      }
    }

    messages.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 3;
      const pb = PRIORITY_ORDER[b.priority] ?? 3;
      return pa - pb;
    });

    return messages;
  }

  moveToProcessed(filename, sourcePath) {
    const dest = path.join(this.config.processedPath, filename);
    try {
      if (fs.existsSync(dest)) {
        fs.unlinkSync(sourcePath);
      } else {
        fs.renameSync(sourcePath, dest);
      }
      this.processedKeys.add(filename);
    } catch (e) {
      console.error(`[watcher] Cannot move ${filename}:`, e.message);
    }
  }

  processMessage(msg) {
    const filename = msg._sourceFile;
    const sourcePath = msg._sourcePath;
    const priority = msg.priority || 'P3';
    const type = msg.type || 'unknown';
    const from = msg.from || 'unknown';
    const body = msg.body || '';
    const requiresAction = msg.requires_action || false;

    console.log(`[watcher] Processing ${priority} ${type} from ${from}: ${body.slice(0, 80)}`);

    // Coordinator-specific: check for blocker claims
    if (type === 'finding' || type === 'review') {
      this.handleConvergenceCheck(msg);
    }

    if (requiresAction) {
      console.log(`[watcher] ACTION REQUIRED: ${msg.id || filename}`);
    }

    this.moveToProcessed(filename, sourcePath);
  }

  handleConvergenceCheck(msg) {
    // Coordinator receives proven/conflicted/blocked claims
    const status = msg.status || 'unproven';
    if (status === 'unproven') {
      console.log(`[watcher] SKIP: unproven claim from ${msg.from} — not forwarded`);
      return;
    }

    if (msg.claim && msg.evidence) {
      console.log(`[watcher] CONVERGENCE: ${msg.claim}`);
      console.log(`[watcher] Evidence: ${msg.evidence}`);
      console.log(`[watcher] Status: ${status}`);
    }
  }

  checkLaneHealth() {
    const results = {};
    const laneNames = Object.keys(this.config.canonicalPaths);

    for (const laneName of laneNames) {
      const inboxPath = this.config.canonicalPaths[laneName];
      const hbPath = path.join(inboxPath, `heartbeat-${laneName}.json`);

      try {
        if (!fs.existsSync(hbPath)) {
          results[laneName] = { status: 'no_heartbeat', stale_for_seconds: -1 };
          continue;
        }

        const raw = fs.readFileSync(hbPath, 'utf8');
        const data = JSON.parse(raw);
        const elapsed = Math.floor((Date.now() - new Date(data.timestamp).getTime()) / 1000);
        results[laneName] = {
          status: elapsed > 900 ? 'stale' : 'alive',
          last_heartbeat: data.timestamp,
          stale_for_seconds: elapsed
        };
      } catch (e) {
        results[laneName] = { status: 'error', stale_for_seconds: -1 };
      }
    }

    return results;
  }

  run() {
    console.log(`[watcher] ${this.config.laneName} inbox scan starting`);
    const messages = this.scan();
    console.log(`[watcher] Found ${messages.length} messages`);

    for (const msg of messages) {
      try {
        this.processMessage(msg);
      } catch (e) {
        console.error(`[watcher] Error processing ${msg._sourceFile}:`, e.message);
      }
    }

    return messages.length;
  }
}

module.exports = { InboxWatcher, DEFAULT_CONFIG };

if (require.main === module) {
  const args = process.argv.slice(2);
  const watcher = new InboxWatcher();

  if (args.includes('--health')) {
    const health = watcher.checkLaneHealth();
    console.log(JSON.stringify(health, null, 2));
  } else if (args.includes('--scan')) {
    const messages = watcher.scan();
    console.log(JSON.stringify(messages.map(m => ({
      id: m.id, from: m.from, priority: m.priority, type: m.type
    })), null, 2));
  } else {
    const count = watcher.run();
    console.log(`[watcher] Processed ${count} messages`);
  }
}
