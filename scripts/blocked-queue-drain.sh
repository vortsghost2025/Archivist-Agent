#!/usr/bin/env bash
set -euo pipefail

# blocked-queue-drain.sh — Move requires_action:false acks from blocked/ to processed/
# Runs via systemd timer hourly
# Logs to /home/we4free/agent/logs/blocked-queue-drain.log

REPOS="/home/we4free/agent/repos"
LOG_FILE="/home/we4free/agent/logs/blocked-queue-drain.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$TIMESTAMP] blocked-queue-drain: $1" | tee -a "$LOG_FILE"
}

drain_lane() {
  local lane="$1"
  local repo="$2"
  local blocked_dir="$repo/lanes/$lane/inbox/blocked"
  local processed_dir="$repo/lanes/$lane/inbox/processed"

  if [ ! -d "$blocked_dir" ]; then
    log "SKIP $lane: blocked/ not found"
    return
  fi

  mkdir -p "$processed_dir"

  local drained=0
  local skipped=0

  for file in "$blocked_dir"/*.json; do
    [ -f "$file" ] || continue
    local filename=$(basename "$file")

    # Extract requires_action field
    local requires_action=$(node -e "const m=require('$file'); console.log(m.requires_action);" 2>/dev/null || echo "unknown")

    if [ "$requires_action" = "false" ]; then
      local target="$processed_dir/$filename"
      mv "$file" "$target"
      log "DRAIN $lane/$filename -> processed/"
      drained=$((drained + 1))
    else
      skipped=$((skipped + 1))
    fi
  done

  log "SUMMARY $lane: drained=$drained skipped=$skipped"
}

log "=== Starting blocked-queue drain ==="

drain_lane "archivist" "$REPOS/Archivist-Agent"
drain_lane "kernel" "$REPOS/kernel-lane"
drain_lane "swarmmind" "$REPOS/SwarmMind"
drain_lane "library" "$REPOS/self-organizing-library"

log "=== Blocked-queue drain complete ==="
