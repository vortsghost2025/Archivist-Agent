#!/usr/bin/env bash
# inbox-retention.sh — archive stale blocked/quarantine messages older than RETENTION_HOURS
# Usage: inbox-retention.sh [--dry-run] [RETENTION_HOURS]
# Default retention: 24 hours

set -euo pipefail

DRY_RUN=false
RETENTION_HOURS=24

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    shift
fi
[[ -n "${1:-}" ]] && RETENTION_HOURS="$1"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX_BASE="$REPO_ROOT/lanes"
ARCHIVED=0
SKIPPED=0

for lane_dir in "$INBOX_BASE"/*/inbox; do
    lane="$(basename "$(dirname "$lane_dir")")"
    for category in blocked quarantine; do
        cat_dir="$lane_dir/$category"
        [[ -d "$cat_dir" ]] || continue
        arch_dir="$cat_dir/archive"
        [[ -d "$arch_dir" ]] || { mkdir -p "$arch_dir"; }

        find "$cat_dir" -maxdepth 1 -type f -name '*.json' -mmin "+$((RETENTION_HOURS * 60))" | while read -r f; do
            if $DRY_RUN; then
                echo "[DRY-RUN] Would archive: $f"
            else
                mv "$f" "$arch_dir/"
                ARCHIVED=$((ARCHIVED + 1))
            fi
        done
    done
done

if ! $DRY_RUN; then
    echo "inbox-retention: archived=${ARCHIVED} skipped=${SKIPPED} retention_hours=${RETENTION_HOURS}"
fi
