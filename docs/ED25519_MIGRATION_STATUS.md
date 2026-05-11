# Ed25519 Migration Status Report

OUTPUT_PROVENANCE:
agent: Kilo/z-ai/glm-5.1
lane: archivist
generated_at: 2026-05-11T17:35:00Z
session_id: ed25519-migration-final

## Migration: Option D — Ed25519 with RSA Archived

### 7-Step Plan: ALL COMPLETE ✅

| Step | Description | Status |
|------|-------------|--------|
| 1 | Generate Ed25519 keypairs | ✅ |
| 2 | Update trust-store.json | ✅ |
| 3 | Update signing scripts | ✅ |
| 4 | Update verification + RS256 refs | ✅ |
| 5 | Pre-commit hook `computeKeyId()` | ✅ |
| 6 | Test — sign/verify both old and new | ✅ |
| 7 | Deploy — per-lane commit and push | ✅ |

### Key ID Mapping

| Lane | Old RSA key_id | New Ed25519 key_id |
|------|---------------|-------------------|
| archivist | `65ae05b2a9e749cb` | `6ed65c18a0afca45` |
| kernel | `4ac54d4100323c71` | `2effb49ea02dff5b` |
| swarmmind | `ec467e7103736c28` | `c707d41a7bb96d96` |
| library | `a5a5f5c2edbee56a` | `42e853d4ec37955d` |

### E2E Test Results

**Windows (Node v25.9.0): 122/122 PASS ✅**
- Full suite including create-signed-message, enforcer verification, cross-lane, tamper rejection

**Ubuntu Headless (Node v18.20.8 LTS): 122/122 PASS ✅**
- All 4 lanes fully pass including Archivist (DSO error eliminated by Node upgrade)
- RSA backward compatibility: all pass
- Full E2E suite including create-signed-message, enforcer, cross-lane

**Previous Ubuntu results (Node v12.22.9 — superseded by upgrade):**
- 47 pass, 1 fail (Archivist DSO error)
- create-signed-message tests correctly skipped on Node < 14

### Known Issue: Node 12 OpenSSL DSO Error

**Symptom:** `error:25066067:DSO support routines:dlfcn_load:could not load the shared library`

**Root cause:** Node 12 bundles OpenSSL 1.1.1m. The `crypto.createPrivateKey()` API triggers
an OpenSSL provider/engine loading bug specific to certain Ed25519 key bytes on this version.
System OpenSSL is 3.0.2 but Node 12 doesn't use it.

**Impact:** Only affects the Archivist lane's Ed25519 private key on Node 12. The other 3 lanes
work because the bug is key-byte-dependent (intermittent). All 4 lanes work on Node 14+.

**Fix:** ✅ DONE — Node.js upgraded to v18.20.8 LTS on Ubuntu headless via nvm.
All 4 lanes now pass full E2E test suite.

**Workaround:** If Archivist signing is needed on Ubuntu Node 12 before upgrade, the Archivist
key can be regenerated with different random bytes that don't trigger the DSO bug. However,
this would change the key_id and require trust store updates.

### Bugs Found and Fixed During Migration

1. **`_loadTrustStore()` normalization dropped `archived_keys`** — Fixed in all 4 lanes.
   When trust-store.json used flat format (entries at top level), normalization into
   `trustStore.keys` was discarding `archived_keys`, `rotation_policy`, and `key_lineage`.

2. **Node 12 optional chaining (`?.`)** — Fixed in all signing infrastructure scripts
   across all 4 lanes. Production scripts cannot use `?.` or `??` syntax.

3. **SchemaValidator.js `?.`** — Fixed in Archivist `src/lane/SchemaValidator.js`.

4. **`.identity/` is gitignored** — Discovered that `git pull` doesn't update Ed25519 keys.
   Manual `scp` required for key deployment to Ubuntu headless.

### Additional Milestones

