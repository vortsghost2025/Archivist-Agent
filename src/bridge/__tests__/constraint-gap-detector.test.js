/**
 * Constraint Gap Detector Tests
 *
 * Location: S:/Archivist-Agent/src/bridge/__tests__/constraint-gap-detector.test.js
 * Purpose: Validate Phase A OBSERVE-only and confidence/evidence guardrails.
 */

const { ConstraintGapDetector } = require('../constraint-gap-detector');

function runTests() {
  console.log('\n========================================');
  console.log('Constraint Gap Detector Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  const detector = new ConstraintGapDetector({
    now: () => '2026-04-28T12:00:00.000Z'
  });

  console.log('Test 1: Missing evidence defaults to LOW');
  const c1 = detector.scanForGaps([
    {
      gap_type: 'CONSTRAINT_GAP',
      confidence: 'HIGH',
      verified: true
    }
  ])[0];
  if (c1 && c1.confidence === 'LOW' && c1.evidence_path === null) {
    passed++;
    console.log('  ✓ PASS: confidence forced to LOW without evidence_path');
  } else {
    failed++;
    console.log('  ✗ FAIL: expected LOW confidence and null evidence_path');
  }

  console.log('\nTest 2: Unverified signals default to LOW');
  const c2 = detector.scanForGaps([
    {
      gap_type: 'DELEGATION_GAP',
      confidence: 'HIGH',
      verified: false,
      evidence_path: 'context-buffer/evidence/delegation-gap.json'
    }
  ])[0];
  if (c2 && c2.confidence === 'LOW') {
    passed++;
    console.log('  ✓ PASS: unverified signal downgraded to LOW');
  } else {
    failed++;
    console.log('  ✗ FAIL: expected LOW confidence for unverified signal');
  }

  console.log('\nTest 3: Verified + evidence preserves confidence');
  const c3 = detector.scanForGaps([
    {
      gap_type: 'CHECKPOINT_GAP',
      confidence: 'MEDIUM',
      verified: true,
      evidence_path: 'context-buffer/evidence/checkpoint-gap.json'
    }
  ])[0];
  if (c3 && c3.confidence === 'MEDIUM' && c3.priority === 'P1') {
    passed++;
    console.log('  ✓ PASS: MEDIUM confidence preserved with valid evidence');
  } else {
    failed++;
    console.log('  ✗ FAIL: expected MEDIUM confidence and P1 priority');
  }

  console.log('\nTest 4: Proposal mode blocked by default');
  let blocked = false;
  try {
    detector.generateProposalDrafts([c3]);
  } catch (error) {
    blocked = error.message.includes('disabled');
  }
  if (blocked) {
    passed++;
    console.log('  ✓ PASS: proposal draft generation blocked in Phase A');
  } else {
    failed++;
    console.log('  ✗ FAIL: proposal mode should be disabled by default');
  }

  console.log('\nTest 5: Proposal drafts allowed after explicit enable');
  detector.enableProposalMode();
  const drafts = detector.generateProposalDrafts([
    c1, // LOW (should be filtered out)
    c3  // MEDIUM (should pass)
  ]);
  if (drafts.length === 1 && drafts[0].gap_type === 'CHECKPOINT_GAP') {
    passed++;
    console.log('  ✓ PASS: only MEDIUM/HIGH candidates converted to drafts');
  } else {
    failed++;
    console.log('  ✗ FAIL: expected exactly one CHECKPOINT_GAP draft');
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  return { passed, failed };
}

module.exports = { runTests };

if (require.main === module) {
  const { failed } = runTests();
  process.exit(failed > 0 ? 1 : 0);
}
