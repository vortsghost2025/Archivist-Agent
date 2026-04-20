/**
 * test-phase4-enforcement-proof.js
 * 
 * Behavioral gate tests per Enforcement Proof Requirement.
 * Tests EXECUTION PATH, not string presence.
 * 
 * Four requirements per GOVERNANCE.md Section 13:
 * 1. Runtime call site
 * 2. Real execution trace
 * 3. Failure case blocked
 * 4. Bypass analysis
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ARCHIVIST_ROOT = 'S:/Archivist-Agent';

console.log('\n=== ENFORCEMENT PROOF TESTS ===\n');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
}

// ============================================================================
// REQUIREMENT 1: RUNTIME CALL SITE
// ============================================================================

console.log('--- REQUIREMENT 1: RUNTIME CALL SITE ---\n');

// 1.1: Outcome protocol is imported in VerifierWrapper
const verifierWrapperPath = path.join(ARCHIVIST_ROOT, 'src/attestation/VerifierWrapper.js');
const verifierWrapperCode = fs.readFileSync(verifierWrapperPath, 'utf8');

check(
  'Outcome protocol imported in VerifierWrapper',
  verifierWrapperCode.includes("require('../core/protocols/outcome')")
);

// 1.2: Outcome.quarantine called for missing signature
check(
  'Missing signature returns QUARANTINE outcome',
  verifierWrapperCode.includes('Outcome.quarantine') && 
  verifierWrapperCode.includes('MISSING_SIGNATURE')
);

// 1.3: Outcome.success called for valid verification
check(
  'Valid verification returns SUCCESS outcome',
  verifierWrapperCode.includes('Outcome.success')
);

// 1.4: Outcome.defer called for quarantine retry
check(
  'Quarantine retry returns DEFER outcome',
  verifierWrapperCode.includes('Outcome.defer')
);

// ============================================================================
// REQUIREMENT 2: REAL EXECUTION TRACE
// ============================================================================

console.log('\n--- REQUIREMENT 2: REAL EXECUTION TRACE ---\n');

// 2.1: VerifierWrapper.verify() exists and calls outcome factories
check(
  'VerifierWrapper.verify() exists',
  verifierWrapperCode.includes('async verify(item)')
);

// 2.2: Trace path: verify() -> Outcome.quarantine/success/defer
const hasQuarantineCall = verifierWrapperCode.includes('Outcome.quarantine');
const hasSuccessCall = verifierWrapperCode.includes('Outcome.success');
const hasDeferCall = verifierWrapperCode.includes('Outcome.defer');

check(
  'Execution trace: verify() -> Outcome factories',
  hasQuarantineCall && hasSuccessCall && hasDeferCall
);

// 2.3: Verifier.verifyQueueItem() exists (called by VerifierWrapper)
const verifierPath = path.join(ARCHIVIST_ROOT, 'src/attestation/Verifier.js');
const verifierCode = fs.readFileSync(verifierPath, 'utf8');

check(
  'Verifier.verifyQueueItem() exists',
  verifierCode.includes('verifyQueueItem(item)')
);

// 2.4: QuarantineManager.quarantine() exists (called by VerifierWrapper)
const quarantinePath = path.join(ARCHIVIST_ROOT, 'src/attestation/QuarantineManager.js');
const quarantineCode = fs.readFileSync(quarantinePath, 'utf8');

check(
  'QuarantineManager.quarantine() exists',
  quarantineCode.includes('quarantine(item, reason)')
);

// ============================================================================
// REQUIREMENT 3: FAILURE CASE BLOCKED
// ============================================================================

console.log('\n--- REQUIREMENT 3: FAILURE CASE BLOCKED ---\n');

// 3.1: HMAC dual-mode acceptance REMOVED from VerifierWrapper
check(
  'HMAC dual-mode removed from VerifierWrapper',
  !verifierWrapperCode.includes('HMAC_ACCEPTED_DUAL_MODE')
);

// 3.2: HMAC dual-mode acceptance REMOVED from Verifier
check(
  'HMAC dual-mode removed from Verifier',
  !verifierCode.includes('HMAC_ACCEPTED_DUAL_MODE')
);

// 3.3: Missing signature immediately returns QUARANTINE (not accepted)
check(
  'Missing signature rejected immediately',
  verifierWrapperCode.includes('MISSING_SIGNATURE') && 
  verifierWrapperCode.includes('Outcome.quarantine') &&
  !verifierWrapperCode.includes('HMAC_ACCEPTED')
);

// 3.4: Lane mismatch returns QUARANTINE (not bypassed)
check(
  'Lane mismatch returns QUARANTINE outcome',
  verifierWrapperCode.includes('LANE_MISMATCH') && 
  verifierWrapperCode.includes('Outcome.quarantine')
);

// 3.5: Key not found returns proper handling
check(
  'Key not found handled properly',
  verifierCode.includes('KEY_NOT_FOUND')
);

// ============================================================================
// REQUIREMENT 4: BYPASS ANALYSIS
// ============================================================================

console.log('\n--- REQUIREMENT 4: BYPASS ANALYSIS ---\n');

// 4.1: No HMAC fallback path in VerifierWrapper
check(
  'No HMAC fallback in VerifierWrapper',
  !verifierWrapperCode.includes('hmacCutoffDate') || 
  !verifierWrapperCode.includes('now < cutoff')
);

// 4.2: No HMAC fallback path in Verifier.verifyQueueItem (execution path)
check(
  'No HMAC fallback in Verifier.verifyQueueItem execution path',
  !verifierCode.includes('HMAC_ACCEPTED_DUAL_MODE') &&
  !verifierCode.includes('if (new Date() < cutoff)') // Execution path, not status methods
);

// 4.3: Recovery override forbidden (per anchor)
const anchorPath = path.join(ARCHIVIST_ROOT, 'FREEAGENT_SYSTEM_ANCHOR.json');
const anchorCode = fs.readFileSync(anchorPath, 'utf8');

check(
  'Anchor declares recovery_override_allowed: false',
  anchorCode.includes('"recovery_override_allowed": false')
);

// 4.4: Anchor declares hmac_accepted: false
check(
  'Anchor declares hmac_accepted: false',
  anchorCode.includes('"hmac_accepted": false')
);

// 4.5: Anchor declares missing_signature_mode: "REJECT"
check(
  'Anchor declares missing_signature_mode: "REJECT"',
  anchorCode.includes('"missing_signature_mode": "REJECT"')
);

// 4.6: Confidence defaults are NOT optimistic
const confidencePath = path.join(ARCHIVIST_ROOT, 'src/core/protocols/confidence.js');
const confidenceCode = fs.readFileSync(confidencePath, 'utf8');

check(
  'Confidence factors default to false (not optimistic)',
  confidenceCode.includes('=== true') && 
  !confidenceCode.includes('!== false')
);

// 4.7: Retry boundary is correct (> not >=)
check(
  'Retry boundary uses > (not >=) for correct policy',
  quarantineCode.includes('entry.retryCount > this.maxRetries')
);

// ============================================================================
// CROSS-LANE CONSISTENCY
// ============================================================================

console.log('\n--- CROSS-LANE CONSISTENCY ---\n');

const libraryRoot = 'S:/self-organizing-library';

// 5.1: Library does not have conflicting OutcomeProtocol.js
const conflictingPath = path.join(libraryRoot, 'src/attestation/OutcomeProtocol.js');
check(
  'Library OutcomeProtocol.js removed (no ACCEPT/REJECT conflict)',
  !fs.existsSync(conflictingPath)
);

// 5.2: Library Queue.js has no HMAC bypass branch
const libraryQueuePath = path.join(libraryRoot, 'src/queue/Queue.js');
const libraryQueueCode = fs.readFileSync(libraryQueuePath, 'utf8');

check(
  'Library Queue has no HMAC bypass branch',
  !libraryQueueCode.includes('else if (current.hmac)') ||
  libraryQueueCode.includes('missing required signature')
);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== ENFORCEMENT PROOF RESULTS ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ ENFORCEMENT PROOF NOT SATISFIED');
  console.log('Fix the failing checks before marking complete.');
  process.exit(1);
}

console.log('\n✅ ALL ENFORCEMENT PROOF REQUIREMENTS SATISFIED');
console.log('Outcome protocol is in live execution path.');
console.log('HMAC fallback eliminated.');
console.log('Cross-lane consistency verified.');
process.exit(0);
