#!/bin/bash
# VPS Sudo Remediation Script
# Run with: sudo bash /home/we4free/agent/bin/vps-sudo-remediation.sh
# Generated: 2026-05-20
# Session: continue-vps-remediation

set -euo pipefail

echo "=== VPS Sudo Remediation ==="
echo ""

# 1. Deploy PID-locking launcher
echo "[1/4] Deploying PID-locking launcher..."
cp /home/we4free/agent/bin/we4free-lane-daemon-new /usr/local/bin/we4free-lane-daemon
chmod +x /usr/local/bin/we4free-lane-daemon
echo "  Done. /usr/local/bin/we4free-lane-daemon updated with PID-file locking."
echo ""

# 2. Enable lane-worker systemd templates for all 4 lanes
echo "[2/4] Enabling lane-worker systemd templates..."
for lane in archivist kernel library swarmmind; do
    systemctl enable we4free-lane-worker@${lane}.lane.service
    systemctl start we4free-lane-worker@${lane}.lane.service
    echo "  ${lane}: enabled + started"
done
echo "  Done. All 4 lane-worker services now auto-restart on failure."
echo ""

# 3. Create logrotate config
echo "[3/4] Creating logrotate config..."
cat > /etc/logrotate.d/we4free-agent << 'LOGROTATE'
/home/we4free/agent/logs/*.log
/home/we4free/agent/logs/lane-agents/*.log
/home/we4free/rig-sync-all.log
{
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    maxsize 50M
}
LOGROTATE
chmod 644 /etc/logrotate.d/we4free-agent
echo "  Done. Logs will rotate daily, keep 7 days, max 50MB per file."
echo ""

# 4. Disable rig-sync-all timer (HTTPS auth failure on one rig)
echo "[4/4] Disabling rig-sync-all.timer (has persistent HTTPS auth failure)..."
systemctl disable --now rig-sync-all.timer
echo "  Done. Timer disabled. Re-enable with: sudo systemctl enable --now rig-sync-all.timer"
echo "  To fix properly: fix the HTTPS remote in the failing rig worktree, then re-enable."
echo ""

echo "=== All 4 remediations applied ==="
echo ""
echo "Verification commands (run without sudo):"
echo "  systemctl status we4free-lane-worker@archivist.lane.service"
echo "  systemctl status we4free-lane-worker@swarmmind.lane.service"
echo "  cat /usr/local/bin/we4free-lane-daemon | head -5"
echo "  cat /etc/logrotate.d/we4free-agent"
echo "  systemctl is-enabled rig-sync-all.timer"
