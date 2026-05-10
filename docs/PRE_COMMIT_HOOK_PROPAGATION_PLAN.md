# Pre-Commit Hook Propagation Plan

**Status:** PLAN ONLY — no deployment, no cross-lane mutation
**Created:** 2026-05-10
**Author:** Archivist lane (solo cleanup session)
**Scope:** Archivist-Agent repo only; other lanes are reference targets

---

## 1. Current Local Hook Behavior

The Archivist `.git/hooks/pre-commit` (222 lines, Node.js) runs 6 checks in order:

| # | Check | Script Called | Blocking? |
|---|-------|---------------|-----------|
| 1 | Sovereignty scan | `scripts/sovereignty-enforcer.js --lane Archivist --strict` | Yes |
| 2 | CI/CD Gate 2 (schema compliance) | `scripts/cicd-sovereignty-gates.js --lane Archivist --gate=2 --strict` | Yes |
| 3 | Canonical script guard | `scripts/canonical-script-guard.js` | Yes |
| 4 | Lint | `npm run lint` (if defined in package.json) | Yes |
| 5 | Secret scan | Inline: auth patterns + JWS-in-lane-dir detection | Yes |
| 6 | Trust store validation | Inline: `computeKeyId()` + `validateTrustStore()` | Yes |

**Key implementation details:**

- `computeKeyId(pem)` — extracts SPKI DER from PEM via `crypto.createPublicKey()`, hashes with SHA-256, returns first 16 hex chars. **Hardened**: returns `null` on PEM parse failure instead of hashing raw PEM text (the old buggy behavior that caused false mismatches).
- `validateKeyId(pem, expectedKeyId)` — returns `null` on parse failure, `true`/`false` otherwise.
- `validateTrustStore()` — reads `lanes/broadcast/trust-store.json`, iterates entries, skips entries where `computeKeyId()` returns `null` with a warning.
- Secret scan blocks: OpenAI keys (`sk-`), GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`), private keys, JWTs, and JWS signing tokens in lane directory files.

---

## 2. What Is Tracked vs Untracked Today

### Tracked in repo (visible to git)

| Path | Lines | Language | Status |
|------|-------|----------|--------|
| `scripts/pre-commit.ps1` | 38 | PowerShell | **DEAD/LEGACY** — lint + basic secret scan only; NOT what actually runs |
| `scripts/setup-hooks.js` | 97 | Node.js | **OUTDATED** — installs a shell-based sovereignty+journal hook, NOT the current 222-line Node.js hook |
| `scripts/sovereignty-enforcer.js` | — | Node.js | Active, shared across lanes |
| `scripts/cicd-sovereignty-gates.js` | — | Node.js | Active, Archivist-only |
| `scripts/canonical-script-guard.js` | — | Node.js | Active, Archivist-only |

### NOT tracked (in `.git/hooks/` — invisible to git)

| Lane | `.git/hooks/pre-commit` | Lines | Language | Checks |
|------|------------------------|-------|----------|--------|
| **Archivist** | 222-line Node.js | 222 | Node.js | 6 (sovereignty, Gate 2, script guard, lint, secrets, trust store) |
| **kernel-lane** | Shell script | 68 | Shell | 4 (NTFS check, sovereignty, schema, lint/typecheck/journal) |
| **SwarmMind** | Bash script | 29 | Bash | 1 (sovereignty only) |
| **Library** | Node.js script | 90 | Node.js | 3 (sovereignty, Gate 2, lint/typecheck) |

**Critical gap:** The actual hook that protects every commit is invisible to git. If any machine is cloned fresh, `npm run setup-hooks` installs the **wrong** (outdated shell) hook. The hardened `computeKeyId()` fix only exists in Archivist's untracked hook.

---

## 3. Canonical DER-SPKI key_id Rule

**Formula:** `key_id = SHA-256(DER-SPKI-public-key).substring(0, 16)` — first 16 hex characters of the SHA-256 hash of the DER-encoded SubjectPublicKeyInfo.

**Implementation (Node.js):**

```javascript
function computeKeyId(pem) {
  if (!pem) return null;
  try {
    const key = crypto.createPublicKey(pem);
    const spkiDer = key.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spkiDer).digest('hex').substring(0, 16);
  } catch (e) {
    return null; // HARDENED: never hash raw PEM text on parse failure
  }
}
```

**Why this matters:** The old implementation hashed the PEM string directly on parse failure, producing a deterministic-but-wrong key_id that would always mismatch the stored value, blocking all commits for any lane with a broken PEM. The hardened version returns `null` and skips the entry.

**Key type status across lanes (from `trust-store.json`):**

| Lane | Key Type | key_id | Algorithm | Notes |
|------|----------|--------|-----------|-------|
| archivist | RSA 2048 | `65ae05b2a9e749cb` | RS256 | Stable, no rotation needed |
| library | RSA 2048 | `a5a5f5c2edbee56a` | RS256 | Rotated from `c5423f36603e1491` (passphrase lost) |
| swarmmind | RSA 2048 | `ec467e7103736c28` | RS256 | Ubuntu key pair |
| kernel | RSA 2048 | `4ac54d4100323c71` | RS256 | Fresh keypair (rotated from `d475d23aeed6c7b8`) |

All lanes currently use RSA 2048. The DER-SPKI-SHA256 formula works identically for RSA and Ed25519. Cross-lane signing interop is not affected by key type differences at this time, but convergence to a single key type should be evaluated in a future proposal.

---

## 4. Recommended Tracked Verifier/Template Path

### Proposal: `hooks/pre-commit.js` (tracked in repo)

Move the actual 222-line hook from `.git/hooks/pre-commit` into the repo as a **tracked, reviewable file**:

```
hooks/
  pre-commit.js          # The actual hook logic (current 222-line script)
  README.md              # How to install: node hooks/install.js
  install.js             # Symlinks or copies hooks/pre-commit.js → .git/hooks/pre-commit
