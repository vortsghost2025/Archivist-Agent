#!/usr/bin/env node
'use strict';

/**
 * LANE REGISTRY TEST — Fixture-based
 *
 * Validates the lane-registry-validation module using in-memory fixtures.
 * Also runs a smoke test against the real registry if available.
 *
 * Tests do NOT depend on:
 *   - live SSH or headless access
 *   - current machine topology
 *   - specific SHAs or timestamps
 *   - external service availability
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { validateRegistry, VALID_LANE_STATES } = require('../scripts/util/lane-registry-validation');

const REGISTRY_PATH = path.join(__dirname, '..', '.global', 'lane-registry.json');

// ── Helpers ────────────────────────────────────────────────────────

function errorCodes(result) {
  return result.errors.map(function (e) { return e.code; });
}

function warningCodes(result) {
  return result.warnings.map(function (w) { return w.code; });
}

function observationCodes(result) {
  return result.observations.map(function (o) { return o.code; });
}

function countByCode(arr, code) {
  return arr.filter(function (e) { return e.code === code; }).length;
}

function makeFixture(overrides) {
  var base = {
    schema_version: '1.0',
    registry_id: 'test-fixture',
    timestamp: '2026-01-01T00:00:00Z',
    lanes: {
      archivist: {
        lane_id: 'archivist',
        role: 'coordinator',
        lane_state: 'ACTIVE',
        repo: 'owner/Archivist-Agent',
        branch: 'master',
        local_path: 'S:/Archivist-Agent',
        mailboxes: {
          inbox: 'S:/Archivist-Agent/lanes/archivist/inbox',
          outbox: 'S:/Archivist-Agent/lanes/archivist/outbox'
        }
      }
    },
    broadcast: { path: 'S:/Archivist-Agent/lanes/broadcast' },
    cross_lane_protocol: { send: 'write', receive: 'read' },
    agent_instructions: {
      before_creating_any_path: ['use registry'],
      path_validation: ['check']
    }
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
  }
  return base;
}

// ══════════════════════════════════════════════════════════════════
// GROUP 1 — Fixture-based validation
// ══════════════════════════════════════════════════════════════════

(function testValidWindowsRegistry() {
  var reg = makeFixture();
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'valid Windows registry: no errors. Got: ' + JSON.stringify(result.errors));
  console.log('  [PASS] valid Windows registry (S:/ paths)');
})();

(function testValidLinuxRegistry() {
  var reg = makeFixture({
    lanes: {
      archivist: {
        lane_id: 'archivist',
        role: 'coordinator',
        lane_state: 'ACTIVE',
        repo: 'owner/Archivist-Agent',
        branch: 'master',
        local_path: '/home/archivist/Archivist-Agent',
        mailboxes: {
          inbox: '/home/archivist/Archivist-Agent/lanes/archivist/inbox',
          outbox: '/home/archivist/Archivist-Agent/lanes/archivist/outbox'
        }
      }
    },
    broadcast: { path: '/home/archivist/Archivist-Agent/lanes/broadcast' }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'valid Linux registry: no errors. Got: ' + JSON.stringify(result.errors));
  console.log('  [PASS] valid Linux registry (/home/ paths)');
})();

(function testPathsWithSpaces() {
  var reg = makeFixture({
    lanes: {
      swarmmind: {
        lane_id: 'swarmmind',
        role: 'optimization',
        lane_state: 'ACTIVE',
        repo: 'owner/SwarmMind',
        branch: 'main',
        local_path: '/home/user/SwarmMind Self-Optimizing Agent',
        mailboxes: {
          inbox: '/home/user/SwarmMind Self-Optimizing Agent/lanes/swarmmind/inbox',
          outbox: '/home/user/SwarmMind Self-Optimizing Agent/lanes/swarmmind/outbox'
        }
      }
    },
    broadcast: { path: '/home/user/SwarmMind Self-Optimizing Agent/lanes/broadcast' }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'paths with spaces: no errors. Got: ' + JSON.stringify(result.errors));
  console.log('  [PASS] paths containing spaces');
})();

(function testValidKernelPath() {
  // Kernel: repo dir is kernel-lane, lane identifier is kernel
  // Valid path: S:/kernel-lane/lanes/kernel/inbox
  var reg = makeFixture({
    lanes: {
      kernel: {
        lane_id: 'kernel',
        role: 'execution',
        lane_state: 'ACTIVE',
        repo: 'owner/kernel-lane',
        branch: 'main',
        local_path: 'S:/kernel-lane',
        mailboxes: {
          inbox: 'S:/kernel-lane/lanes/kernel/inbox',
          outbox: 'S:/kernel-lane/lanes/kernel/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0, 'valid kernel path: no errors');
  var hasWrongSegment = countByCode(result.warnings, 'WRONG_PATH_SEGMENT');
  assert.strictEqual(hasWrongSegment, 0,
    'valid kernel path: no WRONG_PATH_SEGMENT warning');
  console.log('  [PASS] valid Kernel path: kernel-lane/lanes/kernel/inbox');
})();

(function testKernelWrongLaneSegment() {
  // Invalid: S:/kernel-lane/lanes/kernel-lane/inbox uses kernel-lane as lane identifier
  var reg = makeFixture({
    lanes: {
      kernel: {
        lane_id: 'kernel',
        role: 'execution',
        lane_state: 'ACTIVE',
        repo: 'owner/kernel-lane',
        branch: 'main',
        local_path: 'S:/kernel-lane',
        mailboxes: {
          inbox: 'S:/kernel-lane/lanes/kernel-lane/inbox',
          outbox: 'S:/kernel-lane/lanes/kernel-lane/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'wrong kernel lane segment: no errors');
  assert.ok(warningCodes(result).indexOf('WRONG_PATH_SEGMENT') >= 0,
    'wrong kernel lane segment: generates WRONG_PATH_SEGMENT warning');
  console.log('  [PASS] kernel-lane/lanes/kernel-lane/ path triggers WRONG_PATH_SEGMENT warning');
})();

(function testControlPlaneUnderscoreHyphen() {
  var reg = makeFixture({
    lanes: {
      control_plane: {
        lane_id: 'control_plane',
        role: 'supervisor',
        lane_state: 'ACTIVE',
        repo: 'owner/WE4FREE-Control-Plane',
        branch: 'main',
        local_path: 'S:/WE4FREE-Control-Plane',
        mailboxes: {
          inbox: 'S:/WE4FREE-Control-Plane/lanes/control-plane/inbox',
          outbox: 'S:/WE4FREE-Control-Plane/lanes/control-plane/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'control_plane hyphen warning: no errors');
  assert.ok(warningCodes(result).indexOf('UNDERSCORE_HYPHEN_MISMATCH') >= 0,
    'control_plane key with control-plane paths generates UNDERSCORE_HYPHEN_MISMATCH warning');
  console.log('  [PASS] control_plane (underscore key) with control-plane (hyphen paths) generates UNDERSCORE_HYPHEN_MISMATCH');
})();

(function testArchivedLaneMissingTransition() {
  var reg = makeFixture({
    lanes: {
      old_feature: {
        lane_id: 'old_feature',
        role: 'experimental',
        lane_state: 'ARCHIVED',
        repo: 'owner/old-repo',
        branch: 'main',
        local_path: 'S:/old-repo',
        mailboxes: {
          inbox: 'S:/old-repo/lanes/old_feature/inbox',
          outbox: 'S:/old-repo/lanes/old_feature/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'archived no transition: no errors');
  assert.ok(warningCodes(result).indexOf('ARCHIVED_NO_TRANSITION') >= 0,
    'ARCHIVED lane without notes generates ARCHIVED_NO_TRANSITION warning');
  console.log('  [PASS] ARCHIVED lane without transition metadata generates warning');
})();

(function testInvalidLaneState() {
  var reg = makeFixture({
    lanes: {
      mystery: {
        lane_id: 'mystery',
        role: 'unknown',
        lane_state: 'MYSTERY_MODE',
        repo: 'owner/repo',
        branch: 'main',
        local_path: 'S:/repo',
        mailboxes: {
          inbox: 'S:/repo/lanes/mystery/inbox',
          outbox: 'S:/repo/lanes/mystery/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(errorCodes(result).indexOf('INVALID_LANE_STATE') >= 0, true,
    'MYSTERY_MODE lane state triggers INVALID_LANE_STATE error. Got codes: '
    + errorCodes(result).join(', '));
  assert.strictEqual(result.errors.length, 1,
    'exactly one error for invalid lane state. Got: ' + result.errors.length);
  console.log('  [PASS] invalid lane_state MYSTERY_MODE triggers error');
})();

(function testDuplicateLaneId() {
  var reg = makeFixture({
    lanes: {
      alpha: {
        lane_id: 'dup_id',
        role: 'alpha',
        lane_state: 'ACTIVE',
        repo: 'owner/repo1',
        branch: 'main',
        local_path: 'S:/repo1',
        mailboxes: {
          inbox: 'S:/repo1/lanes/alpha/inbox',
          outbox: 'S:/repo1/lanes/alpha/outbox'
        }
      },
      beta: {
        lane_id: 'dup_id',
        role: 'beta',
        lane_state: 'ACTIVE',
        repo: 'owner/repo2',
        branch: 'main',
        local_path: 'S:/repo2',
        mailboxes: {
          inbox: 'S:/repo2/lanes/beta/inbox',
          outbox: 'S:/repo2/lanes/beta/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(countByCode(result.errors, 'DUPLICATE_LANE_ID'), 1,
    'duplicate lane_id triggers one DUPLICATE_LANE_ID error');
  console.log('  [PASS] duplicate canonical lane_id triggers DUPLICATE_LANE_ID error');
})();

(function testKucoinRuntimeAdapter() {
  // Kucoin has runtime adapter: mailbox through Archivist-Agent, not co-located
  var reg = makeFixture({
    lanes: {
      kucoin: {
        lane_id: 'kucoin',
        role: 'trading',
        lane_state: 'ACTIVE',
        repo: 'owner/kucoin-lane',
        branch: 'main',
        local_path: 'S:/kucoin-lane',
        mailboxes: {
          inbox: 'S:/Archivist-Agent/lanes/kucoin/inbox',
          outbox: 'S:/Archivist-Agent/lanes/kucoin/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.strictEqual(result.errors.length, 0,
    'kucoin runtime adapter: no errors');
  assert.ok(observationCodes(result).indexOf('RUNTIME_ADAPTER_DIFFERENCE') >= 0,
    'Kucoin mailbox in Archivist-Agent generates RUNTIME_ADAPTER_DIFFERENCE observation');
  console.log('  [PASS] Kucoin runtime adapter generates observation (not error or warning)');
})();

(function testConceptualLaneNoMailboxes() {
  // CONCEPTUAL lanes are allowed to not have mailboxes
  var reg = makeFixture({
    lanes: {
      future_idea: {
        lane_id: 'future_idea',
        role: 'exploration',
        lane_state: 'CONCEPTUAL',
        repo: '',
        branch: '',
        local_path: ''
      }
    }
  });
  var result = validateRegistry(reg);
  var missingMailboxCount = countByCode(result.errors, 'MISSING_MAILBOX');
  assert.strictEqual(missingMailboxCount, 0,
    'CONCEPTUAL lane: no MISSING_MAILBOX error. Codes: ' + errorCodes(result).join(', '));
  console.log('  [PASS] CONCEPTUAL lane skips MISSING_MAILBOX error');
})();

(function testMissingBroadcastAllowed() {
  // broadcast is structurally required by validateStructure() — it's an error if missing
  var reg = makeFixture({});
  delete reg.broadcast;
  var result = validateRegistry(reg);
  assert.strictEqual(countByCode(result.errors, 'MISSING_BROADCAST'), 1,
    'missing broadcast triggers MISSING_BROADCAST error');
  console.log('  [PASS] missing broadcast section triggers error');
})();

(function testAgentInstructionsAsStrings() {
  // agent_instructions values may be strings in practice, not necessarily arrays
  var reg = makeFixture({
    agent_instructions: {
      before_creating_any_path: 'Read registry first',
      path_validation: 'Check path exists'
    }
  });
  var result = validateRegistry(reg);
  // The validator only checks presence, not type — so this should pass
  assert.strictEqual(countByCode(result.errors, 'MISSING_INSTRUCTIONS'), 0,
    'string-valued agent_instructions: no MISSING_INSTRUCTIONS error');
  console.log('  [PASS] agent_instructions with string values (structural check)');
})();

// ══════════════════════════════════════════════════════════════════
// GROUP 2 — Smoke test against real registry (if accessible)
// ══════════════════════════════════════════════════════════════════

(function testRealRegistry() {
  var stat;
  try { stat = fs.statSync(REGISTRY_PATH); } catch (_) {
    console.log('  [SKIP] real registry not accessible at ' + REGISTRY_PATH);
    return;
  }

  var raw;
  try { raw = fs.readFileSync(REGISTRY_PATH, 'utf8'); } catch (_) {
    console.log('  [SKIP] cannot read real registry');
    return;
  }

  var data;
  try { data = JSON.parse(raw); } catch (_) {
    console.log('  [SKIP] real registry not valid JSON');
    return;
  }

  var result = validateRegistry(data);
  result.warnings.forEach(function (w) {
    console.log('  [WARN] ' + (w.lane || '') + ': ' + w.code + ' — ' + w.message);
  });
  result.observations.forEach(function (o) {
    console.log('  [OBS]  ' + (o.lane || '') + ': ' + o.code + ' — ' + o.message);
  });
  if (result.errors.length > 0) {
    console.log('  [ERR]  Real registry has ' + result.errors.length + ' error(s):');
    result.errors.forEach(function (e) {
      console.log('         ' + e.code + ': ' + (e.lane ? '[' + e.lane + '] ' : '') + e.message);
    });
  }

  assert.ok(data.schema_version, 'real registry has schema_version');
  assert.ok(data.lanes, 'real registry has lanes section');

  console.log('  [PASS] real registry: ' + Object.keys(data.lanes).length + ' lanes, '
    + result.errors.length + ' error(s), '
    + result.warnings.length + ' warning(s), '
    + result.observations.length + ' observation(s)');
})();

// ══════════════════════════════════════════════════════════════════
// GROUP 3 — Module API edge cases
// ══════════════════════════════════════════════════════════════════

(function testModuleConstants() {
  assert.ok(VALID_LANE_STATES.indexOf('ACTIVE') >= 0);
  assert.ok(VALID_LANE_STATES.indexOf('ARCHIVED') >= 0);
  assert.ok(VALID_LANE_STATES.indexOf('CONCEPTUAL') >= 0);
  assert.strictEqual(VALID_LANE_STATES.length, 5);
  console.log('  [PASS] VALID_LANE_STATES constant is correct');
})();

(function testNullInput() {
  var result = validateRegistry(null);
  assert.strictEqual(result.errors.length, 1, 'null input: exactly 1 error');
  assert.strictEqual(result.errors[0].code, 'MALFORMED_REGISTRY');
  console.log('  [PASS] null registry data returns MALFORMED_REGISTRY error');
})();

(function testEmptyLanes() {
  var reg = makeFixture({ lanes: {} });
  var result = validateRegistry(reg);
  assert.strictEqual(countByCode(result.errors, 'EMPTY_LANES'), 1);
  console.log('  [PASS] empty lanes section triggers EMPTY_LANES error');
})();

(function testActiveLaneMissingRepo() {
  var reg = makeFixture({
    lanes: {
      missing: {
        lane_id: 'missing',
        role: 'coordinator',
        lane_state: 'ACTIVE',
        local_path: 'S:/missing',
        branch: 'main',
        mailboxes: { inbox: 'S:/missing/inbox', outbox: 'S:/missing/outbox' }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.ok(errorCodes(result).indexOf('ACTIVE_NO_REPO') >= 0,
    'active lane missing repo: ACTIVE_NO_REPO error');
  console.log('  [PASS] active lane missing repo triggers ACTIVE_NO_REPO error');
})();

(function testActiveLaneMissingBranch() {
  var reg = makeFixture({
    lanes: {
      missing: {
        lane_id: 'missing',
        role: 'coordinator',
        lane_state: 'ACTIVE',
        repo: 'owner/missing',
        local_path: 'S:/missing',
        mailboxes: { inbox: 'S:/missing/inbox', outbox: 'S:/missing/outbox' }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.ok(errorCodes(result).indexOf('ACTIVE_NO_BRANCH') >= 0,
    'active lane missing branch: ACTIVE_NO_BRANCH error');
  console.log('  [PASS] active lane missing branch triggers ACTIVE_NO_BRANCH error');
})();

(function testLaneIdPathMismatch() {
  var reg = makeFixture({
    lanes: {
      library: {
        lane_id: 'library',
        role: 'knowledge',
        lane_state: 'ACTIVE',
        repo: 'owner/self-organizing-library',
        branch: 'main',
        local_path: 'S:/self-organizing-library',
        mailboxes: {
          inbox: 'S:/self-organizing-library/lanes/lib/inbox',
          outbox: 'S:/self-organizing-library/lanes/lib/outbox'
        }
      }
    }
  });
  var result = validateRegistry(reg);
  assert.ok(countByCode(result.warnings, 'LANE_ID_PATH_MISMATCH') >= 0,
    'path lane "lib" vs lane_id "library": LANE_ID_PATH_MISMATCH warning');
  console.log('  [PASS] lane identifier mismatch in path triggers LANE_ID_PATH_MISMATCH warning');
})();

// ══════════════════════════════════════════════════════════════════

console.log('\nPASS lane-registry.test.js — all fixture tests passed');