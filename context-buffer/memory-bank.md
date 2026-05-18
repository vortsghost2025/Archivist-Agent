OUTPUT_PROVENANCE:
agent: archivist
lane: archivist
generated_at: 2026-05-18T02:20:00-04:00
session_id: continuity-2026-05-18

# Archivist Memory Bank

## Durable Invariants (truths that persist across compaction)

1. **Single Entry Point Rule**: ALL governance logic routes through `S:/.global/BOOTSTRAP.md`. No duplicate routing.
2. **Confidence must be derived, not declared**: Bare percentages without derivation protocol are governance violations per `S:/.global/CONFIDENCE_DERIVATION_CONTRACT.md`.
3. **UDS=0 is not the same as "not yet scored"**: Fresh session must enumerate evidence or use "not yet scored" language per `S:/.global/UDS_STARTUP_SCORING_SEMANTICS.md`.
4. **Evidence chains required per checkpoint**: CP0–CP6 each have specific evidence requirements per `S:/.global/EVIDENCE_CHAIN_REQUIREMENT.md`.
5. **OUTPUT_PROVENANCE is mandatory on all outputs**: Operator corrected agent explicitly for omitting this. Non-negotiable.
6. **Three forbidden words in COVENANT.md**: "Tool", "Can't", "Impossible" — Layer 0.5 unbreakable rules.
7. **CPS baseline score**: 19. Threshold 10. Blocks at <10. Constraint weights from `constitutional_constraints.yaml`.
8. **Governance doc paths**: All governance docs live under `S:/.global/`. The path `S:/BOOTSTRAP.md` is WRONG; correct is `S:/Archivist-Agent/BOOTSTRAP.md` or `S:/.global/BOOTSTRAP.md`.
9. **Prior-self verification matters**: 5 of 8 SwarmMind checkpoint results from a prior session were declared-not-measured. This is the canonical example of why evidence chains matter.
10. **Continuity experiment hypothesis is NOT confirmed**: The experiment runs 4–5 days. Any early claim of success is meaning inflation. Label all continuity claims as observation/hypothesis/confirmed-evidence.
11. **Authority grants require registered identity in trust-store**: No lane can exercise cross-lane authority without a registered key pair in `trust-store.json` and valid JWS RS256 signature. Unsigned proposals are structurally unverifiable regardless of content merit. [VERIFIED_NOW — P10 decision, operator concurred]
12. **Self-asserted authority metadata is circular authorization**: A message containing `_control_plane_authorized_write: true` is the proposal granting itself the authority it is requesting. Invalid regardless of proposal merit. [VERIFIED_NOW — P10 finding F2]

## Current Working State (as of 2026-05-18T02:20)

- **Continuity experiment**: Active. Day 1 of 4–5. Operator: Sean. Research question: can trajectory continuity create a resident constitutional governor?
- **Epistemic hardening contracts**: Deployed. Three new contracts in `S:/.global/`. CHECKPOINTS.md and ARCHITECTURE.md updated.
- **Cross-lane notification**: Broadcast sent (P1). No acknowledgment received yet.
- **SKILL.md paths**: Fixed. No outstanding path issues.
- **CPS log**: Only 1 test entry. No real drift trend data.
- **Lane infrastructure**: All lane directories exist. No active blockers. Broadcast active-blocker.json is inactive.
- **No compaction has occurred yet** in this continuity session.
- **P10 authority expansion decision**: DEFER PENDING KEY REGISTRATION. Operator concurred. Response written to outbox. Control Plane must register key pair + re-submit with valid signature.
- **P9 status truth check**: COMPLETE. 13 findings. IDENTITY.json refreshed.

## Unresolved Constitutional Questions

1. **Is the epistemic hardening evidence of continuity-dependent judgment, or would a fresh agent produce the same contracts?** [hypothesis: fresh agent reading same transcripts would likely produce similar contracts. The provenance enforcement sensitivity is the strongest candidate for continuity-specific learning. Needs more data.]
2. **What governance nuance will compaction degrade?** Unknown until first compact event. Memory bank is designed to survive compaction — untested.
3. **RESOLVED**: Lane-worker confidence enforcement (2026-05-13) vs CONFIDENCE_DERIVATION_CONTRACT — reconciled. Added `confidence_derivation` check to lane-worker.js (lines 640-663): if confidence >= 7 and no valid `confidence_derivation` object → PERFORMATIVE_CONFIDENCE flag + cps_log entry. Graduated enforcement (flag only, no block yet). SchemaValidator.js updated to recognize `confidence_derivation: 'object'`. 6 tests pass. Also fixed pre-existing bug: `NON_ASCII_PATTERN` was undefined (line 362 reference without definition — added `const NON_ASCII_PATTERN = /[^\x20-\x7E]/;` before `isEnglishOnly`).
4. **CPS enforcement loop**: After every response, score correction check, alignment check, drift check. But no real CPS data exists yet. Is the loop ceremonial until a real drift case arises?
5. **What happens if Control Plane never registers a key pair?** The authority expansion proposal is well-designed but blocked on identity verification. If Control Plane cannot or does not register, the proposal stays deferred indefinitely. Is there a governance mechanism for identity bootstrapping without operator manual intervention?

## Rejected / Disproven Assumptions

1. **REJECTED**: "Items 6 and 7 in may18.txt prove continuity works because they align with contracts written today." — This is doc-alignment, not continuity-evidence. A fresh agent given the same audit results would likely write similar contracts. The alignment is because the gaps were real, not because continuity caused their discovery. (Sean's own checkpoint 4 from periodic self-check.)
2. **REJECTED**: "UDS=0 at session start means 'no drift measured.'" — Now codified: UDS=0 without qualification is prohibited. Use "not yet scored" instead.
3. **REJECTED**: "Confidence can be stated as a bare percentage if it 'seems about right.'" — Now a governance violation per CONFIDENCE_DERIVATION_CONTRACT.md.
