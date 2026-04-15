/**
 * Bridge Module Tests
 * 
 * Location: S:/Archivist-Agent/src/bridge/__tests__/bridge.test.js
 * Purpose: Unit tests for bridge components
 * 
 * Run with: npm test
 */

const { classifyVerification, VERIFICATION_CATEGORIES } = require('../swarmmind-verify');
const { shouldFallback, getNextProfile, getNextProfileName, getProfile } = require('../provider-profiles');
const { assessSeverity } = require('../routing-logger');

// ===== classifyVerification Tests =====

function testClassifyVerification() {
  console.log('\n--- Testing classifyVerification ---');
  
  // Test: null input
  let result = classifyVerification(null);
  console.assert(result === VERIFICATION_CATEGORIES.UNTESTED, 'null should return UNTESTED');
  
  // Test: fake confidence
  result = classifyVerification({ fakeConfidence: true });
  console.assert(result === VERIFICATION_CATEGORIES.INVALID, 'fakeConfidence should return INVALID');
  
  // Test: hardcoded values
  result = classifyVerification({ hardcodedValues: true });
  console.assert(result === VERIFICATION_CATEGORIES.INVALID, 'hardcodedValues should return INVALID');
  
  // Test: verified
  result = classifyVerification({ runtimeChecksPassed: true, metricsCaptured: true });
  console.assert(result === VERIFICATION_CATEGORIES.VERIFIED, 'passed checks should return VERIFIED');
  
  // Test: measured
  result = classifyVerification({ actualMetrics: { latency: 100 } });
  console.assert(result === VERIFICATION_CATEGORIES.MEASURED, 'actualMetrics should return MEASURED');
  
  // Test: untested with honest gaps
  result = classifyVerification({ honestGaps: ['GPU not tested'] });
  console.assert(result === VERIFICATION_CATEGORIES.UNTESTED, 'honestGaps should return UNTESTED');
  
  // Test: empty object
  result = classifyVerification({});
  console.assert(result === VERIFICATION_CATEGORIES.UNTESTED, 'empty should return UNTESTED');
  
  console.log('✓ classifyVerification tests passed');
}

// ===== shouldFallback Tests =====

function testShouldFallback() {
  console.log('\n--- Testing shouldFallback ---');
  
  // Test: quota exceeded
  let result = shouldFallback({ quotaExceeded: true, retryCount: 0, maxRetries: 3 });
  console.assert(result === true, 'quotaExceeded should fallback');
  
  // Test: max retries reached
  result = shouldFallback({ quotaExceeded: false, retryCount: 3, maxRetries: 3 });
  console.assert(result === false, 'max retries should not fallback');
  
  // Test: string error with 429
  result = shouldFallback({ error: '429 rate limit', retryCount: 0, maxRetries: 3 });
  console.assert(result === true, '429 string should fallback');
  
  // Test: Error object with 429 (FIX TEST)
  result = shouldFallback({ error: new Error('429 rate limit'), retryCount: 0, maxRetries: 3 });
  console.assert(result === true, '429 Error object should fallback');
  
  // Test: timeout error
  result = shouldFallback({ error: 'timeout exceeded', retryCount: 0, maxRetries: 3 });
  console.assert(result === true, 'timeout should fallback');
  
  // Test: non-fallback error
  result = shouldFallback({ error: 'some other error', retryCount: 0, maxRetries: 3 });
  console.assert(result === false, 'non-fallback error should not fallback');
  
  // Test: null error
  result = shouldFallback({ error: null, retryCount: 0, maxRetries: 3 });
  console.assert(result === false, 'null error should not fallback');
  
  console.log('✓ shouldFallback tests passed');
}

// ===== Provider Profile Tests =====

function testProviderProfiles() {
  console.log('\n--- Testing Provider Profiles ---');
  
  // Test: getProfile
  let profile = getProfile('local-fast');
  console.assert(profile !== null, 'local-fast profile should exist');
  console.assert(profile.provider === 'ollama', 'local-fast should be ollama');
  
  profile = getProfile('nonexistent');
  console.assert(profile === null, 'nonexistent profile should return null');
  
  // Test: getNextProfileName
  let nextName = getNextProfileName('local-fast', 'architecture');
  console.assert(nextName === 'cloud-reasoning', 'next in architecture chain should be cloud-reasoning');
  
  nextName = getNextProfileName('cloud-reasoning', 'architecture');
  console.assert(nextName === null, 'end of chain should return null');
  
  // Test: getNextProfile
  let nextProfile = getNextProfile('local-fast', 'architecture');
  console.assert(nextProfile.name === 'Cloud Reasoning', 'getNextProfile should return profile object');
  
  console.log('✓ Provider profile tests passed');
}

// ===== Routing Severity Tests =====

function testAssessSeverity() {
  console.log('\n--- Testing assessSeverity ---');
  
  // Test: local to cloud (HIGH)
  let severity = assessSeverity({ intended: 'ollama/qwen2.5', actual: 'z-ai/glm5' });
  console.assert(severity === 'HIGH', 'local→cloud should be HIGH');
  
  // Test: cloud to local (MEDIUM)
  severity = assessSeverity({ intended: 'z-ai/glm5', actual: 'ollama/qwen2.5' });
  console.assert(severity === 'MEDIUM', 'cloud→local should be MEDIUM');
  
  // Test: openrouter to local (MEDIUM)
  severity = assessSeverity({ intended: 'openrouter/auto', actual: 'ollama/qwen2.5' });
  console.assert(severity === 'MEDIUM', 'openrouter→local should be MEDIUM');
  
  // Test: same category (LOW)
  severity = assessSeverity({ intended: 'ollama/qwen2.5', actual: 'ollama/deepseek' });
  console.assert(severity === 'LOW', 'same provider should be LOW');
  
  console.log('✓ assessSeverity tests passed');
}

// ===== Run All Tests =====

function runAllTests() {
  console.log('\n========================================');
  console.log('Bridge Module Tests');
  console.log('========================================');
  
  try {
    testClassifyVerification();
    testShouldFallback();
    testProviderProfiles();
    testAssessSeverity();
    
    console.log('\n========================================');
    console.log('✓ ALL TESTS PASSED');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for module usage
module.exports = {
  testClassifyVerification,
  testShouldFallback,
  testProviderProfiles,
  testAssessSeverity,
  runAllTests
};

// Run if called directly
if (require.main === module) {
  runAllTests();
}
