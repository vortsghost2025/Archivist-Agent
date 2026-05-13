#!/usr/bin/env node
'use strict';

/**
 * init-research-radar.js
 * Initializes the Research Radar evidence storage directory structure.
 * Creates all required subdirectories, initial index, and state files.
 *
 * Run once at project setup or after clearing evidence/.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(process.cwd(), 'evidence', 'research-radar', 'v1');

const dirs = [
  'packets',
  'packets/example',
  'by-source',
  'by-status',
  'state',
  'logs',
  'archive'
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log('Created:', dirPath);
  }
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log('Created:', filePath);
  } else {
    console.log('Exists:', filePath);
  }
}

function init() {
  console.log('Initializing Research Radar evidence storage at', BASE);

  for (const d of dirs) {
    ensureDir(path.join(BASE, d));
  }

  writeIfMissing(path.join(BASE, 'index.json'), {
    schema_version: "1.0.0",
    index_generated_at: new Date().toISOString(),
    description: "Global index of all Research Radar evidence packets.",
    packets: {},
    counters: { total_packets: 0, by_source: {}, by_risk_level: {}, by_verification_status: {} }
  });

  writeIfMissing(path.join(BASE, 'state', 'current.json'), {
    schema_version: "1.0.0",
    state_updated_at: new Date().toISOString(),
    current_focus_areas: [
      "sovereignty",
      "autonomous agents",
      "task chains",
      "provenance",
      "self-healing",
      "graph reasoning",
      "safety gates",
      "CI loops",
      "multi-agent orchestration",
      "evals",
      "open-source agent frameworks"
    ],
    relevance_threshold: 0.65,
    min_confidence: 0.6,
    auto_approval_enabled: false,
    pending_review_count: 0,
    last_scan_completed: null,
    next_scan_scheduled: null,
    statistics: {
      total_packets_ingested: 0,
      total_approved: 0,
      total_rejected: 0,
      total_expired: 0,
      average_relevance_score: 0.0,
      high_risk_items: 0
    }
  });

  writeIfMissing(path.join(BASE, 'state', 'schema_version.txt'), "1.0.0\n");

  // Initialize empty source indexes for all known sources
  const sources = ['arxiv', 'openalex', 'semantic_scholar', 'github', 'bluesky', 'hacker_news', 'youtube', 'rss', 'other'];
  for (const src of sources) {
    const filePath = path.join(BASE, 'by-source', `${src}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({
        source: src,
        updated_at: new Date().toISOString(),
        packet_ids: []
      }, null, 2), 'utf8');
      console.log('Created:', filePath);
    }
  }

  // Initialize status indexes
  const statuses = ['pending', 'approved', 'rejected', 'expired'];
  for (const st of statuses) {
    const filePath = path.join(BASE, 'by-status', `${st}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({
        status: st,
        updated_at: new Date().toISOString(),
        packet_ids: []
      }, null, 2), 'utf8');
      console.log('Created:', filePath);
    }
  }

  console.log('Initialization complete.');
  console.log('Next steps:');
  console.log('  1. Run connectors to populate packets/');
  console.log('  2. Run node scripts/rebuild-research-index.js to index them');
  console.log('  3. Process pending packets via lane messages');
}

if (require.main === module) {
  init();
}

module.exports = { init };
