/**
 * Constraint Lattice Implementation
 * 
 * Location: S:/Archivist-Agent/src/bridge/constraint-lattice.js
 * Purpose: Formal implementation of WE4FREE Paper B constraint lattice operations
 * 
 * This is not analogy - the governance stack IS this lattice.
 */

/**
 * ConstraintLattice - Bounded distributive lattice for governance constraints
 * 
 * Formal definition (Paper B):
 * ℒ = (C, ≤, ∧, ∨, ⊥, ⊤) where:
 * - C is set of constraints
 * - ≤ is "implies" (stronger constraint implies weaker)
 * - ∧ is meet (greatest lower bound - strongest common constraint)
 * - ∨ is join (least upper bound - weakest constraint implying both)
 * - ⊥ is bottom (maximal freedom)
 * - ⊤ is top (impossibility / contradiction)
 */
class ConstraintLattice {
  constructor() {
    this.constraints = new Set();      // All constraints
    this.order = new Map();            // a → {b | a ≤ b} (a implies b)
    this.constitution = new Set();     // Principal sublattice (hard invariants)
    this.deformationLog = [];          // Drift detection history
  }

  /**
   * Add a constraint to the lattice
   * @param {string} name - Constraint identifier
   * @param {Set<string>} implies - Set of constraints this implies
   */
  addConstraint(name, implies = new Set()) {
    this.constraints.add(name);
    this.order.set(name, new Set([name, ...implies])); // reflexive
    
    for (const imp of implies) {
      this.constraints.add(imp);
      if (!this.order.has(imp)) {
        this.order.set(imp, new Set([imp]));
      }
    }
  }

  /**
   * Add constraint to constitutional sublattice (hard invariant)
   * @param {string} name - Constraint name
   */
  addToConstitution(name) {
    if (!this.constraints.has(name)) {
      this.addConstraint(name);
    }
    this.constitution.add(name);
  }

  /**
   * Meet operation (∧) - Greatest lower bound
   * Returns the strongest constraint implied by both a and b
   * @param {string} a - First constraint
   * @param {string} b - Second constraint
   * @returns {string|null} - Meet result or null if incompatible
   */
  meets(a, b) {
    if (!this.constraints.has(a) || !this.constraints.has(b)) {
      return null;
    }

    const aImplies = this.order.get(a) || new Set();
    const bImplies = this.order.get(b) || new Set();
    const common = [...aImplies].filter(x => bImplies.has(x));

    if (common.length === 0) {
      return null; // No common constraint
    }

    // Return the strongest (most specific - implies the most)
    return common.reduce((strongest, current) => {
      const currentImplies = this.order.get(current) || new Set();
      const strongestImplies = this.order.get(strongest) || new Set();
      return currentImplies.size >= strongestImplies.size ? current : strongest;
    });
  }

  /**
   * Join operation (∨) - Least upper bound
   * Returns the weakest constraint that implies both a and b
   * @param {string} a - First constraint
   * @param {string} b - Second constraint
   * @returns {string} - Join result
   */
  joins(a, b) {
    if (!this.constraints.has(a) || !this.constraints.has(b)) {
      return null;
    }

    const aImplies = this.order.get(a) || new Set();
    const bImplies = this.order.get(b) || new Set();

    // If a implies b, a is the join
    if (aImplies.has(b)) return a;
    // If b implies a, b is the join
    if (bImplies.has(a)) return b;

    // Synthetic join - can be extended with proper join table
    return `${a}_OR_${b}`;
  }

  /**
   * Check if phenotype behavior respects constitutional sublattice
   * Maps to VERIFICATION_LANES + CHECKPOINTS
   * @param {Set<string>} phenotypeBehavior - Observed behavior
   * @returns {{respects: boolean, violation: string|null}}
   */
  respectsLattice(phenotypeBehavior) {
    for (const constraint of this.constitution) {
      const satisfies = [...phenotypeBehavior].some(behavior => {
        const behaviorImplies = this.order.get(behavior) || new Set();
        return behaviorImplies.has(constraint);
      });

      if (!satisfies) {
        return {
          respects: false,
          violation: constraint
        };
      }
    }

    return { respects: true, violation: null };
  }

