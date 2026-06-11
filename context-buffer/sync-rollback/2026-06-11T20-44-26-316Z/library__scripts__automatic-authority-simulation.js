#!/usr/bin/env node
/**
 * automatic-authority-simulation.js
 * Prototype: Evaluate convergence evidence and issue automatic ratifications
 * Usage: node automatic-authority-simulation.js
 */

const fs = require('fs');
const path = require('path');
const { LaneDiscovery } = require('./util/lane-discovery');
const discovery = new LaneDiscovery();

const LANE_ROOTS = {
  archivist: discovery.getLocalPath('archivist'),
  kernel: discovery.getLocalPath('kernel'),
  library: discovery.getLocalPath('library'),
  swarmmind: discovery.getLocalPath('swarmmind')
};

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function evaluateConvergence() {
  console.log('=== Automatic Authority Simulation ===\n');
  
  // 1. Check convergence-complete.json exists in all lanes
  let allConverged = true;
  const convergenceArtifacts = [];
  
  for (const [laneId, root] of Object.entries(LANE_ROOTS)) {
    const convergencePath = path.join(root, 'convergence-complete.json');
    const converged = fs.existsSync(convergencePath);
    console.log(`[${laneId}] convergence-complete.json: ${converged ? '✅' : '❌'}`);
    if (!converged) allConverged = false;
    else convergenceArtifacts.push(convergencePath);
  }
  
    // 2. Check latest convergence monitor report
    const monitorPath = path.join(discovery.getLocalPath('archivist'), 'convergence-monitor-report-20260423.json');
    const monitor = loadJson(monitorPath);
  if (monitor) {
    console.log(`\n[Monitor] Status: ${monitor.status}`);
    console.log(`[Monitor] Contradictions: ${monitor.contradictions.join(', ') || 'none'}`);
  }
  
    // 3. Check post-compact audit
    const auditPath = path.join(discovery.getLocalPath('archivist'), '.compact-audit', 'POST_COMPACT_AUDIT.json');
    const audit = loadJson(auditPath);
  if (audit) {
    console.log(`\n[Audit] overall_ok: ${audit.overall_ok}`);
    console.log(`[Audit] Risks lost: ${audit.risks_lost || 'none'}`);
  }
  
  // 4. Decision logic
  console.log('\n=== Decision ===');
  const canRatify = allConverged && 
                     monitor && monitor.status !== 'conflicted' &&
                     audit && audit.overall_ok;
  
  if (canRatify) {
    console.log('✅ AUTHORITY DECISION: ISSUE AUTOMATIC RATIFICATION');
    return { decision: 'ratify', status: 'ready' };
  } else {
    console.log('❌ AUTHORITY DECISION: ISSUE P0 ESCALATION');
    const reasons = [];
    if (!allConverged) reasons.push('not all lanes converged');
    if (monitor && monitor.status === 'conflicted') reasons.push(`contradictions: ${monitor.contradictions.join(', ')}`);
    if (audit && !audit.overall_ok) reasons.push('post-compact audit failed');
    return { decision: 'escalate', status: 'conflicted', reasons };
  }
}

function generateRatification() {
  const timestamp = new Date().toISOString();
  const artifact = {
    schema_version: '1.0',
    generated_at: timestamp,
    generated_by: 'automatic-authority-simulation',
    decision: 'ratification',
    claim: 'System ready for automatic ratification - all convergence evidence verified',
    evidence: 'convergence-complete.json + convergence-monitor-report-*.json + post-compact-audit.json',
    verified_by: 'automatic-authority-simulation',
    status: 'approved',
    terminal_decision: 'Automatic authority simulation approves ratification based on convergence evidence'
  };
  
    const outPath = path.join(discovery.getLocalPath('archivist'), `automatic-ratification-${timestamp.replace(/[:.]/g, '')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\n✅ Generated: ${path.basename(outPath)}`);
  return artifact;
}

function generateEscalation(reasons) {
  const timestamp = new Date().toISOString();
  const artifact = {
    schema_version: '1.0',
    generated_at: timestamp,
    generated_by: 'automatic-authority-simulation',
    decision: 'escalation',
    priority: 'P0',
    claim: 'System NOT ready - automatic authority issues P0 escalation',
    evidence: 'convergence-monitor-report + post-compact-audit',
    verified_by: 'automatic-authority-simulation',
    status: 'conflicted',
    contradictions: reasons,
    terminal_decision: 'Automatic authority simulation escalates due to convergence contradictions'
  };
  
    const outPath = path.join(discovery.getLocalPath('archivist'), `automatic-escalation-${timestamp.replace(/[:.]/g, '')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\n❌ Generated: ${path.basename(outPath)}`);
  return artifact;
}

// Main execution
const evaluation = evaluateConvergence();

if (evaluation.decision === 'ratify') {
  generateRatification();
} else {
  generateEscalation(evaluation.reasons || []);
}

console.log('\n=== Simulation Complete ===');
