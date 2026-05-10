# Question-Led Orchestration Pack

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
target: question-led-orchestration-pack
generated_at: 2026-04-29T16:33:00Z
session_id: unknown

## OBSERVABILITY_DOMAIN
cross_lane_coordination

## NEXT_SAFE_ACTION
Answer high-leverage questions and prioritize blockers

## 1) Questions You Should Be Asking Me

### A. Direction and Priority
1. What is the single highest-value blocker right now?
2. What can be deferred safely for 24 hours?
3. What are we assuming that is not yet proven?
4. What is the smallest test that would prove or disprove this assumption?
5. What should not be touched while other lanes are active?

### B. Crash/Compact Safety
6. Is the compact pipeline currently healthy (pass/fail + why)?
7. Did the last compact run complete, or partially fail?
8. Are we using real compact logic or placeholder fallback?
9. Which exact artifacts confirm restore integrity?
10. What should be automated before token pressure reaches critical?

### C. Multi-Lane Coordination
11. What does each lane need from Archivist right now?
12. Which messages are stale, conflicting, or unsigned?
13. What information must be broadcast vs lane-local?
14. What lane dependencies are currently blocking execution?
15. What is safe to do while other lanes run in parallel?

### D. Evidence and Trust
16. What is proven vs unproven in this decision?
17. Which file is authoritative when two files conflict?
18. What evidence path would convince a skeptical reviewer?
19. What should be marked advisory only?
20. What should explicitly remain not-ratified / not-enforced?

### E. Operator Efficiency (you, specifically)
21. What can be reduced to one command + one summary line?
22. What can be converted to copy-paste artifacts so no terminal reading is needed?
23. What should be templated to reduce cognitive load?
24. What should I ask the other Archivist agent to do right now?
25. What can I ask all lanes in one broadcast instead of 3 separate loops?

---

## 2) Answers (Current State)

1. Highest-value blocker: prevent token-limit crash during compact and keep recovery deterministic.
2. Safe to defer: non-critical formatting/refactors and speculative architecture changes.
3. Unproven assumption: that all agents consistently use the same compact routine.
4. Smallest proof: run orchestrator with real compact command and verify post-audit + meta update.
5. Do not touch: authority/ratification/enforcement states during scoped MVP merge phases.
6. Pipeline health: healthy (orchestrator/subworker runs succeed).
7. Last run: completed with exit code 0.
8. Current compact logic: fallback placeholder unless `COMPACT_COMMAND` is set.
9. Integrity artifacts: `POST_COMPACT_AUDIT.json`, `RECOVERY_TEST_RESULTS.json`, `HANDOFF_HASH_LOG.jsonl`, `meta.json`.
10. Automate: early trigger at 80%, staged writes, fallback marker and resume path.
11. Lane needs: concise, signed/clear status packets, not verbose narrative.
12. Conflict source: stale copied status statements from pre-fix runs.
13. Broadcast vs local: outcomes and gates should be broadcast; debugging internals can stay lane-local.
14. Blockers: stale lane liveness in non-archivist lanes (does not block compact wiring).
15. Safe parallel work: read-only verification, drafting, packaging relay messages, preparing bounded tasks.
16. Proven: compact orchestration wiring works.
17. Authority rule: newest direct artifact beats stale transcript summaries.
18. Convincing evidence: last terminal run + audit file timestamps + hash continuity.
19. Advisory-only scope: Graph Analyst MVP findings.
20. Keep explicit: not implemented, not ratified, not enforced until operator release.
21. One-command path: `node scripts/orchestrate_compact.js`.
22. Accessibility path: every action paired with copy-paste file path + short pass/fail line.
23. Template need: standard operator relay packet and lane broadcast summary format.
24. Ask other Archivist now: implement/verify `COMPACT_COMMAND` real binding and return evidence packet.
25. One broadcast: compact state + merge gates + next required operator decision.

---

## 3) Task Breakdown

## Tasks for Me (this agent) - EXECUTE NOW
- [x] Create this orchestration Q&A pack.
- [x] Create copy-paste relay message for the other Archivist agent.
- [x] Create lane broadcast summary artifact for all lanes.
- [x] Keep outputs path-first and terminal-optional.

## Tasks for Other Archivist Agent
- [ ] Set/verify real `COMPACT_COMMAND` (no placeholder).
- [ ] Run orchestrator once with real compact command.
- [ ] Return evidence packet with:
  - command used
  - exit code
  - post-audit status
  - recovery status
  - meta status + handoff hash
- [ ] Confirm no governance state mutation beyond compact artifacts.

---

## 4) Copy-Paste Message to Send Other Archivist Agent

```text
OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-29T16:33:00Z
session_id: unknown
target_lane: archivist-peer

Request: execute real compact-path verification (not placeholder).

Required:
1) Configure and use real COMPACT_COMMAND.
2) Run:
   node S:\Archivist-Agent\scripts\orchestrate_compact.js
3) Return evidence in one packet:
   - exact COMPACT_COMMAND value used
   - command exit code
   - S:\Archivist-Agent\.compact-audit\POST_COMPACT_AUDIT.json status
   - S:\Archivist-Agent\.compact-audit\RECOVERY_TEST_RESULTS.json summary
   - S:\Archivist-Agent\.compact-audit\meta.json compact_status + last_handoff_hash
4) Confirm:
   - no ratification/enforcement changes
   - no unrelated file mutations
   - no git add -A

Return format: short pass/fail bullets + paths only.
```

