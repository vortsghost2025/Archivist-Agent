param(
  [string]$UbuntuHost = "we4free@192.168.0.171",
  [int]$RefreshSeconds = 5,
  [switch]$Once,
  [switch]$NoClear,
  [switch]$NoRemote
)

$lanes = @(
  @{ Name = "archivist"; Root = "S:\Archivist-Agent" },
  @{ Name = "library"; Root = "S:\self-organizing-library" },
  @{ Name = "kernel"; Root = "S:\kernel-lane" },
  @{ Name = "swarmmind"; Root = "S:\SwarmMind" }
)

function Get-AgeMin([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return "missing" }
  $age = [math]::Round(((Get-Date) - (Get-Item -LiteralPath $path).LastWriteTime).TotalMinutes, 1)
  return "$age"
}

function Count-Files([string]$dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return 0 }
  return @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue).Count
}

function Get-UbuntuSummary([string]$targetHost) {
  try {
    $cmd = @'
bash -lc '
source ~/.bashrc >/dev/null 2>&1 || true
for pair in "library:self-organizing-library" "kernel:kernel-lane" "swarmmind:SwarmMind"; do
  lane="${pair%%:*}"
  repo="${pair##*:}"
  root="$HOME/agent/repos/$repo"
  w=$(pgrep -f "$root/scripts/lane-worker.js" | head -n 1 || true)
  h=$(pgrep -f "$root/scripts/heartbeat.js --lane $lane" | head -n 1 || true)
  if [ -n "$w" ] || [ -n "$h" ]; then
    echo "UP:$lane:worker=$w:heartbeat=$h"
  else
    echo "DOWN:$lane"
  fi
done
'
'@
    $out = ssh $targetHost $cmd 2>$null
    return $out
  } catch {
    return @("SSH_ERROR")
  }
}

while ($true) {
  if (-not $NoClear) {
    Clear-Host
  } else {
    Write-Host ""
  }
  Write-Host ("=== STABLE HEALTH PANEL ===  " + (Get-Date).ToString("o"))
  Write-Host ("ubuntu_host=" + $UbuntuHost)
  Write-Host ""

  foreach ($lane in $lanes) {
    $inbox = Join-Path $lane.Root ("lanes\" + $lane.Name + "\inbox")
    $hb = Join-Path $inbox ("heartbeat-" + $lane.Name + ".json")
    $age = Get-AgeMin $hb

    $rootInbox = Count-Files $inbox
    $ar = Count-Files (Join-Path $inbox "action-required")
    $bl = Count-Files (Join-Path $inbox "blocked")
    $qu = Count-Files (Join-Path $inbox "quarantine")
    $pr = Count-Files (Join-Path $inbox "processed")

    "{0,-10} hb:{1,-8} inbox:{2,4} ar:{3,4} bl:{4,4} qu:{5,4} pr:{6,5}" -f `
      $lane.Name, $age, $rootInbox, $ar, $bl, $qu, $pr | Write-Host
  }

  Write-Host ""
  Write-Host "--- Ubuntu lane services ---"
  if ($NoRemote) {
    Write-Host "SKIPPED (--NoRemote)"
  } else {
    $remote = Get-UbuntuSummary $UbuntuHost
    $remote | ForEach-Object { Write-Host $_ }
  }

  Write-Host ""
  $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue
  $mem = (Get-Counter '\Memory\% Committed Bytes In Use').CounterSamples[0].CookedValue
  Write-Host ("host_cpu={0:N1}% host_mem={1:N1}% refresh={2}s" -f $cpu, $mem, $RefreshSeconds)

  if ($Once) { break }
  Start-Sleep -Seconds $RefreshSeconds
}