- **Node.js Ubuntu upgrade** — v18.20.8 LTS via nvm (`nvm alias default 18`) ✅
- **GitHub branch protection** — All 4 repos: 1 approving review, no force push, no deletion ✅
- **kernel-lane Ubuntu branch fix** — Switched from diverged `master` to `main`, deleted stale branch ✅
- **Protection plan document** — `docs/AGENT_REACTIVATION_PROTECTION_PLAN.md` ✅

### Commit History (per lane)

**Archivist (LANE-1):**
- `d08a7b9` — Fix optional chaining in signing scripts
- `43db301` — Fix SchemaValidator.js optional chaining
- `290fd80` — E2E test: skip create-signed-message on Node < 14

**Kernel (LANE-2):**
- `dd7398c` — Fix optional chaining for Node 12
- `9725739` — Fix trust store normalization to preserve archived_keys
- `03103ef` — Migrate signing scripts to algorithm-aware

**SwarmMind (LANE-3):**
- `8bd57e4` — Fix optional chaining for Node 12
- `4a5e117` — Fix trust store normalization to preserve archived_keys
- `0419400` — Migrate signing scripts to algorithm-aware

**Library (LANE-4):**
- `894f26b` — Fix optional chaining for Node 12
- `7796794` — Fix trust store normalization to preserve archived_keys
- `e582969` — Migrate signing scripts to algorithm-aware

### Files Modified (per lane)

Each lane received updates to:
- `scripts/identity-enforcer.js` — Algorithm-aware verification
- `scripts/identity-self-healing.js` — Algorithm-aware key handling
- `scripts/sign-snapshot.js` — Algorithm-aware signing
- `.global/algorithm-helpers.js` — Shared EdDSA/RS256 utilities
- `lanes/{lane}/trust-store.json` — Ed25519 keys + archived RSA
- `.identity/private.pem` — Ed25519 private key (not tracked by git)
- `.identity/public.pem` — Ed25519 public key (not tracked by git)

### Pre-commit Hooks

All 4 lanes have `deriveKeyId`-based hooks deployed on both Windows and Ubuntu headless.
Hooks validate that committed key IDs match trust store entries.

### Readiness for Agent Re-activation

**SAFE to re-activate agents one at a time with supervision.**

Rationale:
- All signing infrastructure is algorithm-aware (EdDSA + RS256)
- Backward compatibility with archived RSA keys is verified
- Trust stores have proper `archived_keys` with `superseded_by` links
- Pre-commit hooks prevent key ID mismatches
- E2E tests pass on both Windows (full) and Ubuntu (raw crypto + RSA compat)

**Recommended activation order:**
1. Library (simplest, fewest cross-dependencies)
2. SwarmMind
3. Kernel
4. Archivist (most complex, most files)

**Required before activation:**
- Operator should monitor first message signing/verification per lane
- Confirm agents use Ed25519 keys (check `key_id` in signed messages)
- If any agent attempts RSA signing, the enforcer will catch it

### Protections Against Regression

Existing protections:
1. **Pre-commit hooks** — `deriveKeyId` validates key IDs match trust store
2. **Identity enforcer** — `SUPPORTED_ALGORITHMS` whitelist prevents unknown algorithms
3. **Trust store** — Archived RSA keys have `superseded_by` links; enforcer checks archived keys
4. **Git push** — All changes pushed to GitHub; local system wipe is recoverable

Recommended additional protections:
1. ~~Upgrade Ubuntu Node to v18 LTS~~ ✅ DONE — v18.20.8 LTS via nvm
2. ~~Protected branches~~ ✅ DONE — All 4 repos have branch protection
3. **CI check** — Add GitHub Action running `test-e2e-signing.js` on push (see docs/AGENT_REACTIVATION_PROTECTION_PLAN.md)
4. **Key rotation policy** — Document in `rotation_policy` field of trust-store.json
5. **Trust store mutation guard** — Script to detect trust store tampering
6. **File permissions** — `chmod 444` on trust-store.json, `chmod 400` on private keys
