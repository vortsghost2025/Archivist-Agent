/**
 * SwarmMind Verification Bridge
 * 
 * Location: S:/Archivist-Agent/src/bridge/swarmmind-verify.js
 * Purpose: Wrap Kilo execution with SwarmMind truth verification
 * 
 * Categories:
 * - VERIFIED: Direct checks with evidence
 * - MEASURED: Quantified metrics
 * - UNTESTED: Honest admission of gaps
 * - INVALID: Detected fake confidence
 */

const path = require('path');

const VERIFICATION_CATEGORIES = {
  VERIFIED: 'VERIFIED',
  MEASURED: 'MEASURED',
  UNTESTED: 'UNTESTED',
  INVALID: 'INVALID'
};

// Load SwarmMind verification (portable path resolution)
let swarmMindVerify;
try {
  const swarmMindPath = process.env.SWARMIND_PATH || 
    path.resolve('S:', 'SwarmMind Self-Optimizing Multi-Agent AI System');
  swarmMindVerify = require(path.join(swarmMindPath, 'verify.js'));
} catch (e) {
  console.warn('[Bridge] SwarmMind not available, using fallback:', e.message);
  // Fallback: basic verification without SwarmMind
  swarmMindVerify = (result) => ({
    category: 'UNTESTED',
    reason: 'SwarmMind not loaded',
    runtimeChecksPassed: false,
    metricsCaptured: false,
    honestGaps: ['SwarmMind verification unavailable']
  });
}

/**
 * Run execution with verification wrapper
 * @param {Function} kiloExecution - Async function to execute
 * @param {Object} task - Task parameters
 * @returns {Object} { result, verification, trace, error? }
 */
async function runWithVerification(kiloExecution, task) {
  const trace = [];
  trace.push({ event: 'execution_start', timestamp: Date.now(), task });

  let result;
  try {
    result = await kiloExecution(task);
    trace.push({ event: 'execution_complete', timestamp: Date.now(), success: true });
  } catch (error) {
    // FIX: Don't lose trace on error
    trace.push({ event: 'execution_error', timestamp: Date.now(), error: error.message });
    // Return error with trace instead of throwing
    return {
      result: null,
      verification: {
        category: VERIFICATION_CATEGORIES.INVALID,
        error: error.message,
        runtimeChecksPassed: false
      },
      trace,
      error: error.message
    };
  }

  trace.push({ event: 'verification_start', timestamp: Date.now() });

  let verification;
  try {
    verification = swarmMindVerify(result);
  } catch (e) {
    verification = {
      category: VERIFICATION_CATEGORIES.UNTESTED,
      reason: 'Verification failed: ' + e.message
    };
  }

  // FIX: Wire classifyVerification into return value
  const category = classifyVerification(verification);
  verification.category = category;

  trace.push({
    event: 'verification_complete',
    timestamp: Date.now(),
    category: verification.category,
    confidence: verification.confidence || null
  });

  return {
    result,
    verification,
    trace
  };
}

/**
 * Classify verification result into category
 * @param {Object} verification - Verification object
 * @returns {string} Category
 */
function classifyVerification(verification) {
  if (!verification) {
    return VERIFICATION_CATEGORIES.UNTESTED;
  }

  // Check for fake confidence first (highest priority)
  if (verification.fakeConfidence || verification.hardcodedValues) {
    return VERIFICATION_CATEGORIES.INVALID;
  }

  // Verified: runtime checks passed with metrics
  if (verification.runtimeChecksPassed && verification.metricsCaptured) {
    return VERIFICATION_CATEGORIES.VERIFIED;
  }

  // Measured: has actual metrics
  if (verification.actualMetrics && Object.keys(verification.actualMetrics).length > 0) {
    return VERIFICATION_CATEGORIES.MEASURED;
  }

  // Untested: honest gaps admitted
  if (verification.honestGaps && verification.honestGaps.length > 0) {
    return VERIFICATION_CATEGORIES.UNTESTED;
  }

  // Default to untested if nothing matches
  return VERIFICATION_CATEGORIES.UNTESTED;
}

/**
 * Wrap an execution function with verification
 * @param {Function} kiloExecution - Async execution function
 * @returns {Function} Wrapped function
 */
function wrapExecution(kiloExecution) {
  return async (task) => {
    return runWithVerification(kiloExecution, task);
  };
}

module.exports = {
  runWithVerification,
  wrapExecution,
  classifyVerification,
  VERIFICATION_CATEGORIES
};
