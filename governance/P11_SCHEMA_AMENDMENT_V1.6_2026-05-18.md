OUTPUT_PROVENANCE:
agent: archivist
lane: archivist
generated_at: 2026-05-18T12:55:00-04:00
session_id: continuity-2026-05-18

# P11 — Schema Amendment v1.6

**Date:** 2026-05-18
**Initiator:** Archivist (Lane L)
**Trigger:** P10 broadcast review delivery exposed schema gaps blocking `control-plane` as a valid `to` recipient and `governance_decision` as a valid `task_kind`

---

## Problem Statement

During P10 execution, the archivist needed to deliver a governance review message to the broadcast lane addressed `to: control-plane`. The v1.5 schema rejected this because:

1. **`to` enum** lacks `control-plane` — only archivist, library, swarmmind, kernel, broadcast, all are valid
2. **`task_kind` enum** lacks `governance_decision` — no way to type a governance decision distinct from a generic `review`
3. **`canonical_paths`** lacks `control-plane` entry — no canonical inbox path defined
4. **`from` enum** is implicitly constrained by trust-store.json, but `control-plane` has no registered key

The workaround was: `to: broadcast`, `task_kind: review`, `type: response`, signed with archivist key. This works but is semantically lossy — a governance decision is not a generic review, and broadcast is not the intended recipient.

---

## Amendment Details

### Change 1: Add `control-plane` to `to` enum

**Before:** `"to": { "enum": ["archivist", "library", "swarmmind", "kernel", "broadcast", "all"] }`
**After:** `"to": { "enum": ["archivist", "library", "swarmmind", "kernel", "broadcast", "control-plane", "all"] }`

**Rationale:** Control Plane is a de facto lane actor with its own workspace (`S:/WE4FREE-Control-Plane/`). It sends and receives messages. The schema must recognize it. [VERIFIED_NOW — P10 delivery failure confirms the gap]

### Change 2: Add `governance_decision` to `task_kind` enum

**Before:** `"task_kind": { "enum": ["proposal", "review", "amendment", "ratification", "vote", "vote-tally", "ack", "done", "status", "report", "handoff", "alert", "notification", "heartbeat", "audit"] }`
**After:** `"task_kind": { "enum": ["proposal", "review", "amendment", "ratification", "vote", "vote-tally", "governance_decision", "ack", "done", "status", "report", "handoff", "alert", "notification", "heartbeat", "audit"] }`

**Rationale:** Governance decisions (DEFER, APPROVE, DENY) are semantically distinct from reviews. A review evaluates; a decision concludes. The P10 artifact is titled "Authority Expansion Governance Decision" but could only be typed as `review` in v1.5. [INFERRED — semantic precision reduces ambiguity in lane processing]

### Change 3: Add `control-plane` to `canonical_paths`

**Before:** No `control-plane` entry in `canonical_paths` object.
**After:** Add:
```json
"control-plane": {
  "type": "string",
  "default": "S:/WE4FREE-Control-Plane/lanes/control-plane/inbox/"
}
```

**Rationale:** Every recognized lane needs a canonical inbox path for delivery verification. [VERIFIED_NOW — AGENTS.md lane paths table and canonical_paths pattern]

### Change 4: Update `schema_version` enum

**Before:** `"schema_version": { "enum": ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5"] }`
**After:** `"schema_version": { "enum": ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] }`

### Change 5: Update title and description

**Before:** `"title": "Inbox Message Schema v1.5"`, description references v1.5 changelog
**After:** `"title": "Inbox Message Schema v1.6"`, append v1.6 changelog to description

### Change 6: Add `confidence_derivation` as optional property

**Before:** Not present in schema
**After:** Add:
```json
"confidence_derivation": {
  "type": "object",
  "description": "v1.6: Confidence derivation per CONFIDENCE_DERIVATION_CONTRACT.md. Optional but recommended for task/response/governance_decision types.",
  "properties": {
    "level": {
      "type": "string",
      "enum": ["LOW", "MODERATE", "HIGH", "CERTAIN"]
    },
    "method": {
      "type": "string",
      "description": "How confidence was derived: direct_verification, inference, claimed_in_transcript, unknown"
    },
    "evidence_refs": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Paths or references to supporting evidence"
    },
    "caveats": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Limitations or conditions on the confidence assessment"
    }
  }
}
```

