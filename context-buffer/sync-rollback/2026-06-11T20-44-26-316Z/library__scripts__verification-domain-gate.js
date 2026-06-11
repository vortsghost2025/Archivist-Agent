#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('./completion-proof');
const { getCodeVersionHash } = require('./code-version-hash');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'verification-domain-gate.json');

const VALID_TASK_KINDS = new Set([
  'task',
  'proposal',
  'review',
  'finding',
  'report',
  'status',
  'ack',
  'handoff',
  'ratification',
]);

const DEFAULT_CONFIG = {
  temporal_window_ms: 3600000,
  semantic_hash_algorithm: 'sha256',
  semantic_hash_field: 'domain_hash',
  allowed_timestamp_skew_ms: 300000,
  max_future_drift_ms: 60000,
};

function loadGateConfig(configPath = DEFAULT_CONFIG_PATH) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    return { ...DEFAULT_CONFIG };
  }
}

function loadConfig(configPath) {
  return loadGateConfig(configPath);
}

function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

function computeSemanticHash(msg, algorithm = 'sha256') {
  if (!msg) return null;
  const hash = crypto.createHash(algorithm);
  const fields = [
    msg.schema_version,
    msg.task_id,
    msg.from,
    msg.to,
    msg.type,
    msg.task_kind,
    msg.priority,
    msg.subject,
    msg.body,
    msg.timestamp,
    msg.requires_action ? '1' : '0',
    JSON.stringify(msg.evidence || null),
    JSON.stringify(msg.evidence_exchange || null),
    JSON.stringify(msg.execution || null),
  ];
  for (const f of fields) {
    hash.update(String(f == null ? '' : f));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function checkTemporalDomain(msg, config = DEFAULT_CONFIG) {
  if (!msg) {
    return { valid: false, reason: 'NULL_MESSAGE', phase: 'pre_execution' };
  }

  const now = Date.now();
  const timestampMs = toMs(msg.timestamp);

  if (timestampMs === null) {
    return { valid: false, reason: 'TEMPORAL_INVALID_TIMESTAMP', phase: 'pre_execution' };
  }

  const maxFutureDriftMs = config.max_future_drift_ms || DEFAULT_CONFIG.max_future_drift_ms;
  if (timestampMs > now + maxFutureDriftMs) {
    return { valid: false, reason: 'TEMPORAL_FUTURE_DRIFT', phase: 'pre_execution' };
  }

  const temporalWindowMs = config.temporal_window_ms || DEFAULT_CONFIG.temporal_window_ms;
  if (now - timestampMs > temporalWindowMs) {
    return { valid: false, reason: 'TEMPORAL_EXPIRED', phase: determinePhase(msg) };
  }

  return {
    valid: true,
    reason: null,
    phase: determinePhase(msg),
    timestamp_ms: timestampMs,
    age_ms: now - timestampMs,
  };
}

function checkObservabilityDomain(msg, resolver) {
  if (!msg) {
    return { valid: false, reason: 'OBSERVABILITY_NULL_MESSAGE' };
  }

  const classification = resolver ? resolver.classifyProof(msg) : null;
  const proofType = classification ? classification.type : 'NONE';

  if (proofType === 'NONE') {
    if (msg.completion_message_id || msg.resolved_by_task_id) {
      return { valid: true, reason: null, path_resolves: true, proof_type: 'REFERENCE_BASED' };
    }
    return { valid: true, reason: null, path_resolves: true, proof_type: 'NONE' };
  }

  if (!resolver) {
    return { valid: false, reason: 'OBSERVABILITY_RESOLVER_UNAVAILABLE', path_resolves: false, proof_type: proofType };
  }

  const resolution = resolver.resolveMessage(msg);
  if (!resolution.resolved) {
    const reasonMap = {
      'PATH_TRAVERSAL_REJECTED': 'OBSERVABILITY_PATH_TRAVERSAL',
      'OUTSIDE_ALLOWED_ROOTS': 'OBSERVABILITY_OUTSIDE_ROOTS',
      'FILE_NOT_FOUND': 'OBSERVABILITY_FILE_NOT_FOUND',
      'EMPTY_PATH': 'OBSERVABILITY_EMPTY_PATH',
    };
    const specificReason = reasonMap[resolution.reason] || 'OBSERVABILITY_UNRESOLVED';
    return {
      valid: false,
      reason: specificReason,
      path_resolves: false,
      proof_type: proofType,
      resolution_reason: resolution.reason,
    };
  }

  return {
    valid: true,
    reason: null,
    path_resolves: true,
    proof_type: proofType,
    resolution_reason: resolution.reason,
  };
}

function checkSemanticDomain(msg, config = DEFAULT_CONFIG) {
  if (!msg) {
    return { valid: false, reason: 'NULL_MESSAGE', hash_computed: null };
  }

  const hashField = config.semantic_hash_field || DEFAULT_CONFIG.semantic_hash_field;
  const hashAlgo = config.semantic_hash_algorithm || DEFAULT_CONFIG.semantic_hash_algorithm;
  const claimedHash = msg[hashField];

  if (!claimedHash) {
    return { valid: true, reason: null, hash_computed: null, hash_claimed: null, hash_valid: true };
  }

  const computedHash = computeSemanticHash(msg, hashAlgo);

  if (claimedHash !== computedHash) {
    return {
      valid: false,
      reason: 'SEMANTIC_MUTATION',
      hash_computed: computedHash,
      hash_claimed: claimedHash,
      hash_valid: false,
    };
  }

  return {
    valid: true,
    reason: null,
    hash_computed: computedHash,
    hash_claimed: claimedHash,
    hash_valid: true,
  };
}

function determinePhase(msg) {
  const hasExecutionArtifact = Boolean(
    msg.execution_timestamp ||
    (msg.evidence_exchange && msg.evidence_exchange.delivered_at) ||
    (msg.heartbeat && msg.heartbeat.last_heartbeat_at)
  );
  return hasExecutionArtifact ? 'post_execution' : 'pre_execution';
}

function evaluateTemporal(msg) {
  const dispatchTs = toMs(msg.dispatch_timestamp || msg.timestamp);
  const executionTs = toMs(
    msg.execution_timestamp ||
    (msg.evidence_exchange && msg.evidence_exchange.delivered_at) ||
    (msg.heartbeat && msg.heartbeat.last_heartbeat_at)
  );

  if (!dispatchTs || !executionTs) {
    return {
      valid: false,
      reason: 'temporal constraint unreachable',
      expected: 'execution_timestamp > dispatch_timestamp',
      actual: null,
    };
  }

  return {
    valid: executionTs >= dispatchTs,
    reason: executionTs >= dispatchTs ? null : 'execution timestamp precedes dispatch',
    expected: 'execution_timestamp >= dispatch_timestamp',
    actual: executionTs >= dispatchTs,
  };
}

function evaluateSemantic(msg, localCodeVersionHash = null) {
  const taskKindValid = !msg.task_kind || VALID_TASK_KINDS.has(String(msg.task_kind).toLowerCase());
  const hasProof = cp.hasCompletionProof(msg);
  const evidenceFieldsPresent = hasProof
    ? Boolean(
      (msg.evidence_exchange && msg.evidence_exchange.artifact_path) ||
      msg.completion_artifact_path ||
      msg.completion_message_id ||
      msg.resolved_by_task_id
    )
    : true;
  const routingMetadataValid = !msg._execution_result || !msg._execution_result._routing || Boolean(msg._execution_result._routing.verb);

  const messageCodeHash = msg && msg._governance ? msg._governance.code_version_hash : null;
  const codeVersionHashValid = !messageCodeHash || !localCodeVersionHash || messageCodeHash === localCodeVersionHash;
  const valid = taskKindValid && evidenceFieldsPresent && routingMetadataValid && codeVersionHashValid;
  let reason = null;
  if (!taskKindValid) reason = 'schema does not cover behavior';
  else if (!evidenceFieldsPresent) reason = 'evidence fields missing for completion proof';
  else if (!routingMetadataValid) reason = 'routing metadata invalid';
  else if (!codeVersionHashValid) reason = 'code version hash mismatch';

  return {
    valid,
    reason,
    task_kind_valid: taskKindValid,
    evidence_fields_present: evidenceFieldsPresent,
    routing_metadata_valid: routingMetadataValid,
    code_version_hash_valid: codeVersionHashValid,
    local_code_version_hash: localCodeVersionHash,
    message_code_version_hash: messageCodeHash,
  };
}

function evaluateObservability(msg, resolver) {
  return checkObservabilityDomain(msg, resolver);
}

function evaluateVerificationDomain(msg, options = {}) {
  if (!msg) {
    return {
      domain_valid: false,
      phase: 'pre_execution',
      has_execution_artifact: false,
      invalid_domain_reason: 'NULL_MESSAGE',
      verification_outcome: 'INVALID_DOMAIN',
      execution_preserved: false,
    };
  }

  const resolver = options.resolver;
  const config = options.config || loadGateConfig();
  const localCodeVersionHash = options.localCodeVersionHash || getCodeVersionHash(options.repoRoot || path.resolve(__dirname, '..'));

  const hasExecutionArtifact = Boolean(
    msg.execution_timestamp ||
    (msg.evidence_exchange && msg.evidence_exchange.delivered_at) ||
    (msg.heartbeat && msg.heartbeat.last_heartbeat_at)
  );
  const phase = hasExecutionArtifact ? 'post_execution' : 'pre_execution';

  const temporal = checkTemporalDomain(msg, config);
  if (!temporal.valid) {
    return {
      domain_valid: false,
      phase,
      has_execution_artifact: hasExecutionArtifact,
      invalid_domain_reason: temporal.reason,
      verification_outcome: 'INVALID_DOMAIN',
      execution_preserved: phase === 'post_execution',
      checks: { temporal, semantic: checkSemanticDomain(msg, config), observability: checkObservabilityDomain(msg, resolver) },
    };
  }

  const semantic = checkSemanticDomain(msg, config);
  if (!semantic.valid) {
    return {
      domain_valid: false,
      phase,
      has_execution_artifact: hasExecutionArtifact,
      invalid_domain_reason: semantic.reason,
      verification_outcome: 'INVALID_DOMAIN',
      execution_preserved: phase === 'post_execution',
      checks: { temporal, semantic, observability: checkObservabilityDomain(msg, resolver) },
    };
  }

  const observability = checkObservabilityDomain(msg, resolver);
  if (!observability.valid) {
    return {
      domain_valid: false,
      phase,
      has_execution_artifact: hasExecutionArtifact,
      invalid_domain_reason: observability.reason,
      verification_outcome: 'INVALID_DOMAIN',
      execution_preserved: phase === 'post_execution',
      checks: { temporal, semantic, observability },
    };
  }

  return {
    domain_valid: true,
    phase,
    has_execution_artifact: hasExecutionArtifact,
    invalid_domain_reason: null,
    verification_outcome: 'PASS',
    execution_preserved: false,
    checks: { temporal, semantic, observability },
  };
}

module.exports = {
  loadGateConfig,
  loadConfig,
  evaluateVerificationDomain,
  checkTemporalDomain,
  checkObservabilityDomain,
  checkSemanticDomain,
  computeSemanticHash,
  evaluateTemporal,
  evaluateSemantic,
  evaluateObservability,
  DEFAULT_CONFIG,
};
