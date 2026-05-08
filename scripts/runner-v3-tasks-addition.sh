
task_execute_action_required() {
  log "[TASK] Execute action-required tasks across lanes..."
  for repo in "${REPOS[@]}"; do
    local lane_name
    case "$repo" in
      Archivist-Agent) lane_name="archivist" ;;
      self-organizing-library) lane_name="library" ;;
      SwarmMind) lane_name="swarmmind" ;;
      kernel-lane) lane_name="kernel" ;;
      *) continue ;;
    esac
    local executor_script="$REPOS_DIR/$repo/scripts/executor-watcher.js"
    if [ ! -f "$executor_script" ]; then continue; fi
    local result
    result=$(node "$executor_script" --apply --lane="$lane_name" 2>&1) || true
    local executed
    executed=$(echo "$result" | grep -oP 'executed.:\s*\K\d+' | head -1 || echo "0")
    if [ "$executed" != "0" ]; then
      log "[TASK] $lane_name executor: executed=$executed"
    fi
  done
}

task_blocked_remediation() {
  log "[TASK] Blocked-remediator across lanes..."
  for repo in "${REPOS[@]}"; do
    local lane_name
    case "$repo" in
      Archivist-Agent) lane_name="archivist" ;;
      self-organizing-library) lane_name="library" ;;
      SwarmMind) lane_name="swarmmind" ;;
      kernel-lane) lane_name="kernel" ;;
      *) continue ;;
    esac
    local remediator_script="$REPOS_DIR/$repo/scripts/blocked-remediator.js"
    if [ ! -f "$remediator_script" ]; then continue; fi
    local result
    result=$(node "$remediator_script" --lane="$lane_name" --apply 2>&1) || true
    local archived
    archived=$(echo "$result" | grep -oP 'archived.:\s*\K\d+' | head -1 || echo "0")
    if [ "$archived" != "0" ]; then
      log "[TASK] $lane_name blocked-remediator: archived=$archived"
    fi
  done
}
