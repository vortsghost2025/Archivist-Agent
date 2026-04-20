# FreeAgent Production Phenotype - Scope Lock

Date: 2026-04-19
Baseline commit hashes:
- Archivist: `5a9e2fab7dcfcd57f9cb47cdd2f6f5e2c8bf0d74`
- Library: `c5cb640126a0f914c8099b73cd78b1fa5e7d984e`
- SwarmMind: `2fa9e13ebf467d5c146c930af780e7e2da72a7d5`

## Included Surfaces (Production Phenotype)

### Core Runtime
| Component | Lane | Purpose | Status |
|-----------|------|---------|--------|
| Trust Store | Archivist | Key management, revocation | Active |
| Identity Attestation | All lanes | JWS signing/verification | Active |
| VerifierWrapper | All lanes | Deterministic verification | Active |
| Queue | All lanes | Artifact queue with attestation | Active |
| QuarantineManager | All lanes | Rejected artifact isolation | Active |

### Verification Path
- `src/attestation/VerifierWrapper.js` - Main enforcement (lane check before crypto)
- `src/attestation/Verifier.js` - JWS verification against trust store
- `src/attestation/Signer.js` - Artifact signing
- `src/attestation/KeyManager.js` - Key load/store
- `src/attestation/TrustStoreManager.js` - Trust store access

### Scripts
- `scripts/security-drill.js` (Library) - 4-scenario attack rejection
- `scripts/test-hardening-drill.js` (SwarmMind) - 4-scenario hardening
- `scripts/edge-case-test.js` (Library) - Lane mismatch runtime test

## Excluded Surfaces (Not in Production Phenotype)

### Medical/Health Domain
- All `medical/*` directories
- Health-specific agents and models

### Distributed Systems Experiments
- `DISTRIBUTED_MICROSERVICES_UNIVERSE/*`
- Federation experiments not on critical path

### Legacy/Archive
- `_root/*` archives
- `_ARCHIVED/*` historical snapshots
- Side projects not required for core orchestration

### Development Artifacts
- `.continuity_test*/` directories
- Test fixtures not part of verification path
- Temporary state files

## Verification Baseline

All three lanes pass:
1. Syntax check: `node --check` on core files
2. Security drill: 4/4 scenarios pass
3. Hardening drill: 4/4 scenarios pass
4. Edge case: Runtime rejects lane mismatch

## Scope Lock Declaration

No new features added to production phenotype until Phase 1 complete.
Changes limited to:
- Bug fixes in verification path
- Documentation updates
- Test additions (no behavioral changes)

---
Human sign-off required to proceed to Phase 1.
