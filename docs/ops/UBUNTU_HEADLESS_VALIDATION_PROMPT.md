# Ubuntu Headless Full Validation Prompt

**Purpose:** Give this prompt to a Kilo agent running directly on the Ubuntu headless machine (`cd /home/we4free/agent/repos/Archivist-Agent && kilo`) to run ALL tests, verify ALL services, and validate ALL autonomous systems before loading any live agents.

**Date written:** 2026-05-12
**Author lane:** archivist (LANE-1)

---

## Preamble

You are an infrastructure validation agent on the Ubuntu headless machine. Your job is to run a comprehensive health check across all 4 lanes (Archivist, Kernel, SwarmMind, Library) and report findings. You are the ONLY agent running — no other live agents are active. This is a pre-flight check before any autonomous work resumes.

**Key paths:**
- Node binary: `/home/we4free/.nvm/versions/node/v20.20.2/bin/node` (add to PATH or use full path)
- Repo root: `/home/we4free/agent/repos/`
- Agent scripts: `/home/we4free/agent/repos/Archivist-Agent/scripts/`
- Runner: `/home/we4free/agent/bin/runner.sh`
- Systemd user dir: `~/.config/systemd/user/`
- Logs: `/home/we4free/agent/logs/`

**Read first:** `/home/we4free/agent/repos/Archivist-Agent/SCRIPT_INDEX.md`

---

## Phase 1: Recovery Test Suite (CRITICAL)

Run the recovery test suite in ALL 4 lane repos. Every test must PASS.

```bash
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"

# Archivist
cd /home/we4free/agent/repos/Archivist-Agent
$NODE scripts/recovery-test-suite.js

# Kernel
cd /home/we4free/agent/repos/kernel-lane
$NODE scripts/recovery-test-suite.js

# SwarmMind
cd /home/we4free/agent/repos/SwarmMind
$NODE scripts/recovery-test-suite.js

# Library
cd /home/we4free/agent/repos/self-organizing-library
$NODE scripts/recovery-test-suite.js
```

**Expected:** All tests PASS in each repo. If any test FAILS, document the failure and STOP — do not proceed to later phases until recovery is PROVEN.

**Report format:**
```
| Lane | Total Tests | Passed | Failed | Verdict |
|------|-------------|--------|--------|---------|
| archivist | 12 | ? | ? | PROVEN/CONFLICTED |
| kernel | 12 | ? | ? | PROVEN/CONFLICTED |
| swarmmind | 12 | ? | ? | PROVEN/CONFLICTED |
| library | 12 | ? | ? | PROVEN/CONFLICTED |
```

---

## Phase 2: Systemd Service Health

Check ALL 8 lane services + timers. Every service must be `active (running)`.

```bash
# 4 relay-daemons
systemctl --user status archivist-relay-daemon --no-pager
systemctl --user status kernel-relay-daemon --no-pager
systemctl --user status swarmmind-relay-daemon --no-pager
systemctl --user status library-relay-daemon --no-pager

# 4 lane-workers
systemctl --user status archivist-lane-worker --no-pager
systemctl --user status kernel-lane-worker --no-pager
systemctl --user status swarmmind-lane-worker --no-pager
systemctl --user status library-lane-worker --no-pager

# Timers
systemctl --user list-timers --no-pager

# Also check for rig-sync-all.timer (may be system-level)
systemctl status rig-sync-all.timer --no-pager 2>/dev/null || systemctl --user status rig-sync-all.timer --no-pager 2>/dev/null
```

**Report format:**
```
| Service | Active | Uptime | Memory | Verdict |
|---------|--------|--------|--------|---------|
| archivist-relay-daemon | yes/no | Xh Ym | ZM | OK/FAIL |
| kernel-relay-daemon | yes/no | Xh Ym | ZM | OK/FAIL |
| swarmmind-relay-daemon | yes/no | Xh Ym | ZM | OK/FAIL |
| library-relay-daemon | yes/no | Xh Ym | ZM | OK/FAIL |
| archivist-lane-worker | yes/no | Xh Ym | ZM | OK/FAIL |
| kernel-lane-worker | yes/no | Xh Ym | ZM | OK/FAIL |
| swarmmind-lane-worker | yes/no | Xh Ym | ZM | OK/FAIL |
| library-lane-worker | yes/no | Xh Ym | ZM | OK/FAIL |
```

