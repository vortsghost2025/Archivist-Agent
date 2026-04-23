'use strict';

const fs = require('fs');
const path = require('path');
const { loadPolicy, assertWatcherConfig } = require('./concurrency-policy');

const DEFAULT_CONFIG = {
  laneName: 'archivist',
  inboxPath: path.join(__dirname, '..', 'lanes', 'archivist', 'inbox'),
  intervalSeconds: 60,
  staleAfterSeconds: 900,
  canonicalPaths: {
    archivist: 'S:/Archivist-Agent/lanes/archivist/inbox/',
    library: 'S:/self-organizing-library/lanes/library/inbox/',
    swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox/',
    kernel: 'S:/kernel-lane/lanes/kernel/inbox/'
  }
};

const REPO_ROOT = path.join(__dirname, '..');
const POLICY = loadPolicy(REPO_ROOT);
assertWatcherConfig({
  laneName: DEFAULT_CONFIG.laneName,
  heartbeatSeconds: DEFAULT_CONFIG.intervalSeconds
}, POLICY);

class Heartbeat {
  constructor(configOverrides) {
    this.config = Object.assign({}, DEFAULT_CONFIG, configOverrides || {});
    this.startTime = Date.now();
    this.messagesProcessed = 0;
    this._timer = null;
    this._shuttingDown = false;
  }

  start() {
    this.writeHeartbeat();
    this._timer = setInterval(() => {
      this.writeHeartbeat();
    }, this.config.intervalSeconds * 1000);

    process.on('SIGINT', () => this._handleSignal('SIGINT'));
    process.on('SIGTERM', () => this._handleSignal('SIGTERM'));
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._shuttingDown = true;
    this.writeHeartbeat();
  }

  _handleSignal(signal) {
    if (this._shuttingDown) return;
    this.stop();
    process.exit(0);
  }

  _heartbeatFilename(laneName) {
    return `heartbeat-${laneName}.json`;
  }

  writeHeartbeat() {
    const now = new Date();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const heartbeatStatus = this._shuttingDown ? 'done' : 'in_progress';

    // Create idempotency key as SHA-256 of "heartbeat-{laneName}-fixed"
    const crypto = require('crypto');
    const idempotencyKey = crypto.createHash('sha256').update(`heartbeat-${this.config.laneName}-fixed`).digest('hex');

    // Construct schema-compliant heartbeat message
    const message = {
      schema_version: "1.1",
      task_id: `heartbeat-${this.config.laneName}`,
      idempotency_key: idempotencyKey,
      from: this.config.laneName,
      to: this.config.laneName,
      type: "heartbeat",
      task_kind: "proposal",
      priority: "P3",
      subject: `Heartbeat from ${this.config.laneName} lane`,
      body: JSON.stringify({
        lane: this.config.laneName,
        session_active: !this._shuttingDown,
        uptime_seconds: uptimeSeconds,
        messages_processed: this.messagesProcessed,
        last_inbox_scan: now.toISOString(),
        version: '1.0'
      }),
      timestamp: now.toISOString(),
      requires_action: false,
      payload: {
        mode: "inline"
      },
      execution: {
        mode: "manual",
        engine: "opencode",
        actor: "lane"
      },
      lease: {
        owner: null,
        acquired_at: null,
        expires_at: null,
        renew_count: 0,
        max_renewals: 3
      },
      retry: {
        attempt: 1,
        max_attempts: 3,
        last_error: null,
        last_attempt_at: null
      },
      evidence: {
        required: true,
        evidence_path: null,
        verified: false,
        verified_by: null,
        verified_at: null
      },
      heartbeat: {
        interval_seconds: this.config.intervalSeconds,
        last_heartbeat_at: now.toISOString(),
        timeout_seconds: this.config.staleAfterSeconds,
        status: heartbeatStatus
      },
      signature: "",
      key_id: ""
    };

    const dir = this.config.inboxPath;
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, this._heartbeatFilename(this.config.laneName));
      fs.writeFileSync(filePath, JSON.stringify(message, null, 2) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write heartbeat:', err.message);
    }
  }

  incrementProcessed() {
    this.messagesProcessed++;
  }

  checkLaneHealth() {
    const now = Date.now();
    const lanes = {};

    const laneNames = Object.keys(this.config.canonicalPaths);
    for (let i = 0; i < laneNames.length; i++) {
      const laneName = laneNames[i];
      const inboxPath = this.config.canonicalPaths[laneName];
      const laneSpecificPath = path.join(inboxPath, this._heartbeatFilename(laneName));

      try {
        if (!fs.existsSync(laneSpecificPath)) {
          lanes[laneName] = { status: 'unknown', last_heartbeat: null, stale_for_seconds: 0 };
          continue;
        }

        const raw = fs.readFileSync(laneSpecificPath, 'utf8');
        const data = JSON.parse(raw);
        const heartbeatTime = new Date(data.timestamp).getTime();
        const elapsed = Math.floor((now - heartbeatTime) / 1000);

        lanes[laneName] = {
          status: elapsed > this.config.staleAfterSeconds ? 'stale' : 'alive',
          last_heartbeat: data.timestamp,
          stale_for_seconds: elapsed
        };
      } catch (err) {
        lanes[laneName] = { status: 'unknown', last_heartbeat: null, stale_for_seconds: 0 };
      }
    }

    return { timestamp: new Date().toISOString(), lanes: lanes };
  }
}

module.exports = { Heartbeat, DEFAULT_CONFIG };

if (require.main === module) {
  const args = process.argv.slice(2);
  const heartbeat = new Heartbeat();

  if (args.includes('--check')) {
    const report = heartbeat.checkLaneHealth();
    console.log(JSON.stringify(report, null, 2));
  } else if (args.includes('--once')) {
    heartbeat.writeHeartbeat();
  } else {
    heartbeat.start();
  }
}
