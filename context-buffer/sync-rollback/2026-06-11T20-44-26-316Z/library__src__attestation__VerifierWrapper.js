/**
* VerifierWrapper.js - Phase 4.4 Unified Verification Entry Point
*
* COPIED FROM: Archivist-Agent/src/attestation/VerifierWrapper.js
* VERSION: 1.0
* LAST_SYNC: 2026-04-19
*
* Wraps Verifier.verifyQueueItem() and orchestrates quarantine loop.
* Enforces: Identity checks BEFORE crypto verification.
* Implements: Quarantine-Compare-Rewind cycle on failure.
*
* INTEGRATION: Optionally submits failures to RecoveryEngine via RecoveryClient.
* DO NOT MODIFY - changes must be synced from Archivist.
*/

const { Verifier } = require('./Verifier');
const { QuarantineManager } = require('./QuarantineManager');
const { PhenotypeStore } = require('./PhenotypeStore');
const { VERIFY_REASON } = require('./constants');
const { RecoveryClient, submitToRecoveryEngine } = require('./RecoveryClient');

class VerifierWrapper {
constructor(options = {}) {
this.verifier = options.verifier || new Verifier(options);
this.quarantineManager = options.quarantineManager || new QuarantineManager(options);
this.phenotypeStore = options.phenotypeStore || new PhenotypeStore(options);
this.onQuarantineRetry = options.onQuarantineRetry || null;

// RecoveryEngine integration (optional), but never policy-toggleable.
// If a client is provided, submission is always attempted.
this.recoveryClient = options.recoveryClient || null;
}

async verify(item) {
if (!item.signature) {
return this._handleFailure(item, VERIFY_REASON.MISSING_SIGNATURE,
'No signature provided - REJECTED (no fallback)', null);
}

// Step 1: Get outer lane from envelope (A)
const outerLane = item.lane || item.origin_lane;

if (!outerLane) {
return this._handleFailure(item, VERIFY_REASON.MISSING_LANE,
'Outer envelope missing lane field', null);
}

// Step 2: Parse JWS without trusting it yet (protected from throw)
let parsed;
try {
  parsed = this.verifier._parseJWS(item.signature);
} catch (e) {
  return this._handleFailure(item, VERIFY_REASON.SIGNATURE_MISMATCH,
    `Malformed JWS: ${e.message}`, outerLane);
}
if (!parsed) {
return this._handleFailure(item, VERIFY_REASON.SIGNATURE_MISMATCH,
'Invalid JWS format', outerLane);
}

// Step 3: Extract signed payload lane (B)
const payloadLane = parsed.payload?.lane;

// Step 4: Require payloadLane exists
if (!payloadLane) {
return this._handleFailure(item, VERIFY_REASON.MISSING_LANE,
'Signed payload missing lane field', outerLane);
}

// Step 5: Compare lanes (A = B enforcement, before crypto)
if (payloadLane !== outerLane) {
return this._handleFailure(item, VERIFY_REASON.LANE_MISMATCH,
`Signed payload lane (${payloadLane}) differs from outer lane (${outerLane})`, outerLane);
}

// Step 6: Only NOW fetch the key for the agreed lane (C = A = B)
const publicKey = this.verifier.getPublicKey(payloadLane);
if (!publicKey) {
return this._handleFailure(item, VERIFY_REASON.KEY_NOT_FOUND,
`No public key for lane: ${payloadLane}`, outerLane);
}

// Step 7: Verify crypto (after identity is settled)
const result = this.verifier.verify(item.signature, publicKey);

if (!result.valid) {
return this._handleFailure(item, result.error, result.error, outerLane);
}

this.phenotypeStore.setLastSync(outerLane, {
lane: outerLane,
verified_at: new Date().toISOString(),
key_id: result.header?.kid || 'unknown'
});

const quarantinedId = item.id || item.signature?.slice(0, 16);
if (
  quarantinedId &&
  typeof this.quarantineManager.isQuarantined === 'function' &&
  this.quarantineManager.isQuarantined(quarantinedId) &&
  typeof this.quarantineManager.release === 'function'
) {
this.quarantineManager.release(quarantinedId);
}

return { ...result, mode: 'JWS_VERIFIED' };
}

async _handleFailure(item, reason, note, outerLane) {
const itemId = item.id || item.signature?.slice(0, 16) || `unknown-${Date.now()}`;
const lane = outerLane || item.origin_lane || item.lane || 'unknown';

const quarantineResult = this.quarantineManager.quarantine(item, reason);

// Submit to RecoveryEngine if client configured
if (this.recoveryClient) {
try {
const recoveryResult = await submitToRecoveryEngine(
this,
this.recoveryClient,
item,
lane,
{ valid: false, reason, note, itemId, lane }
);

// RecoveryEngine CANNOT override local deterministic failure
// "Provable" guarantees require this to be locally verifiable
// If RecoveryEngine says OK, we log but still REJECT
console.log('[RECOVERY] RecoveryEngine response ignored - local verification is authoritative');
console.log('[RECOVERY] Status:', recoveryResult.status);
console.log('[RECOVERY] Local reason:', reason);

// RecoveryEngine returned a definitive status
if (recoveryResult.quarantineId) {
return {
valid: false,
reason: recoveryResult.status || reason,
note,
itemId,
lane,
recoveryId: recoveryResult.quarantineId,
retryCount: recoveryResult.retryCount,
handoffRequired: recoveryResult.handoffRequired
};
}
} catch (e) {
// RecoveryEngine unreachable - FATAL FAILURE
console.error('[FATAL] RecoveryEngine unreachable - cannot enforce deterministic guarantee');
console.error(' Error:', e.message);
console.error(' Item ID:', itemId);
console.error(' Lane:', lane);

// Attempt handoff signal via QuarantineManager public API;
// never call private methods that may not survive refactors.
 if (typeof this.quarantineManager._signalHumanIntervention === 'function') {
try {
this.quarantineManager._signalHumanIntervention(itemId, lane, 'ORCHESTRATOR_UNREACHABLE', 0);
} catch (signalErr) {
console.error('[FATAL] Handoff signal also failed:', signalErr.message);
}
} else {
// Structured fallback: write handoff file directly so the signal
// is never lost even if QuarantineManager is refactored away.
const fs = require('fs');
const handoffPath = this.quarantineManager.handoffFile || 'AGENT_HANDOFF_REQUIRED.md';
try {
 fs.writeFileSync(handoffPath, [
 '# AGENT HANDOFF REQUIRED', '',
 '**Status:** Orchestrator unreachable - fatal rejection',
 `**Item ID:** ${itemId}`,
 `**Lane:** ${lane}`,
 `**Reason:** ORCHESTRATOR_UNREACHABLE`,
 `**Timestamp:** ${new Date().toISOString()}`, '',
 '## Action Required',
 '1. Verify RecoveryEngine availability',
 '2. Re-submit artifact after orchestrator recovery',
 '3. Permanently reject if orchestrator is decommissioned', ''
 ].join('\n'), 'utf8');
 } catch (writeErr) {
 console.error('[FATAL] Could not write handoff file:', writeErr.message);
 }
 }

 // HALT - return hard failure, do NOT fallback to local quarantine
 return {
 valid: false,
 reason: 'ORCHESTRATOR_UNREACHABLE',
 note: 'RecoveryEngine unreachable - cannot verify artifact deterministically',
 itemId,
 lane,
 handoffRequired: true,
 handoffFile: this.quarantineManager.handoffFile,
 fatal: true
 };
}
}

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
