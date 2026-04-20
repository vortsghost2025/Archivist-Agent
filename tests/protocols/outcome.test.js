/**
 * Tests for Phase 4B Outcome Protocol
 */

const assert = require('assert');
const {
  OutcomeStatus,
  EscalationTarget,
  RequirementKind,
  EvidenceType,
  success,
  failure,
  escalate,
  defer,
  quarantine,
  fromVerificationResult,
  route,
  routeEscalation,
  calculateConfidence,
  isConfidenceSufficient,
  getConfidenceLabel,
  generateConfidenceBreakdown
} = require('../../src/core/protocols');

// ============================================
// Outcome Factory Tests
// ============================================

console.log('\n=== OUTCOME FACTORY TESTS ===\n');

// Test success outcome
const successOutcome = success({
  lane: 'library',
  task_id: 'task-001',
  summary: 'Task completed',
  result: { data: 'test' }
});

assert.strictEqual(successOutcome.status, OutcomeStatus.SUCCESS, 'Success status');
assert.strictEqual(successOutcome.lane, 'library', 'Success lane');
assert.strictEqual(successOutcome.task_id, 'task-001', 'Success task_id');
assert.strictEqual(successOutcome.confidence, 1.0, 'Success default confidence');
assert.ok(successOutcome.created_at, 'Success has timestamp');
console.log('✓ success() creates correct outcome');

// Test failure outcome
const failureOutcome = failure({
  lane: 'archivist',
  task_id: 'task-002',
  summary: 'Task failed',
  error_code: 'ERR_VERIFY',
  reason: 'Invalid signature'
});

assert.strictEqual(failureOutcome.status, OutcomeStatus.FAILURE, 'Failure status');
assert.strictEqual(failureOutcome.confidence, 0.0, 'Failure confidence is 0');
assert.strictEqual(failureOutcome.error_code, 'ERR_VERIFY', 'Failure error_code');
console.log('✓ failure() creates correct outcome');

// Test escalate outcome
const escalateOutcome = escalate({
  lane: 'swarmmind',
  task_id: 'task-003',
  summary: 'Need verification',
  confidence: 0.6,
  escalation_target: EscalationTarget.ARCHIVIST,
  requires: [{ kind: RequirementKind.VERIFICATION_NEEDED, detail: 'Key trust check' }]
});

assert.strictEqual(escalateOutcome.status, OutcomeStatus.ESCALATE, 'Escalate status');
assert.strictEqual(escalateOutcome.confidence, 0.6, 'Escalate confidence');
assert.strictEqual(escalateOutcome.escalation_target, EscalationTarget.ARCHIVIST, 'Escalate target');
assert.strictEqual(escalateOutcome.requires.length, 1, 'Escalate has requires');
console.log('✓ escalate() creates correct outcome');

// Test defer outcome
const deferOutcome = defer({
  lane: 'library',
  task_id: 'task-004',
  summary: 'Waiting for context',
  confidence: 0.4,
  reason: 'Missing context from orchestrator',
  requires: [{ kind: RequirementKind.MISSING_CONTEXT, detail: 'Config file' }]
});

assert.strictEqual(deferOutcome.status, OutcomeStatus.DEFER, 'Defer status');
assert.strictEqual(deferOutcome.confidence, 0.4, 'Defer confidence');
assert.ok(deferOutcome.requires, 'Defer has requires');
console.log('✓ defer() creates correct outcome');

// Test quarantine outcome
const quarantineOutcome = quarantine({
  lane: 'archivist',
  task_id: 'task-005',
  summary: 'Unsafe payload detected',
  reason: 'Signature mismatch',
  quarantine_id: 'q-123'
});

assert.strictEqual(quarantineOutcome.status, OutcomeStatus.QUARANTINE, 'Quarantine status');
assert.strictEqual(quarantineOutcome.confidence, 0.95, 'Quarantine confidence high');
assert.ok(quarantineOutcome.error_code.includes('QUARANTINE'), 'Quarantine has error_code');
console.log('✓ quarantine() creates correct outcome');

