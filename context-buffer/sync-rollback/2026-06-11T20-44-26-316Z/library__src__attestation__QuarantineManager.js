/**
 * QuarantineManager – Library-side quarantine loop.
 *
 * This manager intentionally mirrors the API shape used by VerifierWrapper
 * so deterministic failure paths do not throw at runtime.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_QUARANTINE_LOG_PATH = path.resolve(__dirname, '../../logs/quarantine.log');
const DEFAULT_HANDOFF_FILE = path.resolve(__dirname, '../../AGENT_HANDOFF_REQUIRED.md');
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 5000;

class QuarantineManager {
  constructor(options = {}) {
    this.quarantinedItems = new Map();
    this.logPath = options.logPath || DEFAULT_QUARANTINE_LOG_PATH;
    this.handoffFile = options.handoffFile || DEFAULT_HANDOFF_FILE;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.backoffMs = options.backoffMs || DEFAULT_BACKOFF_MS;
    this.metrics = {
      total: 0,
      byLane: {},
      maxExceeded: 0
    };
    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    } catch (_) {}
  }

  _deriveId(item) {
    if (item?.id) return String(item.id);
    if (item?.signature) return item.signature.slice(0, 16);
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(item || {}))
      .digest('hex')
      .slice(0, 16);
  }

  _deriveLane(item) {
    return item?.origin_lane || item?.lane || 'unknown';
  }

  _logEvent(event) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, 'utf8');
    } catch (err) {
      console.error('[QuarantineManager] Failed to write log:', err.message);
    }
  }

  _emitMetric(type, lane) {
    if (!this.metrics.byLane[lane]) {
      this.metrics.byLane[lane] = { quarantined: 0, released: 0, failed: 0 };
    }
    if (type === 'quarantine') {
      this.metrics.total++;
      this.metrics.byLane[lane].quarantined++;
    } else if (type === 'release') {
      this.metrics.byLane[lane].released++;
    } else if (type === 'max_exceeded') {
      this.metrics.maxExceeded++;
      this.metrics.byLane[lane].failed++;
    }
  }

  quarantine(item, reason, nextRetryIn) {
    const itemId = this._deriveId(item);
    const lane = this._deriveLane(item);
    const existing = this.quarantinedItems.get(itemId);
    const now = new Date().toISOString();

    const entry = {
      item,
      reason,
      lane,
      retryCount: existing ? existing.retryCount + 1 : 1,
      firstQuarantined: existing ? existing.firstQuarantined : now,
      lastRetry: existing ? now : null,
      nextRetryIn: nextRetryIn || null
    };
    this.quarantinedItems.set(itemId, entry);

    this._logEvent({
      event: 'QUARANTINE',
      item_id: itemId,
      lane,
      reason,
      retry_count: entry.retryCount,
      next_retry_in_ms: entry.nextRetryIn
    });
    this._emitMetric('quarantine', lane);

    if (entry.retryCount > this.maxRetries) {
      this._emitMetric('max_exceeded', lane);
      this._signalHumanIntervention(itemId, lane, reason, entry.retryCount);
      return {
        status: 'MAX_RETRIES_EXCEEDED',
        itemId,
        lane,
        retryCount: entry.retryCount,
        handoffRequired: true
      };
    }

    return {
      status: 'QUARANTINED',
      itemId,
      lane,
      retryCount: entry.retryCount,
      nextRetryIn: this.backoffMs * entry.retryCount,
      reason,
      handoffRequired: false
    };
  }

  _signalHumanIntervention(itemId, lane, reason, retryCount) {
    this._logEvent({
      event: 'HANDOFF_SIGNAL',
      item_id: itemId,
      lane,
      reason,
      retry_count: retryCount,
      message: 'Operator intervention required'
    });

    const body = [
      '# AGENT HANDOFF REQUIRED',
      '',
      `**Status:** Quarantine max retries exceeded`,
      `**Item ID:** ${itemId}`,
      `**Lane:** ${lane}`,
      `**Reason:** ${reason}`,
      `**Retry Count:** ${retryCount}`,
      `**Timestamp:** ${new Date().toISOString()}`,
      '',
      '## Action Required',
      '1. Release with manual approval',
      '2. Permanently reject',
      '3. Force phenotype sync',
      '',
      `## Logs`,
      `See: ${this.logPath}`,
      ''
    ].join('\n');

    try {
      fs.writeFileSync(this.handoffFile, body, 'utf8');
    } catch (err) {
      console.error('[QuarantineManager] Failed to write handoff signal:', err.message);
    }
  }

  isQuarantined(itemId) {
    return this.quarantinedItems.has(itemId);
  }

  get(itemId) {
    return this.quarantinedItems.get(itemId) || null;
  }

  getQuarantineStatus(itemId) {
    return this.get(itemId);
  }

  release(itemId) {
    const entry = this.quarantinedItems.get(itemId);
    if (!entry) return { success: false, reason: 'NOT_IN_QUARANTINE' };
    this._logEvent({
      event: 'RELEASE',
      item_id: itemId,
      lane: entry.lane,
      original_reason: entry.reason,
      total_retries: entry.retryCount
    });
    this._emitMetric('release', entry.lane);
    this.quarantinedItems.delete(itemId);
    return { success: true, reason: 'QUARANTINE_RELEASED' };
  }

  clearHandoffSignal() {
    try {
      if (fs.existsSync(this.handoffFile)) {
        fs.unlinkSync(this.handoffFile);
      }
    } catch (err) {
      console.error('[QuarantineManager] Failed to clear handoff signal:', err.message);
    }
  }

  scheduleRetry(itemId, callback) {
    const entry = this.quarantinedItems.get(itemId);
    if (!entry) return false;
    entry.lastRetry = new Date().toISOString();
    const delay = this.backoffMs * entry.retryCount;
    setTimeout(() => {
      if (this.quarantinedItems.has(itemId)) {
        callback(entry.item);
      }
    }, delay);
    return true;
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentlyQuarantined: this.quarantinedItems.size,
      quarantinedItems: Array.from(this.quarantinedItems.entries()).map(([id, entry]) => ({
        itemId: id,
        lane: entry.lane,
        retryCount: entry.retryCount,
        reason: entry.reason,
        firstQuarantined: entry.firstQuarantined
      }))
    };
  }
}

module.exports = { QuarantineManager };
