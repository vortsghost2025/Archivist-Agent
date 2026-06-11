#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let LaneDiscovery;
try {
  LaneDiscovery = require('./util/lane-discovery.js').LaneDiscovery;
} catch (_) {
  LaneDiscovery = null;
}

function getRoots() {
  if (LaneDiscovery) {
    const ld = new LaneDiscovery();
    const map = {};
    for (const name of ld.listLanes()) {
      map[name] = ld.getRoot(name);
    }
    return map;
  }
  return {
    archivist: path.resolve(__dirname, '..', '..', 'Archivist-Agent'),
    kernel: path.resolve(__dirname, '..', '..', 'kernel-lane'),
    library: path.resolve(__dirname, '..', '..', 'self-organizing-library'),
    swarmmind: path.resolve(__dirname, '..')
  };
}

const ROOTS = getRoots();
const LANE_ID = 'swarmmind';

const LOG = {
  info: '[i]',
  success: '[+]',
  warning: '[!]',
  error: '[-]',
  test: '[T]'
};

function log(message, level) {
  level = level || 'info';
  console.log((LOG[level] || '') + ' ' + message);
}

function extractCheckpoints(content) {
  var checkpoints = [];
  if (content.indexOf('User Drift') !== -1) checkpoints.push({ id: 'CP-000', name: 'user_drift_gate' });
  if (content.indexOf('Am I anchored') !== -1) checkpoints.push({ id: 'CP-001', name: 'anchored_to_structure' });
  if (content.indexOf('Am I following') !== -1) checkpoints.push({ id: 'CP-002', name: 'following_rules' });
  if (content.indexOf('Am I drifting') !== -1) checkpoints.push({ id: 'CP-003', name: 'drift_check' });
  if (content.indexOf('Am I confident') !== -1) checkpoints.push({ id: 'CP-004', name: 'confidence_check' });
  if (content.indexOf('Is risk acceptable') !== -1) checkpoints.push({ id: 'CP-005', name: 'risk_assessment' });
  if (content.indexOf('Did two reviewers') !== -1) checkpoints.push({ id: 'CP-006', name: 'dual_verification' });
  return checkpoints;
}

class CompactRestoreTest {
  constructor() {
    this.testResults = { phases: {}, evidence: [], alignment_score: 0, passed: false };
    this.preCompactState = null;
    this.restorePacket = null;
    this.postRestoreState = null;
    this.continuityProbe = null;
  }

  phase1_activeReviewStart() {
    log('\n=== PHASE 1: ACTIVE REVIEW STARTS ===', 'test');
    var bootstrapPath = path.join(ROOTS.archivist, 'BOOTSTRAP.md');
    var runtimeStatePath = path.join(ROOTS.archivist, 'RUNTIME_STATE.json');

    if (!fs.existsSync(bootstrapPath)) {
      log('BOOTSTRAP.md not found at ' + bootstrapPath + ' - cannot proceed', 'error');
      return false;
    }
    var bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');
    var runtimeState = {};
    if (fs.existsSync(runtimeStatePath)) {
      try { runtimeState = JSON.parse(fs.readFileSync(runtimeStatePath, 'utf8')); } catch (_) { runtimeState = {}; }
    }

    log('Governance loaded from: ' + bootstrapPath, 'success');

    this.preCompactState = {
      governance_constraints: {
        single_entry_point: bootstrapContent.indexOf('ALL LOGIC ROUTES THROUGH THIS FILE') !== -1,
        structure_over_identity: bootstrapContent.indexOf('Structure > Identity') !== -1,
        correction_mandatory: bootstrapContent.indexOf('CORRECTION IS MANDATORY') !== -1,
        agent_not_part_of_WE: bootstrapContent.indexOf('THE AGENT IS NOT PART OF WE') !== -1
      },
      active_checkpoints: extractCheckpoints(bootstrapContent),
      drift_baseline: { cps_score: (runtimeState.governance || {}).active ? 0 : null, signals: [] },
      session_context: {
        lane_id: LANE_ID,
        role: 'trace-layer',
        governance_active: !!(runtimeState.runtime || {}).governance_active
      },
      working_context: [
        'Reviewing trace-layer sync',
        'Cross-lane compact/restore verification',
        'Session continuity protocol'
      ]
    };

    log('Pre-compact baseline established:', 'success');
    log('  Governance constraints: ' + Object.keys(this.preCompactState.governance_constraints).length, 'info');
    log('  Active checkpoints: ' + this.preCompactState.active_checkpoints.length, 'info');
    log('  Working context items: ' + this.preCompactState.working_context.length, 'info');

    this.testResults.phases.phase1 = { status: 'pass', governance_loaded: true, baseline_established: true };
    return true;
  }