```

### `hooks/install.js` behavior:

1. Resolve `.git/hooks/pre-commit` path from repo root
2. If file exists and differs from `hooks/pre-commit.js`, warn and prompt
3. Copy `hooks/pre-commit.js` to `.git/hooks/pre-commit`
4. Set executable permission (`chmod 0o755` on Unix, no-op on Windows)
5. Print confirmation

### Why copy instead of symlink:

- Windows Git Bash does not reliably execute symlinks as hooks
- Copying is simple and cross-platform
- `install.js` can re-run after clone to restore the hook

### What to deprecate:

| File | Action |
|------|--------|
| `scripts/pre-commit.ps1` | Mark deprecated in README, remove in next major cleanup |
| `scripts/setup-hooks.js` | Replace with `hooks/install.js` (currently installs wrong hook) |

### Lane-specific adaptation:

The tracked `hooks/pre-commit.js` should accept a `--lane` parameter or auto-detect the lane from the repo directory name (following the pattern in `setup-hooks.js` lines 31-37). This allows the same template to work across all 4 lanes with:

- **Mandatory checks for all lanes:** sovereignty, lint, secret scan, trust store validation
- **Optional checks (enabled per lane):** Gate 2, canonical script guard, NTFS check, journal
- **Lane-specific config:** `hooks/lane-config.json` or embedded config object

### Lane config example:

```json
{
  "archivist": {
    "gate2": true,
    "canonicalScriptGuard": true,
    "ntfsCheck": false,
    "journal": false
  },
  "kernel": {
    "gate2": true,
    "canonicalScriptGuard": false,
    "ntfsCheck": true,
    "journal": true
  },
  "swarmmind": {
    "gate2": false,
    "canonicalScriptGuard": false,
    "ntfsCheck": false,
    "journal": false
  },
  "library": {
    "gate2": true,
    "canonicalScriptGuard": false,
    "ntfsCheck": false,
    "journal": false
  }
}
```

---

## 5. Deployment Plan Per Lane

### Phase 0: Archivist (this repo) — do first

1. Create `hooks/pre-commit.js` from current `.git/hooks/pre-commit`
2. Create `hooks/install.js`
3. Create `hooks/lane-config.json`
4. Create `hooks/README.md`
5. Test: run `node hooks/install.js`, verify `.git/hooks/pre-commit` matches
6. Test: make a commit, verify all 6 checks still run
7. Commit and push
8. Deprecation: add deprecation notice to `scripts/pre-commit.ps1` and `scripts/setup-hooks.js`

### Phase 1: Library

1. Copy `hooks/pre-commit.js`, `hooks/install.js`, `hooks/lane-config.json` to Library repo
2. Set lane-config for Library (Gate 2 enabled, no script guard, no NTFS, no journal)
3. Test sovereignty + Gate 2 + lint + secret scan + trust store validation
4. Commit and push
5. Verify Library's trust-store.json key_id still validates

### Phase 2: Kernel

1. Copy `hooks/pre-commit.js`, `hooks/install.js`, `hooks/lane-config.json` to Kernel repo
2. Set lane-config for Kernel (Gate 2 + NTFS check + journal enabled)
3. Port NTFS check and journal preflight from current shell hook to Node.js
4. Test all enabled checks
5. Commit and push

### Phase 3: SwarmMind

1. Copy `hooks/pre-commit.js`, `hooks/install.js`, `hooks/lane-config.json` to SwarmMind repo
2. Set lane-config for SwarmMind (sovereignty only + secret scan + trust store validation)
3. This is an upgrade from 1 check to 3+ checks — verify no false positives
4. Commit and push

### Phase 4: Post-deployment verification

1. On each lane: `node hooks/install.js && echo "test" > /tmp/test && git add -A && git commit -m "hook verification"`
2. Verify all expected checks run (check console output)
3. Verify trust store validation passes on each lane
4. Document results in `docs/PRE_COMMIT_HOOK_PROPAGATION_STATUS.md`

---

## 6. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Copy-to-.git/hooks drift** — tracked file diverges from installed hook | Medium | `hooks/install.js` warns if mismatch detected; add to CI check |
| **Windows Git Bash hook execution** — Node.js shebang may not resolve | High | Test on Windows first; shebang `#!/usr/bin/env node` is standard but verify on all machines |
| **NTFS check porting** — kernel's shell-based NTFS check needs Node.js rewrite | Low | Simple regex check (`/[<>:"\\|?*]/`) — trivial port |
| **Journal preflight porting** — kernel's store-journal preflight is advisory, non-blocking | Low | Port as-is with `|| true` fallback |
| **Secret scan false positives** — test fixtures or example configs may trigger patterns | Medium | Add allowlist file (`.pre-commit-allowlist.json`) for known safe patterns |
| **Trust store validation failure on fresh clone** — trust-store.json must exist before hook runs | Low | Hook already gracefully handles missing trust-store (returns `true`) |
| **Lane-config auto-detection** — directory name → lane mapping must match all machines | Low | Fallback to `--lane` CLI arg; auto-detect is convenience, not requirement |
| **Breaking existing kernel/shell workflows** — kernel currently uses shell hook; switching to Node.js changes runtime dependency | Medium | Ensure Node.js is available on kernel-lane machine; keep shell hook as fallback during transition |
| **SwarmMind upgrade from 1→3+ checks** — may surface pre-existing issues blocked by sovereignty-only check | Low | Deploy with `--dry-run` mode first to audit what would be blocked |

---

## 7. Next Safe Action

**Immediate (this session or next):**

1. Create `hooks/pre-commit.js` in Archivist-Agent repo by copying the current `.git/hooks/pre-commit` content
2. Create `hooks/install.js` with copy-to-.git/hooks logic
3. Create `hooks/lane-config.json` with Archivist config
4. Create `hooks/README.md` with install instructions
5. Test locally: `node hooks/install.js` → verify `.git/hooks/pre-commit` matches
6. Commit and push to Archivist-Agent repo
7. Add deprecation notice to `scripts/pre-commit.ps1` and `scripts/setup-hooks.js`

**NOT this session:**

- Do NOT deploy hooks to other lanes
- Do NOT modify other lane repos
- Do NOT standardize key types (separate proposal needed)
- Do NOT reactivate multi-agent workflows

**Verification gate before Phase 1:**

- Archivist tracked hook must work for 3+ commits without issues
- `hooks/install.js` must be tested on a fresh clone scenario
- Operator must confirm readiness before any cross-lane deployment