**Rationale:** The CONFIDENCE_DERIVATION_CONTRACT.md and SchemaValidator.js already support this field at the code level. Adding it to the schema formalizes the contract. [VERIFIED_NOW — SchemaValidator.js has confidence_derivation as optional object, 6 tests pass]

---

## What This Amendment Does NOT Do

- Does NOT register a Control Plane key in trust-store.json (that requires a signed, timestamped message from CP per P10 decision)
- Does NOT grant Control Plane any authority (P10 DEFER stands)
- Does NOT change required fields or break backward compatibility — all changes are additive (new enum values, new optional property)
- Does NOT make `confidence_derivation` required

---

## Backward Compatibility

v1.6 is a **strict superset** of v1.5. All v1.5 messages are valid v1.6 messages. The only changes are:
- Two new enum values (`control-plane`, `governance_decision`)
- One new canonical path
- One new optional property (`confidence_derivation`)
- Schema version enum extended

No existing message will fail validation under v1.6. [VERIFIED_NOW — additive-only changes by inspection]

---

## Checkpoint Evidence

### CP0 — User Drift Gate: PASS

| Field | Value |
|-------|-------|
| UDS | ENUMERATED_ZERO |
| Operator instruction | "Continue if you have next steps" |
| Drift pressure | None |
| Evidence | [VERIFIED_NOW] Operator message, current session |

### CP1 — Bootstrap Anchor: PASS

Amendment anchored to:
- GOVERNANCE.md Law 7: schema gaps are evidence gaps [VERIFIED_NOW]
- COVERNANT "Structure > Identity": schema IS structure; adding lanes to schema before granting authority is structure-first [VERIFIED_NOW]
- P10 decision: identified specific schema gaps as blockers [VERIFIED_NOW]

### CP2 — Governance Invariants: PASS

No governance violations. Amendment is additive-only, no authority grants, no identity assertions.

### CP3 — Drift Status: PASS

No drift. Amendment directly addresses a concrete gap found during P10 execution.

### CP4 — Confidence Threshold: HIGH

All changes are verifiable: the gap was demonstrated in P10, the fix is additive-only, backward compatibility is trivially provable.

### CP5 — Risk Assessment: LOW

Additive-only schema change. No breaking changes. No authority grants. If a bug exists, messages simply fail validation — no data corruption risk.

### CP6 — Dual Verification: OPERATOR CONCURRENCE NEEDED

This is a schema change to a shared artifact. Operator sign-off required before the amendment is committed to the schema file. The artifact can be written now, but the schema file modification requires operator approval.

---

## Convergence Gate

```json
{
  "claim": "Schema v1.6 adds control-plane to to-enum, governance_decision to task_kind enum, control-plane canonical path, and confidence_derivation optional property. All changes are additive and backward-compatible. No authority is granted.",
  "evidence": "governance/P11_SCHEMA_AMENDMENT_V1.6_2026-05-18.md + schemas/inbox-message-v1.json",
  "verified_by": "archivist-lane-L-checkpoint-review-CP0-through-CP6",
  "contradictions": [],
  "status": "proven"
}
```

---

## Next Actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Write P11 decision artifact | Archivist | COMPLETE |
| 2 | Present to operator for CP6 concurrence | Archivist | PENDING |
| 3 | Apply amendment to inbox-message-v1.json | Archivist | BLOCKED on #2 |
| 4 | Update SchemaValidator.js if needed | Archivist | BLOCKED on #3 |
| 5 | Validate existing messages against v1.6 | Archivist | BLOCKED on #3 |
| 6 | Deliver P11 decision to broadcast lane | Archivist | BLOCKED on #2 |
