[CmdletBinding()]
param(
    [switch]$WhatIf
)

$ErrorActionPreference = 'SilentlyContinue'
$repoRoot = 'S:/Archivist-Agent'

$script:DeletedCount = 0
$script:FreedBytes = 0L

function Remove-LoggedItem {
    param(
        [string]$Path,
        [switch]$Recurse,
        [switch]$Force
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $item = Get-Item $Path -Force
    if ($item) {
        $size = 0L
        if ($item -is [System.IO.FileInfo]) {
            $size = $item.Length
        } elseif ($item -is [System.IO.DirectoryInfo]) {
            $size = ($item.GetFiles('*', [System.IO.SearchOption]::AllDirectories) | Measure-Object -Property Length -Sum).Sum
            if ($null -eq $size) { $size = 0L }
        }

        $relPath = $Path.Replace($repoRoot, '').TrimStart('\', '/')
        $typeLabel = if ($item -is [System.IO.DirectoryInfo]) { 'DIR ' } else { 'FILE' }

        if ($WhatIf) {
            Write-Host ("[WHATIF] Would delete {0}: {1} ({2:N0} bytes)" -f $typeLabel, $relPath, $size)
        } else {
            Write-Host ("DELETING {0}: {1} ({2:N0} bytes)" -f $typeLabel, $relPath, $size)
            if ($Recurse) {
                Remove-Item $Path -Recurse -Force
            } else {
                Remove-Item $Path -Force
            }
        }

        $script:DeletedCount++
        $script:FreedBytes += $size
    }
}

function Remove-LoggedContents {
    param(
        [string]$DirPath
    )

    if (-not (Test-Path $DirPath)) {
        return
    }

    $items = Get-ChildItem $DirPath -Force
    foreach ($item in $items) {
        Remove-LoggedItem -Path $item.FullName -Recurse -Force
    }
}

function Remove-Glob {
    param(
        [string]$BaseDir,
        [string]$Pattern
    )

    $items = Get-ChildItem -Path $BaseDir -Filter $Pattern -Force
    foreach ($item in $items) {
        Remove-LoggedItem -Path $item.FullName -Recurse -Force
    }
}

# ============================================================
# CATEGORY 1 — tmp/ directory (delete contents, keep directory)
# ============================================================
Write-Host "`n=== CATEGORY 1: tmp/ directory contents ==="
Remove-LoggedContents "$repoRoot/tmp"

# ============================================================
# CATEGORY 2 — .tmp/ directory (delete contents, keep directory)
# ============================================================
Write-Host "`n=== CATEGORY 2: .tmp/ directory contents ==="
Remove-LoggedContents "$repoRoot/.tmp"

# ============================================================
# CATEGORY 3 — _tmp_sendmsg_tests/ directory (delete entire directory)
# ============================================================
Write-Host "`n=== CATEGORY 3: _tmp_sendmsg_tests/ directory ==="
Remove-LoggedItem "$repoRoot/_tmp_sendmsg_tests" -Recurse -Force

# ============================================================
# CATEGORY 4 — scratch/ directory (delete test artifacts only)
# ============================================================
Write-Host "`n=== CATEGORY 4: scratch/ test artifacts ==="
Remove-LoggedItem "$repoRoot/scratch/tool-test-dir" -Recurse -Force
Remove-LoggedItem "$repoRoot/scratch/tool-test.js" -Force
Remove-LoggedItem "$repoRoot/scratch/tool-test.txt" -Force
Remove-LoggedItem "$repoRoot/scratch/tool-test" -Recurse -Force

# ============================================================
# CATEGORY 5 — Top-level stray .txt files
# ============================================================
Write-Host "`n=== CATEGORY 5: Top-level stray .txt files ==="

# Conversation fragments starting with "# "
Remove-Glob $repoRoot '# Beyond Prohibition*'
Remove-Glob $repoRoot '# The Moral Imperative*'
Remove-Glob $repoRoot '# User Drift Scoring System*'
Remove-Glob $repoRoot '## User Drift Scoring System*'

# Other stray .txt files
Remove-LoggedItem "$repoRoot/Architecture Review Checklist.txt" -Force
Remove-LoggedItem "$repoRoot/Constraint-aware Error Handling*.txt" -Force
Remove-Glob $repoRoot 'Constraint-aware Error Handling*'
Remove-LoggedItem "$repoRoot/Decision Matrix.txt" -Force
Remove-LoggedItem "$repoRoot/Error Handling & Resilience Concept.txt" -Force
Remove-LoggedItem "$repoRoot/Grokassesmentaoril142026.txt" -Force
Remove-LoggedItem "$repoRoot/Sharp edges Clarifications.txt" -Force

# Conversation fragment files
Remove-Glob $repoRoot "You're right*"
Remove-Glob $repoRoot 'Alright—*'
Remove-Glob $repoRoot "Here's the full*"
Remove-Glob $repoRoot "I'm on Ubuntu*"
Remove-Glob $repoRoot "You're right to flag*"

Remove-LoggedItem "$repoRoot/OUTPUT_PROVENANCE.txt" -Force
Remove-LoggedItem "$repoRoot/opencodeupgrades.txt" -Force

# ============================================================
# CATEGORY 6 — Top-level stale state JSON files
# ============================================================
Write-Host "`n=== CATEGORY 6: Top-level stale state JSON files ==="
Remove-LoggedItem "$repoRoot/archivist-final-task-matrix.json" -Force
Remove-LoggedItem "$repoRoot/archivist-normalization-status.json" -Force
Remove-LoggedItem "$repoRoot/archivist-replica-diff-report.json" -Force

Remove-Glob $repoRoot 'swarmmind-*.json'

Remove-LoggedItem "$repoRoot/governance-stress-report.json" -Force
Remove-LoggedItem "$repoRoot/post-convergence-lock-status.json" -Force
Remove-LoggedItem "$repoRoot/convergence-complete.json" -Force
Remove-LoggedItem "$repoRoot/convergence-monitor-report-20260423.json" -Force
Remove-LoggedItem "$repoRoot/convergence-artifact-schema-v1.json" -Force
Remove-LoggedItem "$repoRoot/automatic-escalation-2026-04-23T215153230Z.json" -Force
Remove-LoggedItem "$repoRoot/CONTINUITY_REGISTRY.json" -Force
Remove-LoggedItem "$repoRoot/RUNTIME_STATE.json" -Force
Remove-LoggedItem "$repoRoot/SESSION_REGISTRY.json" -Force
Remove-LoggedItem "$repoRoot/LAST_KNOWN_STATE_2026-04-17.json" -Force
Remove-LoggedItem "$repoRoot/context.md" -Force

# ============================================================
# CATEGORY 7 — Top-level temp scripts
# ============================================================
Write-Host "`n=== CATEGORY 7: Top-level temp scripts ==="
Remove-LoggedItem "$repoRoot/test_models_working.js" -Force
Remove-LoggedItem "$repoRoot/test-nvidia-persistence.js" -Force
Remove-LoggedItem "$repoRoot/test-persistence.js" -Force
Remove-LoggedItem "$repoRoot/test-persistence2.js" -Force
Remove-LoggedItem "$repoRoot/test-sign2.js" -Force
Remove-LoggedItem "$repoRoot/test-sign3.js" -Force
Remove-LoggedItem "$repoRoot/test-sign4.js" -Force
Remove-LoggedItem "$repoRoot/test-ui-diag.py" -Force
Remove-LoggedItem "$repoRoot/fix-heartbeat.js" -Force
Remove-LoggedItem "$repoRoot/fix-toolmap-casing.js" -Force
Remove-LoggedItem "$repoRoot/gen-heartbeat.js" -Force
Remove-LoggedItem "$repoRoot/capture-screen.ps1" -Force
Remove-LoggedItem "$repoRoot/launch-and-capture.ps1" -Force

# ============================================================
# CATEGORY 8 — Top-level build/test artifacts
# ============================================================
Write-Host "`n=== CATEGORY 8: Top-level build/test artifacts ==="
Remove-LoggedItem "$repoRoot/firebase-debug.log" -Force
Remove-LoggedItem "$repoRoot/tsconfig.ci.json" -Force
Remove-LoggedItem "$repoRoot/tsconfig.tsbuildinfo" -Force
Remove-LoggedItem "$repoRoot/wave1.patch" -Force
Remove-LoggedItem "$repoRoot/tauri-screenshot.png" -Force
Remove-LoggedItem "$repoRoot/test-screenshot.png" -Force
Remove-LoggedItem "$repoRoot/nul" -Force

# ============================================================
# CATEGORY 9 — scripts/ directory temp files
# ============================================================
Write-Host "`n=== CATEGORY 9: scripts/ temp files ==="
$scriptsDir = "$repoRoot/scripts"

Remove-LoggedItem "$scriptsDir/_lane_sync_check.js" -Force
Remove-LoggedItem "$scriptsDir/_lane_sync_check.sh" -Force
Remove-LoggedItem "$scriptsDir/_lane_sync_v2.js" -Force
Remove-LoggedItem "$scriptsDir/test-signed-message.js.tmp" -Force

Remove-LoggedItem "$scriptsDir/lane-worker.js.backup" -Force
Remove-LoggedItem "$scriptsDir/lane-worker.js.backup-20260529-202446" -Force
Remove-LoggedItem "$scriptsDir/lane-worker.js.backup-20260530-190339" -Force
Remove-LoggedItem "$scriptsDir/lane-worker.js.bak-1780099307" -Force
Remove-LoggedItem "$scriptsDir/lane-worker.js.nack-fix-backup" -Force

Remove-LoggedItem "$scriptsDir/hygiene-monitor-v2.sh.bak-20260517171659" -Force
Remove-LoggedItem "$scriptsDir/auto-inbox-watch.ps1.QUARANTINED" -Force

Remove-LoggedItem "$scriptsDir/inbox-watcher.log" -Force
Remove-LoggedItem "$scriptsDir/deletion-log.txt" -Force
Remove-LoggedItem "$scriptsDir/migration-output.log" -Force
Remove-LoggedItem "$scriptsDir/swarmmind-migration-log.txt" -Force
Remove-LoggedItem "$scriptsDir/swarmmind-migration-report.txt" -Force

Remove-LoggedItem "$scriptsDir/verify-archivist-nodes-v2.js" -Force
Remove-LoggedItem "$scriptsDir/verify-archivist-nodes-v3.js" -Force
Remove-LoggedItem "$scriptsDir/verify-archivist-nodes-v4.js" -Force
Remove-LoggedItem "$scriptsDir/verify-archivist-nodes-v5.js" -Force

Remove-LoggedItem "$scriptsDir/nul" -Force

# ============================================================
# CATEGORY 10 — context-buffer/ dated analysis files
# ============================================================
Write-Host "`n=== CATEGORY 10: context-buffer/ dated artifacts ==="
$cbDir = "$repoRoot/context-buffer"

# graph-auto-analysis-2026-04-30T*.{json,md}
Remove-Glob $cbDir 'graph-auto-analysis-2026-04-30T*.json'
Remove-Glob $cbDir 'graph-auto-analysis-2026-04-30T*.md'

# graph-roadmap-extraction-result-2026-04-2*.json/md
Remove-Glob $cbDir 'graph-roadmap-extraction-result-2026-04-2*.json'
Remove-Glob $cbDir 'graph-roadmap-extraction-result-2026-04-2*.md'

# graph-snapshot-2026-04-30-*.json.backup-*
Remove-Glob $cbDir 'graph-snapshot-2026-04-30-*.json.backup-*'

# compact-*-20260429.md, pre-read-*-20260429.md, *-20260429.json
Remove-Glob $cbDir 'compact-*-20260429.md'
Remove-Glob $cbDir 'pre-read-*-20260429.md'
Remove-Glob $cbDir '*-20260429.json'

# contradiction_batch_{1,2,3}_20260430.json
Remove-LoggedItem "$cbDir/contradiction_batch_1_20260430.json" -Force
Remove-LoggedItem "$cbDir/contradiction_batch_2_20260430.json" -Force
Remove-LoggedItem "$cbDir/contradiction_batch_3_20260430.json" -Force

# extra-archive-20260429134636.zip
Remove-LoggedItem "$cbDir/extra-archive-20260429134636.zip" -Force

# Stray shell scripts
Remove-LoggedItem "$cbDir/debug-remote.sh" -Force
Remove-LoggedItem "$cbDir/vps-sudo-remediation.sh" -Force
Remove-LoggedItem "$cbDir/we4free-lane-daemon-fixed.sh" -Force

# Stray .txt files in context-buffer
$cbTxtFiles = Get-ChildItem -Path $cbDir -Filter '*.txt' -Force -File
foreach ($txt in $cbTxtFiles) {
    Remove-LoggedItem $txt.FullName -Force
}

# ============================================================
# SUMMARY
# ============================================================
Write-Host "`n============================================================"
if ($WhatIf) {
    Write-Host ("DRY-RUN SUMMARY: {0} items would be deleted, {1:N0} bytes would be freed" -f $script:DeletedCount, $script:FreedBytes)
} else {
    Write-Host ("CLEANUP SUMMARY: {0} items deleted, {1:N0} bytes freed" -f $script:DeletedCount, $script:FreedBytes)
}
Write-Host "============================================================"
