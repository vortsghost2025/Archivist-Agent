// src/orchestrator/api.ts
// ---------------------------------------------------
// HTTP handler for the Archivist recovery orchestrator.
// Exposes POST /orchestrate/recovery endpoint.
//
// Invariants enforced:
// - payload.lane must exist
// - payload.lane must equal outerLane
// - All branches returning QUARANTINED write to QuarantineStore

import { Request, Response } from 'express';
import { handleRecovery } from './recoveryEngine';

export interface RecoveryRequest {
  artifact: any;
  outerLane: string;
  failureReason: string;
  debugContext?: any;
}

export async function recoveryHandler(req: Request, res: Response) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { artifact, outerLane, failureReason, debugContext } = req.body;

    // Validate required fields
    if (!artifact) {
      return res.status(400).json({ error: 'Missing required field: artifact' });
    }
    if (!outerLane) {
      return res.status(400).json({ error: 'Missing required field: outerLane' });
    }
    if (!failureReason) {
      return res.status(400).json({ error: 'Missing required field: failureReason' });
    }

    const request: RecoveryRequest = { artifact, outerLane, failureReason, debugContext };
    const result = await handleRecovery(request);

    // Map result to appropriate HTTP status
    if (result.status === 'OK') {
      return res.json(result);
    } else if (result.status === 'MISSING_LANE' || result.status === 'LANE_MISMATCH') {
      return res.status(400).json(result);
    } else if (result.handoffRequired) {
      return res.status(500).json(result);
    } else {
      return res.status(422).json(result);
    }
  } catch (err) {
    console.error('[ORCHESTRATOR] Recovery handler error:', err);
    return res.status(500).json({ error: 'Internal orchestrator failure' });
  }
}

// Health check endpoint
export async function healthCheck(req: Request, res: Response) {
  return res.json({ status: 'healthy', service: 'orchestrator' });
}

// In the actual server bootstrap:
// app.post('/orchestrate/recovery', recoveryHandler);
// app.get('/orchestrate/health', healthCheck);
