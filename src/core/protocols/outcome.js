/**
 * outcome.js - Phase 4B Outcome Protocol
 * 
 * Replaces binary success/failure with structured outcome states:
 * SUCCESS | FAILURE | ESCALATE | DEFER | QUARANTINE
 * 
 * Core rule: Do not force completion. Force honesty. Allow help. Route uncertainty.
 */

/**
 * Valid outcome statuses
 * @enum {string}
 */
const OutcomeStatus = {
  SUCCESS: 'SUCCESS',     // Task completed with sufficient confidence
  FAILURE: 'FAILURE',     // Task cannot be completed, stop
  ESCALATE: 'ESCALATE',   // Task incomplete, known next resolver
  DEFER: 'DEFER',         // Task blocked, not urgent/safely resolvable now
  QUARANTINE: 'QUARANTINE' // Unsafe/invalid/contradictory detected, isolate
};

/**
 * Escalation targets for ESCALATE status
 * @enum {string}
 */
const EscalationTarget = {
  ORCHESTRATOR: 'ORCHESTRATOR',
  ARCHIVIST: 'ARCHIVIST',
  LIBRARY: 'LIBRARY',
  SWARMMIND: 'SWARMMIND',
  USER: 'USER',
  OTHER_LANE: 'OTHER_LANE'
};

/**
 * Requirement kinds for blocking
 * @enum {string}
 */
const RequirementKind = {
  MISSING_CONTEXT: 'missing_context',
  MISSING_DEPENDENCY: 'missing_dependency',
  VERIFICATION_NEEDED: 'verification_needed',
  HUMAN_APPROVAL: 'human_approval',
  RESOURCE_BLOCK: 'resource_block',
  CONFLICT_RESOLUTION: 'conflict_resolution'
};

/**
 * Evidence reference types
 * @enum {string}
 */
const EvidenceType = {
  FILE: 'file',
  LOG: 'log',
  ENDPOINT: 'endpoint',
  MEMORY: 'memory',
  TRACE: 'trace'
};

/**
 * @typedef {Object} EvidenceRef
 * @property {EvidenceType} type - Type of evidence
 * @property {string} value - Reference value (path, URL, key, etc.)
 */

/**
 * @typedef {Object} Requirement
 * @property {RequirementKind} kind - Kind of requirement
 * @property {string} detail - Human-readable detail
 */

/**
 * @typedef {Object} LaneOutcome
 * @property {OutcomeStatus} status - Outcome status
 * @property {string} lane - Lane that produced this outcome
 * @property {string} task_id - Task identifier
 * @property {string} summary - Human-readable summary
 * @property {number} confidence - Confidence level (0.0 - 1.0)
 * @property {*} [result] - Result payload (for SUCCESS)
 * @property {string} [error_code] - Error code (for FAILURE)
 * @property {string} [reason] - Reason for non-SUCCESS status
 * @property {Requirement[]} [requires] - Blocking requirements
 * @property {EscalationTarget} [escalation_target] - Target for ESCALATE
 * @property {string} [suggested_next_step] - Suggested action
 * @property {EvidenceRef[]} [evidence] - Evidence references
 * @property {string[]} [blockers] - Blocking issues
 * @property {string} [trace_id] - Cross-lane correlation ID
 * @property {string} created_at - ISO timestamp
 */

/**
 * Validate required fields
 * @param {Object} params
 * @param {string[]} required
 * @throws {Error} if required field missing or empty
 */
