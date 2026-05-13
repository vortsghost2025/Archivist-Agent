#!/usr/bin/env node
'use strict';

/**
 * rebuild-research-index.js
 * Scans evidence/research-radar/v1/packets/ and rebuilds:
 *   - Global index (index.json)
 *   - Source indexes (by-source/*.json)
 *   - Status indexes (by-status/*.json)
 *   - State statistics (state/current.json)
 *
 * Run after manual packet additions/removals or if indexes become corrupted.
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(process.cwd(), 'evidence', 'research-radar', 'v1');
const PACKETS_DIR = path.join(BASE_DIR, 'packets');
const INDEX_FILE = path.join(BASE_DIR, 'index.json');
const STATE_FILE = path.join(BASE_DIR, 'state', 'current.json');

function readJSON(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function walkPackets(dir, packetList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPackets(full, packetList);
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      packetList.push(full);
    }
  }
  return packetList;
}

function extractPacketMetadata(packetPath) {
  try {
    const raw = fs.readFileSync(packetPath, 'utf8');
    const pkt = JSON.parse(raw);
    const relPath = path.relative(process.cwd(), packetPath).replace(/\\/g, '/');

    return {
      packet_id: pkt.packet_id,
      path: relPath,
      source: pkt.source,
      risk_level: pkt.risk_level,
      verified: !!pkt.provenance?.verified,
      relevance_score: pkt.relevance_score,
      ingested_at: pkt.provenance?.retrieved_at || null
    };
  } catch (e) {
    console.warn('Failed to parse', packetPath, e.message);
    return null;
  }
}

function buildIndexes() {
  if (!fs.existsSync(PACKETS_DIR)) {
    console.error('Packets directory not found:', PACKETS_DIR);
    process.exit(1);
  }

  console.log('Scanning packets...');
  const packetFiles = walkPackets(PACKETS_DIR);
  console.log(`Found ${packetFiles.length} packet files.`);

  const index = {
    schema_version: "1.0.0",
    index_generated_at: new Date().toISOString(),
    packets: {},
    counters: {
      total_packets: 0,
      by_source: {},
      by_risk_level: {},
      by_verification_status: { verified: 0, pending: 0 }
    }
  };

  // Source and status indexes
  const bySource = {};
  const byStatus = { pending: [], approved: [], rejected: [], expired: [] };

  for (const pktPath of packetFiles) {
    const meta = extractPacketMetadata(pktPath);
    if (!meta) continue;

    index.packets[meta.packet_id] = {
      path: meta.path,
      source: meta.source,
      risk_level: meta.risk_level,
      relevance_score: meta.relevance_score,
      verified: meta.verified,
      ingested_at: meta.ingested_at
    };

    // Counters
    index.counters.total_packets++;
    index.counters.by_source[meta.source] = (index.counters.by_source[meta.source] || 0) + 1;
    index.counters.by_risk_level[meta.risk_level] = (index.counters.by_risk_level[meta.risk_level] || 0) + 1;
    if (meta.verified) index.counters.by_verification_status.verified++;
    else index.counters.by_verification_status.pending++;

    // Source index
    if (!bySource[meta.source]) bySource[meta.source] = [];
    bySource[meta.source].push(meta.packet_id);

    // Status index (simple: verified -> approved, else pending)
    const status = meta.verified ? 'approved' : 'pending';
    byStatus[status].push(meta.packet_id);
  }

  // Write global index
  writeJSON(INDEX_FILE, index);
  console.log('Wrote index.json');

  // Write source indexes
  for (const [source, ids] of Object.entries(bySource)) {
    const outPath = path.join(BASE_DIR, 'by-source', `${source}.json`);
    writeJSON(outPath, {
      source,
      updated_at: new Date().toISOString(),
      packet_ids: ids
    });
  }
  console.log('Wrote by-source indexes:', Object.keys(bySource).join(', '));

  // Write status indexes
  for (const [status, ids] of Object.entries(byStatus)) {
    const outPath = path.join(BASE_DIR, 'by-status', `${status}.json`);
    writeJSON(outPath, {
      status,
      updated_at: new Date().toISOString(),
      packet_ids: ids
    });
  }
  console.log('Wrote by-status indexes:', Object.keys(byStatus).join(', '));

  // Update state statistics
  const state = readJSON(STATE_FILE, {});
  state.schema_version = "1.0.0";
  state.state_updated_at = new Date().toISOString();
  state.statistics = {
    total_packets_ingested: index.counters.total_packets,
    total_approved: byStatus.approved.length,
    total_pending: byStatus.pending.length,
    total_rejected: byStatus.rejected.length,
    total_expired: byStatus.expired.length,
    average_relevance_score: 0.0, // TODO: compute if needed
    high_risk_items: index.counters.by_risk_level.high + (index.counters.by_risk_level.critical || 0)
  };
  state.pending_review_count = byStatus.pending.length;
  writeJSON(STATE_FILE, state);
  console.log('Updated state/current.json');

  console.log('Index rebuild complete.');
}

if (require.main === module) {
  buildIndexes();
}

module.exports = { buildIndexes, walkPackets, extractPacketMetadata };
