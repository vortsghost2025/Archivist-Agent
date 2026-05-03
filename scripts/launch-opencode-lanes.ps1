param(
  [ValidateSet('single','four')]
  [string]$Mode = 'single',

  [ValidateSet('Archivist','Kernel','Library','SwarmMind')]
  [string]$Lane = 'Archivist',

  [string]$OpenCodeCmd = 'opencode',
  [int]$DelaySeconds = 8,
  # Pure mode avoids starting the full MCP/plugin stack once per lane.
  # Without this, four lane CLIs can spawn hundreds of node.exe processes.
  [switch]$WithPlugins,
  [switch]$DryRun
)

$laneMap = [ordered]@{
  'Archivist' = 'S:\Archivist-Agent'
  'Kernel'    = 'S:\kernel-lane'
  'Library'   = 'S:\self-organizing-library'
  'SwarmMind' = 'S:\SwarmMind'
}

function Resolve-OpenCode([string]$cmd) {
  try {
    return (Get-Command $cmd -ErrorAction Stop).Source
  } catch {
    $fallback = Join-Path $env:APPDATA 'npm\opencode.cmd'
    if (Test-Path $fallback) { return $fallback }
  }
  return $null
}

function Start-Lane([string]$laneName, [string]$lanePath, [string]$resolvedCmd, [switch]$WithPluginsMode, [switch]$DryRunMode) {
  if (-not (Test-Path -LiteralPath $lanePath)) {
    Write-Host "SKIP [$laneName] missing path: $lanePath" -ForegroundColor Yellow
    return
  }

  $opencodeArgs = @()
  if (-not $WithPluginsMode) {
    $opencodeArgs += '--pure'
  }
  $opencodeArgs += $lanePath
  $quotedArgs = ($opencodeArgs | ForEach-Object { "'$_'" }) -join ' '
  $command = "Set-Location -LiteralPath '$lanePath'; & '$resolvedCmd' $quotedArgs"
  $args = @('-NoExit', '-Command', $command)

  if ($DryRunMode) {
    Write-Host "DRYRUN [$laneName] powershell.exe $($args -join ' ')" -ForegroundColor Gray
    return
  }

  Start-Process -FilePath 'powershell.exe' -ArgumentList $args -WindowStyle Normal | Out-Null
  Write-Host "LAUNCHED [$laneName] $lanePath" -ForegroundColor Green
}

$resolved = Resolve-OpenCode $OpenCodeCmd
if (-not $resolved) {
  Write-Host 'ERROR: OpenCode not found. Install with: npm i -g opencode-ai' -ForegroundColor Red
  exit 1
}

Write-Host "Using OpenCode: $resolved" -ForegroundColor Cyan
Write-Host "Mode=$Mode Lane=$Lane DelaySeconds=$DelaySeconds PureMode=$(-not $WithPlugins.IsPresent) DryRun=$($DryRun.IsPresent)" -ForegroundColor Cyan

if ($Mode -eq 'single') {
  Start-Lane -laneName $Lane -lanePath $laneMap[$Lane] -resolvedCmd $resolved -WithPluginsMode:$WithPlugins -DryRunMode:$DryRun
  exit 0
}

# Mode=four (safe stagger)
foreach ($name in $laneMap.Keys) {
  Start-Lane -laneName $name -lanePath $laneMap[$name] -resolvedCmd $resolved -WithPluginsMode:$WithPlugins -DryRunMode:$DryRun
  if (-not $DryRun -and $name -ne 'SwarmMind') {
    Start-Sleep -Seconds $DelaySeconds
  }
}

Write-Host 'Done.' -ForegroundColor Cyan
