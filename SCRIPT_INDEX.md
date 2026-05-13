# Ubuntu Headless Script Index

Canonical index of all active scripts on the Ubuntu headless machine.
Agents: READ THIS FILE FIRST to discover available tooling.

## System Scripts (/usr/local/bin/)

| Script | Purpose | Called By | Frequency | Status |
|--------|---------|-----------|-----------|--------|
| `rig-sync-all.sh` | Sync all 5 Gastown rigs to GitHub | rig-sync-all.timer (systemd) | Every 30s | ACTIVE (canonical) |
| `bead-wrapper.sh` | Cloud agent defensive sync wrapper (fetch, reset-on-drift, exec, log) | Cloud bead execution | On-demand | READY (not yet called) |
| `we4free-sync.sh` | DEPRECATED — redundant with rig-sync-all.sh, has stale kernel-lane mapping | REMOVED from cron 2026-05-09 | N/A | DEAD |
| `rig-sync.sh` | DEPRECATED — replaced by rig-sync-all.sh | rig-sync.timer | N/A | DEAD (unit masked, file in _archived-duplicates/) |

## Home Directory Scripts

| Script | Path | Purpose | Status |
|--------|------|---------|--------|
| `agent-bootstrap.sh` | ~/agent-bootstrap.sh | One-time machine setup (install pkgs, create dirs) | RUN-ONCE (already ran) |
| `bead-wrapper.sh` | ~/bead-wrapper.sh | Copy of /usr/local/bin/bead-wrapper.sh | MIRROR |

## Agent Core Scripts (~/agent/bin/)

| Script | Purpose | Status |
|--------|---------|--------|
| `heartbeat.sh` | Simple bash heartbeat logger | SUPERSEDED by JS heartbeat.js in cron |
| `launch-4-lanes.sh` | Start all 4 lane agents in tmux | ON-DEMAND (manual start after reboot) |
| `launch-4-lanes-shell.sh` | Shell-based lane launcher variant | ON-DEMAND |
| `runner.sh` | Agent runner (canonical, v3 merged) | ON-DEMAND |
| `setup-watcher-services.sh` | Configure lane watcher services (requires sudo) | RUN-ONCE |
| `sync-trust-stores.sh` | Synchronize trust stores across lanes | ON-DEMAND |
| `we4free-hygiene` | Wrapper → hygiene-summary.sh | ON-DEMAND |

## Agent Shared Scripts (~/agent/scripts/)

| Script | Purpose | Status |
|--------|---------|--------|
| `hygiene-monitor.sh` | File hygiene monitoring (alert dedup, no auto-fix) | ON-DEMAND |
| `hygiene-summary.sh` | One-line hygiene report summary | ON-DEMAND (called by we4free-hygiene) |
| `process.py` | Minimal Python process stub | UNUSED |
| `recovery-hourly.sh` | Hourly recovery check (runs recovery-test-suite.js) | ON-DEMAND |
| `tailscale-watchdog.sh` | Tailscale connectivity monitor + reconnect | ON-DEMAND |

## Cron-Managed Services

| Service | Script | Schedule | Lane |
|---------|--------|----------|------|
| Archivist heartbeat | `~/agent/repos/Archivist-Agent/scripts/heartbeat.js --once` | Every 5m | archivist |
| SwarmMind heartbeat | `~/agent/repos/SwarmMind/scripts/heartbeat.js --lane swarmmind --once` | Every 5m | swarmmind |
| Kernel heartbeat | `~/agent/repos/kernel-lane/scripts/heartbeat.js --lane kernel --once` | Every 5m | kernel |
| Library heartbeat | `~/agent/repos/self-organizing-library/scripts/heartbeat.js --lane library --once` | Every 5m | library |
| Overseer health | `~/agent/repos/SwarmMind/scripts/overseer-health-check.js` | Every 15m | swarmmind |
| Workspace sync | ~~`~/we4free-sync.sh`~~ REMOVED 2026-05-09 | N/A | system |

## Systemd Services

| Unit | Type | Schedule | Status |
|------|------|----------|--------|
| `rig-sync-all.timer` | Timer | Every 30s | ENABLED/ACTIVE |
| `rig-sync-all.service` | Service | Triggered by timer | ACTIVE (runs on trigger) |
| `rig-sync.timer` | Timer | N/A | DEAD (disabled, unit file needs sudo rm) |
| `rig-sync.service` | Service | N/A | DEAD (masked, unit file needs sudo rm) |

## Repo Scripts (165+ JS files in Archivist-Agent/scripts/)

Key scripts agents should know about:

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `sync-all-lanes.js` | Sync shared scripts + broadcast across all 4 lane repos | After changes to shared scripts |
| `node-version-guard.js` | Validate Node v18+ before script execution; exits 1 if too old | Required by autonomous-executor.js, task-executor.js |
| `post-compact-audit.js` | Verify system state after context compaction | After any context compact |
| `recovery-test-suite.js` | Run 11-test recovery verification | After crash/reboot/compact |
| `heartbeat.js` | Lane heartbeat with --once flag | Cron-managed, don't run manually |
| `sign-outbox-message.js` | Sign outbound lane messages | Before sending lane messages |
| `verify-output-provenance.js` | Verify OUTPUT_PROVENANCE compliance | After generating reports |
| `output-provenance.js` | Generate OUTPUT_PROVENANCE headers | Before any final output |
| `lane-health-monitor.js` | Check health across all lanes | Debugging lane issues |
| `system-status.js` | Full system status report | Session startup check |
| `start-core.js` | Start core governance services | Manual lane start |

## Archived Scripts

Single-use scripts moved to `~/agent/bin/_archived-single-use/`:
- 20 push/fix/test scripts from past debugging sessions
- Safe to delete entirely after 7 days if no issues arise (since 2026-05-09)

Duplicate sync scripts moved to `~/agent/bin/_archived-duplicates/`:
- `rig-sync-all.sh` (home copy), `rig-sync.sh` (user bin copy)
- Safe to delete now

Deleted 2026-05-09:
- `runner-v3.sh` (identical to runner.sh, no v2/v3 rule)
- `runner.sh.bak`, `runner.sh.bak-20260503-150441` (backup copies)
- `runner-v3.sh.patch` (stale diff)
- we4free-sync.sh removed from crontab (redundant, stale mapping)

## Rules for New Scripts

1. **Must be added to this index** — or it doesn't exist
2. **Must have an owner** — which lane/repo maintains it
3. **Must have a last-used date** — scripts unused for 30 days get archived
4. **No v2/v3 suffixes** — replace the original, don't version filenames
5. **No copies** — one canonical location, everything else is a symlink
6. **System scripts go in /usr/local/bin/** — home dir scripts are mirrors only

## Continuous Improvement Loop
| Script | Path | Purpose | Status |
|--------|------|---------|--------|
| continuous-improvement-loop.sh | ~/agent/repos/Archivist-Agent/scripts/ | Cycles all 4 lanes (kernel, swarmmind, library, archivist) every 120s; tasks: stale cleanup, hygiene scan, inbox process, journal backfill, git housekeeping, sovereignty verify, heartbeat refresh, broadcast sync | ACTIVE (systemd) |

### CI Loop Notes
- v2.0.0 (2026-05-13): Added archivist lane to loop. Previously only cycled kernel/swarmmind/library.
- Archivist inbox-process calls autonomous-executor with --once (non-recursive, single pass).
- Safe: executor --once does NOT re-invoke the CI loop.
- State file: ~/agent/logs/ci-cycle-state.json
- Log: ~/agent/logs/continuous-improvement.log
