#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

AGENT_ROOT="$HOME/agent"
REPOS_DIR="$AGENT_ROOT/repos"
ARTIFACTS_DIR="$AGENT_ROOT/artifacts"
LOG_DIR="$AGENT_ROOT/logs"
LOCK_FILE="$AGENT_ROOT/runner.lock"
LOG_FILE="$LOG_DIR/agent.log"
AUDIT_SCRIPT="$AGENT_ROOT/scripts/compact-restore-bridge.js"

mkdir -p "$ARTIFACTS_DIR" "$LOG_DIR"

if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "$(date -Iseconds) [WARN] Runner already running, exiting" >> "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_FILE" 2>/dev/null' EXIT

log() { echo "$(date -Iseconds) $1" >> "$LOG_FILE"; }

# Split mode: keep kernel local by default.
# Override with RUNNER_INCLUDE_KERNEL=1 if you explicitly want kernel managed on Ubuntu.
RUNNER_INCLUDE_KERNEL="${RUNNER_INCLUDE_KERNEL:-0}"

REPOS=("Archivist-Agent" "self-organizing-library" "SwarmMind")
REPO_URLS=(
  "https://github.com/vortsghost2025/Archivist-Agent.git"
  "https://github.com/vortsghost2025/self-organizing-library.git"
  "https://github.com/vortsghost2025/SwarmMind-Self-Optimizing-Multi-Agent-AI-System.git"
)

if [ "$RUNNER_INCLUDE_KERNEL" = "1" ]; then
  REPOS=("kernel-lane" "${REPOS[@]}")
  REPO_URLS=("https://github.com/vortsghost2025/kernel-lane.git" "${REPO_URLS[@]}")
fi

clone_if_missing() {
  local name="$1" url="$2"
  if [ ! -d "$REPOS_DIR/$name" ]; then
    log "[INFO] Cloning $name..."
    git clone --depth 1 "$url" "$REPOS_DIR/$name" 2>> "$LOG_FILE" || log "[ERROR] Failed to clone $name"
  fi
}

pull_latest() {
  local name="$1"
  local dir="$REPOS_DIR/$name"
  if [ -d "$dir" ]; then
    log "[INFO] Pulling latest for $name..."
    if git -C "$dir" diff-index --quiet HEAD 2>/dev/null; then
      git -C "$dir" pull --ff-only 2>> "$LOG_FILE" || log "[ERROR] Pull failed for $name"
    else
      log "[WARN] $dir has local changes, skipping pull"
    fi
  fi
}