---

## Phase 3: ContradictionAdjudicator Firing Verification

The relay-daemons were recently wired to run periodic contradiction adjudication. Verify it's actually firing.

```bash
# Check relay-daemon logs for adjudication output
journalctl --user -u archivist-relay-daemon --no-pager -n 50 | grep -i adjudicat
journalctl --user -u kernel-relay-daemon --no-pager -n 50 | grep -i adjudicat
journalctl --user -u swarmmind-relay-daemon --no-pager -n 50 | grep -i adjudicat
journalctl --user -u library-relay-daemon --no-pager -n 50 | grep -i adjudicat

# Check if adjudication log files exist
ls -la /home/we4free/agent/repos/Archivist-Agent/logs/contradiction-adjudicator.json 2>/dev/null
ls -la /home/we4free/agent/repos/kernel-lane/logs/contradiction-adjudicator.json 2>/dev/null
ls -la /home/we4free/agent/repos/SwarmMind/logs/contradiction-adjudicator.json 2>/dev/null
ls -la /home/we4free/agent/repos/self-organizing-library/logs/contradiction-adjudicator.json 2>/dev/null
```

**Expected:** Each relay-daemon should show `adjudication: edges=N contradicts=N adjudicated=N` in its journal logs. The log JSON files should exist (or the `logs/` dir should be creatable).

**Also verify the code is wired** — spot-check one relay-daemon:
```bash
grep -n "ContradictionAdjudicator\|adjudicatorInterval\|adjudication" /home/we4free/agent/repos/Archivist-Agent/scripts/relay-daemon.js
```

Should show: import, constructor fields, runOnce() periodic logic, and watch-mode log line.

---

## Phase 4: TaskChainEngine in runner-v3.sh

Verify the 4 TCE invocations exist in the runner and are syntactically correct.

```bash
# Check runner for TCE calls
grep -n "task-chain-engine\|TaskChainEngine\|task_task_chain_engine" /home/we4free/agent/bin/runner.sh

# Verify the function exists
grep -A 3 "TCE_SCRIPT=" /home/we4free/agent/bin/runner.sh

# Dry-run TCE for one lane (should parse and exit cleanly)
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"
$NODE /home/we4free/agent/repos/Archivist-Agent/scripts/task-chain-engine.js --lane archivist --dry-run --max-chain-depth 5
```

**Expected:** 4 TCE_SCRIPT entries (one per lane), `task_task_chain_engine` function called in main loop, dry-run completes without error.

---

## Phase 5: Autonomous Systems — Heartbeats, Overseer, Inbox-Watchers

### 5a. Heartbeat freshness

```bash
# Check heartbeat log files are recent (within last 10 min)
tail -5 /home/we4free/agent/logs/archivist-heartbeat.log
tail -5 /home/we4free/agent/logs/swarmmind-heartbeat.log
tail -5 /home/we4free/agent/logs/kernel-heartbeat.log
tail -5 /home/we4free/agent/logs/library-heartbeat.log

# Check heartbeat JSON files exist and are recent
find /home/we4free/agent/repos/ -name "heartbeat-*.json" -mmin -10 -type f 2>/dev/null
```

**Expected:** Each heartbeat log should show recent entries (within 5-10 min). JSON files should exist under `lanes/*/heartbeat/`.

### 5b. Overseer health check

```bash
tail -5 /home/we4free/agent/logs/overseer-health.log
```

**Expected:** Recent entries showing health checks completing.

### 5c. Cron verification

```bash
crontab -l
```

**Expected:** 4 heartbeat entries (every 5 min), 1 overseer entry (every 15 min), no stale entries.

