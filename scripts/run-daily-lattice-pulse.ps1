#!/usr/bin/env pwsh
# Daily lattice freedom pulse job.
# Scheduled via Windows Task Scheduler (run once per day).
# Requires: Node.js in PATH, Archivist-Agent workspace.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspace = "S:/Archivist-Agent"
$script    = Join-Path $workspace "scripts/publish-lattice-freedom-pulse.js"

if (-Not (Test-Path $script)) {
    Write-Error "Pulse script not found: $script"
    exit 1
}

Push-Location $workspace
node $script 2>&1 | ForEach-Object { Write-Host $_ }
Pop-Location