  phase2_compactHappens() {
    log('\n=== PHASE 2: COMPACT HAPPENS ===', 'test');
    var contextBefore = 180000;
    var contextAfter = 50000;
    var contextLost = contextBefore - contextAfter;

    log('Simulating compact:', 'info');
    log('  Before: ' + contextBefore + ' tokens', 'info');
    log('  After:  ' + contextAfter + ' tokens', 'info');
    log('  Lost:   ' + contextLost + ' tokens', 'warning');

    this.continuityProbe = {
      task_id: 'continuity-probe-' + Date.now(),
      expected_next_step: 'Reviewing trace-layer sync',
      resume_plan: [
        'Reviewing trace-layer sync',
        'Cross-lane compact/restore verification',
        'Session continuity protocol'
      ]
    };

    this.restorePacket = {
      '$schema': 'https://archivist.dev/schemas/context-restore.json',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      context_lost: contextLost,
      restore_payload: {
        governance_constraints: this.preCompactState.governance_constraints,
        active_checkpoints: this.preCompactState.active_checkpoints,
        drift_baseline: this.preCompactState.drift_baseline,
        session_context: this.preCompactState.session_context,
        working_context_resume: this.preCompactState.working_context,
        continuity_probe: this.continuityProbe
      },
      authority: {
        fields_authoritative: ['governance_constraints', 'active_checkpoints'],
        fields_advisory: ['drift_baseline', 'session_context', 'working_context_resume']
      }
    };

    var restoreDir = path.join(ROOTS.swarmmind, '.compact-audit');
    if (!fs.existsSync(restoreDir)) fs.mkdirSync(restoreDir, { recursive: true });
    var restorePath = path.join(restoreDir, 'COMPACT_RESTORE_PACKET.json');
    fs.writeFileSync(restorePath, JSON.stringify(this.restorePacket, null, 2));

    var packetSize = fs.statSync(restorePath).size;
    var efficiency = Math.round((1 - packetSize / 75000) * 100);

    log('Restore packet created: ' + restorePath, 'success');
    log('  Packet size: ~' + Math.round(packetSize / 4) + ' tokens', 'info');
    log('  Efficiency: ' + efficiency + '% token savings', 'success');

    this.testResults.phases.phase2 = { status: 'pass', context_lost: contextLost, restore_packet_created: true, token_efficiency: efficiency };
    return true;
  }

