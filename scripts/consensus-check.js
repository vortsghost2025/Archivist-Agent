#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateVerificationDomain } = require('./verification-domain-gate');
const { ExecutionGate } = require('./execution-gate');
const { ArtifactResolver } = require('./artifact-resolver');
const { getCodeVersionHash } = require('./code-version-hash');

const CONSENSUS_POLICY_PATH = path.join(__dirname, '..', 'config', 'consensus-policy.json');

const DEFAULT_POLICY = {
  structural_weight: 1.0,
  operational_weight: 1.0,
  consensus_threshold: 1.0,
  reject_on_any_critical: true,
  drift_integration: {
    enabled: true,
    cps_threshold_warning: 30,
    cps_threshold_critical: 50,
    cps_log_path: 'context-buffer/cps_log.jsonl',
  },
  routing: {
    proven_action: 'route',
    conflicted_action: 'escalate',
    unproven_action: 'block',
    blocked_action: 'hold',
  },
};

function loadPolicy(policyPath) {
  try {
    return JSON.parse(fs.readFileSync(policyPath || CONSENSUS_POLICY_PATH, 'utf8'));
  } catch (_) {
    return Object.assign({}, DEFAULT_POLICY);
  }
}

function evaluateStructural(msg, schema, options) {
  const errors = [];
  if (!msg || typeof msg !== 'object') {
    return { lane: 'L', valid: false, errors: [{ field: 'message', error: 'null or non-object' }], score: 0 };
  }

  if (schema && schema.required) {
    for (const field of schema.required) {
      if (!(field in msg)) {
        errors.push({ field, error: 'required field missing' });
      }
    }
  }

  if (msg.signature !== undefined) {
    const jwsRegex = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    if (!jwsRegex.test(String(msg.signature))) {
      errors.push({ field: 'signature', error: 'JWS compact format invalid' });
    }
  }

  const TRUST_STORE_KEYS = {
    archivist: '506c2d0838b6862c',
    library: '2eec06be0befc8d5',
    swarmmind: 'c41954228c48ff9c',
    kernel: '127b44d2bb294ad9',
  };

  if (msg.key_id && msg.from) {
    const expectedKey = TRUST_STORE_KEYS[msg.from];
    if (expectedKey && msg.key_id !== expectedKey) {
      errors.push({ field: 'key_id', error: `key_id ${msg.key_id} does not match trust-store entry for ${msg.from}` });
    }
  }

  if (msg.schema_version && !String(msg.schema_version).startsWith('1.')) {
    errors.push({ field: 'schema_version', error: `unsupported schema version: ${msg.schema_version}` });
  }

  const validType = ['task', 'response', 'escalation', 'handoff', 'ack', 'alert', 'notification', 'status', 'heartbeat'].includes(msg.type);
  if (msg.type && !validType) {
    errors.push({ field: 'type', error: `invalid type enum value: ${msg.type}` });
  }

  const score = errors.length === 0 ? 1.0 : Math.max(0, 1.0 - (errors.length * 0.25));
  return { lane: 'L', valid: errors.length === 0, errors, score };
}

function evaluateOperational(msg, options) {
  if (!msg || typeof msg !== 'object') {
    return { lane: 'R', valid: false, errors: [{ domain: 'message', error: 'null or non-object' }], score: 0 };
  }

  const repoRoot = options.repoRoot || path.resolve(__dirname, '..');
  const resolver = options.resolver || new ArtifactResolver({
    allowedRoots: [
      'S:/Archivist-Agent',
      'S:/kernel-lane',
      'S:/self-organizing-library',
      'S:/SwarmMind',
    ],
    dryRun: options.dryRun !== undefined ? !!options.dryRun : true,
  });

  const domainResult = evaluateVerificationDomain(msg, {
    resolver,
    repoRoot,
    localCodeVersionHash: options.localCodeVersionHash || getCodeVersionHash(repoRoot),
  });

  const errors = [];
  if (!domainResult.domain_valid) {
    errors.push({
      domain: domainResult.invalid_domain_reason || 'verification_domain',
      error: domainResult.verification_outcome,
      phase: domainResult.phase,
    });
  }

  const executionGate = new ExecutionGate({ resolver, lane: options.lane || 'archivist', dryRun: options.dryRun });
  const execResult = executionGate.verify(msg);
  if (!execResult.execution_verified && execResult.verification_type !== 'NO_PROOF' && !execResult.would_verify) {
    errors.push({
      domain: 'execution_gate',
      error: execResult.reason,
      verification_type: execResult.verification_type,
    });
  }

  const score = errors.length === 0 ? 1.0 : Math.max(0, 1.0 - (errors.length * 0.33));
  return {
    lane: 'R',
    valid: errors.length === 0,
    errors,
    score,
    domain_result: domainResult,
    execution_result: execResult,
  };
}

function evaluateDrift(policy, repoRoot) {
  const driftConfig = policy.drift_integration || DEFAULT_POLICY.drift_integration;
  if (!driftConfig.enabled) {
    return { active: false, cps_score: null, level: 'none', reason: 'drift integration disabled' };
  }

  const logPath = path.join(repoRoot || path.resolve(__dirname, '..'), driftConfig.cps_log_path);
  let latestScore = null;

  try {
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const entry = JSON.parse(lastLine);
        latestScore = typeof entry.cps_score === 'number' ? entry.cps_score : (typeof entry.score === 'number' ? entry.score : null);
      }
    }
  } catch (_) {}

  if (latestScore === null) {
    return { active: true, cps_score: null, level: 'unknown', reason: 'no cps_log entries found' };
  }

  let level = 'normal';
  if (latestScore >= driftConfig.cps_threshold_critical) {
    level = 'critical';
  } else if (latestScore >= driftConfig.cps_threshold_warning) {
    level = 'warning';
  }

  return { active: true, cps_score: latestScore, level, thresholds: driftConfig };
}

