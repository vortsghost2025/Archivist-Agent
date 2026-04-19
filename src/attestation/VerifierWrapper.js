/**
 * VerifierWrapper.js - Phase 4.4 Unified Verification Entry Point
 *
 * Wraps Verifier.verifyQueueItem() and orchestrates quarantine loop.
 * Enforces: Identity checks BEFORE crypto verification.
 * Implements: Quarantine-Compare-Rewind cycle on failure.
 */

const { Verifier } = require('./Verifier');
const { QuarantineManager } = require('./QuarantineManager');
const { PhenotypeStore } = require('./PhenotypeStore');
const { VERIFY_REASON } = require('./constants');

class VerifierWrapper {
  constructor(options = {}) {
    this.verifier = options.verifier || new Verifier(options);
    this.quarantineManager = options.quarantineManager || new QuarantineManager(options);
    this.phenotypeStore = options.phenotypeStore || new PhenotypeStore(options);
    this.onQuarantineRetry = options.onQuarantineRetry || null;
  }

  async verify(item) {
    if (!item.signature) {
      const cutoff = this.verifier.hmacCutoffDate;
      const now = new Date();
      if (now < cutoff) {
        return { 
          valid: true, 
          mode: 'HMAC_ACCEPTED_DUAL_MODE', 
          warning: 'Signature missing but dual-mode active' 
        };
      }
      return { 
        valid: false, 
        reason: VERIFY_REASON.MISSING_SIGNATURE, 
        error: 'SIGNATURE_REQUIRED' 
      };
    }

    // Delegate to Verifier.verifyQueueItem which now implements:
    // 1. Parse JWS (without trusting)
    // 2. Extract signedPayloadLane from parsed JWS
    // 3. Require signedPayloadLane exists
    // 4. Compare signedPayloadLane to outerLane
    // 5. Fetch key for agreed lane
    // 6. Verify crypto
    const result = this.verifier.verifyQueueItem(item);

    if (!result.valid) {
      // Identity failures (MISSING_LANE, LANE_MISMATCH) should NOT go through quarantine
      // They are deterministic policy violations, not crypto failures
      const identityReasons = [VERIFY_REASON.MISSING_LANE, VERIFY_REASON.LANE_MISMATCH];
      if (identityReasons.includes(result.reason)) {
        return {
          valid: false,
          reason: result.reason,
          note: result.note,
          lane: item.origin_lane || item.lane
        };
      }
      // Crypto failures go through quarantine loop
      return this._handleFailure(item, result.reason || result.error, result.note);
    }

    // Success: update phenotype
    const laneId = result.payload?.lane || item.origin_lane || item.lane;
    if (laneId) {
      this.phenotypeStore.setLastSync(laneId, { 
        lane: laneId, 
        verified_at: new Date().toISOString(),
        key_id: result.header?.kid || 'unknown'
      });
    }

    // Release from quarantine if previously quarantined
    const quarantinedId = item.id || item.signature?.slice(0, 16);
    if (quarantinedId && this.quarantineManager.isQuarantined(quarantinedId)) {
      this.quarantineManager.release(quarantinedId);
    }

    return { ...result, mode: 'JWS_VERIFIED' };
  }

  _handleFailure(item, reason, note) {
    const itemId = item.id || item.signature?.slice(0, 16) || `unknown-${Date.now()}`;
    const lane = item.origin_lane || item.lane || 'unknown';

    const quarantineResult = this.quarantineManager.quarantine(item, reason);

    if (quarantineResult.handoffRequired) {
      return {
        valid: false,
        reason: VERIFY_REASON.QUARANTINE_MAX_RETRIES,
        note,
        itemId,
        lane,
        handoffRequired: true,
        handoffFile: this.quarantineManager.handoffFile
      };
    }

    if (this.onQuarantineRetry) {
      this.quarantineManager.scheduleRetry(itemId, async (quarantinedItem) => {
        await this.onQuarantineRetry(quarantinedItem, quarantineResult.retryCount);
      });
    }

    return {
      valid: false,
      reason: VERIFY_REASON.QUARANTINED,
      note,
      itemId,
      lane,
      retryCount: quarantineResult.retryCount,
      nextRetryIn: quarantineResult.nextRetryIn
    };
  }

  async compareAndSync(laneId, currentState) {
    const comparison = this.phenotypeStore.compareWithLast(laneId, currentState);
    
    if (!comparison.match) {
      console.log(`[VerifierWrapper] Phenotype drift detected for ${laneId}: ${comparison.reason}`);
      return {
        needsSync: true,
        lastHash: comparison.last_hash,
        currentHash: comparison.current_hash,
        lastSync: comparison.last_sync
      };
    }

    return { needsSync: false, hash: comparison.currentHash };
  }

  forceRelease(itemId) {
    const entry = this.quarantineManager.getQuarantineStatus(itemId);
    if (!entry) {
      return { success: false, reason: 'NOT_IN_QUARANTINE' };
    }

    this.quarantineManager.clearHandoffSignal();
    return this.quarantineManager.release(itemId);
  }

  getMetrics() {
    return {
      quarantine: this.quarantineManager.getMetrics(),
      phenotypes: this.phenotypeStore.getAllPhenotypes()
    };
  }
}

module.exports = { VerifierWrapper };
