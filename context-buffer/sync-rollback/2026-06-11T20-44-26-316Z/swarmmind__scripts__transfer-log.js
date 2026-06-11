'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createTransferEntry(msg, direction, lane) {
  const entry = {
    log_version: '1.0',
    timestamp: new Date().toISOString(),
    lane: lane || msg.from || 'unknown',
    direction,
    task_id: msg.task_id || null,
    from: msg.from || null,
    to: msg.to || null,
    type: msg.type || null,
    priority: msg.priority || null,
    subject: (msg.subject || '').substring(0, 200),
    signature_present: !!(msg.signature && msg.signature.length > 0),
    key_id: msg.key_id || null,
    schema_version: msg.schema_version || null,
    content_hash: msg.content_hash || null,
    signature_valid: null,
    delivery_path: null,
  };

  if (msg._lane_worker) {
    entry.signature_valid = msg._lane_worker.signature_valid === true;
    entry.delivery_path = msg._lane_worker.route || null;
  }

  entry.log_hash = computeLogHash(entry);
  return entry;
}

function computeLogHash(entry) {
  const fields = [
    entry.timestamp, entry.lane, entry.direction, entry.task_id,
    entry.from, entry.to, entry.type, entry.content_hash,
  ];
  return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

function scanLaneTransfers(laneRoot, lane) {
  const entries = [];
  const inboxDirs = ['processed', 'action-required', 'in-progress', 'blocked', 'quarantine'];
  const inboxRoot = path.join(laneRoot, 'lanes', lane, 'inbox');

  for (const sub of inboxDirs) {
    const dir = path.join(inboxRoot, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
      try {
        const msg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        entries.push(createTransferEntry(msg, 'inbound', lane));
      } catch (_) {}
    }
  }

  const outboxDir = path.join(laneRoot, 'lanes', lane, 'outbox');
  if (fs.existsSync(outboxDir)) {
    for (const f of fs.readdirSync(outboxDir).filter(n => n.endsWith('.json'))) {
      try {
        const msg = JSON.parse(fs.readFileSync(path.join(outboxDir, f), 'utf8'));
        entries.push(createTransferEntry(msg, 'outbound', lane));
      } catch (_) {}
    }
  }

  return entries;
}

function aggregateTransferLog(laneRoots) {
  const allEntries = [];
  for (const [lane, root] of Object.entries(laneRoots)) {
    try {
      const entries = scanLaneTransfers(root, lane);
      allEntries.push(...entries);
    } catch (_) {}
  }

  allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const stats = {
    total: allEntries.length,
    inbound: allEntries.filter(e => e.direction === 'inbound').length,
    outbound: allEntries.filter(e => e.direction === 'outbound').length,
    signed: allEntries.filter(e => e.signature_present).length,
    unsigned: allEntries.filter(e => !e.signature_present).length,
    signature_validated: allEntries.filter(e => e.signature_valid === true).length,
    signature_invalid: allEntries.filter(e => e.signature_valid === false).length,
    by_lane: {},
    by_type: {},
    key_ids_used: new Set(),
  };

  for (const e of allEntries) {
    stats.by_lane[e.lane] = (stats.by_lane[e.lane] || 0) + 1;
    stats.by_type[e.type || 'unknown'] = (stats.by_type[e.type || 'unknown'] || 0) + 1;
    if (e.key_id) stats.key_ids_used.add(e.key_id);
  }
  stats.key_ids_used = [...stats.key_ids_used];

  return { entries: allEntries, stats, generated_at: new Date().toISOString() };
}

function verifyTrustStoreCoverage(trustStorePath, keyIdsUsed) {
  try {
    const store = JSON.parse(fs.readFileSync(trustStorePath, 'utf8'));
    const storeKeyIds = new Set();
    for (const [lane, info] of Object.entries(store)) {
      if (info.key_id) storeKeyIds.add(info.key_id);
    }

    const missing = keyIdsUsed.filter(id => !storeKeyIds.has(id));
    const covered = keyIdsUsed.filter(id => storeKeyIds.has(id));

    return {
      trust_store_keys: [...storeKeyIds],
      keys_in_use: keyIdsUsed,
      covered,
      missing,
      full_coverage: missing.length === 0,
      lane_count: Object.keys(store).length,
    };
  } catch (err) {
    return { trust_store_keys: [], keys_in_use: keyIdsUsed, covered: [], missing: keyIdsUsed, full_coverage: false, error: err.message };
  }
}

module.exports = { createTransferEntry, scanLaneTransfers, aggregateTransferLog, verifyTrustStoreCoverage, computeLogHash };
