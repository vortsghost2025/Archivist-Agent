# Verification Triage Report — High-Authority Unverified Nodes

**Generated**: 2026-04-30T20:55:06.275Z  
**Analyzed by**: SwarmMind (dry-run)  
**Snapshot**: snapshot-2026-04-29-08-41-47

---

## Executive Summary

| Metric | Count |
|---|---|
| Unverified nodes with authorityDepth ≥ 70 | **330** |
| Likely structural (low verification priority) | **75** |
| Governance/docs (high verification priority) | **25** |
| Ambiguous (manual review needed) | **230** |

---

## Classification Logic

- **Structural**: File names/tags indicate configs, builds, CI, dependencies, licenses, etc. These typically don't need content verification.
- **Needs verification**: Titles/tags indicate governance, protocols, policies, frameworks, specs — content that must be verified.
- **Ambiguous**: No clear pattern; requires human judgment.

---

## Repository Breakdown (Top 10)

| self-organizing-library | 330 | 75 | 25 | 230 |

---

## Top 20 Structural Candidates (Low Priority)

These are likely config/build files that can be auto-tagged as `verification_priority:low`.

- 564e1d02561e7243: CONTINUITY_REGISTRY.json (self-organizing-library) authorityDepth:90
- 4e6ee4593d7bb180: drizzle.config.ts (self-organizing-library) authorityDepth:90
- 80a27d34983899f5: eslint.config.mjs (self-organizing-library) authorityDepth:90
- 42642844ba4227f8: kilo.json (self-organizing-library) authorityDepth:90
- 7cd14bfa393bf304: library_collaborative_summary.json (self-organizing-library) authorityDepth:90
- 092ca590ff391e8c: next.config.ts (self-organizing-library) authorityDepth:90
- acf6082f46db3e15: package.json (self-organizing-library) authorityDepth:90
- 6f61bcc16933d14d: postcss.config.mjs (self-organizing-library) authorityDepth:90
- 304b32d1587a9a60: SESSION_REGISTRY.json (self-organizing-library) authorityDepth:90
- 8be5a83a3e225694: tsconfig.json (self-organizing-library) authorityDepth:90
- 79b290aef443ccc0: verdict.json (self-organizing-library) authorityDepth:90
- 8321a240677da0a5: canonical-message-builder.js (self-organizing-library) authorityDepth:90
- a9ff0e8b389b3b42: allowed_roots.json (self-organizing-library) authorityDepth:90
- 845754c5371ad7be: verification-domain-gate.json (self-organizing-library) authorityDepth:90
- 65446e22f21c93f0: daemon-state.json (self-organizing-library) authorityDepth:90
- 6892c4c220926a8d: site-index-summary.json (self-organizing-library) authorityDepth:90
- cb3754c653cda71f: site-index.json (self-organizing-library) authorityDepth:90
- 8717eb7dcbd2b378: homepage.json (self-organizing-library) authorityDepth:90
- 36baa4bc2b1ff7c4: .c6aa8d7abf14d09ccba825952e0e8c9f1153f0ed-audit.js (self-organizing-library) authorityDepth:90
- 4a7e20f91d7ed957: context-restore.json (self-organizing-library) authorityDepth:90

---

## Top 20 High-Priority Verification Candidates

These are governance/docs that should be prioritized for verification.

- 981834ecc31a5111: deliver-reaudit-request.js (self-organizing-library) authorityDepth:90
- a6e52e0d99f4958a: deliver-review-summary.js (self-organizing-library) authorityDepth:90
- ee675c19fdbc0e15: completion-gate-audit.js (self-organizing-library) authorityDepth:90
- 39603b312b272cbe: completion-proof-audit.js (self-organizing-library) authorityDepth:90
- 0ed4148cd9826f1a: concurrency-policy.js (self-organizing-library) authorityDepth:90
- 633798e34dd7d9ee: deliver-e2e-review.js (self-organizing-library) authorityDepth:90
- ad95c473f2fbba73: fix-trust-stores.js (self-organizing-library) authorityDepth:90
- 9aaac022862fbdc3: full-lane-review-and-dispatch.js (self-organizing-library) authorityDepth:90
- d55100fa5f645e1a: governance-message-verifier.js (self-organizing-library) authorityDepth:90
- 5b22ba3dc5337581: post-compact-audit.js (self-organizing-library) authorityDepth:90
- d4375f3e0816afd1: run-compact-with-audit.js (self-organizing-library) authorityDepth:90
- eff8de63a02db085: security-drill.js (self-organizing-library) authorityDepth:90
- 4aa8b932746cc168: send-ack-system-code-review.js (self-organizing-library) authorityDepth:90
- dfd2675a526e61ab: sync-identity-from-trust.js (self-organizing-library) authorityDepth:90
- cbdef5af527e8352: test-identity-enforcement.js (self-organizing-library) authorityDepth:90
- 1908b5a1f995e03e: test-outcome-protocol.js (self-organizing-library) authorityDepth:90
- 210683f4a537172f: test-verification-domain-gate.js (self-organizing-library) authorityDepth:90
- dbeef05054943bec: trust-normalization-test.js (self-organizing-library) authorityDepth:90
- ea2bc00e06c31e01: verification-domain-gate.js (self-organizing-library) authorityDepth:90
- 978d393da343051e: test-attestation.js (self-organizing-library) authorityDepth:90

---

## Patch Preview

If approved, the following tags would be added:

| Category | Tag | Purpose |
|---|---|---|
| Structural | verification_priority:low | Suppress verification alerts |
| Governance | verification_priority:high | Mark for priority verification |
| Ambiguous | verification_priority:medium, needs_manual_review:true | Flag for human triage |

**Files modified**: Only the graph snapshot (in-place with backup if apply is run)

---

## Next Steps

1. Review this report and the top candidate lists
2. Approve patch application if classification looks correct
3. Apply patch: `node analyze-unverified-authority.js --apply`
4. After apply, run lane-worker to propagate tag changes
5. Monitor verification queue — it should now be better prioritized

---

**Confidence**: MEDIUM — heuristics are based on common patterns but should be spot-checked on a sample before full apply.
