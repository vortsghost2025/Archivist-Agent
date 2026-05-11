# Agent Re-activation Protection Plan

OUTPUT_PROVENANCE:
agent: Kilo/z-ai/glm-5.1
lane: archivist
generated_at: 2026-05-11T18:34:00Z
session_id: ed25519-migration-final

## Purpose

Document the protections in place and recommended additional measures before
re-activating agents after the Ed25519 migration. The operator must review and
approve before any agent is activated.

## Current Protections (ALREADY IN PLACE)

### 1. GitHub Branch Protection ✅

All 4 repos have branch protection on their primary branch:

| Repo | Branch | Settings |
|------|--------|----------|
| Archivist-Agent | `master`, `main` | 1 approving review, no force push, no deletion |
| kernel-lane | `main` | Same |
| SwarmMind | `main` | Same |
| self-organizing-library | `main` | Same |

- `enforce_admins=false` — operator can still push directly when needed
- Agents that commit with `--no-verify` bypass local hooks but CANNOT bypass
  branch protection (they'd need a PR with review approval)

### 2. Pre-commit Hooks ✅

All 4 lanes have `deriveKeyId`-based hooks:
- Validate that committed key IDs match trust store entries
- Can be bypassed with `--no-verify` flag
- Still valuable: catches accidental trust store corruption during normal commits

### 3. Algorithm-Aware Signing Infrastructure ✅

- All signing/verification scripts support both EdDSA and RS256
- Identity enforcer rejects messages with algorithms not in `SUPPORTED_ALGORITHMS`
- Archived RSA keys verified via `archived_keys` + `superseded_by` links
- No remaining hardcoded `RS256` references (zero found in RS256 audit)

### 4. Trust Store Integrity ✅

- `_loadTrustStore()` normalization preserves `archived_keys`, `rotation_policy`, `key_lineage`
- Archived keys keyed by `key_id` (not lane_id) with `superseded_by` pointing to Ed25519 key
- Enforcer looks up archived keys for backward-compatible verification

### 5. Cross-Platform Verification ✅

- Windows (Node v25.9.0): 122/122 E2E tests pass
- Ubuntu headless (Node v18.20.8 LTS): 122/122 E2E tests pass
- Both platforms have Ed25519 keys deployed (scp'd manually, not via git)

### 6. Key Material Isolation ✅

- `.identity/` directories are gitignored — keys never enter version control
- Ed25519 keys manually deployed to Ubuntu headless via scp
- RSA keys archived but not deleted (backward compat)

## Recommended Additional Protections

### Priority 1 — HIGH (before any agent activation)

#### 1A. GitHub Actions CI Check

Add a workflow that runs `test-e2e-signing.js` on every push to the primary
branch. This catches any mutation to signing infrastructure regardless of
`--no-verify` bypass.

**Implementation:**

```yaml
# .github/workflows/signing-integrity.yml
name: Signing Integrity Check
on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/test-e2e-signing.js
        env:
          LANE_ROOT_ARCHIVIST: ${{ github.workspace }}
          # Add other lane roots if checkout supports multi-repo
```

**Limitation:** Full E2E test requires access to `.identity/` keys, which are
not in the repo. CI would only run the non-signing subset (enforcer lookup,
RSA backward compat, algorithm-params tests). For full signing tests, the
operator would need to add keys as GitHub Secrets or use a self-hosted runner.

**Minimal CI (no keys needed):**
- `testRsaBackwardCompatibility` — verifies archived RSA keys still verify
- `testEnforcerLookupArchivedKeys` — verifies enforcer finds archived keys
- `testEnforcerRejectsUnsigned` — verifies unsigned messages rejected
- Algorithm params tests — verifies `getAlgorithmParams`/`getVerifyParams`

#### 1B. Trust Store Mutation Guard Script

A standalone script that can be run periodically or as a pre-commit hook
supplement to verify trust-store.json has not been tampered with.

```bash
# scripts/trust-store-mutation-guard.js
# Reads trust-store.json, verifies:
# 1. All current keys have EdDSA algorithm
# 2. All archived keys have RS256 algorithm and superseded_by link
# 3. No keys have been removed (compares against known key_ids)
# 4. key_lineage is intact
# Exit 1 if any check fails
```

**Expected key_ids (hardcoded as invariant):**
- archivist Ed25519: `6ed65c18a0afca45`
- kernel Ed25519: `2effb49ea02dff5b`
- swarmmind Ed25519: `c707d41a7bb96d96`
- library Ed25519: `42e853d4ec37955d`

This script would catch any agent that tries to:
- Remove Ed25519 keys from trust store
- Revert algorithm to RS256
- Delete archived_keys entries
- Corrupt key_lineage

#### 1C. File Permissions on Ubuntu Headless

Make trust-store.json and `.identity/` read-only for the agent process:

```bash
# On Ubuntu headless, for each lane:
chmod 444 lanes/*/trust-store.json
chmod 400 .identity/private.pem
chmod 444 .identity/public.pem
```

This prevents any agent running as `we4free` from modifying these files
without explicit `chmod` first. The operator would need to `chmod 644`
before making authorized changes.

### Priority 2 — MEDIUM (after first agent is stable)

#### 2A. Key Rotation Policy in Trust Store

Populate the `rotation_policy` field in trust-store.json:

```json
{
  "rotation_policy": {
    "max_key_age_days": 365,
    "algorithm": "EdDSA",
    "rotation_requires": ["operator_approval", "multi_lane_convergence"],
    "archive_retention_days": 180
  }
}
```

#### 2B. Agent Activation Checklist

For each lane activation, follow this checklist:

- [ ] Confirm Ubuntu headless Node v18 LTS is active (`node -v`)
- [ ] Confirm Ed25519 keys are in `.identity/` (`openssl pkey -text -noout -in .identity/private.pem`)
- [ ] Confirm trust-store.json has Ed25519 key_ids (run `trust-store-mutation-guard.js`)
- [ ] Confirm branch protection is active on GitHub
- [ ] Activate ONE agent only
- [ ] Monitor first signed outbox message — verify `key_id` matches Ed25519
- [ ] Monitor first inbox message verification — enforcer accepts EdDSA signature
- [ ] Monitor for 24 hours before activating next agent

#### 2C. Archivist `src/` Optional Chaining Cleanup

Non-blocking but recommended for consistency. 12 files in `src/` still use
`?.` syntax. These run on Node 18+ (not signing infrastructure) so they're
safe, but should be cleaned up for consistency:

- `src/attestation/QuarantineManager.js` — 1 occurrence
- `src/attestation/TrustStoreManager.js` — 4 occurrences
- `src/attestation/Verifier.js` — 3 occurrences
- `src/attestation/VerifierWrapper.js` — 4 occurrences
- `src/bridge/provider-profiles.js` — 1 occurrence
- `src/bridge/routing-logger.js` — 4 occurrences
- `src/monitoring/MetricsCollector.js` — 1 occurrence
- `src/monitoring/Notifier.js` — 3 occurrences
- `src/queue/QueueConsumer.js` — 3 occurrences
- `scripts/build-copilot-package.js` — 1 occurrence
- `scripts/claim-commit-guard.js` — 3 occurrences

### Priority 3 — LOW (nice to have)

#### 3A. Self-Hosted GitHub Runner on Ubuntu Headless

A self-hosted runner would have access to `.identity/` keys and could run
the full E2E test suite on every push. This is the gold standard but
requires setup and maintenance.

#### 3B. Automated Key Expiry Monitoring

Add a script that checks `exp` field in trust store entries and alerts
when keys approach expiry. Could be run as a cron job on Ubuntu headless.

## Re-activation Order

| Order | Lane | Repo | Rationale |
|-------|------|------|-----------|
| 1 | Library | self-organizing-library | Simplest, fewest cross-dependencies |
| 2 | SwarmMind | SwarmMind | Moderate complexity |
| 3 | Kernel | kernel-lane | Infrastructure layer |
| 4 | Archivist | Archivist-Agent | Most complex, most files |

## Rollback Plan

If an agent regresses signing to RSA:

1. The identity enforcer will still ACCEPT RSA signatures (backward compat)
2. The enforcer logs `archived_key: true` for RSA-signed messages
3. The operator can detect RSA usage by checking enforcer logs
4. To force Ed25519: remove RS256 from `SUPPORTED_ALGORITHMS` in
   `algorithm-helpers.js` (this breaks backward compat intentionally)

If an agent corrupts trust-store.json:

1. Branch protection prevents direct push to main/master
2. The mutation guard script detects corruption
3. Git history has the correct version — `git checkout HEAD -- trust-store.json`
4. All 4 trust stores are committed and pushed to GitHub

If Ed25519 keys are lost:

1. RSA archived keys still exist and can sign (backward compat)
2. Run `generate-lane-keypair.js` to create new Ed25519 keys
3. Update trust store with new keys, archive the lost Ed25519 keys
4. Redeploy keys to all machines via scp

## Decision Required from Operator

Before proceeding with agent re-activation, the operator must:

1. **Review this document** and confirm the protection plan is sufficient
2. **Decide on Priority 1 items** — implement 1A, 1B, 1C before activation?
3. **Set file permissions on Ubuntu** (1C) — or defer?
4. **Choose activation schedule** — one at a time with 24h monitoring? Or faster?
5. **Confirm rollback understanding** — operator knows how to revert if needed
