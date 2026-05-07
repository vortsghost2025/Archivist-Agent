#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

AGENT_ROOT="$HOME/agent"
REPOS_DIR="$AGENT_ROOT/repos"
ARTIFACTS_DIR="$AGENT_ROOT/artifacts"
LOG_DIR="$AGENT_ROOT/logs"
ARCHIVIST_DIR="$REPOS_DIR/Archivist-Agent"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$ARTIFACTS_DIR" "$LOG_DIR"

echo "$(date -Iseconds) [recovery-hourly] Starting..." >> "$LOG_DIR/recovery-hourly.log"

cd "$ARCHIVIST_DIR"

# Pull latest scripts (if no local changes)
if git diff-index --quiet HEAD 2>/dev/null; then
  git pull --ff-only >> "$LOG_DIR/recovery-hourly.log" 2>&1 || true
else
  echo "$(date -Iseconds) [recovery-hourly] Local changes present, skipping pull" >> "$LOG_DIR/recovery-hourly.log"
fi

# Run recovery suite
RESULT=$(node scripts/recovery-test-suite.js 2>&1) || true
EXIT_CODE=$?

VERDICT=$(echo "$RESULT" | grep -oE 'Verdict: .*' | head -1 | sed 's/Verdict: //')
[ -z "$VERDICT" ] && VERDICT="UNKNOWN"

# Write artifact
cat > "$ARTIFACTS_DIR/recovery-hourly-${TIMESTAMP}.json" <<JSONEOF
{
  "task": "recovery_hourly",
  "timestamp": "$(date -Iseconds)",
  "verdict": "$VERDICT",
  "exit_code": $EXIT_CODE,
  "runner": "recovery-hourly.sh"
}
JSONEOF

# Log summary
echo "$(date -Iseconds) [recovery-hourly] verdict=$VERDICT exit=$EXIT_CODE" >> "$LOG_DIR/recovery-hourly.log"

# If CONFLICTED, write alert
if echo "$VERDICT" | grep -q CONFLICTED; then
  echo "$(date -Iseconds) [ALERT] Recovery CONFLICTED - context integrity compromised" >> "$LOG_DIR/recovery-hourly.log"
fi

# Cleanup: keep last 48 hourly artifacts (2 days)
find "$ARTIFACTS_DIR" -name "recovery-hourly-*.json" -mtime +2 -delete 2>/dev/null || true

exit 0
