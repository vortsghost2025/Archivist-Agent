/**
 * outcome_router.js - Phase 4B Cross-Lane Routing
 * 
 * Routes outcomes to correct destinations based on status:
 * - SUCCESS → Continue processing
 * - FAILURE → Log and stop
 * - ESCALATE → Route to escalation target
 * - DEFER → Queue for later
 * - QUARANTINE → Isolate and alert
 */

const { OutcomeStatus, EscalationTarget } = require('./outcome');

/**
 * @typedef {Object} RoutingResult
 * @property {string} action - Action to take
 * @property {string} [target] - Target lane/endpoint
 * @property {string} [queue] - Queue name for deferred
 * @property {boolean} [notify_operator] - Whether to alert operator
 */

/**
 * Determine routing action for an outcome
 * @param {import('./outcome').LaneOutcome} outcome
 * @returns {RoutingResult}
 */
function route(outcome) {
  switch (outcome.status) {
    case OutcomeStatus.SUCCESS:
      return {
        action: 'continue',
        notify_operator: false
      };
    
    case OutcomeStatus.FAILURE:
      return {
        action: 'stop',
        notify_operator: false
      };
    
    case OutcomeStatus.ESCALATE:
      return routeEscalation(outcome);
    
    case OutcomeStatus.DEFER:
      return {
        action: 'queue',
        queue: 'deferred',
        notify_operator: false
      };
    
    case OutcomeStatus.QUARANTINE:
      return {
        action: 'isolate',
        notify_operator: true
      };
    
    default:
      return {
        action: 'stop',
        notify_operator: true
      };
  }
}

/**
 * Route escalation to correct target
 * @param {import('./outcome').LaneOutcome} outcome
 * @returns {RoutingResult}
 */
function routeEscalation(outcome) {
  const target = outcome.escalation_target;
  
  switch (target) {
    case EscalationTarget.ORCHESTRATOR:
      return {
        action: 'escalate',
        target: 'orchestrator',
        notify_operator: false
      };
    
    case EscalationTarget.ARCHIVIST:
      return {
        action: 'escalate',
        target: 'archivist',
        notify_operator: false
      };
    
    case EscalationTarget.LIBRARY:
      return {
        action: 'escalate',
        target: 'library',
        notify_operator: false
      };
    
    case EscalationTarget.SWARMMIND:
      return {
        action: 'escalate',
        target: 'swarmmind',
        notify_operator: false
      };
    
    case EscalationTarget.USER:
      return {
        action: 'escalate',
        target: 'user',
        notify_operator: true
      };
    
    case EscalationTarget.OTHER_LANE:
      return {
        action: 'cross_lane',
        target: determineCrossLaneTarget(outcome),
        notify_operator: false
      };
    
    default:
      return {
        action: 'escalate',
        target: 'orchestrator',
        notify_operator: true
      };
  }
}

/**
 * Determine cross-lane target based on outcome context
 * @param {import('./outcome').LaneOutcome} outcome
 * @returns {string}
 */
function determineCrossLaneTarget(outcome) {
  if (outcome.requires && outcome.requires.length > 0) {
    const firstReq = outcome.requires[0];
    if (firstReq.kind === 'missing_context') {
      return 'library';
    }
    if (firstReq.kind === 'verification_needed') {
      return 'archivist';
    }
  }
  return 'orchestrator';
}

/**
 * Get lane endpoint for escalation
 * @param {string} laneName
 * @returns {string}
 */
function getLaneEndpoint(laneName) {
  const endpoints = {
    archivist: 'http://localhost:3847',
    library: 'http://localhost:3848',
    swarmmind: 'http://localhost:3849',
    orchestrator: 'http://localhost:3846'
  };
  return endpoints[laneName] || endpoints.orchestrator;
}

/**
 * Format outcome for transmission
 * @param {import('./outcome').LaneOutcome} outcome
 * @returns {string}
 */
function formatForTransmission(outcome) {
  return JSON.stringify({
    protocol: 'freeagent-outcome-v1',
    outcome: outcome,
    routed_at: new Date().toISOString()
  });
}

module.exports = {
  route,
  routeEscalation,
  determineCrossLaneTarget,
  getLaneEndpoint,
  formatForTransmission
};
