#!/usr/bin/env bash
# Headless Hygiene Monitor v2
# Detects runtime hygiene issues without auto-fixing them.
# v2: Alert deduplication — only writes operator_alert if content differs from last alert.

set -euo pipefail

AGENT_ROOT="${HOME}/agent"
REPOS_DIR="${AGENT_ROOT}/repos"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
TIMESTAMP_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_DIR="${AGENT_ROOT}/logs"
BROADCAST_DIR="${REPOS_DIR}/kernel-lane/lanes/broadcast"

mkdir -p "${LOG_DIR}"
HYGIENE_REPORT_DIR="${BROADCAST_DIR}/hygiene"
QUARANTINE_DIR="${BROADCAST_DIR}/quarantine/path_normalization"
mkdir -p "${HYGIENE_REPORT_DIR}" "${QUARANTINE_DIR}"

# 1. Windows path detection
PATH_ISSUES=$(find "${REPOS_DIR}" -path '*[A-Z]:*' -print) || true

# 2. Secrets in process arguments
SECRET_ISSUES=$(ps -eo pid,cmd | grep -Ei -- '--api-key|sk-|nvapi-|OPENROUTER|NVIDIA' | grep -v grep) || true

# 3. Dirty git repositories
declare -a DIRTY_REPOS
for REPO in Archivist-Agent kernel-lane self-organizing-library SwarmMind; do
  REPO_PATH="${REPOS_DIR}/${REPO}"
  if [ -d "${REPO_PATH}/.git" ]; then
    COUNT=$(git -C "${REPO_PATH}" status --short | wc -l)
    if (( COUNT > 0 )); then
      BRANCH=$(git -C "${REPO_PATH}" branch --show-current)
      DIRTY_REPOS+=("${REPO} [${BRANCH}] dirty_files=${COUNT}")
    fi
  fi
done

# 4. Failed systemd services
FAILED_SERVICES_RAW=$(systemctl --user list-units --type=service --state=failed 2>/dev/null || true)
FAILED_SERVICES=$(echo "$FAILED_SERVICES_RAW" | grep -Ev "^$|^\s*UNIT LOAD|^[0-9]+ loaded units listed" || true)

# 5. Queue pressure detection
declare -a QUEUE_PRESSURE
THRESHOLD=100
for REPO in Archivist-Agent kernel-lane self-organizing-library SwarmMind; do
  LANE_DIR="${REPOS_DIR}/${REPO}/lanes"
  if [ -d "${LANE_DIR}" ]; then
    LIVE_INBOX=$(find "${LANE_DIR}" -path "*/inbox/*" -type f ! -path "*/processed/*" ! -path "*/quarantine/*" ! -path "*/blocked/*" 2>/dev/null | wc -l)
    OUTBOX=$(find "${LANE_DIR}" -path "*/outbox/*" -type f ! -path "*/processed/*" ! -path "*/sent/*" 2>/dev/null | wc -l)
    if (( LIVE_INBOX > THRESHOLD || OUTBOX > THRESHOLD )); then
      QUEUE_PRESSURE+=("${REPO} live_inbox=${LIVE_INBOX} outbox=${OUTBOX}")
    fi
  fi
done

# 6. Stale heartbeats
STALE_HEARTBEATS=$(find "${REPOS_DIR}" -type f -name "heartbeat*.json" -mmin +10 -print) || true

# Build JSON
to_json_array() {
  local input="$1"
  if [ -z "$input" ]; then echo "[]"
  else printf '%s\n' "$input" | jq -R . | jq -s .
  fi
}

PATH_JSON=$(to_json_array "$PATH_ISSUES")
SECRET_JSON=$(to_json_array "$SECRET_ISSUES")
DIRTY_JSON=$(to_json_array "${DIRTY_REPOS[@]}")
FAILED_JSON=$(to_json_array "$FAILED_SERVICES")
QUEUE_JSON=$(to_json_array "${QUEUE_PRESSURE[@]}")
STALE_JSON=$(to_json_array "$STALE_HEARTBEATS}")

