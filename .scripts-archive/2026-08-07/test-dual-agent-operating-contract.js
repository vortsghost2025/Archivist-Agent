#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function loadPolicy() {
  const p = path.join(__dirname, '..', 'config', 'dual-agent-operating-contract.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function overlapWithinWindow(prev, next, windowSeconds) {
  return Math.abs(next.ts - prev.ts) <= windowSeconds * 1000;
}

function isSharedProtectedPath(policy, fileTree) {
  const normalized = String(fileTree || '').replace(/\\/g, '/').toLowerCase();
  return (policy.scope.protected_shared_paths || []).some((p) =>
    normalized.startsWith(String(p).replace(/\\/g, '/').toLowerCase())
  );
}

function evaluateIntent(policy, previousIntent, currentIntent) {
  if (!currentIntent.signed || !currentIntent.owner_agent_id) {
    return {
      action: policy.enforcement.on_unsigned_or_unowned_write_intent.action,
      reason: policy.enforcement.on_unsigned_or_unowned_write_intent.reason,
    };
  }

  const sameTree = previousIntent && previousIntent.file_tree === currentIntent.file_tree;
  const withinWindow =
    previousIntent &&
    overlapWithinWindow(previousIntent, currentIntent, policy.overlap_window_seconds);

  if (isSharedProtectedPath(policy, currentIntent.file_tree) && sameTree && withinWindow) {
    return {
      action: policy.enforcement.on_protected_shared_path_overlap.action,
      reason: policy.enforcement.on_protected_shared_path_overlap.reason,
    };
  }

  if (sameTree && withinWindow) {
    if (previousIntent.owner_agent_id !== currentIntent.owner_agent_id) {
      const repeat = previousIntent.overlap_seen === true;
      if (repeat) {
        return {
          action: policy.enforcement.on_repeat_overlap_within_window.action,
          reason: policy.enforcement.on_repeat_overlap_within_window.reason,
        };
      }
      return {
        action: policy.enforcement.on_first_overlap.action,
        reason: policy.enforcement.on_first_overlap.reason,
      };
    }
  }

  return { action: 'allow', reason: 'NO_CONFLICT' };
}

function run() {
  const policy = loadPolicy();
  const baseTs = Date.now();

  // 1) first overlap -> warn
  const i1 = {
    ts: baseTs,
    owner_agent_id: 'arch-fast',
    signed: true,
    file_tree: 'S:/Archivist-Agent/lanes/library',
    overlap_seen: false,
  };
  const i2 = {
    ts: baseTs + 60 * 1000,
    owner_agent_id: 'arch-methodical',
    signed: true,
    file_tree: 'S:/Archivist-Agent/lanes/library',
    overlap_seen: false,
  };
  const r1 = evaluateIntent(policy, i1, i2);
  assert.strictEqual(r1.action, 'warn');

  // 2) repeat overlap within window -> block
  const i3 = {
    ...i2,
    ts: baseTs + 2 * 60 * 1000,
    owner_agent_id: 'arch-methodical',
    overlap_seen: true,
  };
  const i3b = {
    ...i3,
    ts: baseTs + 3 * 60 * 1000,
    owner_agent_id: 'arch-fast',
    overlap_seen: false,
  };
  const r2 = evaluateIntent(policy, i3, i3b);
  assert.strictEqual(r2.action, 'block');

  // 3) repeat overlap outside window -> warn (window reset)
  const i4 = {
    ...i2,
    ts: baseTs + 20 * 60 * 1000,
    overlap_seen: false,
  };
  const r3 = evaluateIntent(policy, i1, i4);
  assert.strictEqual(r3.action, 'allow');
  const i5 = {
    ...i4,
    ts: baseTs + 21 * 60 * 1000,
    owner_agent_id: 'arch-fast',
    overlap_seen: false,
  };
  const r4 = evaluateIntent(policy, i4, i5);
  assert.strictEqual(r4.action, 'warn');

  // 4) shared protected path overlap -> immediate block
  const s1 = {
    ts: baseTs,
    owner_agent_id: 'arch-fast',
    signed: true,
    file_tree: 'S:/Archivist-Agent/lanes/broadcast/system_state.json',
    overlap_seen: false,
  };
  const s2 = {
    ts: baseTs + 30 * 1000,
    owner_agent_id: 'arch-methodical',
    signed: true,
    file_tree: 'S:/Archivist-Agent/lanes/broadcast/system_state.json',
    overlap_seen: false,
  };
  const r5 = evaluateIntent(policy, s1, s2);
  assert.strictEqual(r5.action, 'block');

  // 5) unsigned/unowned intent -> quarantine
  const u1 = {
    ts: baseTs,
    owner_agent_id: null,
    signed: false,
    file_tree: 'S:/Archivist-Agent/lanes/kernel',
  };
  const r6 = evaluateIntent(policy, null, u1);
  assert.strictEqual(r6.action, 'quarantine');

  console.log('Dual-agent operating contract: PASS (5/5 checks)');
}

if (require.main === module) {
  run();
}

module.exports = {
  evaluateIntent,
  overlapWithinWindow,
  isSharedProtectedPath,
};
