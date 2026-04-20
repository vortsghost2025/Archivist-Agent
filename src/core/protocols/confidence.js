/**
 * confidence.js - Phase 4B Confidence Scoring
 * 
 * Confidence represents certainty of outcome correctness.
 * Range: 0.0 (no confidence) to 1.0 (certain)
 * 
 * Key thresholds:
 * - >= 0.9: High confidence, proceed
 * - >= 0.7: Medium confidence, may need review
 * - >= 0.5: Low confidence, escalate
 * - < 0.5: Very low confidence, block/defer
 */

/**
 * Confidence thresholds
 * @enum {number}
 */
const ConfidenceThreshold = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  NONE: 0.0
};

/**
 * Calculate confidence from verification factors
 * @param {Object} factors
 * @param {boolean} factors.signature_valid - JWS signature valid
 * @param {boolean} factors.lane_match - Lane field matches
 * @param {boolean} factors.key_trusted - Key in trust store
 * @param {boolean} factors.key_not_revoked - Key not revoked
 * @param {boolean} factors.payload_integrity - Payload unmodified
 * @param {number} [factors.custom] - Additional confidence modifier
 * @returns {number}
 */
function calculateConfidence(factors) {
  const weights = {
    signature_valid: 0.30,
    lane_match: 0.20,
    key_trusted: 0.20,
    key_not_revoked: 0.15,
    payload_integrity: 0.15
  };
  
  let confidence = 0.0;
  
  if (factors.signature_valid) confidence += weights.signature_valid;
  if (factors.lane_match) confidence += weights.lane_match;
  if (factors.key_trusted) confidence += weights.key_trusted;
  if (factors.key_not_revoked) confidence += weights.key_not_revoked;
  if (factors.payload_integrity) confidence += weights.payload_integrity;
  
  if (factors.custom !== undefined) {
    confidence += factors.custom * 0.1;
  }
  
  return Math.min(1.0, Math.max(0.0, confidence));
}

/**
 * Determine if confidence is sufficient for action
 * @param {number} confidence
 * @param {string} actionType - 'proceed' | 'review' | 'escalate' | 'block'
 * @returns {boolean}
 */
function isConfidenceSufficient(confidence, actionType) {
  const thresholds = {
    proceed: ConfidenceThreshold.HIGH,
    review: ConfidenceThreshold.MEDIUM,
    escalate: ConfidenceThreshold.LOW,
    block: ConfidenceThreshold.NONE
  };
  
  return confidence >= thresholds[actionType];
}

/**
 * Get confidence level label
 * @param {number} confidence
 * @returns {string}
 */
function getConfidenceLabel(confidence) {
  if (confidence >= ConfidenceThreshold.HIGH) return 'HIGH';
  if (confidence >= ConfidenceThreshold.MEDIUM) return 'MEDIUM';
  if (confidence >= ConfidenceThreshold.LOW) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Generate confidence breakdown for logging
 * @param {Object} factors
 * @returns {Object}
 */
function generateConfidenceBreakdown(factors) {
  const confidence = calculateConfidence(factors);
  const label = getConfidenceLabel(confidence);
  
  return {
    confidence,
    label,
    factors: {
      signature_valid: factors.signature_valid === true,
      lane_match: factors.lane_match === true,
      key_trusted: factors.key_trusted === true,
      key_not_revoked: factors.key_not_revoked === true,
      payload_integrity: factors.payload_integrity === true
    },
    sufficient_for: {
      proceed: isConfidenceSufficient(confidence, 'proceed'),
      review: isConfidenceSufficient(confidence, 'review'),
      escalate: isConfidenceSufficient(confidence, 'escalate')
    }
  };
}

module.exports = {
  ConfidenceThreshold,
  calculateConfidence,
  isConfidenceSufficient,
  getConfidenceLabel,
  generateConfidenceBreakdown
};
