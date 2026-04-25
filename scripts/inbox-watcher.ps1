<#
.SYNOPSIS
Background watcher that polls all lane inboxes for new messages
and automatically runs lane-worker to process them.

.DESCRIPTION
Polls every $PollSeconds for new .json files in each lane's inbox.
When detected, runs lane-worker --apply for that lane.
Logs all activity to a timestamped log file.

.PARAMETER PollSeconds
Seconds between polls. Default: 60.

.PARAMETER LogFile
Path to log file. Default: scripts/inbox-watcher.log

.EXAMPLE
.\scripts\inbox-watcher.ps1 -PollSeconds 30
#>

param(
    [int]$PollSeconds = 60,
    [string]$LogFile = "$PSScriptRoot\inbox-watcher.log"
)

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File -FilePath $LogFile -Append -Encoding utf8
    Write-Host "$ts $msg"
}

$LaneRoots = @{
    archivist = "S:\Archivist-Agent"
    kernel    = "S:\kernel-lane"
    library   = "S:\self-organizing-library"
    swarmmind = "S:\SwarmMind"
}

$InboxSubpath = "lanes"

function Count-NewMessages([string]$inboxDir) {
    if (-not (Test-Path $inboxDir)) { return 0 }
    return (Get-ChildItem -Path $inboxDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "heartbeat*" }).Count
}

Write-Log "[watcher] Started - poll interval ${PollSeconds}s - lanes: $($LaneRoots.Keys -join ',')"

$cycle = 0
while ($true) {
    $cycle++
    $activity = $false

    foreach ($lane in $LaneRoots.Keys) {
        $root = $LaneRoots[$lane]
        $inboxDir = Join-Path $root "lanes\$lane\inbox"

        $count = Count-NewMessages $inboxDir
        if ($count -eq 0) { continue }

        Write-Log "[watcher] Cycle $cycle : $count messages in ${lane} inbox - invoking lane-worker"

        try {
            $result = & node "$root\scripts\lane-worker.js" --lane $lane --apply 2>&1
            $resultStr = ($result | Out-String).Trim()
            Write-Log "[watcher] Lane-worker ${lane}: $resultStr"
            $activity = $true
        } catch {
            Write-Log "[watcher] ERROR lane-worker ${lane}: $_"
        }
    }

    if (-not $activity -and $cycle % 10 -eq 0) {
        Write-Log "[watcher] Cycle $cycle : no new messages across any lane"
    }

    Start-Sleep -Seconds $PollSeconds
}