task_sovereignty_scan() {
  log "[TASK] Sovereignty scan across selected lanes..."
  local result_file="$ARTIFACTS_DIR/sovereignty-scan-$(date +%Y%m%d-%H%M%S).json"
  local violations=0

  for repo in "${REPOS[@]}"; do
    local dir="$REPOS_DIR/$repo"
    if [ ! -d "$dir" ]; then
      log "[WARN] $repo not found, skipping"
      continue
    fi

    local count
    count=$(grep -rl "require.*['\"]S:[\\/]\(Archivist-Agent\|self-organizing-library\|SwarmMind\|kernel-lane\)" "$dir/src" "$dir/scripts" 2>/dev/null | grep -v "node_modules" | grep -v ".git" | wc -l || true)

    if [ "$count" -gt 0 ]; then
      violations=$((violations + count))
      log "[VIOLATION] $repo has $count cross-lane imports"
    else
      log "[PASS] $repo sovereignty-compliant"
    fi
  done

  cat > "$result_file" <<JSONEOF
{
  "task": "sovereignty_scan",
  "timestamp": "$(date -Iseconds)",
  "total_violations": $violations,
  "lanes_scanned": ${#REPOS[@]},
  "status": "$([ "$violations" -eq 0 ] && echo "compliant" || echo "violations_found")",
  "runner_include_kernel": "$RUNNER_INCLUDE_KERNEL"
}
JSONEOF
  log "[TASK] Sovereignty scan complete: $violations violations -> $result_file"
}

task_graph_analysis() {
  # Graph analysis is kernel-owned; skip in split mode unless explicitly enabled.
  if [ "$RUNNER_INCLUDE_KERNEL" != "1" ]; then
    log "[TASK] Graph analysis skipped (kernel local mode)"
    return
  fi

  log "[TASK] Graph analysis..."
  local snapshot_dir="$REPOS_DIR/kernel-lane/evidence/graph-snapshots"
  if [ ! -d "$snapshot_dir" ]; then
    log "[WARN] No graph snapshots found"
    return
  fi

  local latest
  latest=$(ls -t "$snapshot_dir"/*.json 2>/dev/null | head -1)
  if [ -z "$latest" ]; then
    log "[WARN] No snapshot JSON files found"
    return
  fi

  local result_file="$ARTIFACTS_DIR/graph-analysis-$(date +%Y%m%d-%H%M%S).json"
  local total verified unverified conflicted

  total=$(node -e "const d=require('$latest');const e=d.entries||[];console.log(e.length)" 2>> "$LOG_FILE" || echo 0)
  verified=$(node -e "const d=require('$latest');const e=d.entries||[];console.log(e.filter(x=>x.bridgeState==='verified').length)" 2>> "$LOG_FILE" || echo 0)
  unverified=$(node -e "const d=require('$latest');const e=d.entries||[];console.log(e.filter(x=>x.bridgeState==='unknown'||!x.bridgeState).length)" 2>> "$LOG_FILE" || echo 0)
  conflicted=$(node -e "const d=require('$latest');const e=d.entries||[];console.log(e.filter(x=>x.bridgeState==='contradicted').length)" 2>> "$LOG_FILE" || echo 0)

  cat > "$result_file" <<JSONEOF
{
  "task": "graph_analysis",
  "timestamp": "$(date -Iseconds)",
  "snapshot": "$(basename "$latest")",
  "total": $total,
  "verified": $verified,
  "unverified": $unverified,
  "conflicted": $conflicted
}
JSONEOF
  log "[TASK] Graph analysis: $total total, $verified verified, $unverified unverified, $conflicted conflicted -> $result_file"
}

task_health_report() {
  log "[TASK] Health report..."
  local result_file="$LOG_DIR/node-health.json"
  local uptime_s disk_free mem_free node_ver

  uptime_s=$(cat /proc/uptime | awk '{print int($1)}')
  disk_free=$(df -h /home/we4free | awk 'NR==2{print $4}')
  mem_free=$(free -m | awk '/Mem:/{print $4}')
  node_ver=$(node --version 2>> "$LOG_FILE" || echo "unknown")

  cat > "$result_file" <<JSONEOF
{
  "task": "health_report",
  "timestamp": "$(date -Iseconds)",
  "uptime_seconds": $uptime_s,
  "disk_free": "$disk_free",
  "mem_free_mb": $mem_free,
  "node_version": "$node_ver",
  "repos_cloned": ${#REPOS[@]},
  "runner_version": "3.0",
  "runner_include_kernel": "$RUNNER_INCLUDE_KERNEL"
}
JSONEOF
  log "[TASK] Health report -> $result_file"
}

task_inbox_watch() {
  log "[TASK] Inbox watch across selected lanes..."
  for repo in "${REPOS[@]}"; do
    local inbox_dir="$REPOS_DIR/$repo/lanes"
    if [ ! -d "$inbox_dir" ]; then
      continue
    fi

    local lane_name
    case "$repo" in
      kernel-lane) lane_name="kernel" ;;
      Archivist-Agent) lane_name="archivist" ;;
      self-organizing-library) lane_name="library" ;;
      SwarmMind) lane_name="swarmmind" ;;
    esac

    local inbox="$REPOS_DIR/$repo/lanes/$lane_name/inbox"
    if [ -d "$inbox" ]; then
      local msg_count
      msg_count=$(find "$inbox" -maxdepth 1 -name "*.json" ! -name "heartbeat-*.json" 2>/dev/null | wc -l || echo 0)
      if [ "$msg_count" -gt 0 ]; then
        log "[INFO] $lane_name inbox: $msg_count pending messages"
      fi
    fi
  done
}

task_artifact_retention() {
  # Retention policy: keep last 24 hours of artifacts (~1440 files), delete older.
  # This prevents unbounded growth of graph-analysis-*.json and sovereignty-scan-*.json
  local retention_hours="${ARTIFACT_RETENTION_HOURS:-24}"
  local cutoff_epoch
  cutoff_epoch=$(date -d "$retention_hours hours ago" +%s 2>/dev/null || date -v-${retention_hours}H +%s 2>/dev/null || echo 0)

  if [ "$cutoff_epoch" -eq 0 ]; then
    log "[WARN] Artifact retention: could not compute cutoff, skipping"
    return
  fi

  local deleted=0
  local kept=0
  for f in "$ARTIFACTS_DIR"/graph-analysis-*.json "$ARTIFACTS_DIR"/sovereignty-scan-*.json "$ARTIFACTS_DIR"/graph-stats-*.json; do
    [ -f "$f" ] || continue
    local file_epoch
    # Extract timestamp from filename: graph-analysis-20260502-194739.json
    file_epoch=$(date -d "$(echo "$f" | sed -E 's/.*-([0-9]{8})-([0-9]{6})\.json/\1 \2/' | sed 's/\(....\)\(..\)/\1-\2-/')" +%s 2>/dev/null || echo 9999999999)
    if [ "$file_epoch" -lt "$cutoff_epoch" ] 2>/dev/null; then
      rm -f "$f"
      deleted=$((deleted + 1))
    else
      kept=$((kept + 1))
    fi
  done
  log "[TASK] Artifact retention: deleted=$deleted, kept=$kept, retention_hours=$retention_hours"
}

# ── Compact Restore Bridge Hooks ──────────────────────────────────────
# These hooks ensure that when the Ubuntu agent compacts, its context
# can be verified and restored using the existing audit pipeline.
#
# Flow: pre-compact snapshot → compact → restore packet → post-compact audit → recovery suite
# ──────────────────────────────────────────────────────────────────────

task_compact_audit_init() {
  log "[TASK] Compact audit init — ensuring .compact-audit/ dirs for all lanes..."
  local bridge_script="$REPOS_DIR/Archivist-Agent/scripts/compact-restore-bridge.js"
  if [ ! -f "$bridge_script" ]; then
    log "[WARN] compact-restore-bridge.js not found — skipping init"
    return
  fi
  local result
  result=$(node "$bridge_script" init 2>&1) || true
  log "[TASK] Compact audit init: $result"
}

task_pre_compact_snapshot() {
  log "[TASK] Pre-compact snapshot — capturing state before agent session..."
  local audit_script="$REPOS_DIR/Archivist-Agent/scripts/post-compact-audit.js"
  if [ ! -f "$audit_script" ]; then
    log "[WARN] post-compact-audit.js not found — skipping pre-compact snapshot"
    return
  fi

  # Capture pre-compact snapshot for archivist lane
  local result
  result=$(node -e "
    const { PostCompactAudit } = require('$audit_script');
    const audit = new PostCompactAudit();
    const snap = audit.capturePreCompact();
    console.log('snapshot_phase=' + snap.phase + ' constraints=' + (snap.constraint_names || []).length);
  " 2>&1) || true
  log "[TASK] Pre-compact snapshot: $result"

  # If a COMPACT_RESTORE_PACKET exists for any lane, bridge it into the audit pipeline
  for repo in "${REPOS[@]}"; do
    local lane_name
    case "$repo" in
      Archivist-Agent) lane_name="archivist" ;;
      self-organizing-library) lane_name="library" ;;
      SwarmMind) lane_name="swarmmind" ;;
      kernel-lane) lane_name="kernel" ;;
      *) continue ;;
    esac

    local packet_path="$REPOS_DIR/$repo/COMPACT_RESTORE_PACKET.json"
    if [ -f "$packet_path" ]; then
      local bridge_script="$REPOS_DIR/Archivist-Agent/scripts/compact-restore-bridge.js"
      if [ -f "$bridge_script" ]; then
        log "[TASK] Bridging restore packet for $lane_name from $packet_path"
        node "$bridge_script" pre-compact "$lane_name" "$packet_path" >> "$LOG_FILE" 2>&1 || log "[WARN] Bridge pre-compact failed for $lane_name"
      fi
    fi

    # Also check .compact-audit/ for lane-specific packets
    local audit_packet="$REPOS_DIR/$repo/.compact-audit/COMPACT_RESTORE_PACKET.json"
    if [ -f "$audit_packet" ]; then
      local bridge_script="$REPOS_DIR/Archivist-Agent/scripts/compact-restore-bridge.js"
      if [ -f "$bridge_script" ]; then
        log "[TASK] Bridging audit-embedded restore packet for $lane_name"
        node "$bridge_script" pre-compact "$lane_name" "$audit_packet" >> "$LOG_FILE" 2>&1 || log "[WARN] Bridge pre-compact failed for $lane_name (audit)"
      fi
    fi
  done
}

task_post_compact_verify() {
  log "[TASK] Post-compact verify — running recovery suite after agent session..."
  local recovery_script="$REPOS_DIR/Archivist-Agent/scripts/recovery-test-suite.js"
  if [ ! -f "$recovery_script" ]; then
    log "[WARN] recovery-test-suite.js not found — skipping post-compact verify"
    return
  fi

  local result
  result=$(node "$recovery_script" 2>&1) || true
  local exit_code=$?

  # Extract verdict from output
  local verdict
  verdict=$(echo "$result" | grep -oE 'RECOVERY (PROVEN|CONFLICTED)' | head -1 || echo "UNKNOWN")
  log "[TASK] Post-compact verify: verdict=$verdict exit=$exit_code"

  # Write verdict to artifacts for monitoring
  cat > "$ARTIFACTS_DIR/recovery-verify-$(date +%Y%m%d-%H%M%S).json" <<JSONEOF
{
  "task": "post_compact_verify",
  "timestamp": "$(date -Iseconds)",
  "verdict": "$verdict",
  "exit_code": $exit_code
}
JSONEOF

  if [ "$verdict" = "RECOVERY CONFLICTED" ]; then
    log "[ALERT] Post-compact verify CONFLICTED — context may be corrupted"
  fi
}

task_restore_from_packet() {
  log "[TASK] Restore from packet — checking for any pending COMPACT_RESTORE_PACKET..."
  local bridge_script="$REPOS_DIR/Archivist-Agent/scripts/compact-restore-bridge.js"
  if [ ! -f "$bridge_script" ]; then
    log "[WARN] compact-restore-bridge.js not found — skipping restore"
    return
  fi

  for repo in "${REPOS[@]}"; do
    local lane_name
    case "$repo" in
      Archivist-Agent) lane_name="archivist" ;;
      self-organizing-library) lane_name="library" ;;
      SwarmMind) lane_name="swarmmind" ;;
      kernel-lane) lane_name="kernel" ;;
      *) continue ;;
    esac

    local packet_path="$REPOS_DIR/$repo/COMPACT_RESTORE_PACKET.json"
    if [ -f "$packet_path" ]; then
      log "[TASK] Restoring $lane_name from $packet_path"
      local restore_result
      restore_result=$(node "$bridge_script" restore "$lane_name" "$packet_path" 2>&1) || true
      log "[TASK] Restore $lane_name: $restore_result"

      # Move packet to .compact-audit/ after successful restore (lane ownership fix)
      local audit_dir="$REPOS_DIR/$repo/.compact-audit"
      mkdir -p "$audit_dir"
      mv "$packet_path" "$audit_dir/COMPACT_RESTORE_PACKET.json" 2>/dev/null || true

      # Cross-verify
      local verify_result
      verify_result=$(node "$bridge_script" cross-verify "$lane_name" 2>&1) || true
      log "[TASK] Cross-verify $lane_name: $verify_result"
    fi
  done
}

# ── Main Runner ───────────────────────────────────────────────────────

log "========== Runner v3.0 starting (kernel_include=$RUNNER_INCLUDE_KERNEL) =========="

for i in "${!REPOS[@]}"; do
  clone_if_missing "${REPOS[$i]}" "${REPO_URLS[$i]}"
done

for repo in "${REPOS[@]}"; do
  pull_latest "$repo"
done

# Phase 1: Compact audit initialization (once per cycle)
task_compact_audit_init

# Phase 2: Pre-compact snapshot (captures state before work)
task_pre_compact_snapshot

# Phase 3: Restore any pending compact restore packets
task_restore_from_packet

# Phase 4: Regular tasks
task_sovereignty_scan
task_graph_analysis
task_health_report
task_inbox_watch
task_artifact_retention

# Phase 5: Post-compact verify (validates context after work)
task_post_compact_verify

log "========== Runner v3.0 complete =========="
