param(
  [string]$UbuntuHost = "we4free@192.168.0.171",
  [int]$PollSeconds = 20,
  [switch]$SkipLocalArchivistLaunch,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
  Write-Host ("`n== " + $msg + " ==") -ForegroundColor Cyan
}

function Stop-LocalNonArchivistLaneServices {
  $patterns = @(
    'S:\\self-organizing-library\\scripts\\lane-worker.js',
    'S:\\self-organizing-library\\scripts\\heartbeat.js',
    'S:\\kernel-lane\\scripts\\lane-worker.js',
    'S:\\kernel-lane\\scripts\\heartbeat.js',
    'S:\\SwarmMind\\scripts\\lane-worker.js',
    'S:\\SwarmMind\\scripts\\heartbeat.js'
  )

  $killed = @()
  $procs = CimCmdlets\Get-CimInstance -ClassName Win32_Process | Where-Object {
    $_.Name -match '^node(\.exe)?$' -and $_.CommandLine
  }

  foreach ($p in $procs) {
    $cmd = $p.CommandLine.ToLowerInvariant()
    $matched = $false
    foreach ($pat in $patterns) {
      if ($cmd.Contains($pat.ToLowerInvariant())) {
        $matched = $true
        break
      }
    }
    if ($matched) {
      if (-not $DryRun) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
      }
      $killed += $p.ProcessId
    }
  }

  return $killed
}

function Start-LocalArchivistOpenCode {
  $launcher = "S:\Archivist-Agent\scripts\launch-opencode-lanes.ps1"
  if (-not (Test-Path -LiteralPath $launcher)) {
    Write-Host "Archivist launcher missing: $launcher" -ForegroundColor Yellow
    return
  }
  if ($DryRun) {
    Write-Host "DRYRUN: would start local Archivist OpenCode via launch-opencode-lanes.ps1"
    return
  }
  powershell -NoProfile -ExecutionPolicy Bypass -File $launcher -Mode single -Lane Archivist | Out-Null
}

function Start-UbuntuLaneServices {
  $remoteScript = @'
set -euo pipefail
source ~/.bashrc >/dev/null 2>&1 || true
mkdir -p ~/agent/logs

declare -a LANE_MAP=(
  "library:self-organizing-library"
  "kernel:kernel-lane"
  "swarmmind:SwarmMind"
)

for pair in "${LANE_MAP[@]}"; do
  lane="${pair%%:*}"
  repo="${pair##*:}"
  root="$HOME/agent/repos/$repo"
  if [ ! -d "$root" ]; then
    echo "MISSING:$lane:$root"
    continue
  fi

  pkill -f "$root/scripts/lane-worker.js" || true
  pkill -f "$root/scripts/heartbeat.js --lane $lane" || true

  nohup node "$root/scripts/lane-worker.js" --apply --watch --poll-seconds __POLL_SECONDS__ > "$HOME/agent/logs/${lane}-worker.log" 2>&1 &
  worker_pid=$!
  nohup node "$root/scripts/heartbeat.js" --lane "$lane" > "$HOME/agent/logs/${lane}-heartbeat.log" 2>&1 &
  heartbeat_pid=$!

  echo "STARTED:$lane:worker=$worker_pid:heartbeat=$heartbeat_pid"
done
'@
  $remoteScript = $remoteScript.Replace('__POLL_SECONDS__', [string]$PollSeconds)

  if ($DryRun) {
    Write-Host "DRYRUN: would execute remote lane start on $UbuntuHost"
    return @()
  }

  $tmpLocal = Join-Path $env:TEMP "stable-profile-remote.sh"
  Set-Content -Path $tmpLocal -Value $remoteScript -Encoding ASCII

  $tmpRemote = "/tmp/stable-profile-remote.sh"
  $oldErrPref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    scp $tmpLocal "$UbuntuHost`:$tmpRemote" | Out-Null
    $output = ssh $UbuntuHost "sed -i 's/\r$//' $tmpRemote; bash -n $tmpRemote; bash $tmpRemote; rm -f $tmpRemote" 2>&1
    return $output
  } finally {
    $ErrorActionPreference = $oldErrPref
  }
}

Write-Step "Daily Stable Profile"
Write-Host ("host={0} poll_seconds={1} dry_run={2}" -f $UbuntuHost, $PollSeconds, $DryRun.IsPresent)

Write-Step "Stop local non-Archivist lane services"
$killedPids = Stop-LocalNonArchivistLaneServices
if ($killedPids.Count -gt 0) {
  Write-Host ("killed local node pids: " + ($killedPids -join ", "))
} else {
  Write-Host "no matching local non-Archivist lane services found"
}

if (-not $SkipLocalArchivistLaunch) {
  Write-Step "Start local Archivist OpenCode"
  Start-LocalArchivistOpenCode
  Write-Host "Archivist launch requested"
} else {
  Write-Step "Skip local Archivist OpenCode launch"
}

Write-Step "Start Library/Kernel/SwarmMind services on Ubuntu"
$remoteOut = Start-UbuntuLaneServices
if ($remoteOut -and $remoteOut.Count -gt 0) {
  $remoteOut | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "no remote output"
}

Write-Step "Done"
Write-Host "Run health panel: powershell -ExecutionPolicy Bypass -File S:\Archivist-Agent\scripts\stable-health-panel.ps1"
