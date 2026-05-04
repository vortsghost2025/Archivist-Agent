# Verification Table for External Review Claims

| Claim | Evidence Path | Verified (True/False/Partial) | Action Required | Owner Lane |
|-------|---------------|-------------------------------|-----------------|------------|
| Library not present locally (Windows) | S:\self-organizing-library | True | None – lane exists | Library |
| SwarmMind not present locally (Windows) | S:\SwarmMind Self-Optimizing Multi-Agent AI System | True | None – lane exists | SwarmMind |
| Kernel repo not in current filesystem view | S:\kernel-lane | True | None – lane exists | Kernel |
| No concrete drift-detection implementation | S:\Archivist-Agent\src-tauri\src (search for drift files) | Partial – no drift.rs found in Archivist-Agent; need to check other lanes | Implement drift detection module (e.g., src/drift.rs) and integrate into Tauri commands | Archivist |
| Actual inbox/outbox folders missing | S:\Archivist-Agent\lanes\archivist\inbox, S:\Archivist-Agent\lanes\archivist\outbox (and similar for other lanes on Windows and Ubuntu) | False – inbox/outbox directories exist on all lanes | None | All lanes |
| No validation layer present | S:\Archivist-Agent\scripts\governance-message-verifier.js, S:\Archivist-Agent\scripts\schema-validator.js | Partial – validation scripts exist but may not be enforcing lane message schema at runtime | Ensure runtime validation of lane messages (e.g., via convergence gate daemon) and integrate with outbox/inbox processing | Kernel (for convergence gate) |
| OUTPUT_PROVENANCE block missing | S:\Archivist-Agent\OUTPUT_PROVENANCE.txt | True – file exists | None | Archivist |
| AGENTS.md missing | S:\Archivist-Agent\AGENTS.md | True – file exists | None | Archivist |
| LANE_REGISTRY.json missing | S:\Archivist-Agent\LANE_REGISTRY.json | True – file exists (seen in lanes directory) | None | Archivist |
| Cross-lane git protocol not followed | S:\Archivist-Agent\CROSS_LANE_GIT_PROTOCOL.md | True – document exists | Ensure pre-commit hooks enforce commit message format | All lanes |
| No transfer logging for SCP/SSH | S:\kernel-lane\logs\ (check for transfer_log.jsonl) | Not verified – need to check kernel logs | Implement secure SCP wrapper with hash verification and logging | Kernel |
| No automated replay script for failed messages | S:\kernel-lane\scripts\replay_failed_messages.sh (search) | Not verified – need to check | Create replay script and integrate into checkpoint flow | Kernel |
| No drift monitoring service | S:\Archivist-Agent\scripts\ (search for drift_monitor) | Not verified – need to check | Deploy drift monitor service that tails cps_log.jsonl and alerts on high scores | Archivist |
| No host-key pinning for SSH | S:\kernel-lane\config\ (check for known_hosts) | Not verified – need to check | Add Ubuntu host SSH fingerprint to known_hosts and enforce StrictHostKeyChecking | Kernel |
| No bandwidth throttling on SCP | S:\kernel-lane\config\transfer_limits.json (search) | Not verified – need to check | Add optional bandwidth limit to SCP wrapper | Kernel |
| No lock file serialization for kernel transfers | S:\kernel-lane\ (check for /tmp/kernel_sync.lock usage) | Not verified – need to check | Implement lock file with flock in transfer script | Kernel |
| No unit/Playwright tests for UI/kernel transfer scripts | S:\Archivist-Agent\ui\ (check for test files) and S:\kernel-lane\tests\ | Not verified – need to check | Add Playwright tests for Tauri UI and Bash/Python unit tests for kernel transfer scripts | Archivist, Kernel |