function consensusCheck(msg, options) {
  options = options || {};
  const policy = options.policy || loadPolicy(options.policyPath);
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..');

  const schema = options.schema || null;
  const structural = evaluateStructural(msg, schema, options);
  const operational = evaluateOperational(msg, options);
  const drift = evaluateDrift(policy, repoRoot);

  const weightedScore =
    (structural.score * policy.structural_weight + operational.score * policy.operational_weight) /
    (policy.structural_weight + policy.operational_weight);

  let status;
  let routingAction;

  if (policy.reject_on_any_critical && drift.level === 'critical') {
    status = 'blocked';
    routingAction = policy.routing.blocked_action;
  } else if (structural.valid && operational.valid && weightedScore >= policy.consensus_threshold) {
    status = drift.level === 'warning' ? 'proven_with_drift_warning' : 'proven';
    routingAction = policy.routing.proven_action;
  } else if (!structural.valid || !operational.valid) {
    if (policy.reject_on_any_critical && (structural.errors.length > 0 || operational.errors.length > 0)) {
      const hasCritical = structural.errors.some(e => e.field === 'signature' || e.field === 'key_id') ||
                          operational.errors.some(e => e.domain === 'temporal constraint unreachable');
      status = hasCritical ? 'blocked' : 'conflicted';
      routingAction = hasCritical ? policy.routing.blocked_action : policy.routing.conflicted_action;
    } else {
      status = 'conflicted';
      routingAction = policy.routing.conflicted_action;
    }
  } else {
    status = 'unproven';
    routingAction = policy.routing.unproven_action;
  }

  return {
    status,
    routing_action: routingAction,
    weighted_score: Math.round(weightedScore * 1000) / 1000,
    consensus_threshold: policy.consensus_threshold,
    structural,
    operational,
    drift,
    checked_at: new Date().toISOString(),
    policy_version: '1.0',
  };
}

function routeMessage(msg, consensusResult, options) {
  options = options || {};
  const policy = options.policy || loadPolicy(options.policyPath);

  const action = consensusResult.routing_action;
  const targetInbox = options.targetInbox || null;

  const routing = {
    original_task_id: msg.task_id || null,
    action,
    target: targetInbox,
    reason: null,
    routed_at: new Date().toISOString(),
  };

  switch (action) {
    case 'route':
      routing.reason = 'consensus proven — message routed to target inbox';
      break;
    case 'escalate':
      routing.reason = 'consensus conflicted — message escalated to coordinator';
      routing.target = routing.target || 'lanes/archivist/inbox/';
      break;
    case 'block':
      routing.reason = 'consensus blocked — critical validation failure or drift critical';
      routing.target = null;
      break;
    case 'hold':
      routing.reason = 'consensus unproven — message held pending further verification';
      routing.target = null;
      break;
    default:
      routing.reason = `unknown routing action: ${action}`;
      routing.action = 'hold';
  }

  return routing;
}

module.exports = {
  consensusCheck,
  routeMessage,
  evaluateStructural,
  evaluateOperational,
  evaluateDrift,
  loadPolicy,
  DEFAULT_POLICY,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const msgPath = args.find(function(a) { return !a.startsWith('--'); });
  const jsonOutput = args.includes('--json');

  if (!msgPath) {
    console.log('Usage: node consensus-check.js <message.json> [--json] [--policy=path]');
    console.log('  Evaluates a lane message through dual-verification consensus (L+R lanes)');
    process.exit(1);
  }

  const resolvedMsgPath = path.resolve(msgPath);
  if (!fs.existsSync(resolvedMsgPath)) {
    console.error('File not found:', resolvedMsgPath);
    process.exit(1);
  }

  const policyArg = args.find(function(a) { return a.startsWith('--policy='); });
  const policyPath = policyArg ? policyArg.split('=')[1] : null;
  const policy = loadPolicy(policyPath);

  let msg;
  try {
    msg = JSON.parse(fs.readFileSync(resolvedMsgPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse message JSON:', err.message);
    process.exit(1);
  }

  const result = consensusCheck(msg, { policy, repoRoot: path.resolve(__dirname, '..') });
  const routing = routeMessage(msg, result, { policy });

  if (jsonOutput) {
    console.log(JSON.stringify({ consensus: result, routing }, null, 2));
  } else {
    console.log('CONSENSUS CHECK RESULT');
    console.log('======================');
    console.log('Status:', result.status);
    console.log('Routing:', result.routing_action);
    console.log('Weighted Score:', result.weighted_score, '/', result.consensus_threshold);
    console.log('---');
    console.log('Lane L (Structural):', result.structural.valid ? 'PASS' : 'FAIL', '(score:', result.structural.score + ')');
    if (result.structural.errors.length > 0) {
      for (const e of result.structural.errors) {
        console.log('  ERROR:', e.field, '-', e.error);
      }
    }
    console.log('Lane R (Operational):', result.operational.valid ? 'PASS' : 'FAIL', '(score:', result.operational.score + ')');
    if (result.operational.errors.length > 0) {
      for (const e of result.operational.errors) {
        console.log('  ERROR:', e.domain || e.field, '-', e.error);
      }
    }
    console.log('---');
    console.log('Drift:', result.drift.level, result.drift.cps_score !== null ? '(CPS: ' + result.drift.cps_score + ')' : '(no data)');
    console.log('---');
    console.log('Routing Action:', routing.action);
    console.log('Routing Reason:', routing.reason);
  }

  const blocked = result.status === 'blocked' || result.status === 'unproven';
  process.exit(blocked ? 1 : 0);
}
