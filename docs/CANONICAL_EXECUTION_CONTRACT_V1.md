# Canonical Execution Contract v1

OUTPUT_PROVENANCE

agent: codex

model: GPT-5 Codex

lane: archivist

timestamp_utc: 2026-05-03T02:55:30.526Z

## Status

Draft for lane ratification. This document does not mutate trust stores, identities, authority approvals, or lane runtime code.

## Purpose

Unify the execution-aware pieces already present across the lanes into one shared contract. The audit verdict is PARTIAL: execution truth exists, but scheduling and load control are not yet unified.

## Required Runtime Signals

Each lane must expose: lane_id, heartbeat_age_seconds, worker_lock_owner, active_task_id, queue depths for inbox/action-required/in-progress/blocked/quarantine, processed_count, last_completion_at, execution_verified_count, execution_failed_count, last_quarantine_reason, and last_blocked_reason.

Each task route must expose: task_id, from, to, requires_action, target_queue, completion_proof_present, execution_verified, execution_verification.reason, artifact_path, artifact_exists, signature_valid, schema_valid, and routed_at.

## Hard Rules

### CEC-R1: Processed requires execution truth

No actionable message may enter processed/ unless completion-proof.js accepts proof and execution-gate.js resolves the referenced artifact or reference on disk.

Evidence modules: S:/Archivist-Agent/scripts/completion-proof.js, S:/Archivist-Agent/scripts/execution-gate.js, S:/Archivist-Agent/scripts/lane-worker.js

### CEC-R2: Transport is not execution

Relay delivery, inbox presence, signature validity, or schema validity must not be treated as task completion.

Evidence modules: S:/Archivist-Agent/scripts/relay-daemon.js, S:/Archivist-Agent/scripts/validate-responses.js

### CEC-R3: Actionable pending artifacts are not blocked pre-execution

A new requires_action=true task with an expected artifact path routes to action-required/ or in-progress/, not blocked/, until the lane has had a chance to execute it.

Evidence modules: S:/Archivist-Agent/scripts/lane-worker.js

### CEC-R4: Single governor per lane

A lane may have one governing worker lock holder. Observer sessions must not acquire the governing lock or overwrite primary heartbeat.

Evidence modules: S:/Archivist-Agent/scripts/concurrency-policy.js, S:/Archivist-Agent/scripts/inbox-watcher.js

### CEC-R5: Heartbeat truth over stability

Stale, missing, malformed, or contradictory heartbeat/state signals must degrade status instead of reporting consistency.

Evidence modules: S:/Archivist-Agent/scripts/recovery-test-suite.js, S:/Archivist-Agent/scripts/auto-recover-stale-lanes.ps1

### CEC-R6: Compaction is recovery, not scheduling

Post-compact audit is a fallback safety boundary. It must not be the primary mechanism for load control or agent fan-out control.

Evidence modules: S:/Archivist-Agent/scripts/post-compact-audit.js, S:/Archivist-Agent/scripts/run-compact-with-audit.js

### CEC-R7: Execution graph must be explicit

Structural graph visibility must be separated from actual runtime usage. RuntimeProbe/usage reports may mark active, dormant, dead, or unproven components.

Evidence modules: S:/self-organizing-library/src/usage/RuntimeProbe.js, S:/self-organizing-library/src/usage/UsageGateEnforcer.js

## Soft Rules

### CEC-S1: Standard runtime health panel

All lanes should emit one compact health snapshot consumable by stable-health-panel.ps1 or equivalent.

### CEC-S2: One shared execution summary schema

All lane-workers should report the same execution counters even when implementation remains lane-specific.

### CEC-S3: Schedule from execution signals

Future dispatch should prioritize lanes/tasks by live queue depth, stale heartbeat status, blocked/quarantine count, and recent verified completions.

## Ratification Request

Each lane should return canonical-execution-contract-v1-review-{lane}.json, with: ACK/mismatch, implementation gaps, clause conflicts, and evidence path.

## Evidence Paths

- S:/Archivist-Agent/scripts/execution-gate.js
- S:/Archivist-Agent/scripts/lane-worker.js
- S:/Archivist-Agent/scripts/validate-responses.js
- S:/Archivist-Agent/scripts/concurrency-policy.js
- S:/Archivist-Agent/scripts/inbox-watcher.js
- S:/Archivist-Agent/scripts/recovery-test-suite.js
- S:/Archivist-Agent/scripts/post-compact-audit.js
- S:/Archivist-Agent/scripts/relay-daemon.js
- S:/Archivist-Agent/scripts/task-executor.js
- S:/Archivist-Agent/scripts/auto-recover-stale-lanes.ps1
- S:/self-organizing-library/src/usage/RuntimeProbe.js
- S:/self-organizing-library/src/usage/UsageGateEnforcer.js
- S:/self-organizing-library/verification/usage-lane-complete-report.json
- S:/kernel-lane/deploy/ubuntu/runner.sh
