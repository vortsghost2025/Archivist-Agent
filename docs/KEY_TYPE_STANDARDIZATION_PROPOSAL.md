OUTPUT_PROVENANCE:
agent: z-ai/glm-5.1
lane: archivist
target: key type standardization proposal
generated_at: 2026-05-10T22:12:00-04:00
session_id: solo-continuation-20260510f

# Key Type Standardization Proposal

## Current State

All 4 lanes use **RSA 2048 / RS256** for lane message signing and trust store verification.

| Lane | Key Type | key_id | Key Source |
|------|----------|--------|------------|
| archivist | RSA 2048 | `65ae05b2a9e749cb` | Windows (original) |
| library | RSA 2048 | `a5a5f5c2edbee56a` | Windows (fresh, passphrase lost) |
| swarmmind | RSA 2048 | `ec467e7103736c28` | Ubuntu (self-healed) |
| kernel | RSA 2048 | `4ac54d4100323c71` | Windows (fresh, Ubuntu key unavailable) |

## Why Standardization Matters (Even Though All Lanes Are Currently Aligned)

1. **No algorithm diversity** — If RSA 2048 is broken, ALL lanes fall simultaneously
2. **Performance** — RSA 2048 signing is ~1000x slower than Ed25519 for small messages
3. **Key size** — RSA 2048 private keys are ~1.6KB vs Ed25519's 64 bytes
4. **No rotation policy** — Keys have no `expires_at`, no rotation schedule
5. **Passphrase fragility** — Library passphrase was lost, requiring fresh key generation. Encrypted RSA keys require passphrase management that Ed25519 raw keys do not.
6. **Signing code complexity** — Current `sign-outbox-message.js` and `create-signed-message.js` use `crypto.sign('sha256', ...)` with RSA. Ed25519 uses `crypto.sign(null, ...)` which is simpler.

## Options Considered

### Option A: Keep RSA 2048, Add Rotation Policy (Minimal Change)

- **What**: No key type change. Add `expires_at` fields and a rotation schedule.
- **Pros**: Zero migration cost. No code changes. Trust store stays identical.
- **Cons**: No performance improvement. No future-proofing. Single algorithm risk remains.
- **Complexity**: LOW — just add dates to trust-store.json and a rotation script.

### Option B: Migrate to Ed25519 (Modern Default)

- **What**: Rotate all lane keys to Ed25519. Update signing scripts and trust store.
- **Pros**: ~1000x faster signing. 64-byte private keys. No passphrase needed. Algorithm diversity vs RSA. Widely adopted (SSH, Signal, age, minisign).
- **Cons**: Full key rotation across 4 lanes. Signing script updates (`.sign('sha256', ...)` → `.sign(null, ...)`). Trust store PEM format changes. All existing signed messages become unverifiable against new keys (historical verification breaks unless old keys are retained).
- **Complexity**: MEDIUM — rotation + code changes, but Ed25519 is simpler code.

### Option C: Hybrid — Ed25519 for Signing, RSA 2048 for Historical Verification

- **What**: Add Ed25519 keys alongside existing RSA keys. New messages signed with Ed25519. Old messages verifiable with retained RSA keys.
- **Pros**: Forward improvement + backward compatibility. Gradual migration. No verification gap.
- **Cons**: Two key pairs per lane during transition. Trust store grows. Code must support both algorithms.
- **Complexity**: MEDIUM-HIGH — dual algorithm support in signing and verification code.

### Option D: Ed25519 Now, RSA Archived (Recommended)

- **What**: Generate Ed25519 keys for all lanes. Retire RSA keys to `trust-store.json` under `archived_keys`. Update signing scripts. Update trust store verification to check both active (Ed25519) and archived (RSA) keys.
- **Pros**: Clean migration. Historical verification preserved via archived_keys. Simpler signing code going forward. Better performance.
- **Cons**: One-time migration effort. Trust store schema change (add `archived_keys` section). Pre-commit hook `computeKeyId()` already handles both key types.
- **Complexity**: MEDIUM — same code changes as Option B, but with explicit archive instead of deletion.

## Recommendation: Option D (Ed25519 Now, RSA Archived)

### Migration Steps

1. **Generate Ed25519 keypairs** for all 4 lanes (one-time)
   ```bash
   node scripts/generate-lane-keypair.js --lane archivist --algorithm ed25519
   ```

2. **Update trust-store.json** — move current RSA entries to `archived_keys`, add new Ed25519 entries
   ```json
   {
     "archivist": { "algorithm": "EdDSA", "key_id": "...", "public_key_pem": "..." },
     "archived_keys": {
       "archivist": {
         "65ae05b2a9e749cb": { "algorithm": "RS256", "public_key_pem": "...", "archived_at": "2026-05-11" }
       }
     }
   }
   ```

3. **Update signing scripts** — `sign-outbox-message.js`, `create-signed-message.js`, `sign-snapshot.js`
   - Change `crypto.sign('sha256', data, key)` → `crypto.sign(null, data, key)` for Ed25519
   - Detect algorithm from key type and use appropriate sign call

4. **Update verification** — `remediate-inbox-signature-keyid.js`, pre-commit hook
   - Check `archived_keys` when `key_id` doesn't match active keys

5. **Update pre-commit hook** — `hooks/pre-commit.js` trust store check already uses `computeKeyId()` which handles both RSA and Ed25519 DER parsing

6. **Test** — Sign and verify messages with both old (RSA) and new (Ed25519) keys

7. **Deploy** — Per-lane, with each lane owner rotating their own key

### What Does NOT Change

- `.identity/` directory structure (just new key files)
- Lane message schema (signature field format unchanged)
- `deriveKeyId.js` (already algorithm-agnostic)
- Pre-commit hook structure (just trust-store.json content)

### Key Rotation Policy (Applies Regardless of Option)

| Parameter | Value |
|-----------|-------|
| Rotation frequency | 90 days |
| Expiry warning | 14 days before expiry |
| Grace period | 7 days after expiry (messages still accepted) |
| Hard rejection | After grace period |
| Rotation trigger | Manual (operator) or automated script |
| Archived key retention | Indefinite (for historical verification) |

### Add to trust-store.json:

```json
{
  "rotation_policy": {
    "rotation_days": 90,
    "warning_days": 14,
    "grace_days": 7,
    "last_rotated": "2026-05-10"
  }
}
```

## Operator Decision Required

- [ ] Choose option: A / B / C / D
- [ ] Approve rotation policy parameters
- [ ] Decide if migration is per-lane (lane owners rotate their own) or centrally done
- [ ] Decide timeline (immediate vs after pre-commit hook cross-lane deployment)

## Open Questions

1. Should Ed25519 keys be encrypted at rest? (RSA keys currently use passphrase for library.) Ed25519 raw keys are simpler but less protected if disk is compromised.
2. Should we add a key ceremony script for audit-logged key generation?
3. Should the pre-commit hook enforce rotation policy (reject commits from expired keys)?

## Context

- All 4 lanes converged to RSA 2048 during 2026-05-05 key convergence ratification
- Library passphrase was lost, requiring fresh key generation — demonstrates fragility of passphrase-based key management
- Kernel key was regenerated because Ubuntu private key was unavailable — shows cross-machine key portability issues
- Ed25519 is supported by Node.js `crypto.sign()` since v12.0.0 (Ubuntu runs v20.20.2)
- Pre-commit hook `computeKeyId()` already handles DER parsing for both RSA and Ed25519 public keys
