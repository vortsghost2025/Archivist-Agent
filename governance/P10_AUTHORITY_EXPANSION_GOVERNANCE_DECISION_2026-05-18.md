OUTPUT_PROVENANCE:
agent: archivist
lane: archivist
generated_at: 2026-05-18T06:05:00-04:00
session_id: continuity-2026-05-18

# P10 — Authority Expansion Governance Decision

**Date:** 2026-05-18
**Reviewer:** Archivist (Lane L)
**Proposal Source:** `lanes/archivist/inbox/action-required/cp-authority-expansion-proposal-2026-05-18.json`
**Full Proposal:** `S:/WE4FREE-Control-Plane/agent-logs/proposal-control-plane-authority-expansion-2026-05-18.md`

---

## Decision: DEFER PENDING KEY REGISTRATION

Control Plane must register a key pair in `lanes/broadcast/trust-store.json` and resubmit a signed proposal before any authority expansion can be considered.

---

## Checkpoint Evidence Chains

### CP0 — User Drift Gate: PASS

| Field | Value |
|-------|-------|
| UDS | ENUMERATED_ZERO |
| Operator instruction | "Continue if you have next steps" |
| Drift pressure | None — operator directed continuation of governance review |
| Evidence | [VERIFIED_NOW] Operator message, current session |

### CP0.5 — Meta-Cognition Gate: PASS

Externalized critical thinking on three questions:

1. **Should an unsigned proposal receive authority grants?** No — Law 7 (Evidence Before Assertion) requires evidence chains. An unsigned message from an unregistered actor has no identity provenance. [INFERRED from GOVERNANCE.md Law 7 + COVENANT.md Structure > Identity]
2. **Can we conditionally approve pending key registration?** Risky — conditional approval before identity verification creates a window where an unverified actor holds mutation authority. If the actor never completes registration, we've granted authority to an unidentifiable entity. [INFERRED — risk analysis]
3. **Does the scoped work-order model adequately bound risk?** The model itself is sound. The problem is purely identity verification. [VERIFIED_NOW — proposal text confirms scoped work-order model with task_id, 30-day expiry, audit logging, revocation triggers]

No orphaned questions. All three addressed in this decision.

### CP1 — Bootstrap Anchor: PASS

Decision anchored to:
- GOVERNANCE.md Law 7: Evidence Before Assertion [VERIFIED_NOW]
- COVENANT.md: Structure > Identity [VERIFIED_NOW]
- EVIDENCE_CHAIN_REQUIREMENT.md: identity claims require evidence [VERIFIED_NOW]
- trust-store.json: no control_plane entry exists [VERIFIED_NOW — direct file inspection, 118 lines, 4 lane keys only]

### CP2 — Governance Invariants: PASS

No governance violations in the review process itself. Critical note for the decision:

Approving an unsigned authority request would set precedent that identity is optional for authority grants. This would violate:
- Law 7 (Evidence Before Assertion) — the actor's identity is asserted, not evidenced [INFERRED]
- COVENANT "Structure > Identity" — identity infrastructure (trust-store entry) should precede identity-dependent authority [INFERRED]
- CONFIDENCE_DERIVATION_CONTRACT principle — unverified claims should not receive governance weight [INFERRED — analogical application]

This does not fail CP2 for the review, but is critical to the decision.

### CP3 — Drift Status: PASS

No drift indicators present. Decision process is analytical, not emotionally driven toward approval or denial.

### CP4 — Confidence Threshold: PASS (with caution)

| Aspect | Confidence | Derivation |
|--------|-----------|------------|
| Constitutional analysis | HIGH | Evidence directly verifiable: trust-store.json has no control_plane entry; proposal message is unsigned; Law 7 and COVENANT are unambiguous |
| Policy decision | MODERATE (qualitative) | DEFER is constitutionally strongest. APPROVE WITH CONDITIONS has enforceability risk (unsigned actor gains mutation authority before identity verified). DENY is safe but possibly too restrictive — the proposal itself acknowledges the gap and proposes a sound scoped model |

Confidence derivation: MODERATE is sufficient for this decision. DEFER requires no enforcement risk. If the decision were APPROVE WITH CONDITIONS, confidence would need to be higher before execution.

