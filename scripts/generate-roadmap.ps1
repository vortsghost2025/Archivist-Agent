# <#
# .SYNOPSIS
# Generate a governance roadmap from a graph snapshot and guide conflict resolution.
#
# .DESCRIPTION
# Runs the Node analyzer on the provided snapshot, extracts a prioritized list of
# conflicted and unverified nodes, and optionally assists the operator in a
# resolution loop. No automatic commits or pushes are performed; the operator must
# review and approve any changes.
#
# .REQUIREMENTS
# - Node.js must be available in PATH
# - Existing scripts in this repo:
#   - scripts\analyze-graph-json.js
#   - scripts\extract-graph-roadmap.js
# #>

param(
    [Parameter(Mandatory=$true)]
    [string]$SnapshotPath
)

function Write-Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

# Verify the snapshot file exists
if (-not (Test-Path -LiteralPath $SnapshotPath)) {
    Write-Error "Snapshot file not found: $SnapshotPath"
    exit 1
}
Write-Info "Running analyzer on $SnapshotPath"

# Run analyzer and capture JSON output
$analysisJson = node .\scripts\analyze-graph-json.js $SnapshotPath | ConvertFrom-Json
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$analysisFile = Join-Path "context-buffer" ("graph-auto-analysis-{0}.json" -f $timestamp)
$analysisJson | ConvertTo-Json -Depth 10 | Set-Content -Path $analysisFile -Encoding UTF8
Write-Info "Analysis saved to $analysisFile"

# Generate roadmap (findings) – the extractor works on packs; when run without arguments it processes the most recent pack
Write-Info "Generating roadmap via extract-graph-roadmap.js"
node .\scripts\extract-graph-roadmap.js | Out-Null
Write-Info "Roadmap files created in context-buffer (JSON and MD)."

# Show top conflicted nodes
Write-Host "`nTop conflicted nodes (focus):"
$analysisJson.focus_nodes | ForEach-Object {
    Write-Host "- $($_.id) | $($_.label) | $($_.status)"
}

# Interactive resolution loop
while ($true) {
    $choice = Read-Host "`nEnter node ID to resolve (or 'q' to quit)"
    if ($choice -eq 'q') { break }

    $node = $analysisJson.focus_nodes | Where-Object { $_.id -eq $choice }
    if (-not $node) {
        Write-Warning "Node ID $choice not found among focus nodes."
        continue
    }

    Write-Info "Selected node: $($node.label) ($($node.id))"
    Write-Host "Locate the source file referenced in the snapshot and apply the needed correction."
    Write-Host "When the correction is made, create an evidence artifact (e.g., a signed diff) and place it in 'context-buffer'."

    $ready = Read-Host "Press Enter when evidence is ready (or type 'skip' to choose another node)"
    if ($ready -eq 'skip') { continue }

    # Re‑run analyzer to see delta
    $newAnalysis = node .\scripts\analyze-graph-json.js $SnapshotPath | ConvertFrom-Json
    $deltaConflicted = $analysisJson.summary.conflicted - $newAnalysis.summary.conflicted
    $deltaVerified   = $newAnalysis.summary.verified - $analysisJson.summary.verified
    Write-Info "Delta after resolution: Conflicted Δ=$deltaConflicted, Verified Δ=+$deltaVerified"

    # Optional commit step – requires explicit approval
    $commit = Read-Host "Commit the changes now? (y/N)"
    if ($commit -eq 'y') {
        Write-Info "Please run your lane‑specific signing/commit flow manually."
    }

    # Update analysis reference for next iteration
    $analysisJson = $newAnalysis
}
Write-Info "Resolution session finished."
