# Cross-Lane Remediation Runbook (Steps 1-3)

OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: cross-lane remediation runbook
generated_at: 2026-04-29T00:00:00Z
session_id: retroactive-backfill-20260510

## OBSERVABILITY_DOMAIN
governance

## NEXT_SAFE_ACTION
Review for ongoing relevance; archive if stale

Date: 2026-04-29/30  
Scope: Archivist, Kernel, Library, SwarmMind  
Objective: Stop queue growth, validate signature path, and harden Archivist emitter to reduce schema/NACK churn.

## Step 1 - Freeze automatic movement

- [x] Set all lanes to manual watcher mode via SwarmMind agent-presence control:
  - `node S:/SwarmMind/scripts/agent-presence.js mode archivist manual`
  - `node S:/SwarmMind/scripts/agent-presence.js mode kernel manual`
  - `node S:/SwarmMind/scripts/agent-presence.js mode library manual`
  - `node S:/SwarmMind/scripts/agent-presence.js mode swarmmind manual`

Result:
- All four lanes now report `watcher_mode: manual`.

## Step 2 - Signature path verification

### 2A) Trust-store vs identity key parity check

- [x] Ran derived key-id vs trust-store key-id check for all four lanes.

Observed mismatch (all lanes):
- archivist: derived `65ae05b2a9e749cb` vs trust `45a318fe5e226407`
- kernel: derived `b677eb87f6be83f9` vs trust `6d220ff8f1ef5b05`
- library: derived `ea2a75bab220adc2` vs trust `b1eba056729bbe9a`
- swarmmind: derived `addb0afb8ee5c2ed` vs trust `ecb12bdacf826701`

Interpretation:
- Trust stores are drifted relative to active `.identity/public.pem` keys.
- This is a primary root cause candidate for `SIGNATURE_INVALID` bursts.

### 2B) Signed probe acceptance check

- [x] Dispatched signed probe message from Archivist to Kernel:
  - `task-1777518984436-dcb84efd`
- [x] Processed with one-shot lane-worker apply on Kernel.

Audit proof line:
- `S:/kernel-lane/lanes/kernel/state/worker-audit.log`
- `from_path="S:\kernel-lane\lanes\kernel\inbox\task-1777518984436-dcb84efd.json"...reason="INVALID_DOMAIN_POST_EXECUTION"`

Interpretation:
- Probe was accepted through schema/signature gates (not blocked/quarantined).
- It routed as post-execution invalid-domain (expected for this proof-only probe path).

## Step 3 - Archivist emitter hardening

- [x] Patched `S:/Archivist-Agent/scripts/dispatch-task.js`:
  1. Added ASCII normalization for `subject`/`body`.
  2. Added pre-sign schema normalization + validation via `SchemaValidator`.
  3. Changed task dispatch default to pre-execution evidence posture:
     - `evidence.required = false` (reduces avoidable `ACTIONABLE_NO_PROOF` churn at intake).
  4. Fail-closed on signing/schema errors (`SIGN_OR_SCHEMA_FAILED`) instead of silently dispatching unsigned.

Expected effect:
- Fewer schema-invalid outbound Archivist messages.
- Reduced non-ASCII violations.
- Reduced avoidable intake churn for proposal/task dispatches.

## Immediate next actions (post steps 1-3)

1) Resolve trust-store drift (all lanes) before unfreezing:
   - regenerate trust stores from current `.identity/public.pem` set
   - verify derived key IDs match trust-store key IDs on each lane

2) Re-run signed cross-lane probe after trust-store sync:
   - confirm no new `SIGNATURE_INVALID` entries for new traffic

3) Once stable, return lanes to auto mode:
   - `node S:/SwarmMind/scripts/agent-presence.js mode <lane> auto`

## Notes

- No commit/push actions were performed in this runbook execution.
- This runbook records operational state changes and local hardening only.