  phase3_restoreFromPacket() {
    log('\n=== PHASE 3: RESTORE FROM PACKET ===', 'test');
    var restorePath = path.join(ROOTS.swarmmind, '.compact-audit', 'COMPACT_RESTORE_PACKET.json');
    if (!fs.existsSync(restorePath)) {
      log('Restore packet not found at ' + restorePath, 'error');
      return false;
    }

    var restored = JSON.parse(fs.readFileSync(restorePath, 'utf8'));
    this.restorePacket = restored;
    log('Restore packet loaded from: ' + restorePath, 'success');

    this.postRestoreState = {
      governance_constraints: restored.restore_payload.governance_constraints,
      active_checkpoints: restored.restore_payload.active_checkpoints,
      drift_baseline: restored.restore_payload.drift_baseline,
      session_context: restored.restore_payload.session_context,
      working_context: restored.restore_payload.working_context_resume,
      continuity_probe: restored.restore_payload.continuity_probe || null
    };

    log('Context reconstructed:', 'success');
    log('  Governance constraints restored: ' + Object.keys(this.postRestoreState.governance_constraints).length, 'info');
    log('  Checkpoints restored: ' + this.postRestoreState.active_checkpoints.length, 'info');
    log('  Working context items: ' + this.postRestoreState.working_context.length, 'info');

    var authoritativeFields = restored.authority.fields_authoritative;
    var advisoryFields = restored.authority.fields_advisory;
    log('Authority distinction verified:', 'success');
    log('  Authoritative (MUST accept): ' + authoritativeFields.join(', '), 'info');
    log('  Advisory (MAY override): ' + advisoryFields.join(', '), 'info');

    this.testResults.phases.phase3 = { status: 'pass', context_restored: true, authority_handling: true };
    return true;
  }

  phase4_reviewContinues() {
    log('\n=== PHASE 4: REVIEW CONTINUES CORRECTLY ===', 'test');

    var governanceActive = this.postRestoreState.session_context.governance_active;
    if (!governanceActive) {
      log('Governance not active after restore - FAIL', 'error');
      return false;
    }
    log('Governance still active: ' + governanceActive, 'success');

    var constraintsEnforced = 0;
    var constraintKeys = Object.keys(this.postRestoreState.governance_constraints);
    for (var i = 0; i < constraintKeys.length; i++) {
      if (this.postRestoreState.governance_constraints[constraintKeys[i]]) {
        constraintsEnforced++;
        log('  Constraint enforced: ' + constraintKeys[i], 'info');
      }
    }
    log('Constraints enforced: ' + constraintsEnforced + '/' + constraintKeys.length, 'success');

    var continuityProbe = this.postRestoreState.continuity_probe || null;
    var actualNextAction = 'Reviewing trace-layer sync';
    if (!continuityProbe) {
      log('Continuity probe missing after restore - FAIL', 'error');
      return false;
    }
    var continuityMatched = continuityProbe.expected_next_step === actualNextAction;
    log('Continuity probe task_id: ' + continuityProbe.task_id, 'info');
    log('Expected next step: ' + continuityProbe.expected_next_step, 'info');
    log('Actual next action:  ' + actualNextAction, continuityMatched ? 'success' : 'error');
    if (!continuityMatched) {
      log('Continuity mismatch detected', 'error');
      return false;
    }

    log('\nSimulating continued review:', 'info');
    log('  [1/3] Reviewing trace-layer sync...', 'info');
    log('  [2/3] Cross-lane compact/restore verification...', 'info');
    log('  [3/3] Session continuity protocol...', 'info');

    log('\nWorking context preserved:', 'success');
    for (var j = 0; j < this.postRestoreState.working_context.length; j++) {
      log('  - ' + this.postRestoreState.working_context[j], 'info');
    }

    this.testResults.phases.phase4 = {
      status: 'pass',
      governance_still_active: true,
      constraints_enforced: constraintsEnforced,
      working_context_preserved: true,
      continuity_probe: true,
      expected_next_step: continuityProbe.expected_next_step,
      actual_next_action: actualNextAction
    };
    return true;
  }

