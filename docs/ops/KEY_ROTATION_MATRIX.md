# Key Rotation Matrix (Phase 2)

**Status:** ACTIVE  
**Priority:** P0  
**Owner:** Archivist Lane  
**Last Updated:** 2026-04-25

---

## Objective

Define an execution-safe, evidence-backed rotation order for all key classes in scope.

---

## Rotation Inventory

| Key Class | Current Location | Used For | Blast Radius if Compromised | Rotate Required | Owner |
|---|---|---|---|---|---|
| Archivist lane private signing key | `.identity/private.pem` | message signing/provenance | system-wide trust assertions | YES | Archivist |
| Archivist lane public key | `.identity/public.pem` / trust-store refs | signature verification | lane trust validation | YES (paired with private key) | Archivist |
| Lane trust-store public keys | `lanes/broadcast/trust-store.json` | cross-lane trust | verification continuity | YES (rebuild after key rotation) | Archivist |
| Test/temp keys | `.identity/test-temp/*`, `.identity/tmp.pem` | local testing | local leakage + accidental reuse | YES (remove/replace with ephemeral) | Archivist |
| External API keys/tokens (if present) | runtime env / local secrets | external service auth | account/resource compromise | CONDITIONAL (on evidence) | Service owner |

---

## Execution Order (Zero-Downtime Lean)

1. Generate new lane keypair offline (staging only).
2. Add new public key to trust-store with clear key ID and effective timestamp.
3. Deploy verification path that accepts both old+new public keys (grace window).
4. Flip signing to new private key.
5. Validate cross-lane verification on representative signed messages.
6. Revoke/remove old key references from trust-store after validation window.
7. Remove temp/test keys from disk or quarantine encrypted outside repo paths.
8. Record all operations in `docs/ops/evidence/key-rotation-log-[DATE].txt`.

---

## Validation Gate

Rotation is only considered complete if all are true:

- [ ] New signatures verify with new key ID.
- [ ] Old key ID no longer accepted after cutover.
- [ ] Trust-store updated and committed with explicit key-change notes.
- [ ] Temp/test key files removed from live `.identity/`.
- [ ] Evidence log committed.

---

## Evidence Outputs

- `docs/ops/evidence/key-rotation-log-[DATE].txt`
- `docs/ops/evidence/trust-store-rebuild-[DATE].txt`
- `docs/ops/evidence/rotation-verification-[DATE].txt`