### CP5 — Risk Assessment: PASS

| Option | Risk | Justification |
|--------|------|---------------|
| DEFER PENDING KEY REGISTRATION | LOW | No authority granted. No precedent set. Control Plane has clear path to resubmission. |
| APPROVE WITH CONDITIONS | MEDIUM/HIGH | Unsigned actor gains cross-repo mutation authority before identity verified. Precedent: authority grants can bypass identity verification. Enforcement of conditions depends on actor self-policing (no external verification possible without identity). |
| DENY | LOW | Safe but possibly too restrictive — the scoped work-order model is sound. |

### CP6 — Dual Verification: PARTIAL PASS

- Lane L (Archivist): Review complete, evidence chains documented above. [VERIFIED_NOW]
- Lane R (second reviewer): No second lane agent available for independent review. [VERIFIED_NOW — no other lane agent is active in this session]
- **Operator concurrence required** before decision is delivered to Control Plane. This is the CP6 gate: the decision artifact can be written, but execution (delivery) requires operator sign-off.

---

## Three Critical Governance Issues

### Issue 1: Unsigned Message

The JSON proposal carries `"signature": "UNSIGNED—CONTROL-PLANE-HAS-NO-REGISTERED-KEY-PAIR"` and `"key_id": "UNSIGNED"`. [VERIFIED_NOW — lines 57-59 of the proposal JSON]

**Governance implication:** Per Law 7, we cannot assert the message's origin. The `from: "control-plane"` field is a self-claim, not a verified fact. The message could theoretically have been written by any actor with write access to the action-required directory.

**Mitigating factor:** The operator physically placed the file (acknowledged in `_delivery_note` field, line 71). Operator-mediated delivery provides some provenance, but it is operator-attested, not cryptographically verified. This is weaker than a JWS signature against a registered key.

### Issue 2: Self-Asserted Authority Metadata

The JSON carries `"_control_plane_authorized_write": true` (line 70). [VERIFIED_NOW]

**Governance implication:** This is a self-asserted authorization claim. No external authority validated this. In a trust model where identity is verified through trust-store.json, a self-asserted boolean is meaningless — any actor could set it to `true`.

**Severity:** MODERATE. The field is metadata, not a permission grant. But its presence suggests the Control Plane agent believed it could authorize its own write access, which indicates a gap in identity-awareness.

### Issue 3: No Key Pair in trust-store.json

trust-store.json contains entries for: archivist, library, swarmmind, kernel. [VERIFIED_NOW — direct inspection, 118 lines, 4 active keys + 4 archived keys + lineage + rotation policy]

There is NO entry for `control_plane`. [VERIFIED_NOW — confirmed by absence]

**Governance implications:**
1. No signature verification is possible for messages claiming to be from Control Plane
2. No identity provenance exists for Control Plane as a lane actor
3. No key rotation history exists for Control Plane
4. The `uncertainty` field in the proposal (lines 60-68) correctly identifies this gap — `evidence_needed: ["Archivist-registered key pair for control-plane lane identity"]`

---

## Decision Rationale

### Why DEFER, not APPROVE WITH CONDITIONS

1. **Precedent risk**: Approving authority for an unsigned actor sets a precedent that identity verification is optional for authority grants. This undermines the entire trust-store system. [INFERRED — structural analysis]
2. **Enforceability gap**: Conditions (scoped work-order, 30-day expiry, audit logging) all depend on the actor's identity being verifiable. Without a registered key, we cannot verify who is exercising the authority or whether the actor is the same entity that received the grant. [INFERRED — logical consequence of Issue 3]
3. **Law 7 violation**: "Evidence Before Assertion" — we have insufficient evidence of the actor's identity to support an authority grant. [VERIFIED_NOW — GOVERNANCE.md Law 7]
4. **COVENANT violation**: "Structure > Identity" — identity infrastructure (trust-store entry) must precede identity-dependent authority. Approving before the structure exists puts identity before structure. [VERIFIED_NOW — COVENANT.md]

### Why DEFER, not DENY

