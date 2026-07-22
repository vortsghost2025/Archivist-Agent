#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '.global', 'lane-registry.json');

// Expected branch per repository (based on headless verification)
const EXPECTED_BRANCHES = {
  archivist: 'master',
  authority: 'master',
  kernel: 'main',
  swarmmind: 'main',
  library: 'main',
  control_plane: 'main',
  kucoin: 'main',
  'solana-launch': 'main'
};

// Required fields per lane entry
const REQUIRED_FIELDS = [
  'lane_id', 'role', 'lane_state', 'local_path', 'repo', 'branch', 'mailboxes'
];

const REQUIRED_MAILBOXES = ['inbox', 'outbox'];

function run() {
  console.log('Testing lane-registry.json validity...');

  // 1. Parse validation
  let data;
  try {
    data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    assert.fail(`Failed to parse lane-registry.json: ${err.message}`);
  }
  console.log('  [PASS] JSON parses correctly');

  // 2. Schema version
  assert.strictEqual(data.schema_version, '1.0', 'schema_version must be 1.0');
  assert.ok(data.registry_id, 'registry_id must be present');
  assert.ok(data.timestamp, 'timestamp must be present');
  console.log('  [PASS] Schema metadata present');

  // 3. All lanes must have required fields
  let laneErrors = [];
  for (const [laneId, lane] of Object.entries(data.lanes)) {
    for (const field of REQUIRED_FIELDS) {
      if (lane[field] === undefined) {
        laneErrors.push(`${laneId}: missing required field "${field}"`);
      }
    }
    // Check mailboxes
    if (lane.mailboxes) {
      for (const mb of REQUIRED_MAILBOXES) {
        if (!lane.mailboxes[mb]) {
          laneErrors.push(`${laneId}: missing mailbox "${mb}"`);
        }
      }
    }
  }
  if (laneErrors.length > 0) {
    assert.fail(`Lane errors:\n  ${laneErrors.join('\n  ')}`);
  }
  console.log('  [PASS] All lanes have required fields');

  // 4. Branch name validation
  let branchErrors = [];
  for (const [laneId, lane] of Object.entries(data.lanes)) {
    const expected = EXPECTED_BRANCHES[laneId];
    if (expected && lane.branch !== expected) {
      branchErrors.push(`${laneId}: expected branch "${expected}", got "${lane.branch}"`);
    }
  }
  if (branchErrors.length > 0) {
    assert.fail(`Branch errors:\n  ${branchErrors.join('\n  ')}`);
  }
  console.log('  [PASS] Branch names match expected values');

  // 5. Swarmmind branch must be 'main' (verified against headless checkout)
  assert.strictEqual(data.lanes.swarmmind.branch, 'main',
    'SwarmMind branch must be "main" — headless checkout is on main, not master');
  console.log('  [PASS] SwarmMind branch verified as main (not master)');

  // 6. control_plane path must use 'control-plane' (hyphen, not underscore — verified on headless)
  const cpInbox = data.lanes.control_plane.mailboxes.inbox;
  if (cpInbox.includes('/control_plane/')) {
    assert.fail(`control_plane inbox uses underscore: ${cpInbox} — must be control-plane (hyphen)`);
  }
  assert.ok(cpInbox.includes('/control-plane/'),
    `control_plane inbox must use hyphen path: ${cpInbox}`);
  console.log('  [PASS] control_plane path uses hyphen (control-plane)');

  // 7. Authority lane_state must not be ARCHIVED (it's INTEGRATED)
  assert.notStrictEqual(data.lanes.authority.lane_state, 'ARCHIVED',
    'Authority lane_state should not be ARCHIVED — it is a governance sub-role within Archivist');
  console.log('  [PASS] authority lane_state is not ARCHIVED');

  // 8. All lanes must have lane_state
  for (const [laneId, lane] of Object.entries(data.lanes)) {
    assert.ok(lane.lane_state, `${laneId}: lane_state must be set`);
    assert.ok(['ACTIVE', 'INTEGRATED', 'ARCHIVED', 'FROZEN'].includes(lane.lane_state),
      `${laneId}: lane_state must be one of ACTIVE, INTEGRATED, ARCHIVED, FROZEN`);
  }
  console.log('  [PASS] All lanes have valid lane_state');

  // 9. Broadcast section validation
  assert.ok(data.broadcast, 'broadcast section must be present');
  assert.ok(data.broadcast.path, 'broadcast.path must be present');
  assert.ok(data.cross_lane_protocol, 'cross_lane_protocol must be present');
  console.log('  [PASS] broadcast and cross_lane_protocol sections present');

  // 10. agent_instructions validation
  assert.ok(data.agent_instructions, 'agent_instructions must be present');
  assert.ok(Array.isArray(data.agent_instructions.before_creating_any_path),
    'before_creating_any_path must be an array');
  assert.ok(Array.isArray(data.agent_instructions.path_validation),
    'path_validation must be an array');
  console.log('  [PASS] agent_instructions sections valid');

  console.log('\nPASS lane-registry.test.js — all assertions passed');
}

if (require.main === module) {
  run();
}

module.exports = { run };