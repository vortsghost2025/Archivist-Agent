param(
  [int]$StaleMinutes = 10,
  [int]$PollSeconds = 20,
  [switch]$Apply,
  [switch]$IncludeArchivist,
  [switch]$VisibleWindows
)

$lanes = @(
  @{ Name = "archivist"; Root = "S:\Archivist-Agent" },
  @{ Name = "library"; Root = "S:\self-organizing-library" },
  @{ Name = "kernel"; Root = "S:\kernel-lane" },
  @{ Name = "swarmmind"; Root = "S:\SwarmMind" }
)
$pidRegistryPath = "S:\Archivist-Agent\context-buffer\auto-recover-stale-lanes-pids.json"

if (-not $IncludeArchivist) {
  $lanes = $lanes | Where-Object { $_.Name -ne "archivist" }
}

function Get-HeartbeatAgeMinutes {
  param([string]$HeartbeatPath)
  if (-not (Test-Path -LiteralPath $HeartbeatPath)) {
    return $null
  }
  $last = (Get-Item -LiteralPath $HeartbeatPath).LastWriteTime
  return [math]::Round(((Get-Date) - $last).TotalMinutes, 1)
}

function Start-LaneWorkerProcess {
  param([hashtable]$Lane, [int]$Poll, [bool]$Visible)
  $scriptPath = Join-Path $Lane.Root "scripts\lane-worker.js"
  $logDir = "S:\Archivist-Agent\context-buffer\lane-worker-start-logs"
  if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  }
  $stdoutPath = Join-Path $logDir ("{0}-stdout.log" -f $Lane.Name)
  $stderrPath = Join-Path $logDir ("{0}-stderr.log" -f $Lane.Name)
  $style = if ($Visible) { "Normal" } else { "Hidden" }

  $p = Start-Process -FilePath "node" `
    -ArgumentList @($scriptPath, "--apply", "--watch", "--poll-seconds", "$Poll") `
    -WorkingDirectory $Lane.Root `
    -WindowStyle $style `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
  return $p.Id
}

function Start-HeartbeatProcess {
  param([hashtable]$Lane, [bool]$Visible)
  $scriptPath = Join-Path $Lane.Root "scripts\heartbeat.js"
  $logDir = "S:\Archivist-Agent\context-buffer\lane-worker-start-logs"
  if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  }
  $stdoutPath = Join-Path $logDir ("{0}-heartbeat-stdout.log" -f $Lane.Name)
  $stderrPath = Join-Path $logDir ("{0}-heartbeat-stderr.log" -f $Lane.Name)
  $style = if ($Visible) { "Normal" } else { "Hidden" }

  $p = Start-Process -FilePath "node" `
    -ArgumentList @($scriptPath, "--lane", $Lane.Name) `
    -WorkingDirectory $Lane.Root `
    -WindowStyle $style `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
  return $p.Id
}

function Get-ExistingNodePidByScript {
  param([hashtable]$Lane, [string]$ScriptRelativePath)
  try {
    $needle = (Join-Path $Lane.Root $ScriptRelativePath).ToLowerInvariant()
    $procs = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
      $_.Name -match '^node(\.exe)?$' -and
      $_.CommandLine -and
      $_.CommandLine.ToLowerInvariant().Contains($needle)
    }
    if ($procs) {
      return ($procs | Select-Object -First 1).ProcessId
    }
  } catch {}
  return $null
}

function Load-PidRegistry {
  if (-not (Test-Path -LiteralPath $pidRegistryPath)) {
    return @{}
  }
  try {
    $raw = Get-Content -LiteralPath $pidRegistryPath -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
    $obj = $raw | ConvertFrom-Json -ErrorAction Stop
    $map = @{}
    foreach ($p in $obj.PSObject.Properties) { $map[$p.Name] = [int]$p.Value }
    return $map
  } catch {
    return @{}
  }
}

function Save-PidRegistry {
  param([hashtable]$Registry)
  ($Registry | ConvertTo-Json -Depth 3) | Set-Content -LiteralPath $pidRegistryPath -Encoding utf8
}

function Get-ExistingTrackedPid {
  param([string]$RegistryKey, [hashtable]$Registry)
  if (-not $Registry.ContainsKey($RegistryKey)) { return $null }
  $pidValue = [int]$Registry[$RegistryKey]
  $p = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if (-not $p) { return $null }
  if ($p.ProcessName -notmatch '^node$') { return $null }
  return $pidValue
}

