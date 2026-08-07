#!/usr/bin/env bash
set -euo pipefail

# quarantine-reaper.sh — Purge stale quarantine-archive-* dirs older than 7 days
# Runs via systemd timer weekly
# Logs to /home/we4free/agent/logs/quarantine-reaper.log

REPOS="/home/we4free/agent/repos"
LOG_FILE="/home/we4free/agent/logs/quarantine-reaper.log"
MAX_AGE_DAYS=7
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$TIMESTAMP] quarantine-reaper: $1" | tee -a "$LOG_FILE"
}

reap_lane() {
  local lane="$1"
  local repo="$2"
  local inbox="$repo/lanes/$lane/inbox"
  local archive_dir="$inbox/quarantine-archive-"

  if [ ! -d "$inbox" ]; then
    log "SKIP $lane: inbox not found"
    return
  fi

  # Find quarantine-archive-* directories
  for dir in "$inbox"/quarantine-archive-*; do
    [ -d "$dir" ] || continue
    local dirname=$(basename "$dir")
    local mtime=$(stat -c %Y "$dir" 2>/dev/null || stat -f %m "$dir" 2>/dev/null)
    local now=$(date +%s)
    local age_days=$(( (now - mtime) / 86400 ))

    if [ "$age_days" -ge "$MAX_AGE_DAYS" ]; then
      local file_count=$(find "$dir" -type f | wc -l)
      local dir_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
      log "PURGE $lane/$dirname: ${file_count} files, ${dir_size}, ${age_days} days old"
      rm -rf "$dir"
    else
      log "KEEP $lane/$dirname: ${age_days} days old (< $MAX_AGE_DAYS)"
    fi
  done
}

log "=== Starting quarantine reaper (max age: $MAX_AGE_DAYS days) ==="

reap_lane "archivist" "$REPOS/Archivist-Agent"
reap_lane "kernel" "$REPOS/kernel-lane"
reap_lane "swarmmind" "$REPOS/SwarmMind"
reap_lane "library" "$REPOS/self-organizing-library"

log "=== Quarantine reaper complete ==="