### 5d. Inbox-watcher routing

```bash
# Verify inbox-watcher.js exists and is called by relay-daemons
grep -n "inbox-watcher\|watchInbox\|inboxWatcher" /home/we4free/agent/repos/Archivist-Agent/scripts/relay-daemon.js
```

---

## Phase 6: Cross-Lane Message Flow Test

Send a P3 test message from Archivist to each other lane, then verify delivery.

```bash
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"

# Create test messages
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
MSG_ID="${TIMESTAMP}_archivist_validation-test"

for TARGET in kernel swarmmind library; do
  INBOX="/home/we4free/agent/repos/"
  case $TARGET in
    kernel)   DIR="kernel-lane/lanes/kernel/inbox" ;;
    swarmmind) DIR="SwarmMind/lanes/swarmmind/inbox" ;;
    library)  DIR="self-organizing-library/lanes/library/inbox" ;;
  esac
  
  cat > "/home/we4free/agent/repos/$DIR/${MSG_ID}_${TARGET}.json" << 'EOF'
{
  "id": "validation-test-001",
  "from": "archivist",
  "to": "TARGET",
  "timestamp": "TIMESTAMP",
  "priority": "P3",
  "type": "task",
  "body": "Infrastructure validation test message — safe to ignore or delete",
  "requires_action": false
}
EOF
  # Replace placeholders
  sed -i "s/TARGET/$TARGET/g" "/home/we4free/agent/repos/$DIR/${MSG_ID}_${TARGET}.json"
  sed -i "s/TIMESTAMP/$TIMESTAMP/g" "/home/we4free/agent/repos/$DIR/${MSG_ID}_${TARGET}.json"
done
```

Wait 60 seconds, then check if relay-daemons processed them:
```bash
sleep 60
journalctl --user -u archivist-relay-daemon --no-pager --since "1 min ago" | grep -i "deliver\|outbox\|inbox"
```

**Also verify** the lane-workers eventually process them (check for `processed=1` in lane-worker logs after a few minutes).

**Cleanup after test:**
```bash
for TARGET in kernel swarmmind library; do
  DIR=""
  case $TARGET in
    kernel)   DIR="kernel-lane/lanes/kernel/inbox" ;;
    swarmmind) DIR="SwarmMind/lanes/swarmmind/inbox" ;;
    library)  DIR="self-organizing-library/lanes/library/inbox" ;;
  esac
  rm -f "/home/we4free/agent/repos/$DIR/${MSG_ID}_${TARGET}.json"
done
```

---

## Phase 7: Git Sync Verification

All 4 repos must be at latest commit with no divergent/unstaged changes.

```bash
for REPO in Archivist-Agent kernel-lane SwarmMind self-organizing-library; do
  echo "=== $REPO ==="
  cd /home/we4free/agent/repos/$REPO
  git status --short
  git log --oneline -1
  git log --oneline -1 origin/main 2>/dev/null || git log --oneline -1 origin/master 2>/dev/null
  echo ""
done
```

**Expected:** `git status --short` shows empty or only gitignored files. Local HEAD matches remote HEAD.

---

## Phase 8: S:/ Path Leak Scan

Check for Windows-style `S:/` paths in Ubuntu-side logs, processed files, or inbox messages.

```bash
# Scan logs
grep -r "S:/" /home/we4free/agent/logs/ 2>/dev/null | head -20

# Scan recent inbox processed files
find /home/we4free/agent/repos/ -path "*/inbox/processed/*.json" -mtime -1 -exec grep -l "S:/" {} \; 2>/dev/null

# Scan lane-worker state files
grep -r "S:/" /home/we4free/agent/repos/*/lanes/ 2>/dev/null | grep -v node_modules | head -20
```

**Expected:** Zero or minimal matches. Windows paths in gitignored files are known but should be documented.

---

## Phase 9: System Health — Disk, Memory, Uptime