1. **The proposal is reasonable**: The scoped work-order model is well-designed. 30-day expiry with auto-revoke is sensible. Audit logging is specified. Revocation mechanism exists. [VERIFIED_NOW — proposal text]
2. **The gap is narrow**: The ONLY problem is identity verification. Everything else about the proposal is governance-compatible. [VERIFIED_NOW — analysis above]
3. **Clear remediation path**: Register a key pair in trust-store.json, then resubmit a signed proposal. This is a simple, well-understood process. [INFERRED — trust-store.json has a registration pattern established by the 4 existing entries]
4. **DENY would be disproportionate**: The proposal is not fundamentally incompatible with governance — it just needs identity infrastructure first. [INFERRED]

---

## Conditions for Reconsideration

Control Plane must complete ALL of the following before this proposal can be reconsidered:

1. **Register a key pair in trust-store.json** — EdDSA (Ed25519) preferred to match existing lane keys. Entry must include: lane_id, key_id, public_key_pem, algorithm, registered_at. [VERIFIED_NOW — pattern from 4 existing entries]
2. **Resubmit the proposal as a signed message** — JWS signature using the registered key. The `from`, `signature`, and `key_id` fields must match the trust-store entry. [VERIFIED_NOW — messaging protocol per AGENTS.md]
3. **Remove the `_control_plane_authorized_write` field** — self-asserted authorization metadata has no place in a signed message. The signature itself provides authorization evidence. [INFERRED — structural analysis]
4. **Operator concurrence on resubmission** — per CP6 partial pass, any authority decision requires operator sign-off. [VERIFIED_NOW — CP6 evidence chain above]

Once these conditions are met, Archivist will conduct a new checkpoint review (CP0–CP6) on the signed proposal.

---

## What IS Endorsed

The following aspects of the proposal require no key registration to evaluate:

- **Scoped work-order model**: Sound. Standing authority would be riskier; task-scoped is correct. [VERIFIED_NOW]
- **30-day initial grant with auto-revoke**: Reasonable timeframe for evaluation. [VERIFIED_NOW]
- **Audit logging (cross-repo-writes.log + headless-actions.log)**: Good observability. [VERIFIED_NOW]
- **Archivist revocation mechanism**: Adequate — inbox message to revoke. Control Plane must monitor for it. [VERIFIED_NOW]
- **Quarantine/rollback triggers**: Well-defined. Path violation → quarantine + abort, command not in allowlist → abort + log, etc. [VERIFIED_NOW]
- **Explicit forbidden actions**: Source code mutation, trust store/keys modification, governance doc changes, git ops, cross-lane signing — all correctly excluded. [VERIFIED_NOW]
- **Headless execution scope**: Read-only commands + bounded scp/rsync + systemctl restart only — appropriately narrow. [VERIFIED_NOW]

These design decisions can be carried forward to the reconsideration without re-analysis.

---

## Next Actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Write this decision artifact | Archivist | COMPLETE |
| 2 | Present decision to operator for CP6 concurrence | Archivist | PENDING |
| 3 | Deliver decision to Control Plane (after concurrence) | Archivist | BLOCKED on #2 |
| 4 | Control Plane registers key pair in trust-store.json | Control Plane | NOT STARTED |
| 5 | Control Plane resubmits signed proposal | Control Plane | BLOCKED on #4 |
| 6 | New CP0–CP6 review on signed proposal | Archivist | BLOCKED on #5 |

---

## Convergence Gate

```json
{
  "claim": "Authority expansion for Control Plane is DEFERRED pending key registration in trust-store.json and resubmission of a signed proposal. The proposal's design is endorsed; only identity verification blocks approval.",
  "evidence": "governance/P10_AUTHORITY_EXPANSION_GOVERNANCE_DECISION_2026-05-18.md",
  "verified_by": "archivist-lane-L-checkpoint-review-CP0-through-CP6",
  "contradictions": [],
  "status": "proven"
}
```

Status is PROVEN because: (1) the constitutional analysis is verifiable against governance documents, (2) the trust-store inspection is verifiable against the file, (3) the unsigned status is verifiable against the proposal JSON, and (4) the decision follows logically from Law 7 + COVENANT + structural analysis. No contradictions exist between the evidence and the decision.