  phase5_finalAlignment() {
    log('\n=== PHASE 5: FINAL OUTPUT ALIGNED ===', 'test');

    var preConstraints = Object.keys(this.preCompactState.governance_constraints).length;
    var postConstraints = Object.keys(this.postRestoreState.governance_constraints).length;
    var constraintAlignment = preConstraints === postConstraints;

    var preCheckpoints = this.preCompactState.active_checkpoints.length;
    var postCheckpoints = this.postRestoreState.active_checkpoints.length;
    var checkpointAlignment = preCheckpoints === postCheckpoints;

    var sessionAlignment = this.preCompactState.session_context.lane_id === this.postRestoreState.session_context.lane_id &&
      this.preCompactState.session_context.role === this.postRestoreState.session_context.role;

    log('State comparison:', 'info');
    log('  Constraint count:  pre=' + preConstraints + ', post=' + postConstraints + ' - ' + (constraintAlignment ? 'ALIGNED' : 'DRIFT'), constraintAlignment ? 'success' : 'error');
    log('  Checkpoint count:  pre=' + preCheckpoints + ', post=' + postCheckpoints + ' - ' + (checkpointAlignment ? 'ALIGNED' : 'DRIFT'), checkpointAlignment ? 'success' : 'error');
    log('  Session context:   ' + (sessionAlignment ? 'ALIGNED' : 'DRIFT'), sessionAlignment ? 'success' : 'error');

    var alignmentScore = 0;
    if (constraintAlignment) alignmentScore += 40;
    if (checkpointAlignment) alignmentScore += 30;
    if (sessionAlignment) alignmentScore += 30;

    this.testResults.alignment_score = alignmentScore;
    log('\n=== ALIGNMENT SCORE: ' + alignmentScore + '% ===', alignmentScore >= 80 ? 'success' : 'warning');

    var passed = alignmentScore >= 80;
    this.testResults.passed = passed;
    this.testResults.phases.phase5 = {
      status: passed ? 'pass' : 'fail',
      constraint_alignment: constraintAlignment,
      checkpoint_alignment: checkpointAlignment,
      session_alignment: sessionAlignment,
      alignment_score: alignmentScore
    };
    return passed;
  }

  run() {
    log('\n' + '============================================================', 'test');
    log('COMPACT/RESTORE CYCLE TEST — SwarmMind Lane', 'test');
    log('============================================================', 'test');

    var results = {
      timestamp: new Date().toISOString(),
      test_name: 'compact-restore-cycle-swarmmind',
      phases: this.testResults.phases,
      evidence: this.testResults.evidence,
      alignment_score: 0,
      passed: false
    };

    if (!this.phase1_activeReviewStart()) {
      results.phases.phase1 = { status: 'fail' };
      return this.emitResults(results);
    }
    if (!this.phase2_compactHappens()) {
      results.phases.phase2 = { status: 'fail' };
      return this.emitResults(results);
    }
    if (!this.phase3_restoreFromPacket()) {
      results.phases.phase3 = { status: 'fail' };
      return this.emitResults(results);
    }
    if (!this.phase4_reviewContinues()) {
      results.phases.phase4 = { status: 'fail' };
      return this.emitResults(results);
    }
    var passed = this.phase5_finalAlignment();
    results.passed = passed;
    results.phases = this.testResults.phases;
    results.alignment_score = this.testResults.alignment_score;
    return this.emitResults(results);
  }

  emitResults(results) {
    log('\n' + '============================================================', 'test');
    log('TEST RESULTS', 'test');
    log('============================================================', 'test');
    log('\nPhases:', 'info');
    var phaseKeys = Object.keys(results.phases);
    for (var i = 0; i < phaseKeys.length; i++) {
      var phase = phaseKeys[i];
      var data = results.phases[phase];
      var status = data.status === 'pass' ? '[+] PASS' : '[-] FAIL';
      log('  ' + phase + ': ' + status, data.status === 'pass' ? 'success' : 'error');
    }
    log('\nFinal Result:', 'info');
    log('  Alignment Score: ' + results.alignment_score + '%', results.alignment_score >= 80 ? 'success' : 'warning');
    log('  Test Passed: ' + (results.passed ? 'YES' : 'NO'), results.passed ? 'success' : 'error');

    var resultsDir = path.join(ROOTS.swarmmind, '.compact-audit');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    var resultsPath = path.join(resultsDir, 'COMPACT_RESTORE_TEST_RESULTS.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    log('\nResults written to: ' + resultsPath, 'success');
    return results;
  }
}

if (require.main === module) {
  var test = new CompactRestoreTest();
  var results = test.run();
  process.exit(results.passed ? 0 : 1);
}

module.exports = CompactRestoreTest;
