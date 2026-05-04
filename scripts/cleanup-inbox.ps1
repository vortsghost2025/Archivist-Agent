# Cleanup stale inbox artifacts across all lanes
# NFM-020: fixed hardcoded root path bug (S:/$lane -> correct canonical roots)
param([int]$ageDays = 2, [switch]$dryRun)

$laneRoots = @{
  'archivist' = 'S:/Archivist-Agent'
  'kernel'    = 'S:/kernel-lane'
  'library'   = 'S:/self-organizing-library'
  'swarmmind' = 'S:/SwarmMind'
}

$now = Get-Date

foreach ($lane in $laneRoots.Keys) {
  $root = $laneRoots[$lane]
  $dirs = @(
    "${root}/lanes/${lane}/inbox/processed",
    "${root}/lanes/${lane}/inbox/blocked",
    "${root}/lanes/${lane}/inbox/quarantine",
    "${root}/lanes/${lane}/inbox/archive",          # NFM-020: summary spam dir
    "${root}/lanes/${lane}/inbox/stale-foreign"     # NFM-020: stale-foreign dir
  )
  foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -File -Recurse | Where-Object { $_.LastWriteTime -lt $now.AddDays(-$ageDays) } | ForEach-Object {
      if ($dryRun) {
        Write-Host "[dry-run] Would remove $($_.FullName)"
      } else {
        Remove-Item -Path $_.FullName -Force
        Write-Host "Removed $($_.FullName)"
      }
    }
  }
  # NFM-020: also clean root inbox .bak-* files older than ageDays
  $inboxRoot = "${root}/lanes/${lane}/inbox"
  if (Test-Path $inboxRoot) {
    Get-ChildItem -Path $inboxRoot -File | Where-Object { $_.Name -like '*.bak-*' -and $_.LastWriteTime -lt $now.AddDays(-$ageDays) } | ForEach-Object {
      if ($dryRun) {
        Write-Host "[dry-run] Would remove $($_.FullName)"
      } else {
        Remove-Item -Path $_.FullName -Force
        Write-Host "Removed $($_.FullName)"
      }
    }
  }
}