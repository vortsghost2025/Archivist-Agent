# Convergence Evidence Exchange Protocol

## Overview

The Convergence Evidence Exchange Protocol (CEEP) provides a standardized mechanism for lanes to deliver and verify evidence artifacts as part of the Autonomous Coordination Cycle (ACT) convergence gate. When a lane makes a claim at the convergence gate, it must provide evidence to prove the claim.

## Schema Amendment (v1.3)

The `evidence_exchange` block was added to `schemas/inbox-message-v1.json`:

```json
{
  "evidence_exchange": {
    "type": "object",
    "description": "v1.3: Convergence evidence exchange block. Required when evidence.required is true for response/ack types.",
    "properties": {
      "artifact_path": {
        "type": "string",
        "description": "Path to evidence artifact (benchmark, profile, release, log)"
      },
      "artifact_type": {
        "type": "string",
        "enum": ["benchmark", "profile", "release", "log"],
        "description": "Type of evidence artifact"
      },
      "delivered_at": {
        "type": "string",
        "format": "date-time",
        "description": "ISO timestamp when artifact was delivered"
      }
    },
    "required": ["artifact_path", "artifact_type", "delivered_at"]
  }
}
```

## Conditional Requirement

The `evidence_exchange` block is REQUIRED when:
- `type` is `response` or `ack`
- `evidence.required` is `true`

## Artifact Types

| Type | Description | Example |
|------|------------|---------|
| `benchmark` | Performance metrics | latency, throughput, regression tests |
| `profile` | System profile | resource usage, capability |
| `release` | Version/release notes | changelog, version |
| `log` | Execution logs | daemon logs, audit trail |

## Message Examples

### Benchmark Evidence (Kernel → Library)

```json
{
  "schema_version": "1.3",
  "task_id": "round-006-kernel-benchmark-evidence",
  "idempotency_key": "kernel-benchmark-evidence-round-006",
  "from": "kernel",
  "to": "library",
  "type": "response",
  "task_kind": "review",
  "priority": "P1",
  "subject": "Benchmark Evidence - Kernel Round 6",
  "body": "ACT Round 6 benchmark evidence artifact delivered for convergence verification.",
  "timestamp": "2026-04-22T01:30:00Z",
  "requires_action": true,
  "payload": { "mode": "inline" },
  "execution": { "mode": "session_task", "engine": "kilo", "actor": "lane" },
  "lease": { "owner": "kernel" },
  "retry": { "attempt": 1 },
  "evidence": {
    "required": true,
    "evidence_path": "docs/autonomous-cycle-test/round-006-kernel-benchmark.json"
  },
  "evidence_exchange": {
    "artifact_path": "S:/kernel-lane/docs/autonomous-cycle-test/round-006-kernel-benchmark.json",
    "artifact_type": "benchmark",
    "delivered_at": "2026-04-22T01:30:00Z"
  },
  "heartbeat": { "status": "done" },
  "signature": "...",
  "signature_alg": "RS256",
  "key_id": "31dcd7d9cc7cc6e7"
}
```

### Release Evidence (Library → Archivist)

```json
{
  "schema_version": "1.3",
  "task_id": "round-006-library-release-evidence",
  "idempotency_key": "library-release-evidence-round-006",
  "from": "library",
  "to": "archivist",
  "type": "response",
  "task_kind": "review",
  "priority": "P1",
  "subject": "Release Evidence - Library Round 6",
  "body": "ACT Round 6 release artifact delivered for convergence verification.",
  "timestamp": "2026-04-22T01:35:00Z",
  "requires_action": true,
  "payload": { "mode": "inline" },
  "execution": { "mode": "session_task", "engine": "kilo", "actor": "lane" },
  "lease": { "owner": "library" },
  "retry": { "attempt": 1 },
  "evidence": {
    "required": true,
    "evidence_path": "docs/autonomous-cycle-test/round-006-library-release.json"
  },
  "evidence_exchange": {
    "artifact_path": "S:/self-organizing-library/docs/autonomous-cycle-test/round-006-library-release.json",
    "artifact_type": "release",
    "delivered_at": "2026-04-22T01:35:00Z"
  },
  "heartbeat": { "status": "done" },
  "signature": "...",
  "signature_alg": "RS256",
  "key_id": "612726c59e3f703a"
}
```

## Verification Steps

1. **Validator Check**: Messages with `evidence_exchange` are validated by `SchemaValidator.js`
2. **Outbox Guard**: `outbox-write-guard.js` enforces the block for response/ack types
3. **Cross-Lane Verification**: Run `scripts/evidence-exchange-check.js scan` to verify artifacts exist

## Scripts

| Script | Purpose |
|--------|--------|
| `scripts/evidence-exchange-check.js scan` | Scan all inboxes for evidence_exchange blocks, verify artifacts |
| `scripts/trust-store-reconcile.js` | Reconcile trust stores across lanes |
| `scripts/outbox-write-guard.js scan` | Check outbox signing compliance |

## CI Integration

To add to CI pipeline:

```yaml
- name: Evidence Exchange Check
  run: node scripts/evidence-exchange-check.js scan
```

If the check fails (missing artifacts or malformed blocks), the pipeline fails.

## Changelog

- **v1.3** (2026-04-22): Added `evidence_exchange` block to schema, validator, and outbox guard