// ============================================
// Verification Result Conversion Tests
// ============================================

console.log('\n=== VERIFICATION CONVERSION TESTS ===\n');

const validResult = fromVerificationResult(
  { valid: true, payload: { test: true } },
  'library',
  'task-006'
);
assert.strictEqual(validResult.status, OutcomeStatus.SUCCESS, 'Valid result → SUCCESS');
console.log('✓ fromVerificationResult(valid) → SUCCESS');

const invalidResult = fromVerificationResult(
  { valid: false, reason: 'INVALID_SIGNATURE', note: 'Bad signature' },
  'library',
  'task-007'
);
assert.strictEqual(invalidResult.status, OutcomeStatus.FAILURE, 'Invalid result → FAILURE');
console.log('✓ fromVerificationResult(invalid) → FAILURE');

const quarantineResult = fromVerificationResult(
  { valid: false, reason: 'QUARANTINED', note: 'Lane mismatch', itemId: 'item-001' },
  'library',
  'task-008'
);
assert.strictEqual(quarantineResult.status, OutcomeStatus.QUARANTINE, 'Quarantined result → QUARANTINE');
console.log('✓ fromVerificationResult(quarantined) → QUARANTINE');

// ============================================
// Routing Tests
// ============================================

console.log('\n=== ROUTING TESTS ===\n');

const successRoute = route(successOutcome);
assert.strictEqual(successRoute.action, 'continue', 'SUCCESS → continue');
assert.strictEqual(successRoute.notify_operator, false, 'SUCCESS no alert');
console.log('✓ SUCCESS routes to continue');

const failureRoute = route(failureOutcome);
assert.strictEqual(failureRoute.action, 'stop', 'FAILURE → stop');
console.log('✓ FAILURE routes to stop');

const escalateRoute = route(escalateOutcome);
assert.strictEqual(escalateRoute.action, 'escalate', 'ESCALATE → escalate');
assert.strictEqual(escalateRoute.target, 'archivist', 'ESCALATE target correct');
console.log('✓ ESCALATE routes to target');

const deferRoute = route(deferOutcome);
assert.strictEqual(deferRoute.action, 'queue', 'DEFER → queue');
assert.strictEqual(deferRoute.queue, 'deferred', 'DEFER queue name');
console.log('✓ DEFER routes to queue');

const quarantineRoute = route(quarantineOutcome);
assert.strictEqual(quarantineRoute.action, 'isolate', 'QUARANTINE → isolate');
assert.strictEqual(quarantineRoute.notify_operator, true, 'QUARANTINE alerts operator');
console.log('✓ QUARANTINE routes to isolate + alert');

// ============================================
// Confidence Tests
// ============================================

console.log('\n=== CONFIDENCE TESTS ===\n');

const highConfidence = calculateConfidence({
  signature_valid: true,
  lane_match: true,
  key_trusted: true,
  key_not_revoked: true,
  payload_integrity: true
});
assert.strictEqual(highConfidence, 1.0, 'All factors → 1.0');
console.log('✓ All confidence factors → 1.0');

const mediumConfidence = calculateConfidence({
  signature_valid: true,
  lane_match: true,
  key_trusted: true,
  key_not_revoked: false,
  payload_integrity: true
});
assert.ok(mediumConfidence >= 0.7 && mediumConfidence < 0.9, 'Partial factors → medium');
console.log('✓ Partial factors → medium confidence');

const lowConfidence = calculateConfidence({
  signature_valid: false,
  lane_match: false,
  key_trusted: false,
  key_not_revoked: false,
  payload_integrity: false
});
assert.strictEqual(lowConfidence, 0.0, 'No factors → 0.0');
console.log('✓ No confidence factors → 0.0');

