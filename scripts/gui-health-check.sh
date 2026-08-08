#!/usr/bin/env bash
set -uo pipefail
APP="archivist-agent"
BIN="/home/we4free/agent/repos/Archivist-Agent/src-tauri/target/release/archivist-agent"
LOG="/home/we4free/agent/repos/Archivist-Agent/context-buffer/gui-health.log"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DISK_THRESHOLD_GB=10

if ! pgrep -x "$APP" >/dev/null 2>&1; then
  if [ -x "$BIN" ]; then
    DISPLAY=:0 GDK_BACKEND=x11 nohup "$BIN" >>/tmp/archivist-app.log 2>&1 &
    echo "[$TS] RELAUNCHED $APP (was not running)" >> "$LOG"
  else
    echo "[$TS] ERROR binary missing: $BIN" >> "$LOG"
  fi
else
  if DISPLAY=:0 xdotool search --name "Archivist Agent" >/dev/null 2>&1; then
    :
  else
    echo "[$TS] WARN $APP running but no window mapped" >> "$LOG"
  fi
fi

FREE_KB=$(df -k / | awk 'NR==2 {print $4}')
FREE_GB=$((FREE_KB / 1024 / 1024))
if [ "$FREE_GB" -lt "$DISK_THRESHOLD_GB" ]; then
  echo "[$TS] WARN disk free ${FREE_GB}G < ${DISK_THRESHOLD_GB}G" >> "$LOG"
fi
