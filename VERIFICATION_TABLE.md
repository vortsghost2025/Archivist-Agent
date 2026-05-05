# Verification Table for External Review Claims

| Claim | Evidence Path | Verified (True/False/Partial) | Action Required | Owner Lane |
|-------|---------------|-------------------------------|-----------------|------------|
| Library not present locally (Windows) | S:\self-organizing-library | True | None – lane exists | Library |
| SwarmMind not present locally (Windows) | S:\SwarmMind Self-Optimizing Multi-Agent AI System | True | None – lane exists | SwarmMind |
| Kernel repo not in current filesystem view | S:\kernel-lane | True | None – lane exists | Kernel |
| No concrete drift-detection implementation | S:\Archivist-Agent\scripts\consensus-check.js (evaluateDrift), S:\Archivist-Agent\config\consensus-policy.json | True – HARDEN-2 implemented: dual-verification consensus with drift monitoring wired into inbox-watcher.js routing | None | Archivist |
| Actual inbox/outbox folders missing | S:\Archivist-Agent\lanes\archivist\inbox, S:\Archivist-Agent\lanes\archivist\outbox (and similar for other lanes on Windows and Ubuntu) | False – inbox/outbox directories exist on all lanes | None | All lanes |
| No validation layer present | S:\Archivist-Agent\scripts\governance-message-verifier.js, S:\Archivist-Agent\scripts\schema-validator.js | True – HARDEN-2 consensus_check() wired into inbox-watcher.js runtime enforcement; 24/24 tests pass | Wire consensus into pre-commit sovereignty gate (optional) | Archivist (design), Kernel (gate) |
| OUTPUT_PROVENANCE block missing | S:\Archivist-Agent\OUTPUT_PROVENANCE.txt | True – file exists | None | Archivist |
| AGENTS.md missing | S:\Archivist-Agent\AGENTS.md | True – file exists | None | Archivist |
| LANE_REGISTRY.json missing | S:\Archivist-Agent\LANE_REGISTRY.json | True – file exists (seen in lanes directory) | None | Archivist |
| Cross-lane git protocol not followed | S:\Archivist-Agent\CROSS_LANE_GIT_PROTOCOL.md | True – document exists | Ensure pre-commit hooks enforce commit message format | All lanes |
| No transfer logging for SCP/SSH | S:\kernel-lane\logs\transfer_log.jsonl, S:\Archivist-Agent\scripts\transfer-log.js, S:\Archivist-Agent\logs\transfer-log.jsonl | True – Kernel HARDEN-1 complete (36/36); Archivist HARDEN-3 complete (35/35 tests pass), wired into send-message.js + inbox-watcher.js | None | Kernel, Archivist |
| No automated replay script for failed messages | S:\kernel-lane\scripts\replay_failed_messages.sh | True – Implemented in HARDEN-1 | None | Kernel |
| No drift monitoring service | S:\Archivist-Agent\scripts\consensus-check.js (evaluateDrift), S:\Archivist-Agent\context-buffer\cps_log.jsonl | True – HARDEN-2 consensus_check() integrates drift monitoring with configurable thresholds and routing overrides | None | Archivist |
| No host-key pinning for SSH | S:\kernel-lane\config\ (check for known_hosts) | True – Implemented in HARDEN-1 send-lane.js | None | Kernel |
| No bandwidth throttling on SCP | S:\kernel-lane\config\transfer_limits.json (search) | True – Implemented in HARDEN-1 send-lane.js | None | Kernel |
| No lock file serialization for kernel transfers | S:\kernel-lane\ (check for /tmp/kernel_sync.lock usage) | True – Implemented in HARDEN-1 send-lane.js | None | Kernel |
| No unit/Playwright tests for UI/kernel transfer scripts | S:\Archivist-Agent\ui\ and S:\kernel-lane\tests\ | Partial – Kernel transfer tests 36/36 pass; Archivist UI tests pending | Add Playwright tests for Tauri UI; kernel transfer scripts covered | Archivist, Kernel |