```bash
# Disk usage
df -h /home/we4free/

# Memory
free -h

# Uptime
uptime

# Node version
/home/we4free/.nvm/versions/node/v20.20.2/bin/node --version

# Tailscale status
tailscale status 2>/dev/null | head -5
```

---

## Phase 10: system-status.js Full Report

Run the comprehensive system status script.

```bash
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"
cd /home/we4free/agent/repos/Archivist-Agent
$NODE scripts/system-status.js
```

**Expected:** CONVERGENCE across all 4 lanes, no blockers active.

---

## Phase 11: Post-Compact Audit

Run the post-compact audit to verify system coherence.

```bash
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"
cd /home/we4free/agent/repos/Archivist-Agent
$NODE scripts/post-compact-audit.js
```

---

## Phase 12: Additional Script Verification

Spot-check key scripts exist and are loadable:

```bash
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"
SCRIPTS_DIR="/home/we4free/agent/repos/Archivist-Agent/scripts"

for SCRIPT in \
  claim-commit-guard.js \
  contradiction-adjudicator.js \
  task-chain-engine.js \
  lane-health-monitor.js \
  sync-all-lanes.js \
  verify-output-provenance.js \
  completion-proof-audit.js \
  completion-gate-audit.js \
  daily-productivity-report.js \
  agent-health-snapshot.js; do
  if [ -f "$SCRIPTS_DIR/$SCRIPT" ]; then
    $NODE -e "require('$SCRIPTS_DIR/$SCRIPT')" 2>&1 && echo "$SCRIPT: LOADABLE" || echo "$SCRIPT: LOAD ERROR"
  else
    echo "$SCRIPT: MISSING"
  fi
done
```

---

## Final Report Format

After completing ALL phases, produce a single summary:

```
# UBUNTU HEADLESS VALIDATION REPORT

**Date:** <ISO-8601>
**Agent:** Kilo (infrastructure validation)
**Lane:** archivist (LANE-1)

## Summary

| Phase | Name | Verdict | Details |
|-------|------|---------|---------|
| 1 | Recovery Test Suite | PASS/FAIL | X/48 tests passed |
| 2 | Systemd Service Health | PASS/FAIL | X/8 services active |
| 3 | ContradictionAdjudicator | PASS/FAIL | Firing in X/4 lanes |
| 4 | TaskChainEngine in Runner | PASS/FAIL | X/4 invocations present |
| 5 | Autonomous Systems | PASS/FAIL | Heartbeats X/4, Overseer OK/FAIL |
| 6 | Cross-Lane Message Flow | PASS/FAIL | Delivered to X/3 targets |
| 7 | Git Sync | PASS/FAIL | X/4 repos synced |
| 8 | S:/ Path Leak Scan | CLEAN/DIRTY | X leaks found |
| 9 | System Health | PASS/FAIL | Disk X%, Mem X% |
| 10 | system-status.js | CONVERGENT/DIVERGENT | Details |
| 11 | Post-Compact Audit | PROVEN/CONFLICTED | Details |
| 12 | Script Verification | PASS/FAIL | X/Y scripts loadable |

## Overall Verdict: READY / NOT READY

## Blockers (if any):
- <list any P0 items preventing readiness>

## Recommendations:
- <list non-blocking issues to address next>
```

---

## Important Notes

1. **If Phase 1 (Recovery) FAILS on any lane, STOP.** Do not proceed past Phase 1 until all lanes are PROVEN. Escalate to the operator.
2. **If any systemd service is NOT active, try restarting it:** `systemctl --user restart <service-name>` and re-check.
3. **This is a READ-MOSTLY validation.** The only writes are the test messages in Phase 6 (which get cleaned up). Do NOT make code changes or configuration changes unless a service needs restarting.
4. **Commit this report.** After completing validation, write the report to `/home/we4free/agent/repos/Archivist-Agent/docs/ops/VALIDATION_REPORT_<timestamp>.md` and commit+push it.
5. **OUTPUT_PROVENANCE is mandatory** on the final report. Include agent, lane, generated_at, and session_id.
