/**
 * Source-Tag Linter Tests
 * 
 * Run: node src/tools/__tests__/source-tag-linter.test.js
 */

const assert = require('assert');
const { 
  lintForContamination, 
  hasFirstPersonExecutionClaim, 
  hasSourceTag, 
  hasMixedSources 
} = require('../source-tag-linter.js');

console.log('Testing Source-Tag Linter\n');

// Test 1: hasFirstPersonExecutionClaim
console.log('Test 1: hasFirstPersonExecutionClaim');
assert.strictEqual(hasFirstPersonExecutionClaim('I fixed the bug'), true, 'Should detect "I fixed"');
assert.strictEqual(hasFirstPersonExecutionClaim('I read the file'), true, 'Should detect "I read"');
assert.strictEqual(hasFirstPersonExecutionClaim('I\'ve edited the config'), true, 'Should detect "I\'ve edited"');
assert.strictEqual(hasFirstPersonExecutionClaim('I\'m handling the issue'), true, 'Should detect "I\'m handling"');
assert.strictEqual(hasFirstPersonExecutionClaim('The file was edited'), false, 'Should not detect passive voice');
assert.strictEqual(hasFirstPersonExecutionClaim('I think that...'), false, 'Should not detect non-execution claim');
console.log('  ✓ Passed\n');

// Test 2: hasSourceTag
console.log('Test 2: hasSourceTag');
assert.strictEqual(hasSourceTag('VERIFIED_NOW: I fixed the bug'), true, 'Should detect VERIFIED_NOW');
assert.strictEqual(hasSourceTag('CLAIMED_IN_TRANSCRIPT: Prior agent said'), true, 'Should detect CLAIMED_IN_TRANSCRIPT');
assert.strictEqual(hasSourceTag('I fixed the bug'), false, 'Should detect missing tag');
console.log('  ✓ Passed\n');

// Test 3: hasMixedSources
console.log('Test 3: hasMixedSources');
assert.strictEqual(hasMixedSources('VERIFIED_NOW and CLAIMED_IN_TRANSCRIPT'), true, 'Should detect mixed');
assert.strictEqual(hasMixedSources('VERIFIED_NOW: I did this'), false, 'Should not detect single tag');
console.log('  ✓ Passed\n');

// Test 4: lintForContamination - Clean output
console.log('Test 4: lintForContamination - Clean output');
const cleanResult = lintForContamination('VERIFIED_NOW: I edited the file. CLAIMED_IN_TRANSCRIPT: The prior agent reported success.');
assert.strictEqual(cleanResult.passed, true, 'Should pass clean output');
assert.strictEqual(cleanResult.highSeverityCount, 0, 'Should have no high-severity issues');
console.log('  ✓ Passed\n');

// Test 5: lintForContamination - Untagged claim
console.log('Test 5: lintForContamination - Untagged claim');
const untaggedResult = lintForContamination('I fixed the bug without a tag.');
assert.strictEqual(untaggedResult.passed, false, 'Should fail untagged claim');
assert.strictEqual(untaggedResult.highSeverityCount, 1, 'Should have one high-severity issue');
assert.strictEqual(untaggedResult.issues[0].type, 'UNTAGGED_EXECUTION_CLAIM', 'Should identify correct issue type');
console.log('  ✓ Passed\n');

// Test 6: lintForContamination - Mixed sources
console.log('Test 6: lintForContamination - Mixed sources');
const mixedResult = lintForContamination('VERIFIED_NOW: I checked and CLAIMED_IN_TRANSCRIPT the prior agent verified.');
assert.strictEqual(mixedResult.issues.some(i => i.type === 'MIXED_SOURCES'), true, 'Should detect mixed sources');
console.log('  ✓ Passed\n');

// Test 7: lintForContamination - No first-person claims
console.log('Test 7: lintForContamination - No first-person claims');
const noClaimsResult = lintForContamination('The system is stable. Tests reported passing.');
assert.strictEqual(noClaimsResult.passed, true, 'Should pass non-execution text');
console.log('  ✓ Passed\n');

// Test 8: lintForContamination - Capability claim
console.log('Test 8: lintForContamination - Capability claim');
const capabilityResult = lintForContamination('CAPABILITY_NOW: I can read files in this session.');
assert.strictEqual(capabilityResult.passed, true, 'Should pass capability claim with tag');
console.log('  ✓ Passed\n');

// Test 9: Real-world case - Grok-style contamination
console.log('Test 9: Real-world Grok-style contamination');
const grokStyle = `I've now fully absorbed the fresh-agent review and I'm handling the highest-priority fixes. The system is stable.`;
const grokResult = lintForContamination(grokStyle);
assert.strictEqual(grokResult.passed, false, 'Should catch Grok-style contamination');
assert.ok(grokResult.issues.length >= 1, 'Should have at least one issue');
console.log('  ✓ Passed\n');

// Test 10: Correct source-tagged output
console.log('Test 10: Correct source-tagged output');
const correctOutput = `CLAIMED_IN_TRANSCRIPT: The handoff states a prior agent absorbed the fresh-agent review.

VERIFIED_NOW: I have independently read the discrepancy analysis file.

INFERRED: Based on the documentation structure, governance transfer appears effective.

UNKNOWN: I cannot determine whether the prior test run was real.`;
const correctResult = lintForContamination(correctOutput);
assert.strictEqual(correctResult.passed, true, 'Should pass properly tagged output');
console.log('  ✓ Passed\n');

console.log('─'.repeat(40));
console.log('All tests passed!\n');
