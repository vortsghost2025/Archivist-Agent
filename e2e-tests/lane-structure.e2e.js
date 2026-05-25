#!/usr/bin/env node
/**
 * E2E: Lane directory structure validation.
 * Verifies all active lanes have required inbox/outbox/state directories.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const LANES_DIR = path.join(REPO_ROOT, 'lanes');

const REQUIRED_LANES = ['archivist', 'kernel', 'swarmmind', 'library'];
const OPTIONAL_LANES = ['kucoin', 'authority'];
const ALL_LANES = [...REQUIRED_LANES, ...OPTIONAL_LANES];

const REQUIRED_SUBDIRS = ['inbox', 'outbox', 'state'];
const INBOX_SUBDIRS = ['processed', 'quarantine', 'action-required'];

function run() {
  // 1. Lanes directory exists
  assert.ok(fs.existsSync(LANES_DIR), 'lanes/ directory must exist');

  // 2. All required lanes exist with canonical subdirectories
  for (const laneId of REQUIRED_LANES) {
    const lanePath = path.join(LANES_DIR, laneId);
    assert.ok(fs.existsSync(lanePath), `required lane "${laneId}" directory must exist`);

    for (const subdir of REQUIRED_SUBDIRS) {
      const subdirPath = path.join(lanePath, subdir);
      assert.ok(fs.existsSync(subdirPath), `lane "${laneId}" must have ${subdir}/ directory`);
    }

    // Check inbox subdirectories
    const inboxPath = path.join(lanePath, 'inbox');
    for (const inboxSub of INBOX_SUBDIRS) {
      const inboxSubPath = path.join(inboxPath, inboxSub);
      assert.ok(fs.existsSync(inboxSubPath), `lane "${laneId}" inbox must have ${inboxSub}/ subdirectory`);
    }
  }

  // 3. Optional lanes: if they exist, must have inbox and outbox (state/ is advisory)
  for (const laneId of OPTIONAL_LANES) {
    const lanePath = path.join(LANES_DIR, laneId);
    if (fs.existsSync(lanePath)) {
      for (const subdir of ['inbox', 'outbox']) {
        const subdirPath = path.join(lanePath, subdir);
        assert.ok(fs.existsSync(subdirPath), `optional lane "${laneId}" exists but missing ${subdir}/`);
      }
      const statePath = path.join(lanePath, 'state');
      if (!fs.existsSync(statePath)) {
        console.log(`  ADVISORY: optional lane "${laneId}" missing state/ directory`);
      }
    }
  }

  // 4. Broadcast directory exists
  const broadcastPath = path.join(LANES_DIR, 'broadcast');
  assert.ok(fs.existsSync(broadcastPath), 'lanes/broadcast/ must exist');

  // 5. No orphan inbox items in action-required (should be empty for clean start)
  for (const laneId of REQUIRED_LANES) {
    const arPath = path.join(LANES_DIR, laneId, 'inbox', 'action-required');
    if (fs.existsSync(arPath)) {
      const items = fs.readdirSync(arPath).filter(f => !f.startsWith('.'));
      // This is advisory, not a hard fail — P0 items would block work
      if (items.length > 0) {
        console.log(`  ADVISORY: lane "${laneId}" has ${items.length} action-required items`);
      }
    }
  }

  // 6. Active blocker rule: at most one active-blocker.json
  const blockerPath = path.join(LANES_DIR, 'broadcast', 'active-blocker.json');
  if (fs.existsSync(blockerPath)) {
    const blocker = JSON.parse(fs.readFileSync(blockerPath, 'utf8'));
    assert.ok(blocker.owner_lane, 'active-blocker must have owner_lane');
    assert.ok(blocker.reason, 'active-blocker must have reason');
    console.log(`  ADVISORY: active blocker owned by ${blocker.owner_lane}`);
  }

  console.log('lane-structure.e2e.js: all 6 checks passed');
}

module.exports = { run };

if (require.main === module) run();
