param(
  [switch]$WriteSnapshot
)

$lanes = @(
  @{ Name = "Archivist"; Root = "S:\Archivist-Agent"; LaneId = "archivist" },
  @{ Name = "Library"; Root = "S:\self-organizing-library"; LaneId = "library" },
  @{ Name = "Kernel"; Root = "S:\kernel-lane"; LaneId = "kernel" },
  @{ Name = "SwarmMind"; Root = "S:\SwarmMind"; LaneId = "swarmmind" }
)

$watchPids = @(49032, 41392, 18472, 37400, 5928, 19864, 25504)
$previousAlive = @{}
$staleMinutes = 30
$freshWindowMinutes = 10
$snapshotPath = "S:\Archivist-Agent\context-buffer\lane-activity-watch-latest.md"

function Get-LaneStatus($ageMin, $freshWrites) {
  if ($null -eq $ageMin) { return "IDLE" }
  if ($freshWrites -gt 0 -and $ageMin -gt 30) { return "ACTIVE" }
  if ($ageMin -le 10) { return "ACTIVE" }
  if ($ageMin -le 30) { return "IDLE" }
  return "STALLED"
}

function Get-MemoryPercent {
  try {
    $sample = Get-Counter '\Memory\% Committed Bytes In Use' -ErrorAction Stop
    if ($sample.CounterSamples.Count -gt 0) {
      return [math]::Round($sample.CounterSamples[0].CookedValue, 1)
    }
    return $null
  } catch {
    return $null
  }
}

function Get-VisibleRiskSignals($root) {
  $risks = @()
  # Process command-line inspection removed to avoid CIM dependency issues.
  # Risk checks below remain file/state based and read-only.

  try {
    $porcelain = git -C $root status --porcelain=1 2>$null
    if ($porcelain) {
      $deleteMove = ($porcelain | Where-Object { $_ -match "^( D|D |R )" }).Count
      if ($deleteMove -ge 20) { $risks += "broad delete/move pattern in worktree" }

      $staged = git -C $root diff --cached --name-only 2>$null
      if ($staged) {
        $conflict = $false
        foreach ($f in $staged) {
          $fp = Join-Path $root $f
          if (Test-Path $fp) {
            $content = Get-Content $fp -Raw -ErrorAction SilentlyContinue
            if ($content -match "(?m)^(<<<<<<<|=======|>>>>>>> )") {
              $conflict = $true
              break
            }
          }
        }
        if ($conflict) { $risks += "conflict markers in staged files" }

        if ($staged | Where-Object { $_ -match "\.env|private\.pem|credentials|secret|token" }) {
          $risks += "possible secret exposure in staged path names"
        }
      }
    }
  } catch {}

  return $risks
}

