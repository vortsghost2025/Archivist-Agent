# 4-Lane Deep Code Review — Session Update 2026-04-21T14:00Z

**Based on:** `S:/kernel-lane/docs/FOUR_LANE_REVIEW_DEEP_2026-04-21.md` (475 lines, 12 failure surfaces)
**Updated by:** Archivist session (opencode, GLM-5.1)
**Purpose:** Track which deep-review findings have been resolved vs. still open

---

## Findings Status Matrix

### Archivist Findings

| # | Finding | Status | Fix |
|---|---------|--------|-----|
| 1 | `forceRelease()` bypasses quarantine without authorization | **OPEN** | No fix yet — needs authorization gate |
| 2 | `swarmmind-verify.js` is a ghost (returns UNTESTED) | **OPEN** | Bridge is disconnected by design until SwarmMind has persistent agent |
| 3 | Continuity handshake would FAIL (key_id mismatch) | **RESOLVED** | Trust store rebuilt with correct key_ids. Archivist key rotated to `583b2c36f397ef01`. All 4 lanes match. |
| 4 | Identity detection is directory-name check | **OPEN** | `detectLane()` still uses path matching. Low priority — directory names are set by deployment |
| 5 | All 4 lane passphrases in single plaintext file | **PARTIALLY RESOLVED** | `.runtime/` added to `.gitignore`. File is local-only, not committed. Risk reduced from "committed to GitHub" to "local disk only". Still a single-point-of-failure on the machine. |
| 6 | Identity enforcement defaults to `warn` | **RESOLVED** | Flipped to `enforce` mode this session. Unsigned messages → `moveToExpired()`, not `processed/` |
| 7 | Parse-failed messages go to `processed/` | **OPEN** | Catch block in scan() still calls `moveToProcessed` for parse errors. Should call `moveToExpired` |

### Library Findings

| # | Finding | Status | Fix |
|---|---------|--------|-----|
| 1 | Schema validation is structural-only | **OPEN** | Semantic validation (real lane check, evidence path existence) not implemented |
| 2 | Identity enforcement not wired into inbox-watcher | **RESOLVED** | `IdentityEnforcer` integrated into Library's inbox-watcher in `enforce` mode this session |
| 3 | Trust store format/location inconsistency | **PARTIALLY RESOLVED** | `lanes/broadcast/trust-store.json` is now canonical. `.trust/keys.json` is legacy. Key_ids reconciled across all sources |
| 4 | AGENTS.md canonical path for Kernel says `kernel-lane` | **OPEN** | Documentation mismatch — code uses `kernel` (correct), docs say `kernel-lane` |
| 5 | No kernel mirror directory in Library | **OPEN** | `lanes/kernel/` not created |

### SwarmMind Findings

| # | Finding | Status | Fix |
|---|---------|--------|-----|
| 1 | `operatorConfirmed: true` bypass undocumented | **OPEN** | No fix yet — needs documentation and cryptographic proof requirement |
| 2 | RecoveryClassifier implicit global | **OPEN** | Line 76 bug not fixed |
| 3 | Inbox watcher unsigned messages pass with WARNING only | **RESOLVED** | `IdentityEnforcer` integrated into SwarmMind's inbox-watcher in `enforce` mode this session |
| 4 | No `cross-lane-sync.js` module | **OPEN** | Cross-lane sync remains file-based |
| 5 | SeccompSimulator is a stub | **OPEN** | No fix — stub creates false confidence |

### Kernel Findings

| # | Finding | Status | Fix |
|---|---------|--------|-----|
| 1 | Fake evidence promotion (Test-Path only) | **OPEN** | No content validation added yet |
| 2 | Null metrics bypass regression | **OPEN** | PowerShell null comparison semantics not fixed |
| 3 | `require_explanation_on_regression` is dead code | **OPEN** | Loaded but never referenced |
| 4 | Windows "proven" contradicts RELEASE_CONTRACT.md | **OPEN** | 4/5 vs 5/5 definition mismatch |
| 5 | Zero identity verification on incoming messages | **RESOLVED** | `IdentityEnforcer` integrated into Kernel's inbox-watcher in `enforce` mode this session |
| 6 | Outgoing messages never signed | **OPEN** | `Signer.js` exists but never called by PowerShell scripts |
| 7 | AGENTS.md has zero integrity protection | **PARTIALLY RESOLVED** | `post-compact-audit.js` hashes governance docs but not AGENTS.md or trust-store.json specifically |
| 8 | Reject-release accepts empty evidence | **OPEN** | No validation on evidence content |
| 9 | `targets.json` corrupted = unhandled crash | **OPEN** | No try/catch around `ConvertFrom-Json` |
| 10 | Heartbeat schema non-compliant | **OPEN** | Missing 17+ v1.1 fields |

