// src/orchestrator/recoveryEngine.ts
// ---------------------------------------------------
// Deterministic recovery engine for lane-consistency enforcement.
// Implements: Quarantine-Compare-Rewind cycle.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { addToQuarantine, QuarantineEntry } from './quarantineStore';
import { loadPhenotype, savePhenotype, Phenotype } from './phenotypeStore';
import { auditLog } from "./logger";

const TRUST_STORE_PATH = path.resolve('S:/Archivist-Agent/.trust/keys.json');
const HANDOFF_SIGNAL_FILE = path.resolve('S:/Archivist-Agent/AGENT_HANDOFF_REQUIRED.md');
const QUARANTINE_MAX_RETRIES = 3;
const QUARANTINE_BACKOFF_MS = 5000;

interface RecoveryRequest {
  artifact: any;
  outerLane: string;
  failureReason: string;
  debugContext?: any;
}

interface RecoveryResult {
  status: 'OK' | 'QUARANTINED' | 'SIGNATURE_MISMATCH' | 'QUARANTINE_MAX_RETRIES';
  reason?: string;
  quarantineId?: string;
  retryCount?: number;
  nextRetryIn?: number;
  handoffRequired?: boolean;
}

interface TrustStore {
  version: string;
  keys: Record<string, { key_id: string; public_key_pem: string; revoked_at?: string }>;
  phenotypes?: Record<string, { hash: string; last_sync: string }>;
  migration?: { jws_only_start: string };
}

function loadTrustStore(): TrustStore | null {
  try {
    if (!fs.existsSync(TRUST_STORE_PATH)) return null;
    const raw = fs.readFileSync(TRUST_STORE_PATH, 'utf8');
    return JSON.parse(raw) as TrustStore;
  } catch (e) {
    return null;
  }
}

function getPublicKey(trustStore: TrustStore, laneId: string): string | null {
  const entry = trustStore.keys?.[laneId];
  if (!entry) return null;
  if (entry.revoked_at) return null;
  return entry.public_key_pem;
}

function verifySignature(payload: any, signature: string, publicKeyPem: string): boolean {
  try {
    const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());
    const signatureBuffer = Buffer.from(signature, 'base64');
    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(payloadStr),
      { key: publicKeyPem, format: 'pem' },
      signatureBuffer
    );
    return verified;
  } catch (e) {
    return false;
  }
}

function writeHandoffSignal(entry: QuarantineEntry, retryCount: number): void {
  const content = `# AGENT HANDOFF REQUIRED

**Status:** Quarantine max retries exceeded
**Quarantine ID:** ${entry.id}
**Outer Lane:** ${entry.outerLane}
**Payload Lane:** ${entry.artifact?.lane || 'MISSING'}
**Failure Reason:** ${entry.failureReason}
**Retry Count:** ${retryCount}
**Timestamp:** ${entry.timestamp}

## Action Required
Review the quarantined artifact and decide:
1. Release with manual approval
2. Permanently reject
3. Force phenotype sync

## Debug Context
\`\`\`json
${JSON.stringify(entry.debugContext || {}, null, 2)}
\`\`\`
`;
  fs.writeFileSync(HANDOFF_SIGNAL_FILE, content);
}

interface RetryState {
  count: number;
  lastAttempt: Date;
}

const retryStates = new Map<string, RetryState>();

