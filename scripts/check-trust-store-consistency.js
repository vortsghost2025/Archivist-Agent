#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function loadTrustStore(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  const keys = parsed.keys || {};
  const result = {};
  for (const [laneId, entry] of Object.entries(keys)) {
    if (entry && entry.key_id) {
      result[laneId] = {
        key_id: entry.key_id,
        algorithm: entry.algorithm || null,
        state: entry.lane_state || (entry.revoked_at ? 'REVOKED' : 'ACTIVE')
      };
    }
  }
  return result;
}

function compare(stores) {
  const allLanes = new Set();
  for (const s of stores) {
    for (const lane of Object.keys(s)) allLanes.add(lane);
  }

  const divergences = [];
  const laneEntries = [];

  for (const lane of allLanes) {
    const entries = stores.map(s => s[lane] || null);
    const ref = entries[0];
    const laneDiv = { lane, entries: [] };

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      laneDiv.entries.push({
        store_index: i,
        key_id: e ? e.key_id : null,
        algorithm: e ? e.algorithm : null,
        state: e ? e.state : null
      });
    }

    const presentCount = entries.filter(e => e !== null).length;
    if (presentCount < stores.length) {
      laneDiv.divergence = 'MISSING_LANE';
      divergences.push(laneDiv);
    } else {
      const activeEntries = entries.filter(e => e && e.state === 'ACTIVE');
      const keyIds = new Set(activeEntries.map(e => e.key_id));
      const algs = new Set(activeEntries.map(e => e.algorithm));

      if (activeEntries.length > 1 && keyIds.size > 1) {
        laneDiv.divergence = 'ACTIVE_KEY_ID_MISMATCH';
        divergences.push(laneDiv);
      } else if (activeEntries.length > 1 && algs.size > 1) {
        laneDiv.divergence = 'ALGORITHM_MISMATCH';
        divergences.push(laneDiv);
      }
    }

    laneEntries.push(laneDiv);
  }

  return { divergences, laneEntries };
}

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const paths = args.filter(a => a !== '--json');

  if (paths.length < 2) {
    console.error('Usage: node check-trust-store-consistency.js <path1> <path2> [--json]');
    process.exit(2);
  }

  const stores = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      console.error(`MISSING: ${p}`);
      process.exit(2);
    }
    stores.push(loadTrustStore(p));
  }

  const result = compare(stores);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const d of result.divergences) {
      console.log(`DIVERGENCE: lane=${d.lane} type=${d.divergence}`);
      for (const e of d.entries) {
        console.log(`  store[${e.store_index}]: key_id=${e.key_id} algorithm=${e.algorithm} state=${e.state}`);
      }
    }
    if (result.divergences.length === 0) {
      console.log('CONSISTENT');
    }
  }

  process.exit(result.divergences.length > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { loadTrustStore, compare };
