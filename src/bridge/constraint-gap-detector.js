/**
 * Constraint Gap Detector (Phase A: OBSERVE-only)
 *
 * Purpose:
 * Detect candidate constraint gaps from repeated signals without broadcasting
 * proposals in Phase A. This enforces amendment L3: observe first, propose later.
 */

const PRIORITY_BY_GAP_TYPE = {
  CONSTRAINT_GAP: 'P0',
  DELEGATION_GAP: 'P0',
  CHECKPOINT_GAP: 'P1',
  SCHEMA_GAP: 'P2',
  EVIDENCE_GAP: 'P2'
};

const VALID_GAP_TYPES = new Set(Object.keys(PRIORITY_BY_GAP_TYPE));
const VALID_CONFIDENCE = new Set(['LOW', 'MEDIUM', 'HIGH']);

class ConstraintGapDetector {
  constructor(options = {}) {
    this.proposalModeEnabled = false; // Phase A guardrail: starts OFF.
    this.gapLog = [];
    this.now = options.now || (() => new Date().toISOString());
  }

  /**
   * Enable proposal mode for Phase B+ use.
   * This does not deliver messages; it only allows draft generation APIs.
   */
  enableProposalMode() {
    this.proposalModeEnabled = true;
  }

  disableProposalMode() {
    this.proposalModeEnabled = false;
  }

  /**
   * Scan incoming raw signals and normalize into candidate gaps.
   * Phase A requirement: NO delivery side effects.
   *
   * Library L1/L3 alignment:
   * - Missing evidence_path => forced LOW confidence
   * - Unverified signals default to LOW
   */
  scanForGaps(rawSignals = []) {
    if (!Array.isArray(rawSignals)) {
      throw new Error('scanForGaps expects an array');
    }

    const candidates = rawSignals
      .map((signal, index) => this.#normalizeSignal(signal, index))
      .filter(Boolean);

    if (candidates.length > 0) {
      this.gapLog.push({
        observed_at: this.now(),
        count: candidates.length,
        candidates
      });
    }

    return candidates;
  }

  /**
   * Return in-memory OBSERVE log for Phase A validation.
   */
  getGapLog() {
    return [...this.gapLog];
  }

  clearGapLog() {
    this.gapLog = [];
  }

  /**
   * Generate proposal drafts for Phase B+.
   * Guarded by enableProposalMode(); still no side effects or delivery.
   */
  generateProposalDrafts(candidates = []) {
    if (!this.proposalModeEnabled) {
      throw new Error('Proposal mode is disabled (Phase A OBSERVE-only)');
    }

    if (!Array.isArray(candidates)) {
      throw new Error('generateProposalDrafts expects an array');
    }

    return candidates
      .filter((c) => c.confidence === 'HIGH' || c.confidence === 'MEDIUM')
      .map((c) => ({
        proposal_id: `gap-${c.gap_type.toLowerCase()}-${Date.now()}`,
        gap_type: c.gap_type,
        priority: c.priority,
        confidence: c.confidence,
        evidence_path: c.evidence_path,
        source_nfm_ids: c.source_nfm_ids,
        hypothesis: c.hypothesis || null,
        status: 'CANDIDATE_CONSTRAINT',
        generated_at: this.now()
      }));
  }

  #normalizeSignal(signal, index) {
    if (!signal || typeof signal !== 'object') return null;

    const gapType = VALID_GAP_TYPES.has(signal.gap_type) ? signal.gap_type : null;
    if (!gapType) return null;

    const hasEvidencePath = typeof signal.evidence_path === 'string' && signal.evidence_path.trim().length > 0;
    const verified = Boolean(signal.verified);

    // L1: unverified/missing evidence defaults to LOW.
    let confidence = VALID_CONFIDENCE.has(signal.confidence) ? signal.confidence : 'LOW';
    if (!verified || !hasEvidencePath) {
      confidence = 'LOW';
    }

    return {
      candidate_id: signal.candidate_id || `candidate-${index + 1}`,
      gap_type: gapType,
      priority: PRIORITY_BY_GAP_TYPE[gapType],
      confidence,
      verified,
      evidence_path: hasEvidencePath ? signal.evidence_path : null,
      source_nfm_ids: Array.isArray(signal.source_nfm_ids) ? signal.source_nfm_ids : [],
      hypothesis: typeof signal.hypothesis === 'string' ? signal.hypothesis : null,
      observed_at: this.now()
    };
  }
}

module.exports = {
  ConstraintGapDetector,
  PRIORITY_BY_GAP_TYPE
};
