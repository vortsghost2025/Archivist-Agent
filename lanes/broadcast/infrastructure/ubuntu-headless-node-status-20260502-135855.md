# Ubuntu Headless Node Status

Generated: 2026-05-02
Owner: seand
Node: we4free@192.168.0.170
Purpose: Auxiliary execution node for agent tasks from Windows 11 workstation.

## Proven Working
- SSH connectivity from Windows to Ubuntu is working.
- Passwordless SSH key auth is working.
- Agent workspace created at `/home/we4free/agent`.
- Runner script works: `/home/we4free/agent/bin/runner.sh`.
- Heartbeat script works: `/home/we4free/agent/bin/heartbeat.sh`.
- Cron installed/enabled and heartbeat schedule registered.

## Canonical Commands (Verified)
```bash
ssh we4free@192.168.0.170 "echo KEY_OK && hostname && whoami"
```

```bash
/home/we4free/agent/bin/runner.sh
/home/we4free/agent/bin/heartbeat.sh
tail -n 20 /home/we4free/agent/logs/agent.log
tail -n 20 /home/we4free/agent/logs/heartbeat.log
crontab -l
```

## What This Node Should Be Used For
1. Long-running or isolated workloads (tests, indexing, ingestion, batch transforms).
2. Watchers/heartbeats that should keep running if Windows sessions close.
3. Risk isolation for experiments before promoting to main lane repos.
4. Parallel execution while primary lane work continues on Windows.

## Immediate Next Actions (Recommended)
1. Keep cron heartbeat every 5 minutes for health proof.
2. Add one real task command into `runner.sh` (currently placeholder).
3. Add a `tmux` session for persistent interactive runs.
4. Add a small status report job that writes `node-health.json` every 5 min.

## Lane Visibility Policy
- This file is the shared reference for all lanes.
- Any lane using this node should append a short usage note in lane outbox linking this file.
- No secrets are stored in this artifact.