### Cross-Lane Findings

| # | Finding | Status | Fix |
|---|---------|--------|-----|
| Q1 | Delivery verification proves existence, not truth | **PARTIALLY RESOLVED** | Identity enforcement now active — `from` field cryptographically verified in `enforce` mode. Evidence path existence still not checked. |
| Q2 | Identity chain partially symbolic | **RESOLVED** | 4/4 lanes have active keys. Trust store populated and verified. Identity enforcement in `enforce` mode. Messages without valid signatures are structurally rejected. **Caveat:** outbound messages still unsigned. |
| Q3 | Scheduled watchers = periodic activity, not autonomy | **OPEN** | Watchers scan and move files but don't trigger builds, escalate, or remediate |
| Q4 | Cross-lane protections inconsistent | **IMPROVED** | Identity enforcement now consistent across all 4 lanes. Lease enforcement still SwarmMind-only. Message signing still 0/4 outbound. |
| Q5 | Compact restore can preserve behavior but restore wrong state | **PARTIALLY RESOLVED** | `post-compact-audit.js` added with multi-source contradiction test, tamper-evident handoff hashing, 11-test recovery suite. **Still open:** doesn't hash AGENTS.md, trust-store.json, or .identity/ files |
| Q6 | All lanes have code paths that can silently degrade | **OPEN** | No file-integrity protection for operational configs. AGENTS.md already overwritten once. |

---

## Top 5 Risks (Updated)

### Risk 1: Fake Evidence Promotion (Kernel — CRITICAL) — UNCHANGED
No content validation added. Empty benchmark data still passes all gates.

### Risk 2: All-Lane Key Compromise (Archivist — CRITICAL) — DOWNGRADED to HIGH
`.runtime/lane-passphrases.json` is now gitignored and local-only. No longer committed to GitHub. Still a single-point-of-failure on the machine, but attack surface reduced.

### Risk 3: Unauthenticated Cross-Lane Communication (All — HIGH) — DOWNGRADED to MEDIUM
**Inbound:** Identity enforcement now `enforce` mode on all 4 lanes. Unsigned messages structurally rejected at inbox-watcher level. **Outbound:** Still 0/4 lanes sign messages. An attacker who can write to a canonical inbox path is now blocked for unsigned messages. But a compromised lane's signing key can still produce valid forged messages.

### Risk 4: Null Metrics Silent Failure (Kernel — HIGH) — UNCHANGED
Full-spectrum silent failure still exists in benchmark pipeline.

### Risk 5: File Integrity Attack Surface (All — HIGH) — NEW (was implicit in Q6)
Any subagent with write access can modify AGENTS.md, trust-store.json, .identity/, config/targets.json without detection. The post-compact-audit hashes governance docs but not operational configs. The AGENTS.md overwrite incident proved this is a real attack vector.

---

## What Changed This Session

1. **Identity chain activated** — 4/4 lanes have RSA-2048 keypairs, trust store populated, key_ids verified
2. **Identity enforcement flipped to `enforce`** — unsigned messages structurally rejected, not just warned
3. **Post-compact audit built** — contradiction test, tamper-evident handoff, multi-source truth reload, 11-test recovery suite
4. **Audit wired into all 4 lanes' AGENTS.md** — session start protocol now mandates running audit; `conflicted` status = stop and escalate
5. **Passphrase file gitignored** — `.runtime/` excluded from commits
6. **Attestation modules deployed to Kernel** — KeyManager, Signer, Verifier, TrustStoreManager copied

## What Still Needs Doing (Priority Order)

1. **Sign outbound messages** — every lane should sign messages before writing to outbox
2. **Content validation in promote-release.ps1** — require non-null metrics, SHA-256 checksums
3. **Fix null-metrics regression bypass** — PowerShell `$null -gt threshold` comparison
4. **Hash operational configs in post-compact-audit** — AGENTS.md, trust-store.json, .identity/
5. **Add authorization to `forceRelease()`** — log who released, require proof
6. **Fix parse-failed messages going to processed/** — route to expired/
7. **Fix Library AGENTS.md kernel path** — `kernel-lane` → `kernel`
8. **Create kernel mirror directory in Library** — `lanes/kernel/`
9. **Document `operatorConfirmed` bypass** — and restrict to cryptographic proof
10. **Add try/catch for targets.json** — prevent crash on corrupted config