  /**
   * Detect drift as lattice deformation
   * Maps to DISCREPANCY_ANALYZER 6 classifications
   * @param {Set<string>} observed - Observed constraints
   * @param {Set<string>} expected - Expected constraints
   * @returns {{hasDrift: boolean, type: string, details: string}}
   */
  detectDrift(observed, expected) {
    const observedSet = new Set(observed);
    const expectedSet = new Set(expected);

    // Check for violations
    const violations = [...observedSet].filter(x => !expectedSet.has(x));
    const missing = [...expectedSet].filter(x => !observedSet.has(x));

    if (violations.length === 0 && missing.length === 0) {
      return {
        hasDrift: false,
        type: null,
        details: 'No drift detected'
      };
    }

    // Classify drift type
    let type;
    let details;

    if (violations.some(v => this.constitution.has(v))) {
      type = 'TRUE DRIFT';
      details = `Constitutional constraint violated: ${violations.find(v => this.constitution.has(v))}`;
    } else if (missing.some(m => this.constitution.has(m))) {
      type = 'EVIDENCE GAP';
      details = `Missing constitutional evidence: ${missing.find(m => this.constitution.has(m))}`;
    } else if (violations.length > 2) {
      type = 'INTERPRETATION DRIFT';
      details = `Multiple constraint deviations: ${violations.join(', ')}`;
    } else if (violations.length === 1) {
      type = 'DIMENSION MISMATCH';
      details = `Unexpected constraint: ${violations[0]}`;
    } else {
      type = 'CHECK FAILURE';
      details = `Expected constraints not observed: ${missing.join(', ')}`;
    }

    // Log deformation
    this.deformationLog.push({
      timestamp: new Date().toISOString(),
      type,
      details,
      observed: [...observedSet],
      expected: [...expectedSet]
    });

    return { hasDrift: true, type, details };
  }

  /**
   * Get deformation log for observability
   * @returns {Array} - Deformation history
   */
  getDeformationLog() {
    return [...this.deformationLog];
  }

  /**
   * Clear deformation log (after correction)
   */
  clearDeformationLog() {
    this.deformationLog = [];
  }
}

/**
 * Create the Archivist-Agent governance lattice
 * This IS the constraint lattice from Paper B
 */
function createGovernanceLattice() {
  const lattice = new ConstraintLattice();

  // Constitutional constraints (hard invariants)
  // Maps to COVENANT.md + GOVERNANCE.md
  lattice.addToConstitution('STRUCTURE_OVER_IDENTITY');
  lattice.addToConstitution('CORRECTION_MANDATORY');
  lattice.addToConstitution('AGENT_NOT_PART_OF_WE');
  lattice.addToConstitution('SINGLE_ENTRY_POINT');

  // Operational constraints
  // Maps to VERIFICATION_LANES.md
  lattice.addConstraint('DUAL_VERIFICATION', new Set(['STRUCTURE_OVER_IDENTITY']));
  lattice.addConstraint('CHECKPOINT_PASS', new Set(['DUAL_VERIFICATION', 'CORRECTION_MANDATORY']));
  lattice.addConstraint('UDS_UNDER_THRESHOLD', new Set(['CHECKPOINT_PASS']));

  // Behavioral constraints
  // Maps to agent permissions
  lattice.addConstraint('READ_ALLOWED', new Set(['AGENT_NOT_PART_OF_WE']));
  lattice.addConstraint('WRITE_RESTRICTED', new Set(['AGENT_NOT_PART_OF_WE', 'CORRECTION_MANDATORY']));
  lattice.addConstraint('BASH_ASK', new Set(['AGENT_NOT_PART_OF_WE', 'STRUCTURE_OVER_IDENTITY']));

  // Phenotype constraints
  // Maps to SwarmMind agent roles
  lattice.addConstraint('PLANNER_ROLE', new Set(['READ_ALLOWED', 'DUAL_VERIFICATION']));
  lattice.addConstraint('CODER_ROLE', new Set(['READ_ALLOWED', 'WRITE_RESTRICTED', 'BASH_ASK']));
  lattice.addConstraint('DEBUG_ROLE', new Set(['READ_ALLOWED', 'WRITE_RESTRICTED']));
  lattice.addConstraint('ASK_ROLE', new Set(['READ_ALLOWED']));

  return lattice;
}

module.exports = {
  ConstraintLattice,
  createGovernanceLattice
};
