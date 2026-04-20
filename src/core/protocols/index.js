/**
 * index.js - Protocol Exports
 */

const outcome = require('./outcome');
const router = require('./outcome_router');
const confidence = require('./confidence');

module.exports = {
  // Outcome status and factories
  OutcomeStatus: outcome.OutcomeStatus,
  EscalationTarget: outcome.EscalationTarget,
  RequirementKind: outcome.RequirementKind,
  EvidenceType: outcome.EvidenceType,
  success: outcome.success,
  failure: outcome.failure,
  escalate: outcome.escalate,
  defer: outcome.defer,
  quarantine: outcome.quarantine,
  fromVerificationResult: outcome.fromVerificationResult,
  
  // Routing
  route: router.route,
  routeEscalation: router.routeEscalation,
  getLaneEndpoint: router.getLaneEndpoint,
  formatForTransmission: router.formatForTransmission,
  
  // Confidence
  ConfidenceThreshold: confidence.ConfidenceThreshold,
  calculateConfidence: confidence.calculateConfidence,
  isConfidenceSufficient: confidence.isConfidenceSufficient,
  getConfidenceLabel: confidence.getConfidenceLabel,
  generateConfidenceBreakdown: confidence.generateConfidenceBreakdown
};
