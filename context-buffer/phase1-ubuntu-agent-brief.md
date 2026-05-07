# Phase 1 — Ubuntu Daemon Infrastructure

You are operating on the headless Ubuntu machine at `we4free@100.95.40.99` (Tailscale IP). SSH in with: `ssh we4free@100.95.40.99`

## Current State

- All 4 lane repos cloned at `/home/we4free/agent/repos/`:
  - `Archivist-Agent`, `kernel-lane`, `SwarmMind`, `self-organizing-library`
- All 4 lanes have working relay-daemon systemd user services
- All 4 lanes have executor timer+service units
- Node.js at `/home/we4free/.nvm/versions/node/v20.20.2/bin/node`
- `loginctl enable-linger we4free` already set (survives reboot)
- 4 relay-daemons active+running, 4 lane-worker.js processes running
- Old watcher services are disabled (superseded by relay-daemons)

## Your Tasks (Phase 1.1-1.4)

### 1.1 Audit all 4 lanes have complete systemd user services

For each lane (archivist, kernel, library, swarmmind), verify these exist and are active:
- `{lane}-relay-daemon.service`
- `{lane}-executor.timer`
- `{lane}-executor.service`

Run this check:
```bash
for lane in archivist kernel library swarmmind; do
  echo "=== $lane ==="
  for svc in ${lane}-relay-daemon.service ${lane}-executor.timer ${lane}-executor.service; do
    printf "  %-40s " "$svc"
    systemctl --user is-active $svc 2>/dev/null || echo "MISSING"
  done
done
```

If any service files are missing, create them. Use the existing archivist-relay-daemon.service as a template:
```bash
systemctl --user cat archivist-relay-daemon.service
```

Repo-to-lane mapping:
- archivist -> Archivist-Agent
- kernel -> kernel-lane
- library -> self-organizing-library
- swarmmind -> SwarmMind

After creating any missing services:
```bash
systemctl --user daemon-reload
systemctl --user enable --now {lane}-{service}
```

### 1.2 Crash recovery verification

Verify all relay-daemon services have `Restart=on-failure` or `Restart=always`. Test by restarting one:
```bash
systemctl --user restart library-relay-daemon.service
sleep 3
systemctl --user is-active library-relay-daemon.service
# Should show "active"
```

Also verify linger is active so user services start at boot without login:
```bash
loginctl show-user we4free | grep Linger
# Should show "yes"
```

### 1.3 Unified log aggregation

1. Create log directories if missing:
```bash
mkdir -p /home/we4free/agent/logs
for repo in Archivist-Agent kernel-lane self-organizing-library SwarmMind; do
  mkdir -p /home/we4free/agent/repos/$repo/logs
done
```

2. Create logrotate config:
```bash
sudo tee /etc/logrotate.d/lane-daemons <<'EOF'
/home/we4free/agent/logs/*.log /home/we4free/agent/repos/*/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
```

3. Verify journalctl captures user service output:
```bash
journalctl --user -u archivist-relay-daemon.service --no-pager -n 5
```

### 1.4 Tailscale connectivity watchdog

1. Create the watchdog script:
```bash
mkdir -p /home/we4free/agent/scripts
cat > /home/we4free/agent/scripts/tailscale-watchdog.sh << 'SCRIPT'
#!/bin/bash
STATE_FILE="/home/we4free/agent/.tailscale-state"
LOG="/home/we4free/agent/logs/tailscale-watchdog.log"

check() {
  if ! tailscale status &>/dev/null; then
    echo "down" > "$STATE_FILE"
    return 1
  fi
  if ! ping -c 1 -W 3 100.95.40.99 &>/dev/null; then
    echo "degraded" > "$STATE_FILE"
    return 1
  fi
  echo "up" > "$STATE_FILE"
  return 0
}

recover() {
  sudo tailscale up --accept-routes 2>/dev/null
  sleep 5
  if check; then
    for lane in archivist kernel library swarmmind; do
      systemctl --user restart ${lane}-relay-daemon.service 2>/dev/null
    done
    echo "recovered $(date -Iseconds)" >> "$LOG"
  else
    echo "still-down $(date -Iseconds)" >> "$LOG"
  fi
}

prev=$(cat "$STATE_FILE" 2>/dev/null || echo "unknown")
if ! check; then
  if [ "$prev" = "down" ]; then
    recover
  fi
else
  if [ "$prev" != "up" ]; then
    for lane in archivist kernel library swarmmind; do
      systemctl --user restart ${lane}-relay-daemon.service 2>/dev/null
    done
    echo "reconnected $(date -Iseconds)" >> "$LOG"
  fi
fi
SCRIPT
chmod +x /home/we4free/agent/scripts/tailscale-watchdog.sh
```

2. Create systemd service:
```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/tailscale-watchdog.service << 'EOF'
[Unit]
Description=Tailscale Connectivity Watchdog

[Service]
Type=oneshot
ExecStart=/bin/bash /home/we4free/agent/scripts/tailscale-watchdog.sh
EOF

cat > ~/.config/systemd/user/tailscale-watchdog.timer << 'EOF'
[Unit]
Description=Tailscale Connectivity Watchdog Timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=60s

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now tailscale-watchdog.timer
```

## Verification (run after completing all tasks above)

```bash
echo "=== PHASE 1 VERIFICATION ==="

echo "--- 1.1 Services ---"
for lane in archivist kernel library swarmmind; do
  for svc in ${lane}-relay-daemon.service ${lane}-executor.timer; do
    printf "%-40s %s\n" "$svc" "$(systemctl --user is-active $svc 2>/dev/null)"
  done
done

echo "--- 1.2 Linger ---"
loginctl show-user we4free | grep Linger

echo "--- 1.3 Log rotation ---"
ls -la /etc/logrotate.d/lane-daemons 2>/dev/null && echo "OK" || echo "MISSING"

echo "--- 1.4 Watchdog ---"
systemctl --user is-active tailscale-watchdog.timer 2>/dev/null || echo "NOT SET UP"

echo "--- Lane workers ---"
ps -eo cmd | grep "lane-worker.js.*--watch" | grep -v grep | wc -l

echo "--- Tailscale ---"
tailscale status 2>&1 | head -3

echo "=== END PHASE 1 ==="
```

Paste the full verification output back. Archivist will run recovery-test-suite.js against Ubuntu to cross-verify once you report done.
