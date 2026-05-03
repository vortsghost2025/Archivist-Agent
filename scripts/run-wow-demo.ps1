param(
  [string]$HostName = "we4free@192.168.0.171",
  [switch]$DispatchDemoMessages,
  [switch]$ShowMonitorHint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = "S:/Archivist-Agent"
$ubuntuJob = Join-Path $repoRoot "scripts/ubuntu-job.ps1"
$dispatchTask = Join-Path $repoRoot "scripts/dispatch-task.js"
$validateResponses = Join-Path $repoRoot "scripts/validate-responses.js"

function Header([string]$title) {
  Write-Host ""
  Write-Host ("=" * 72) -ForegroundColor DarkGray
  Write-Host $title -ForegroundColor Cyan
  Write-Host ("=" * 72) -ForegroundColor DarkGray
}

function Step([string]$message) {
  Write-Host ("[STEP] " + $message) -ForegroundColor Yellow
}

function RunCmd([scriptblock]$cmd) {
  & $cmd
}

Header "WE4FREE WOW DEMO - Split Architecture Validation"

Step "1) Confirm local split policy (Kernel+Archivist local, Library+SwarmMind offloaded)"
$tasks = @(
  "LaneHeartbeat-Archivist",
  "LaneHeartbeat-Kernel",
  "LaneHeartbeat-Library",
  "LaneHeartbeat-SwarmMind",
  "SwarmMindHeartbeat"
)
$taskRows = foreach ($name in $tasks) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($null -eq $task) {
    [PSCustomObject]@{ Task = $name; State = "NOT_FOUND" }
  } else {
    [PSCustomObject]@{ Task = $name; State = [string]$task.State }
  }
}
$taskRows | Format-Table -Auto | Out-String | Write-Host

Step "2) Show remote Ubuntu status + health"
RunCmd { powershell -NoProfile -ExecutionPolicy Bypass -File $ubuntuJob -Action status -HostName $HostName }
RunCmd { powershell -NoProfile -ExecutionPolicy Bypass -File $ubuntuJob -Action health -HostName $HostName }

Step "3) Verify Ubuntu lane-worker services (Library + SwarmMind active, Kernel absent)"
RunCmd {
  ssh -o BatchMode=yes -o ConnectTimeout=8 $HostName `
    "systemctl --user --type=service --state=running --no-pager | grep -E 'agent-runner|library-lane-worker|swarmmind-lane-worker|kernel-lane-worker' || true"
}

Step "4) Show remote heartbeat recency from lane logs"
RunCmd { ssh -o BatchMode=yes -o ConnectTimeout=8 $HostName "tail -n 8 ~/agent/logs/heartbeat.log 2>/dev/null || true" }

if ($DispatchDemoMessages) {
  Header "Dispatch Demo Messages"
  $stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

  Step "5) Dispatch signed non-action status message -> Library"
  RunCmd {
    node $dispatchTask --to library --from archivist --type status --kind status --priority P3 `
      --subject "wow-demo-library-$stamp" --body "demo message from Archivist split architecture validation" --no-action
  }

  Step "6) Dispatch signed non-action status message -> SwarmMind"
  RunCmd {
    node $dispatchTask --to swarmmind --from archivist --type status --kind status --priority P3 `
      --subject "wow-demo-swarmmind-$stamp" --body "demo message from Archivist split architecture validation" --no-action
  }

  Step "7) Validate response ledger snapshot"
  RunCmd { node $validateResponses | Select-Object -First 80 }
}

if ($ShowMonitorHint) {
  Header "Optional Live Monitor"
  Write-Host "Run this in another terminal for a live lane dashboard:" -ForegroundColor Green
  Write-Host "powershell -ExecutionPolicy Bypass -File `"$repoRoot/scripts/watch-lane-activity.ps1`"" -ForegroundColor White
}

Header "Demo Complete"
Write-Host "If you want message dispatch included every run, use: -DispatchDemoMessages" -ForegroundColor Green