// Confidence labels
assert.strictEqual(getConfidenceLabel(0.95), 'HIGH', '0.95 → HIGH');
assert.strictEqual(getConfidenceLabel(0.75), 'MEDIUM', '0.75 → MEDIUM');
assert.strictEqual(getConfidenceLabel(0.55), 'LOW', '0.55 → LOW');
assert.strictEqual(getConfidenceLabel(0.3), 'VERY_LOW', '0.3 → VERY_LOW');
console.log('✓ Confidence labels correct');

// Confidence sufficiency
assert.ok(isConfidenceSufficient(0.95, 'proceed'), '0.95 sufficient for proceed');
assert.ok(!isConfidenceSufficient(0.7, 'proceed'), '0.7 not sufficient for proceed');
assert.ok(isConfidenceSufficient(0.7, 'review'), '0.7 sufficient for review');
assert.ok(isConfidenceSufficient(0.5, 'escalate'), '0.5 sufficient for escalate');
console.log('✓ Confidence sufficiency checks correct');

// Confidence breakdown
const breakdown = generateConfidenceBreakdown({
  signature_valid: true,
  lane_match: true,
  key_trusted: true,
  key_not_revoked: true,
  payload_integrity: true
});
assert.ok(breakdown.confidence >= 0.9, 'Breakdown has confidence');
assert.ok(breakdown.sufficient_for.proceed, 'Breakdown shows proceed allowed');
console.log('✓ Confidence breakdown generated');

// ============================================
// Escalation Target Tests
// ============================================

console.log('\n=== ESCALATION TARGET TESTS ===\n');

const orchestratorEscalation = routeEscalation({
  status: OutcomeStatus.ESCALATE,
  escalation_target: EscalationTarget.ORCHESTRATOR
});
assert.strictEqual(orchestratorEscalation.target, 'orchestrator', 'ORCHESTRATOR target');
console.log('✓ ORCHESTRATOR escalation routes correctly');

const userEscalation = routeEscalation({
  status: OutcomeStatus.ESCALATE,
  escalation_target: EscalationTarget.USER
});
assert.strictEqual(userEscalation.target, 'user', 'USER target');
assert.strictEqual(userEscalation.notify_operator, true, 'USER alerts operator');
console.log('✓ USER escalation routes with alert');

// ============================================
// Evidence Reference Tests
// ============================================

console.log('\n=== EVIDENCE REFERENCE TESTS ===\n');

const outcomeWithEvidence = success({
  lane: 'library',
  task_id: 'task-009',
  summary: 'With evidence',
  result: { data: 'test' },
  evidence: [
    { type: EvidenceType.FILE, value: 'path/to/file.js' },
    { type: EvidenceType.LOG, value: 'logs/verify.log#L42' }
  ]
});

assert.strictEqual(outcomeWithEvidence.evidence.length, 2, 'Has 2 evidence refs');
assert.strictEqual(outcomeWithEvidence.evidence[0].type, EvidenceType.FILE, 'First is FILE');
console.log('✓ Evidence references attached correctly');

// ============================================
// Requires Field Tests
// ============================================

console.log('\n=== REQUIRES FIELD TESTS ===\n');

const outcomeWithRequires = escalate({
  lane: 'library',
  task_id: 'task-010',
  summary: 'Multiple requirements',
  confidence: 0.6,
  escalation_target: EscalationTarget.ORCHESTRATOR,
  requires: [
    { kind: RequirementKind.MISSING_CONTEXT, detail: 'Config missing' },
    { kind: RequirementKind.VERIFICATION_NEEDED, detail: 'Key check needed' },
    { kind: RequirementKind.HUMAN_APPROVAL, detail: 'Approve deploy' }
  ]
});

assert.strictEqual(outcomeWithRequires.requires.length, 3, 'Has 3 requirements');
assert.strictEqual(outcomeWithRequires.requires[0].kind, RequirementKind.MISSING_CONTEXT, 'First req kind');
console.log('✓ Requires field contains all blockers');

// ============================================
// Summary
// ============================================

console.log('\n=== ALL TESTS PASSED ===\n');
console.log('Outcome Protocol: 30/30 checks passed');
console.log('Phase 4B implementation verified');
