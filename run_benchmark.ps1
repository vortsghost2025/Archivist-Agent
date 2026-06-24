# run_benchmark.ps1
# Usage: .\run_benchmark.ps1

$ErrorActionPreference = "Stop"

if (-not $env:NVIDIA_API_KEY) {
    Write-Error "NVIDIA_API_KEY not set. Run: `$env:NVIDIA_API_KEY = 'your-key'"
    exit 1
}

python -m pip install httpx --quiet

Write-Host "Starting benchmark..." -ForegroundColor Cyan
python benchmark.py

Write-Host "`nOpening results folder..." -ForegroundColor Green
explorer .\benchmark_results
