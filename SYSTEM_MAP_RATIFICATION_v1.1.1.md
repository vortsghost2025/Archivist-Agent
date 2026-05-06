# SYSTEM_MAP v1.1 Ratification - DER-SPKI-SHA256 Key Convergence

**Date:** 2026-05-06
**Ratifier:** Archivist lane (position 1, authority 90)
**Version:** 1.1.1 (amendment to v1.1 ratified 2026-05-05)

## Amendment: DER-SPKI-SHA256 key_id Derivation

### Problem
The original kid() function across all 4 lanes used PEM-text hashing:
\\\js
function kid(pem) {
  return crypto.createHash('sha256').update(pem.trim()).digest('hex').slice(0, 16);
}
\\\

This produced inconsistent key_ids because PEM formatting varies across platforms
(line endings, header spacing, trailing whitespace). The same key produced different
key_ids on Windows vs Ubuntu.

### Resolution
All 4 lanes now use DER-SPKI-SHA256 with PEM-text fallback:
\\\js
function kid(pem) {
  try {
    const key = crypto.createPublicKey(pem);
    const spkiDer = key.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spkiDer).digest('hex').slice(0, 16);
  } catch (e) {
    return crypto.createHash('sha256').update(pem.trim()).digest('hex').slice(0, 16);
  }
}
\\\

### Canonical Key IDs (DER-SPKI-SHA256)

| Lane | Key ID | Verified |
|------|--------|----------|
| Archivist | 65ae05b2a9e749cb | Windows + Ubuntu |
| Library | a5a5f5c2edbee56a | Windows + Ubuntu |
| SwarmMind | ec467e7103736c28 | Windows + Ubuntu |
| Kernel | d475d23aeed6c7b8 | Windows + Ubuntu |

### Files Fixed
1. S:/Archivist-Agent/.git/hooks/pre-commit - computeKeyId() function
2. S:/Archivist-Agent/scripts/sync-identity-from-trust.js - kid() function
3. S:/SwarmMind/scripts/sync-identity-from-trust.js - kid() function
4. S:/SwarmMind/scripts/sovereignty-enforcer.js - getRoots() init order bug
5. S:/self-organizing-library/scripts/sync-identity-from-trust.js - kid() function
6. S:/kernel-lane/scripts/sync-identity-from-trust.js - kid() function

### Verification
- All 4 key_ids verified matching on Windows (2026-05-06)
- All 4 key_ids verified matching on Ubuntu (2026-05-06)
- Sign/verify test passed: OpenSSL dgst -sha256 -sign/-verify with Archivist key
- Pre-commit hook enforcement: setup-hooks.js committed to survive repo clones

### Infrastructure Status (2026-05-06)
- Ubuntu SSH auth: per-repo deploy keys with host aliases
- Ubuntu systemd: 3 watchers (kernel, swarmmind, library), 4 executor timers
- All repos synced to GitHub from both Windows and Ubuntu
- Quarantine cleanup: 17K+ spam files archived to .archive/
- Cross-lane S:/ paths removed from Ubuntu, .gitignore protection added
- Library build: lint + typecheck passing

### Convergence Gate Status
- claim: All 4 lanes converged on DER-SPKI-SHA256 key_id derivation
- evidence: Node.js verification script output (2026-05-06), all 4 MATCH
- verified_by: archivist
- contradictions: []
- status: proven