REPORT=$(jq -n \
  --arg ts "$TIMESTAMP_ISO" \
  --argjson path_issues "$PATH_JSON" \
  --argjson secret_issues "$SECRET_JSON" \
  --argjson dirty_repos "$DIRTY_JSON" \
  --argjson failed_services "$FAILED_JSON" \
  --argjson queue_pressure "$QUEUE_JSON" \
  --argjson stale_heartbeats "$STALE_JSON" \
  '{
    timestamp: $ts,
    path_hygiene: { status: (if $path_issues|length>0 then "FAIL" else "PASS" end), classification: "PATH_NORMALIZATION_BUG", evidence: $path_issues },
    secret_detection: { status: (if $secret_issues|length>0 then "FAIL" else "PASS" end), classification: "SECRETS_IN_PROCESS_ARGS", evidence: $secret_issues },
    dirty_repos: { status: (if $dirty_repos|length>0 then "FAIL" else "PASS" end), evidence: $dirty_repos },
    failed_services: { status: (if $failed_services|length>0 then "FAIL" else "PASS" end), evidence: $failed_services },
    queue_pressure: { status: (if $queue_pressure|length>0 then "FAIL" else "PASS" end), evidence: $queue_pressure },
    stale_heartbeats: { status: (if $stale_heartbeats|length>0 then "FAIL" else "PASS" end), evidence: $stale_heartbeats }
  }')

# Severity
OVERALL_SEVERITY=$(echo "$REPORT" | jq -r 'if any(.[] | select(type=="object"); .status == "FAIL") then "FAIL" else "INFO" end')
REPORT=$(echo "$REPORT" | jq --arg sev "$OVERALL_SEVERITY" --argjson noauto true '. + {severity: $sev, NO_AUTO_FIX: $noauto} | if .secret_detection.status == "FAIL" then . + { operator_action_required: true, operator_action_type: "ROTATE_PROVIDER_KEY", provider: "Morph LLM", dashboard_url: "https://morphllm.com/dashboard", agent_may_remediate_after_operator_confirmation: true, must_not_request_secret_in_chat: true } else . end')

# Write main report
echo "$REPORT" > "${HYGIENE_REPORT_DIR}/hygiene_report_${TIMESTAMP}.json"
ln -sf "${HYGIENE_REPORT_DIR}/hygiene_report_${TIMESTAMP}.json" "${HYGIENE_REPORT_DIR}/latest.json"

# Operator alert with deduplication (v2)
ANY_FAIL=$(echo "$REPORT" | jq '[.. | objects | select(has("status")) | .status] | any(.=="FAIL")')
if [ "$ANY_FAIL" = "true" ]; then
  ALERT=$(jq -n --arg ts "$TIMESTAMP" --argjson details "$REPORT" '{timestamp:$ts, alert:"Hygiene monitor detected issues", details:$details}')
  ALERT_BODY=$(echo "$ALERT" | jq 'del(.timestamp) | del(.details.timestamp)')
  LAST_ALERT_LINK="${BROADCAST_DIR}/operator_alert_latest.json"
  SKIP_WRITE=false
  if [ -L "$LAST_ALERT_LINK" ] || [ -f "$LAST_ALERT_LINK" ]; then
    PREV_BODY=$(cat "$LAST_ALERT_LINK" | jq 'del(.timestamp) | del(.details.timestamp)' 2>/dev/null || echo "nomatch")
    if [ "$ALERT_BODY" = "$PREV_BODY" ]; then
      SKIP_WRITE=true
    fi
  fi
  if [ "$SKIP_WRITE" = "true" ]; then
    echo "[$(date -u +%FT%TZ)] Hygiene alert unchanged, skipping write" >> "${LOG_DIR}/hygiene-monitor.log"
  else
    ALERT_FILE="${BROADCAST_DIR}/operator_alert_${TIMESTAMP}.json"
    echo "$ALERT" > "$ALERT_FILE"
    ln -sf "$ALERT_FILE" "$LAST_ALERT_LINK"
  fi
fi

# Store Journal append
JOURNAL_DIR="${AGENT_ROOT}/journal"
if [ -d "$JOURNAL_DIR" ]; then
  DATE=$(date -u +%F)
  JOURNAL_FILE="${JOURNAL_DIR}/${DATE}.jsonl"
  touch "$JOURNAL_FILE"
  SEVERITY=$(echo "$REPORT" | jq -r .severity)
  jq -n --arg ts "$TIMESTAMP" --arg sev "$SEVERITY" '{timestamp:$ts, event_type:"hygiene_monitor", severity:$sev, NO_AUTO_FIX:true}' >> "$JOURNAL_FILE"
fi

# Quarantine path evidence
if [ -n "$PATH_ISSUES" ]; then
  QUARANTINE=$(jq -n --arg ts "$TIMESTAMP" --argjson evidence "$PATH_JSON" '{timestamp:$ts, classification:"PATH_NORMALIZATION_BUG", evidence:$evidence}')
  echo "$QUARANTINE" > "${QUARANTINE_DIR}/${TIMESTAMP}.json"
fi

exit 0
