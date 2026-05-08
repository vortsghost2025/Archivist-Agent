
# ── Main Runner ───────────────────────────────────────────────────────
log "========== Runner v3.1 starting (kernel_include=$RUNNER_INCLUDE_KERNEL) =========="

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

# Phase 4.5: Autonomous execution (scan → route → execute → verify → respond)
task_execute_action_required
task_blocked_remediation

# Phase 5: Post-compact verify (validates context after work)
task_post_compact_verify

log "========== Runner v3.1 complete =========="
