param(
  [string]$SourceDir = "C:\Users\seand\.cursor\projects\s-Archivist-Agent\assets",
  [string]$OutputRoot = "S:\Archivist-Agent\context-buffer\graph-snapshot-packs",
  [int]$HoursBack = 24
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "SourceDir not found: $SourceDir"
}

if (-not (Test-Path -LiteralPath $OutputRoot)) {
  New-Item -ItemType Directory -Path $OutputRoot | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packDir = Join-Path $OutputRoot "pack-$stamp"
New-Item -ItemType Directory -Path $packDir | Out-Null

$cutoff = (Get-Date).AddHours(-1 * $HoursBack)

$candidates = Get-ChildItem -Path $SourceDir -File -Recurse |
  Where-Object {
    ($_.Extension -in @(".png", ".jpg", ".jpeg", ".webp")) -and
    ($_.LastWriteTime -ge $cutoff) -and
    (
      $_.Name -match "Screenshot_" -or
      $_.Name -match "image-" -or
      $_.FullName -match "workspaceStorage_.*images"
    )
  } |
  Sort-Object LastWriteTime

if (-not $candidates -or $candidates.Count -eq 0) {
  $note = @"
No candidate screenshots found.
SourceDir: $SourceDir
HoursBack: $HoursBack
Cutoff: $cutoff
"@
  Set-Content -Path (Join-Path $packDir "README.txt") -Value $note -Encoding UTF8
  Write-Output "No screenshots found. Pack created at: $packDir"
  exit 0
}

$manifest = @()
$i = 1
foreach ($file in $candidates) {
  $ext = $file.Extension.ToLowerInvariant()
  $destName = ("{0:D3}_{1}{2}" -f $i, [System.IO.Path]::GetFileNameWithoutExtension($file.Name), $ext)
  $destPath = Join-Path $packDir $destName
  Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force

  $manifest += [PSCustomObject]@{
    index = $i
    file = $destName
    source_path = $file.FullName
    mtime = $file.LastWriteTime.ToString("o")
    bytes = $file.Length
  }
  $i++
}

$manifestPath = Join-Path $packDir "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

$packId = Split-Path -Leaf $packDir
$perImageItems = @(
  foreach ($m in $manifest) {
    [ordered]@{
      index             = $m.index
      file              = $m.file
      repo_filter_guess = $null
      entry_point_guess = $null
      observations      = @()
      confidence        = "medium"
    }
  }
)

$templateFindings = [ordered]@{
  schema_version = "1.0"
  pack_id        = $packId
  generated_at   = (Get-Date -Format "o")
  analyzer       = ""
  pack_path      = $packDir
  manifest_file  = "manifest.json"
  summary        = [ordered]@{
    one_paragraph = ""
    verification_posture = [ordered]@{
      verified    = $null
      unverified  = $null
      conflicted  = $null
      quarantined = $null
      notes       = ""
    }
    top_risk_signals = @()
    top_next_steps   = @()
    overall_confidence = "medium"
  }
  per_image          = $perImageItems
  comparison_hint = [ordered]@{
    compare_with_pack_ids = @()
    delta_focus          = @(
      "verified vs unverified counts",
      "conflicted and quarantined counts",
      "contradiction hub density / central cluster shape"
    )
  }
  open_questions = @()
}
$findingsPath = Join-Path $packDir "ai-findings.template.json"
($templateFindings | ConvertTo-Json -Depth 8) | Set-Content -Path $findingsPath -Encoding UTF8

$prompt = @"
Analyze these graph snapshots as a time sequence.
Tasks:
1) Identify stable structures vs rapidly changing clusters.
2) Estimate verification posture from visible counters (verified/unverified/conflicted/quarantined).
3) List top 3 risk signals and top 3 actionable next steps.
4) Highlight any evidence of central contradiction hubs.
Return concise bullet points and a confidence level per claim.
"@
Set-Content -Path (Join-Path $packDir "vision-analysis-prompt.txt") -Value $prompt -Encoding UTF8

$readme = @"
Graph Snapshot Pack
Generated: $(Get-Date -Format "o")
SourceDir: $SourceDir
HoursBack: $HoursBack
Images: $($manifest.Count)

Contents:
- numbered image files
- manifest.json
- ai-findings.template.json (fill after vision analysis; schema: schemas/ai-findings-v1.json)
- vision-analysis-prompt.txt
"@
Set-Content -Path (Join-Path $packDir "README.txt") -Value $readme -Encoding UTF8

Write-Output "Pack created: $packDir"
Write-Output "Images exported: $($manifest.Count)"