function validateRequired(params, required) {
  for (const field of required) {
    if (params[field] === undefined || params[field] === null || params[field] === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

/**
 * Validate confidence is in valid range
 * @param {number} confidence
 * @throws {Error} if out of range
 */
function validateConfidence(confidence) {
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${confidence} (must be 0.0-1.0)`);
  }
}

/**
 * Validate status is valid
 * @param {string} status
 * @throws {Error} if not a valid status
 */
function validateStatus(status) {
  const validStatuses = Object.values(OutcomeStatus);
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status} (valid: ${validStatuses.join(', ')})`);
  }
}

/**
 * Validate escalation target
 * @param {string} target
 * @throws {Error} if not a valid target
 */
function validateEscalationTarget(target) {
  const validTargets = Object.values(EscalationTarget);
  if (!validTargets.includes(target)) {
    throw new Error(`Invalid escalation_target: ${target} (valid: ${validTargets.join(', ')})`);
  }
}

/**
 * Create a SUCCESS outcome
 * @param {Object} params
 * @param {string} params.lane
 * @param {string} params.task_id
 * @param {string} params.summary
 * @param {number} [params.confidence=1.0]
 * @param {*} params.result
 * @param {EvidenceRef[]} [params.evidence]
 * @param {string} [params.trace_id]
 * @returns {LaneOutcome}
 */
function success(params) {
  validateRequired(params, ['lane', 'task_id', 'summary']);
  validateConfidence(params.confidence ?? 1.0);
  
  const { lane, task_id, summary, confidence = 1.0, result, evidence, trace_id } = params;

  return {
    status: OutcomeStatus.SUCCESS,
    lane,
    task_id,
    summary,
    confidence,
    result,
    evidence,
    trace_id,
    created_at: new Date().toISOString()
  };
}

/**
 * Create a FAILURE outcome
 * @param {Object} params
 * @param {string} params.lane
 * @param {string} params.task_id
 * @param {string} params.summary
 * @param {string} params.error_code
 * @param {string} [params.reason]
 * @param {EvidenceRef[]} [params.evidence]
 * @param {string} [params.trace_id]
 * @returns {LaneOutcome}
 */
function failure(params) {
  validateRequired(params, ['lane', 'task_id', 'summary', 'error_code']);
  
  const { lane, task_id, summary, error_code, reason, evidence, trace_id } = params;

  return {
    status: OutcomeStatus.FAILURE,
    lane,
    task_id,
    summary,
    confidence: 0.0,
    error_code,
    reason,
    evidence,
    trace_id,
    created_at: new Date().toISOString()
  };
}

/**
 * Create an ESCALATE outcome
 * @param {Object} params
 * @param {string} params.lane
 * @param {string} params.task_id
 * @param {string} params.summary
 * @param {number} params.confidence
 * @param {EscalationTarget} params.escalation_target
 * @param {Requirement[]} [params.requires]
 * @param {string} [params.suggested_next_step]
 * @param {EvidenceRef[]} [params.evidence]
 * @param {string[]} [params.blockers]
 * @param {string} [params.trace_id]
 * @returns {LaneOutcome}
 */
function escalate(params) {
  validateRequired(params, ['lane', 'task_id', 'summary', 'confidence', 'escalation_target']);
  validateConfidence(params.confidence);
  validateEscalationTarget(params.escalation_target);
  
  const {
    lane, task_id, summary, confidence, escalation_target,
    requires, suggested_next_step, evidence, blockers, trace_id
  } = params;
  
  return {
    status: OutcomeStatus.ESCALATE,
    lane,
    task_id,
    summary,
    confidence,
    escalation_target,
    requires,
    suggested_next_step,
    evidence,
    blockers,
    trace_id,
    created_at: new Date().toISOString()
  };
}

/**
 * Create a DEFER outcome
 * @param {Object} params
 * @param {string} params.lane
 * @param {string} params.task_id
 * @param {string} params.summary
 * @param {number} params.confidence
 * @param {string} params.reason
 * @param {Requirement[]} [params.requires]
 * @param {string} [params.suggested_next_step]
 * @param {string[]} [params.blockers]
 * @param {string} [params.trace_id]
 * @returns {LaneOutcome}
 */
function defer(params) {
  validateRequired(params, ['lane', 'task_id', 'summary', 'confidence', 'reason']);
  validateConfidence(params.confidence);
  
  const { lane, task_id, summary, confidence, reason, requires, suggested_next_step, blockers, trace_id } = params;
  
  return {
    status: OutcomeStatus.DEFER,
    lane,
    task_id,
    summary,
    confidence,
    reason,
    requires,
    suggested_next_step,
    blockers,
    trace_id,
    created_at: new Date().toISOString()
  };
}

/**
 * Create a QUARANTINE outcome
 * @param {Object} params
 * @param {string} params.lane
 * @param {string} params.task_id
 * @param {string} params.summary
 * @param {string} params.reason
 * @param {string} [params.quarantine_id]
 * @param {EvidenceRef[]} [params.evidence]
 * @param {string} [params.trace_id]
 * @returns {LaneOutcome}
 */
function quarantine(params) {
  validateRequired(params, ['lane', 'task_id', 'summary', 'reason']);
  
  const { lane, task_id, summary, reason, quarantine_id, evidence, trace_id } = params;
  
  return {
    status: OutcomeStatus.QUARANTINE,
    lane,
    task_id,
    summary,
    confidence: 0.95, // High confidence it's unsafe
    reason,
    error_code: quarantine_id ? `QUARANTINE_${quarantine_id}` : 'QUARANTINE',
    evidence,
    trace_id,
    created_at: new Date().toISOString()
  };
}

/**
 * Convert legacy verification result to outcome
 * @param {Object} verificationResult - { valid, reason, note, ... }
 * @param {string} lane
 * @param {string} task_id
 * @returns {LaneOutcome}
 */
function fromVerificationResult(verificationResult, lane, task_id) {
  if (verificationResult.valid) {
    return success({
      lane,
      task_id,
      summary: 'Verification successful',
      result: verificationResult
    });
  }
  
  const reason = verificationResult.reason || 'UNKNOWN';
  
  if (reason === 'QUARANTINED') {
    return quarantine({
      lane,
      task_id,
      summary: verificationResult.note || 'Quarantined',
      reason: reason,
      evidence: verificationResult.itemId ? [
        { type: EvidenceType.LOG, value: `quarantine.log#${verificationResult.itemId}` }
      ] : undefined
    });
  }
  
  return failure({
    lane,
    task_id,
    summary: verificationResult.note || 'Verification failed',
    error_code: reason,
    reason: reason
  });
}

module.exports = {
  OutcomeStatus,
  EscalationTarget,
  RequirementKind,
  EvidenceType,
  success,
  failure,
  escalate,
  defer,
  quarantine,
  fromVerificationResult
};
