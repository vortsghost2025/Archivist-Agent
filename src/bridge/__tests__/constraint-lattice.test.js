/**
 * Constraint Lattice Tests
 * 
 * Location: S:/Archivist-Agent/src/bridge/__tests__/constraint-lattice.test.js
 * Purpose: Verify lattice operations against known cases
 */

const { ConstraintLattice, createGovernanceLattice } = require('../constraint-lattice');

function runTests() {
  console.log('\n========================================');
  console.log('Constraint Lattice Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Basic meets operation
  console.log('Test 1: meets() returns stronger constraint');
  const lattice1 = new ConstraintLattice();
  lattice1.addConstraint('A', new Set(['B', 'C']));
  lattice1.addConstraint('B', new Set(['C']));
  lattice1.addConstraint('C', new Set());
  
  const meet1 = lattice1.meets('A', 'B');
  console.assert(meet1 === 'A', `Expected 'A', got '${meet1}'`);
  if (meet1 === 'A') { passed++; console.log('  ✓ PASS: meets(A, B) = A (A is stronger)'); }
  else { failed++; console.log('  ✗ FAIL: meets(A, B) should return A'); }

  // Test 2: Meets with no common constraint
  console.log('\nTest 2: meets() with incompatible constraints');
  const lattice2 = new ConstraintLattice();
  lattice2.addConstraint('X', new Set());
  lattice2.addConstraint('Y', new Set());
  
  const meet2 = lattice2.meets('X', 'Y');
  console.assert(meet2 === null, `Expected null, got '${meet2}'`);
  if (meet2 === null) { passed++; console.log('  ✓ PASS: meets(X, Y) = null (incompatible)'); }
  else { failed++; console.log('  ✗ FAIL: incompatible constraints should return null'); }

  // Test 3: respectsLattice passes
  console.log('\nTest 3: respectsLattice() passes for valid behavior');
  const lattice3 = new ConstraintLattice();
  lattice3.addToConstitution('MUST_PASS');
  lattice3.addConstraint('VALID_BEHAVIOR', new Set(['MUST_PASS']));
  
  const result3 = lattice3.respectsLattice(new Set(['VALID_BEHAVIOR']));
  console.assert(result3.respects === true, 'Should respect lattice');
  if (result3.respects) { passed++; console.log('  ✓ PASS: valid behavior respects constitution'); }
  else { failed++; console.log('  ✗ FAIL: valid behavior should pass'); }

  // Test 4: respectsLattice fails
  console.log('\nTest 4: respectsLattice() fails for violation');
  const lattice4 = new ConstraintLattice();
  lattice4.addToConstitution('MUST_PASS');
  lattice4.addConstraint('INVALID_BEHAVIOR', new Set());
  
  const result4 = lattice4.respectsLattice(new Set(['INVALID_BEHAVIOR']));
  console.assert(result4.respects === false, 'Should violate lattice');
  console.assert(result4.violation === 'MUST_PASS', 'Should identify violation');
  if (!result4.respects && result4.violation === 'MUST_PASS') { 
    passed++; 
    console.log('  ✓ PASS: invalid behavior detected, violation identified'); 
  } else { failed++; console.log('  ✗ FAIL: should detect violation'); }

  // Test 5: detectDrift returns exact 6-class strings
  console.log('\nTest 5: detectDrift() returns DIMENSION MISMATCH');
  const lattice5 = new ConstraintLattice();
  lattice5.addConstraint('EXPECTED', new Set());
  
  const drift5 = lattice5.detectDrift(
    new Set(['EXPECTED', 'UNEXPECTED']),
    new Set(['EXPECTED'])
  );
  console.assert(drift5.hasDrift === true, 'Should detect drift');
  console.assert(drift5.type === 'DIMENSION MISMATCH', `Expected 'DIMENSION MISMATCH', got '${drift5.type}'`);
  if (drift5.type === 'DIMENSION MISMATCH') { 
    passed++; 
    console.log('  ✓ PASS: single unexpected constraint = DIMENSION MISMATCH'); 
  } else { failed++; console.log('  ✗ FAIL: expected DIMENSION MISMATCH'); }

  // Test 6: detectDrift TRUE DRIFT
  console.log('\nTest 6: detectDrift() returns TRUE DRIFT for constitutional violation');
  const lattice6 = new ConstraintLattice();
  lattice6.addToConstitution('CONSTITUTIONAL_INVARIANT');
  
  const drift6 = lattice6.detectDrift(
    new Set(['CONSTITUTIONAL_INVARIANT', 'VIOLATION']),
    new Set(['CONSTITUTIONAL_INVARIANT'])
  );
  console.assert(drift6.type === 'TRUE DRIFT', `Expected 'TRUE DRIFT', got '${drift6.type}'`);
  if (drift6.type === 'TRUE DRIFT') { 
    passed++; 
    console.log('  ✓ PASS: constitutional violation = TRUE DRIFT'); 
  } else { failed++; console.log('  ✗ FAIL: expected TRUE DRIFT'); }

  // Test 7: detectDrift EVIDENCE GAP
  console.log('\nTest 7: detectDrift() returns EVIDENCE GAP for missing constitutional');
  const lattice7 = new ConstraintLattice();
  lattice7.addToConstitution('REQUIRED_EVIDENCE');
  
  const drift7 = lattice7.detectDrift(
    new Set(['OTHER']),
    new Set(['REQUIRED_EVIDENCE'])
  );
  console.assert(drift7.type === 'EVIDENCE GAP', `Expected 'EVIDENCE GAP', got '${drift7.type}'`);
  if (drift7.type === 'EVIDENCE GAP') { 
    passed++; 
    console.log('  ✓ PASS: missing constitutional = EVIDENCE GAP'); 
  } else { failed++; console.log('  ✗ FAIL: expected EVIDENCE GAP'); }

  // Test 8: detectDrift INTERPRETATION DRIFT
  console.log('\nTest 8: detectDrift() returns INTERPRETATION DRIFT for multiple violations');
  const lattice8 = new ConstraintLattice();
  
  const drift8 = lattice8.detectDrift(
    new Set(['A', 'B', 'C', 'D']),
    new Set(['A', 'B'])
  );
  console.assert(drift8.type === 'INTERPRETATION DRIFT', `Expected 'INTERPRETATION DRIFT', got '${drift8.type}'`);
  if (drift8.type === 'INTERPRETATION DRIFT') { 
    passed++; 
    console.log('  ✓ PASS: multiple violations = INTERPRETATION DRIFT'); 
  } else { failed++; console.log('  ✗ FAIL: expected INTERPRETATION DRIFT'); }

  // Test 9: Governance lattice creation
  console.log('\nTest 9: createGovernanceLattice() includes constitutional invariants');
  const govLattice = createGovernanceLattice();
  console.assert(govLattice.constitution.has('STRUCTURE_OVER_IDENTITY'), 'Should have STRUCTURE_OVER_IDENTITY');
  console.assert(govLattice.constitution.has('CORRECTION_MANDATORY'), 'Should have CORRECTION_MANDATORY');
  console.assert(govLattice.constitution.has('AGENT_NOT_PART_OF_WE'), 'Should have AGENT_NOT_PART_OF_WE');
  console.assert(govLattice.constitution.has('SINGLE_ENTRY_POINT'), 'Should have SINGLE_ENTRY_POINT');
  if (govLattice.constitution.size === 4) { 
    passed++; 
    console.log('  ✓ PASS: all 4 constitutional invariants present'); 
  } else { failed++; console.log('  ✗ FAIL: missing constitutional invariants'); }

  // Test 10: Deformation log
  console.log('\nTest 10: detectDrift() logs deformation');
  const lattice10 = new ConstraintLattice();
  lattice10.detectDrift(new Set(['A']), new Set(['B']));
  console.assert(lattice10.getDeformationLog().length === 1, 'Should log deformation');
  if (lattice10.getDeformationLog().length === 1) { 
    passed++; 
    console.log('  ✓ PASS: deformation logged'); 
  } else { failed++; console.log('  ✗ FAIL: should log deformation'); }

  // Test 11: Deformation score (Paper D)
  console.log('\nTest 11: calculateDeformationScore() provides Paper D metrics');
  const lattice11 = new ConstraintLattice();
  lattice11.addToConstitution('CONSTITUTIONAL');
  
  const score11 = lattice11.calculateDeformationScore(
    new Set(['CONSTITUTIONAL', 'OTHER']),
    new Set(['EXPECTED'])
  );
  console.assert(score11.score > 0, 'Should have positive score');
  console.assert(score11.severity === 'TRUE DRIFT', `Expected 'TRUE DRIFT', got '${score11.severity}'`);
  console.assert(score11.paperDReference.includes('lattice deformation'), 'Should reference Paper D');
  if (score11.severity === 'TRUE DRIFT' && score11.paperDReference) { 
    passed++; 
    console.log('  ✓ PASS: deformation score with Paper D reference'); 
  } else { failed++; console.log('  ✗ FAIL: expected Paper D deformation metrics'); }

  // Test 12: Deformation score for minor drift
  console.log('\nTest 12: calculateDeformationScore() classifies minor drift');
  const lattice12 = new ConstraintLattice();
  
  const score12 = lattice12.calculateDeformationScore(
    new Set(['A']),
    new Set(['A', 'B'])
  );
  console.assert(score12.severity === 'EVIDENCE GAP' || score12.severity === 'MINOR', `Got '${score12.severity}'`);
  if (score12.score > 0) { 
    passed++; 
    console.log('  ✓ PASS: minor drift scored correctly'); 
  } else { failed++; console.log('  ✗ FAIL: should score minor drift'); }

  // Summary
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  return { passed, failed };
}

module.exports = { runTests };

// Run if called directly
if (require.main === module) {
  const { passed, failed } = runTests();
  if (failed > 0) {
    console.log(`\n${failed} tests failed. Fix before claiming lattice alignment.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed. Formalization progressing.`);
    process.exit(0);
  }
}