export async function handleRecovery(request: RecoveryRequest): Promise<RecoveryResult> {
  const { artifact, outerLane, failureReason, debugContext } = request;

  // Step 1: Validate payload.lane exists
  const payloadLane = artifact?.lane;
  if (!payloadLane) {
    const entry: QuarantineEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      artifact,
      outerLane,
      failureReason: 'MISSING_LANE',
      debugContext: { ...debugContext, expectedLane: outerLane }
    };
    addToQuarantine(entry);
    // Normalize to QUARANTINED for public API
    return { status: 'QUARANTINED', reason: 'MISSING_LANE', quarantineId: entry.id };
  }

  // Step 2: Check lane consistency (Invariant: A = B)
  if (payloadLane !== outerLane) {
    const entry: QuarantineEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      artifact,
      outerLane,
      failureReason: 'LANE_MISMATCH',
      debugContext: { ...debugContext, payloadLane, outerLane }
    };
    addToQuarantine(entry);
    return { status: 'QUARANTINED', reason: `LANE_MISMATCH: ${payloadLane} != ${outerLane}`, quarantineId: entry.id };
  }

  // Step 3: Load trust store and get public key
  const trustStore = loadTrustStore();
  if (!trustStore) {
    const entry: QuarantineEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      artifact,
      outerLane,
      failureReason: 'TRUST_STORE_MISSING',
      debugContext
    };
    addToQuarantine(entry);
    return { status: 'QUARANTINED', reason: 'Trust store not found', quarantineId: entry.id };
  }

  const publicKey = getPublicKey(trustStore, payloadLane);
  if (!publicKey) {
    const entry: QuarantineEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      artifact,
      outerLane,
      failureReason: 'KEY_NOT_FOUND',
      debugContext: { ...debugContext, lane: payloadLane }
    };
    addToQuarantine(entry);
    return { status: 'QUARANTINED', reason: `No public key for lane: ${payloadLane}`, quarantineId: entry.id };
  }

  // Step 4: Verify signature
  const signature = artifact.signature;
  if (!signature) {
    const entry: QuarantineEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      artifact,
      outerLane,
      failureReason: 'MISSING_SIGNATURE',
      debugContext
    };
    addToQuarantine(entry);
    return { status: 'QUARANTINED', reason: 'Missing signature', quarantineId: entry.id };
  }

  const isValid = verifySignature(artifact, signature, publicKey);
  if (!isValid) {
    // Check retry state
    const artifactId = artifact.id || signature.slice(0, 16);
    let retryState = retryStates.get(artifactId) || { count: 0, lastAttempt: new Date() };
    retryState.count++;
    retryState.lastAttempt = new Date();
    retryStates.set(artifactId, retryState);

    if (retryState.count >= QUARANTINE_MAX_RETRIES) {
      const entry: QuarantineEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        artifact,
        outerLane,
        failureReason: 'SIGNATURE_MISMATCH',
        debugContext: { ...debugContext, retryCount: retryState.count }
      };
      addToQuarantine(entry);
      writeHandoffSignal(entry, retryState.count);
      return { 
        status: 'QUARANTINE_MAX_RETRIES', 
        reason: 'Signature verification failed after max retries', 
        quarantineId: entry.id,
        retryCount: retryState.count,
        handoffRequired: true
      };
    }

  const entry: QuarantineEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    artifact,
    outerLane,
    failureReason: 'SIGNATURE_MISMATCH',
    debugContext: { ...debugContext, retryCount: retryState.count }
  };
  addToQuarantine(entry);

  // Calculate backoff for next retry
  const backoffMs = QUARANTINE_BACKOFF_MS * retryState.count;

  return {
    status: 'SIGNATURE_MISMATCH',
    reason: 'Signature verification failed',
    quarantineId: entry.id,
    retryCount: retryState.count,
    nextRetryIn: backoffMs
  };
}

  // Step 5: Success - update phenotype
  const currentPhenotype: Phenotype = {
    trustStoreVersion: trustStore.version,
    trustStore: trustStore,
    migrationMode: trustStore.migration?.jws_only_start ? 'jws-only' : 'dual',
    updatedAt: new Date().toISOString()
  };
  savePhenotype(currentPhenotype);

  // Clear any retry state for this artifact
  const artifactId = artifact.id || signature.slice(0, 16);
  retryStates.delete(artifactId);

  return { status: 'OK' };
}

export function getRetryState(artifactId: string): RetryState | undefined {
  return retryStates.get(artifactId);
}

export function clearRetryState(artifactId: string): void {
  retryStates.delete(artifactId);
}
