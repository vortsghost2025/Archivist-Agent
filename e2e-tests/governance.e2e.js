#!/usr/bin/env node
/**
 * E2E: Governance state validation.
 * Verifies broadcast state files, trust store integrity, and system consistency.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const BROADCAST = path.join(REPO_ROOT, 'lanes', 'broadcast');

function run() {
  // 1. Broadcast directory exists
  assert.ok(fs.existsSync(BROADCAST), 'lanes/broadcast/ directory must exist');

  // 2. System state file exists and is valid JSON
  const statePath = path.join(BROADCAST, 'system_state.json');
  assert.ok(fs.existsSync(statePath), 'system_state.json must exist');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.ok(typeof state.system_status === 'string', 'system_status must be a string');
  assert.ok(['consistent', 'inconsistent', 'degraded'].includes(state.system_status),
    `system_status "${state.system_status}" must be consistent|inconsistent|degraded`);

  // 3. Trust store exists and has at least one lane
  const trustPath = path.join(BROADCAST, 'trust-store.json');
  assert.ok(fs.existsSync(trustPath), 'trust-store.json must exist');
  const trust = JSON.parse(fs.readFileSync(trustPath, 'utf8'));
  const laneIds = Object.keys(trust).filter(k => k !== 'key_lineage' && k !== 'archived_keys' && k !== 'rotation_policy');
  assert.ok(laneIds.length >= 4, `trust store must have at least 4 lane entries, found ${laneIds.length}`);

  // 4. Each trust store lane entry has required fields
  for (const laneId of laneIds) {
    const entry = trust[laneId];
    assert.ok(entry.lane_id, `lane ${laneId} must have lane_id`);
    assert.ok(entry.lane_state, `lane ${laneId} must have lane_state`);
    assert.ok(entry.key_id, `lane ${laneId} must have key_id`);
    assert.ok(entry.algorithm, `lane ${laneId} must have algorithm`);
    assert.ok(entry.registered_at, `lane ${laneId} must have registered_at`);
    assert.ok(['ACTIVE', 'DORMANT', 'SUSPENDED', 'REVOKED'].includes(entry.lane_state),
      `lane ${laneId} lane_state "${entry.lane_state}" must be ACTIVE|DORMANT|SUSPENDED|REVOKED`);
  }

  // 5. Last recovery file exists and has valid structure
  const recoveryPath = path.join(BROADCAST, 'last-recovery.json');
  if (fs.existsSync(recoveryPath)) {
    const recovery = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
    assert.ok(recovery.verdict, 'last-recovery.json must have verdict');
    assert.ok(['PROVEN', 'CONFLICTED'].includes(recovery.verdict),
      `recovery verdict "${recovery.verdict}" must be PROVEN|CONFLICTED`);
  }

  // 6. Governance verification registry exists
  const gvrPath = path.join(BROADCAST, 'governance-verification-registry.json');
  assert.ok(fs.existsSync(gvrPath), 'governance-verification-registry.json must exist');

  // 7. Active mode file exists
  const activeModePath = path.join(BROADCAST, 'active-mode.json');
  assert.ok(fs.existsSync(activeModePath), 'active-mode.json must exist');

  console.log('governance.e2e.js: all 7 checks passed');
}

module.exports = { run };

if (require.main === module) run();
