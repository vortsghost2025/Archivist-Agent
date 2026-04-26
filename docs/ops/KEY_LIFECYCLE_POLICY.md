# Key Lifecycle Policy

**Status:** DRAFT FOR ENFORCEMENT  
**Priority:** P0  
**Owner:** Archivist Lane  
**Last Updated:** 2026-04-25

---

## Purpose

Define mandatory lifecycle controls for all signing and secret keys used by lane operations.

---

## Scope

Applies to:
- lane signing keypairs
- trust-store key references
- temporary test keys
- external API credentials used by lane automation

---

## Policy Rules (Mandatory)

1. **No secret keys committed to git** under any path.
2. **No plaintext temp keys** retained in lane directories after test completion.
3. **Compromise indicator triggers rotation** immediately (same day).
4. **Dual-key grace windows** are allowed only during controlled cutover.
5. **Key metadata must be recorded** (key ID, created_at, rotated_at, owner, purpose).
6. **Rotation cadence**:
   - signing keys: every 90 days or immediately on compromise signal
   - external API keys: per provider policy or immediately on compromise signal
7. **Revocation must be explicit** and recorded in evidence logs.
8. **All key operations require evidence artifacts** in `docs/ops/evidence/`.

---

## Incident Trigger Conditions

Any of the following triggers emergency lifecycle actions:
- key material found in git history
- key material found in logs/artifacts
- unknown signature events
- unauthorized host/user access to key path
- secret scan positive on protected patterns

---

## Required Evidence Per Rotation Event

- `key-rotation-log-[DATE].txt`
- `trust-store-rebuild-[DATE].txt`
- `rotation-verification-[DATE].txt`
- `post-rotation-leak-scan-[DATE].txt`

---

## Enforcement Hooks

- pre-commit secret scanner (required)
- CI leak scan (required)
- periodic rotation check job (required)

Policy is considered unenforced unless all three are active.

---

## Exception Process

Exceptions are temporary and must include:
- owner
- rationale
- expiry date
- compensating control
- explicit approval record

No open-ended exceptions allowed.