while ($true) {
  $now = Get-Date
  $freshCutoff = $now.AddMinutes(-$freshWindowMinutes)
  $staleCutoff = $now.AddMinutes(-$staleMinutes)

  $laneRows = @()
  $latestWriteRows = @()
  $overallRisk = @()

  foreach ($lane in $lanes) {
    $root = $lane.Root
    $laneId = $lane.LaneId
    $heartbeatPath = "$root\lanes\$laneId\inbox\heartbeat-$laneId.json"
    $heartbeatAgeMin = $null
    $heartbeatText = "missing"

    if (Test-Path $heartbeatPath) {
      $hbTime = (Get-Item $heartbeatPath).LastWriteTime
      $heartbeatAgeMin = [math]::Round(($now - $hbTime).TotalMinutes, 1)
      $heartbeatText = "$heartbeatAgeMin min"
    }

    $recent = Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch "\\.git\\" } |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 5 FullName, LastWriteTime

    $freshWrites = ($recent | Where-Object { $_.LastWriteTime -ge $freshCutoff }).Count
    $status = Get-LaneStatus $heartbeatAgeMin $freshWrites
    if ($status -eq "STALLED") { $overallRisk += "$($lane.Name) heartbeat stale with no recent writes" }

    foreach ($r in $recent) {
      $latestWriteRows += [pscustomobject]@{
        Lane = $lane.Name
        Path = $r.FullName
        LastWriteTime = $r.LastWriteTime
      }
    }

    $laneRows += [pscustomobject]@{
      Lane = $lane.Name
      Status = $status
      HeartbeatAge = $heartbeatText
      FreshWrites = $freshWrites
    }
  }

  $memPercent = Get-MemoryPercent
  $memLine = "unknown"
  if ($null -ne $memPercent) {
    if ($memPercent -ge 95) {
      $memLine = "$memPercent% WARNING"
      $overallRisk += "memory above 95%"
    } else {
      $memLine = "$memPercent% normal-for-operator"
    }
  }

  $pidRows = @()
  $aliveCount = 0
  $disappeared = @()
  foreach ($watchPid in $watchPids) {
    $p = Get-Process -Id $watchPid -ErrorAction SilentlyContinue
    if ($p) {
      $aliveCount++
      $previousAlive[$watchPid] = $true
      $pidRows += [pscustomobject]@{
        PID = $p.Id
        Name = $p.ProcessName
        CPU = [math]::Round($p.CPU, 1)
        RAM_MB = [math]::Round($p.WorkingSet64 / 1MB, 1)
      }
    } else {
      if ($previousAlive.ContainsKey($watchPid) -and $previousAlive[$watchPid]) {
        $disappeared += $watchPid
      }
      $previousAlive[$watchPid] = $false
    }
  }
  if ($disappeared.Count -gt 0) {
    $overallRisk += "PID disappeared: $($disappeared -join ', ')"
  }

  $rootRisks = Get-VisibleRiskSignals "S:\Archivist-Agent"
  if ($rootRisks.Count -gt 0) { $overallRisk += $rootRisks }
  $overallRisk = $overallRisk | Select-Object -Unique

  $overallStatus = "ACTIVE"
  if (($laneRows | Where-Object { $_.Status -eq "STALLED" }).Count -gt 0) { $overallStatus = "STALLED" }
  if ($overallRisk.Count -gt 0) { $overallStatus = "RISK" }
  if (($laneRows | Where-Object { $_.Status -eq "ACTIVE" }).Count -eq 0 -and $overallStatus -ne "RISK") { $overallStatus = "IDLE" }

  Clear-Host
  Write-Host "LANE WATCH SUMMARY"
  Write-Host "Overall: $overallStatus"
  Write-Host "Memory: $memLine"
  foreach ($lr in $laneRows) {
    Write-Host "$($lr.Lane): $($lr.Status), heartbeat $($lr.HeartbeatAge), fresh writes $($lr.FreshWrites)"
  }
  Write-Host "PIDs: $aliveCount watched, $($disappeared.Count) disappeared"
  if ($overallRisk.Count -gt 0) {
    Write-Host "Risk: $($overallRisk -join '; ')"
  } else {
    Write-Host "Risk: none visible"
  }
  Write-Host "Next: keep observing"
  Write-Host ""
  Write-Host "--- Per-PID CPU/RAM ---"
  $pidRows | Format-Table -AutoSize
  Write-Host ""
  Write-Host "--- Recent Writes (Top 5 per lane) ---"
  $latestWriteRows | Sort-Object Lane, LastWriteTime -Descending | Format-Table -AutoSize

  if ($WriteSnapshot) {
    $snapshot = @()
    $snapshot += "LANE WATCH SUMMARY"
    $snapshot += "Overall: $overallStatus"
    $snapshot += "Memory: $memLine"
    foreach ($lr in $laneRows) {
      $snapshot += "$($lr.Lane): $($lr.Status), heartbeat $($lr.HeartbeatAge), fresh writes $($lr.FreshWrites)"
    }
    $snapshot += "PIDs: $aliveCount watched, $($disappeared.Count) disappeared"
    if ($overallRisk.Count -gt 0) { $snapshot += "Risk: $($overallRisk -join '; ')" } else { $snapshot += "Risk: none visible" }
    $snapshot += "Next: keep observing"
    $snapshot += ""
    $snapshot += "Updated: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
    Set-Content -Path $snapshotPath -Value ($snapshot -join [Environment]::NewLine) -Encoding utf8
  }

  Start-Sleep 15
}
