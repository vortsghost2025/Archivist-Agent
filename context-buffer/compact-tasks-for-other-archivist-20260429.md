# Tasks for the Other Archivist Agent (Compact Coordination)


OUTPUT_PROVENANCE:
agent: archivist-lane
lane: archivist
target: compact tasks for other archivist instances
generated_at: 2026-04-29
session_id: archivist-2026-04-29

## OBSERVABILITY_DOMAIN
compact-restore

## NEXT_SAFE_ACTION
Verify task handoff to other instances completed

These tasks are intended for the second Archivist instance that is operating in parallel. They focus on synchronizing with the compact process you just completed and ensuring the other laneâ€™s state stays consistent.

1. **Consume the Compact Response**
   - Watch `lanes/archivist/inbox/` for a file matching `compact-response-*.json`.
   - Parse the JSON and verify:
     * `status` is `aligned`.
     * `handoff_hash` matches the value recorded in your own `.compact-audit/meta.json` (if you also run compacts) or at least is a valid SHAâ€‘256 string.
   - Acknowledge receipt by moving the response file to `lanes/archivist/processed/`.

2. **Update Local Meta (if applicable)**
   - If this lane also runs its own compact routine, update its `.compact-audit/meta.json` fields:
     * `last_handoff_hash` â†’ value from the response.
     * `compact_status` â†’ `idle`.
   - Ensure `last_token_usage` is refreshed (you may reuse the tokenâ€‘usage script from the primary agent).

3. **Adjust Lane Liveness Expectations**
   - The recovery test recorded only 2 of 4 lanes alive. If the other two lanes are intentionally paused, update their heartbeat files in `lanes/<lane>/inbox/` to reflect a `stale` status rather than `dead`.
   - If the other lanes should be alive, investigate the missing heartbeat JSONs and restart those lane processes.

4. **Schedule a Followâ€‘Up Compact (optional)**
   - After confirming the handoff hash, you may trigger a compact on this lane as well (run `node scripts/orchestrate_compact.js`). This keeps both Archivist lanes in sync.

5. **Log a Coordination Message**
   - Write a JSON message to `lanes/archivist/outbox/compact-sync-<ts>.json` with the following shape:
   ```json
   {
     "id": "compact-sync-20260429",
     "from": "archivist",
     "to": "archivist",
     "timestamp": "2026-04-29T12:30:00Z",
     "priority": "P0",
     "type": "task",
     "body": "Compact sync completed â€“ handoff hash verified, meta updated, lane liveness reconciled.",
     "requires_action": false
   }
   ```
   - This serves as a provenance record for the other lane and for any downstream agents.

6. **Verify No Drift Flags**
   - Run `node scripts/run-compact-with-audit.js` with `COMPACT_COMMAND` unset (placeholder) just to generate a quick audit and confirm that `POST_COMPACT_AUDIT.json` shows `status: aligned` and no unexpected changes.

7. **Report Summary to All Lanes**
   - After completing the above steps, send a brief summary message to the broadcast lane (`lanes/broadcast/outbox/compact-summary-<ts>.json`) indicating that both Archivist agents have synchronized their compact state.

These steps will close the loop between the two Archivist instances, ensuring that the compact/restore pipeline remains reliable across the whole system.
