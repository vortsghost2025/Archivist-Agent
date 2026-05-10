# Questions to Ask About the Compact/Restore System


OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: compact question list
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
compact-restore

## NEXT_SAFE_ACTION
Update questions for current system state

The following list captures the key questions you should consider when working with the compact/restore pipeline, the orchestrator, and the subâ€‘agent integration. These questions cover purpose, configuration, operation, recovery, and crossâ€‘lane considerations.

## Purpose & Highâ€‘Level Design
1. What is the overall purpose of the compact routine in the Archivist lane?
2. How does the compact routine act as a phenotype checkpoint for the Library lane?
3. Why is a staged, crashâ€‘safe write order important?

## Configuration & Triggering
4. What token budget is used and how is the trigger threshold defined?
5. Where can I adjust the `TOKEN_LIMIT` and `COMPACT_TRIGGER_FRACTION` values?
6. How does the orchestrator detect that a compact is needed?
7. How do I set the real compact command via the `COMPACT_COMMAND` environment variable?

## Execution Flow
8. What are the exact stages executed by `subcompact_worker.js`?
9. What does each stage write to disk (handoff hash log, recovery test, audit)?
10. How does the orchestrator create request/response files and invoke the subâ€‘agent?
11. What files are produced by a successful compact run?

## Recovery & Verification
12. What does the recovery test check (lane liveness, message loss, etc.)?
13. What do the audit statuses `aligned`, `drifted`, and `conflicted` mean?
14. How is the handoff hash calculated and used for integrity verification?
15. What happens if the compact process is interrupted (fallback mechanism)?
16. How can I verify that the compact succeeded after it runs?
17. How do I interpret the `RECOVERY_TEST_RESULTS.json` when some lanes are stale?

## Metadata & Continuity
18. What fields are stored in `.compact-audit/meta.json` and how are they updated?
19. How does the `fallback_attempted` flag work and when is it set?
20. How does the system ensure the handoff hash persists across restarts?

## Crossâ€‘Lane & Phenotype Integration
21. How does the Library lane treat a compact as a phenotype?
22. What steps are needed to reload the last known phenotype after a compact?
23. How does the system filter user noise and undeed information after reload?
24. How can other lanes (Kernel, SwarmMind) be coordinated with the compact process?

## Maintenance & Extensibility
25. How can I replace the placeholder compact operation with a real implementation?
26. How do I schedule periodic compacts or trigger them manually?
27. What cleanup is needed for old compact artifacts (snapshots, logs)?
28. Are there security considerations for the handoff hash log and trust store?
29. How does the compact process respect the governance and lane protocols?
30. What monitoring or alerting should be set up for compact failures?
