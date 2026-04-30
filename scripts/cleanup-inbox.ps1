# Cleanup stale inbox artifacts across all lanes
param([int]$ageDays = 2, [switch]$dryRun)

$lanes = @('archivist','kernel','library','swarmmind')
$now = Get-Date

foreach ($lane in $lanes) {
  $root = "S:/$lane"
  $dirs = @(
    "${root}/lanes/${lane}/inbox/processed",
    "${root}/lanes/${lane}/inbox/blocked",
    "${root}/lanes/${lane}/inbox/quarantine"
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
}