$results = @()
$mode = if ($Apply) { "APPLY" } else { "DRY-RUN" }
$includeArchivistBool = [bool]$IncludeArchivist
$visibleWindowsBool = [bool]$VisibleWindows
$pidRegistry = Load-PidRegistry

foreach ($lane in $lanes) {
  $hbPath = Join-Path $lane.Root ("lanes\" + $lane.Name + "\inbox\heartbeat-" + $lane.Name + ".json")
  $age = Get-HeartbeatAgeMinutes -HeartbeatPath $hbPath
  $stale = ($null -eq $age) -or ($age -gt $StaleMinutes)

  $entry = [ordered]@{
    lane = $lane.Name
    heartbeat_path = $hbPath
    heartbeat_age_min = if ($null -eq $age) { "missing" } else { $age }
    stale_threshold_min = $StaleMinutes
    is_stale = $stale
    action = "none"
    worker_pid = $null
    heartbeat_pid = $null
  }

  if ($stale) {
    $workerKey = "$($lane.Name)_worker"
    $heartbeatKey = "$($lane.Name)_heartbeat"

    $existingWorkerPid = Get-ExistingTrackedPid -RegistryKey $workerKey -Registry $pidRegistry
    if (-not $existingWorkerPid) {
      $existingWorkerPid = Get-ExistingNodePidByScript -Lane $lane -ScriptRelativePath "scripts\lane-worker.js"
    }

    $existingHeartbeatPid = Get-ExistingTrackedPid -RegistryKey $heartbeatKey -Registry $pidRegistry
    if (-not $existingHeartbeatPid) {
      $existingHeartbeatPid = Get-ExistingNodePidByScript -Lane $lane -ScriptRelativePath "scripts\heartbeat.js"
    }

    if ($Apply) {
      try {
        if ($existingWorkerPid) {
          $entry.worker_pid = $existingWorkerPid
        } else {
          $workerPid = Start-LaneWorkerProcess -Lane $lane -Poll $PollSeconds -Visible $visibleWindowsBool
          $entry.worker_pid = $workerPid
          $pidRegistry[$workerKey] = $workerPid
        }

        if ($existingHeartbeatPid) {
          $entry.heartbeat_pid = $existingHeartbeatPid
        } else {
          $heartbeatPid = Start-HeartbeatProcess -Lane $lane -Visible $visibleWindowsBool
          $entry.heartbeat_pid = $heartbeatPid
          $pidRegistry[$heartbeatKey] = $heartbeatPid
        }

        if ($existingWorkerPid -and $existingHeartbeatPid) {
          $entry.action = "already_running"
        } elseif ($existingWorkerPid -or $existingHeartbeatPid) {
          $entry.action = "partially_started"
        } else {
          $entry.action = "started_lane_services"
        }
      } catch {
        $entry.action = "start_failed"
        $entry.error = $_.Exception.Message
      }
    } else {
      if ($existingWorkerPid -and $existingHeartbeatPid) {
        $entry.action = "already_running"
        $entry.worker_pid = $existingWorkerPid
        $entry.heartbeat_pid = $existingHeartbeatPid
      } else {
        $entry.action = "would_start_lane_services"
      }
    }
  }

  $results += [pscustomobject]$entry
}

Write-Host "=== AUTO RECOVER STALE LANES ($mode) ==="
Write-Host ("stale_threshold={0}m poll_seconds={1} include_archivist={2} visible_windows={3}" -f `
  $StaleMinutes, $PollSeconds, $includeArchivistBool, $visibleWindowsBool)
Write-Host ""

$results | Format-Table lane, heartbeat_age_min, is_stale, action, worker_pid, heartbeat_pid -AutoSize

$staleCount = @($results | Where-Object { $_.is_stale }).Count
$startedCount = @($results | Where-Object { $_.action -in @("started_lane_services","partially_started") }).Count
Write-Host ""
Write-Host ("summary: stale={0} started={1}" -f $staleCount, $startedCount)

$logPath = "S:\Archivist-Agent\context-buffer\auto-recover-stale-lanes-latest.json"
$payload = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  mode = $mode
  stale_minutes = $StaleMinutes
  poll_seconds = $PollSeconds
  include_archivist = $includeArchivistBool
  visible_windows = $visibleWindowsBool
  stale_count = $staleCount
  started_count = $startedCount
  results = $results
}
($payload | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $logPath -Encoding utf8
Save-PidRegistry -Registry $pidRegistry
Write-Host ("snapshot: " + $logPath)
