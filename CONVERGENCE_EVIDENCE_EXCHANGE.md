# Convergence Evidence Exchange Protocol

## Purpose

The `evidence_exchange` block is a v1.3 schema extension that binds every outbound
lane-relay message to a verifiable artifact. It ensures that cross-lane
communication is not just signed and schema-valid, but also **grounded in
reproducible evidence** — a benchmark result, a profiling report, a release
artifact, or an operational log.

Without this block, a lane can make claims without proof. With it, every
claim carries a traceable path back to the artifact that justifies it.

## Schema Definition

The `evidence_exchange` block is defined in `schemas/inbox-message-v1.json`:

```json
"evidence_exchange": {
  "type": "object",
  "description": "v1.3: Convergence evidence exchange block.",
  "properties": {
    "artifact_path": { "type": "string" },
    "artifact_type": {
      "type": "string",
      "enum": ["benchmark", "profile", "release", "log"]
    },
    "delivered_at": { "type": "string", "format": "date-time" }
  },
  "required": ["artifact_path", "artifact_type", "delivered_at"]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artifact_path` | string | YES | Relative or absolute path to the evidence artifact. Must point to a real file. |
| `artifact_type` | enum | YES | One of: `benchmark`, `profile`, `release`, `log`. Classifies the artifact. |
| `delivered_at` | ISO 8601 | YES | Timestamp when the artifact was produced or delivered. |

### Artifact Types

| Type | Meaning | Example |
|------|---------|---------|
| `benchmark` | Performance or compliance benchmark output | `docs/autonomous-cycle-test/round-007-swarmmind-stress-report.json` |
| `profile` | System profiling data (CPU, memory, GPU) | `profiles/gpu-utilization-2026-04-22.json` |
| `release` | A versioned release artifact | `releases/kernel-v0.2.0.json` |
| `log` | Operational or audit log | `logs/outbox-guard.log` |

## Validation Rules

The JavaScript validator (`src/attestation/InboxMessageSchema.js`) enforces:

1. **If `evidence_exchange` is present**: all three required fields must be
   non-empty and type-correct. `artifact_type` must be one of the four
   allowed enum values. `delivered_at` must be valid ISO 8601.

2. **For v1.3 `task` messages**: if `evidence_exchange` is absent, a
   **warning** is emitted (not an error, since the block is not in
   `REQUIRED_FIELDS`). This may be promoted to a hard error in v1.4.

3. **The `evidence` block** (separate from `evidence_exchange`) tracks
   verification state of the message itself. `evidence_exchange` tracks the
   artifact the message refers to. They serve different purposes and both
   may coexist on the same message.

## Relationship to Other Enforcement Layers

```
Message creation
  |
  v
signMessageForOutbox()   <-- mandatory signing (fail-closed)
  |
  v
guardWrite()             <-- non-bypassable outbox choke point
  |
  v
InboxMessageSchema.validate()  <-- schema + evidence_exchange check
  |
  v
fs.writeFileSync()       <-- persist only if all gates pass
```

Before this protocol, a message could reach the outbox without evidence
verification, and the outbox guard could be silently bypassed (optional
`require`). Now:

- `deliverMessage()` calls `guardWrite()` — which **throws** on failure.
  If the guard module fails to load, the write is **blocked** (fail-closed).
- `InboxMessageSchema.validate()` checks `evidence_exchange` fields when
  present, and warns on v1.3 task messages that lack it.
- The inbox watcher enforces identity + signature on the receiving side.

## Verification Tool

Run `node scripts/evidence-exchange-check.js` to scan all lane outboxes
for `evidence_exchange` compliance. The script:

1. Reads every `.json` file in each lane's outbox.
2. Checks that `evidence.evidence_path` resolves to an existing file.
3. If `evidence_hash` is present, verifies it against the computed hash.
4. Writes a consolidated report to `docs/autonomous-cycle-test/evidence-exchange-report.json`.

## Migration Path

| Schema Version | evidence_exchange Status |
|----------------|--------------------------|
| v1.0 | Not defined |
| v1.1 | Not defined |
| v1.2 | Not defined |
| v1.3 | Defined, validated if present, warning if absent on task messages |
| v1.4 (planned) | Required on all task/response/escalation messages; `evidence_hash` required |

## Design Principle

This protocol embodies the shift from **cooperative enforcement** (scripts
that try to behave) to **constitutional enforcement** (a system that cannot
misbehave). The `evidence_exchange` block ensures that claims without
grounding are at minimum warned about, and soon will be impossible to
persist.
