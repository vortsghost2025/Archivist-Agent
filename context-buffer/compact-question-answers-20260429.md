# Answers to the Compact/Restore Questions


OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: compact question answers
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
compact-restore

## NEXT_SAFE_ACTION
Validate answers against current recovery suite

Below are concise answers to each of the questions listed in `compact-question-list-20260429.md`. Use these to understand the system, configure it, and plan further actions.

## Purpose & Highâ€‘Level Design
1. **Purpose** â€“ The compact routine creates a lightweight, tamperâ€‘evident snapshot of the current Archivist state (meta, handoff, audit) so the system can discard excess context, avoid token overflow, and recover reliably after crashes.
2. **Phenotype checkpoint** â€“ In the Library lane, a compact snapshot is treated as a *phenotype*: a stable representation of the system that can be reâ€‘loaded, allowing the Library to filter out noisy user input and resume from a clean baseline.
3. **Staged, crashâ€‘safe writes** â€“ By writing the handoff hash, then recovery test results, then the full audit, any interruption leaves the system in a known state (`compact_status: "incomplete"`). On restart, the fallback logic restores the previous checkpoint.

## Configuration & Triggering
4. **Token budget** â€“ Defined by `TOKEN_LIMIT` (default 128â€¯000 tokens). The orchestrator checks `meta.last_token_usage` against this limit.
5. **Adjust thresholds** â€“ Edit `scripts/orchestrate_compact.js` (or a configuration file) to change `TOKEN_LIMIT` or `TRIGGER_FRACTION` (default 0.80 â†’ 80â€¯%).
6. **Detection** â€“ The orchestrator reads `.compact-audit/meta.json`. When `last_token_usage / TOKEN_LIMIT >= TRIGGER_FRACTION`, it creates a compact request.
7. **Set real compact command** â€“ Export an environment variable before running the orchestrator:
   ```bash
   set COMPACT_COMMAND=yourâ€‘compactâ€‘executableâ€‘orâ€‘script
   ```
   If `COMPACT_COMMAND` is defined, `run-compact-with-audit.js` will exec it; otherwise it falls back to a safe placeholder.

## Execution Flow
8. **Stages in `subcompact_worker.js`**:
   - Capture preâ€‘compact snapshot (`capturePreCompact`).
   - Run the compact step (`performCompact` â†’ either placeholder or `COMPACT_COMMAND`).
   - Log the handoff hash (`generateTamperEvidentHandoff`).
   - Run quick recovery tests (lane liveness) and write `RECOVERY_TEST_RESULTS.json`.
   - Run the full postâ€‘compact audit (`audit.run()`).
   - Write a response JSON for the orchestrator.
9. **Files written**:
   - `COMPACT_CONTEXT_HANDOFF.md` (or `.json` if you change it).
   - `HANDOFF_HASH_LOG.jsonl` (appended with hash record).
   - `RECOVERY_TEST_RESULTS.json` (liveness and messageâ€‘loss report).
   - `POST_COMPACT_AUDIT.json` (full diff and status).
   - Updated `.compact-audit/meta.json` (status, timestamp, hash).
10. **Orchestrator flow** â€“ Creates a request JSON in `lanes/archivist/outbox`, spawns `subcompact_worker.js`, waits for it, reads the response JSON from `lanes/archivist/inbox`, updates meta, and logs the final status.
11. **Successful run artifacts** â€“ The four files above plus the request/response JSONs.

## Recovery & Verification
12. **Recovery test** â€“ Checks each lane's heartbeat (`alive` vs `stale`), counts alive lanes, and verifies no inbox messages were lost.
13. **Audit statuses**:
    - `aligned` â€“ No unexpected changes; handoff hash matches; system is consistent.
    - `drifted` â€“ Nonâ€‘critical mismatches such as lane liveness failures (expected when some lanes are stale).
    - `conflicted` â€“ Critical mismatches (e.g., bootstrap or governance files changed) that require manual intervention.
14. **Handoff hash** â€“ SHAâ€‘256 of the handoff payload. Stored in `HANDOFF_HASH_LOG.jsonl` and compared in the audit to guarantee the handoff file was not altered.
15. **Fallback** â€“ If any stage fails, `meta.compact_status` is set to `"incomplete"` and `fallback_attempted` is true. On the next orchestrator run, the script restores the previous preâ€‘compact snapshot and retries.
16. **Verification after run** â€“ Check `POST_COMPACT_AUDIT.json` for `status: "aligned"` and ensure `meta.compact_status` is `"idle"`. The handoff hash in meta should match the latest entry in the hash log.
17. **Interpreting stale lanes** â€“ A recovery test may report `lane_liveness: failed` when some lanes are intentionally paused. This does **not** indicate a compact failure; it is recorded as `drifted` but the compact remains safe.

## Metadata & Continuity
18. **Fields in `meta.json`**:
    - `compact_status` â€“ `idle`, `running`, or `incomplete`.
    - `last_checkpoint_ts` â€“ Epoch ms of last successful compact.
    - `last_token_usage` â€“ Token count at the time of the last check.
    - `last_handoff_hash` â€“ SHAâ€‘256 of the most recent handoff.
    - `fallback_attempted`, `fallback_reason`, `fallback_error` â€“ Debug info for interrupted runs.
19. **Fallback flag** â€“ Set automatically when a stage throws or the process is killed. It remains until a successful run clears it.
20. **Persisting handoff hash** â€“ Updated in meta after each successful run; also appended to `HANDOFF_HASH_LOG.jsonl` for auditability.

## Crossâ€‘Lane & Phenotype Integration
21. **Library phenotype** â€“ The Library lane treats a compact snapshot as a phenotype: it can reload the saved state, discard noisy user messages, and continue processing from that clean baseline.
22. **Reload steps** â€“ After a compact, the Library reads the latest handoff file, verifies the hash, and restores internal structures (e.g., graph caches) from the saved phenotype.
23. **Filtering noise** â€“ Stale inbox messages or outdated user commands are ignored during reload, ensuring only the compacted context influences further work.
24. **Coordinating other lanes** â€“ Other lanes can watch for the `compact-response-*.json` file or monitor `POST_COMPACT_AUDIT.json` to know when a compact has completed and optionally pause their own work until the system is stable.

## Maintenance & Extensibility
25. **Replace placeholder** â€“ Implement your real compact logic (e.g., pruning caches, generating indexes) inside `subcompact_worker.js` or set `COMPACT_COMMAND` to a script that performs those actions.
26. **Scheduling** â€“ Use a cron job or a longâ€‘running watcher that periodically runs `node scripts/orchestrate_compact.js` or invokes it when token usage is high.
27. **Cleanup** â€“ Old snapshots, hashâ€‘log entries, and audit files can be pruned after a configurable retention period (e.g., 30â€¯days) using a simple cleanup script.
28. **Security** â€“ The handoff hash log provides tamper evidence; protect the `.compact-audit` directory and the trust store (`lanes/broadcast/trust-store.json`) with appropriate file permissions.
29. **Governance compliance** â€“ All writes occur in the canonically defined lane directories; the compact process respects the lane inbox/outbox protocol and does not modify governance files.
30. **Monitoring** â€“ Set up alerts on nonâ€‘`aligned` audit statuses, on `fallback_attempted` being true, or on repeated laneâ€‘liveness failures.

---

These answers should give you the context needed to turn the information into concrete tasks for both Archivist agents.
