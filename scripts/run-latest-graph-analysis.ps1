$ErrorActionPreference = "Stop"

$repoRoot = "S:/Archivist-Agent"
$analyzer = Join-Path $repoRoot "scripts/analyze-graph-json.js"

if (-not (Test-Path $analyzer)) {
  throw "Analyzer script not found: $analyzer"
}

$candidates = @()

$downloads = Join-Path $env:USERPROFILE "Downloads"
if (Test-Path $downloads) {
  $candidates += Get-ChildItem -Path $downloads -Filter "*.json" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "graph|snapshot" -and $_.Name -notmatch "^graph-auto-analysis-" }
}

$contextBuffer = Join-Path $repoRoot "context-buffer"
if (Test-Path $contextBuffer) {
  $candidates += Get-ChildItem -Path $contextBuffer -Filter "*.json" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "graph|snapshot" -and $_.Name -notmatch "^graph-auto-analysis-" }
}

if ($candidates.Count -eq 0) {
  throw "No graph JSON candidates found in Downloads or context-buffer."
}

$latest = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "Using latest graph JSON: $($latest.FullName)"

node $analyzer $latest.FullName
