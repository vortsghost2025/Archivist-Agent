param(
  [switch]$Apply,
  [switch]$IncludeDesktopApp
)

$ErrorActionPreference = 'Stop'

function Get-ProcRows {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -in @('opencode.exe', 'opencode-cli.exe', 'node.exe', 'powershell.exe', 'pwsh.exe', 'OpenCode.exe')
    } |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine
}

$rows = @(Get-ProcRows)

$targets = New-Object 'System.Collections.Generic.Dictionary[int,object]'

foreach ($p in $rows) {
  $cmd = [string]$p.CommandLine
  $isCliOpenCode = $p.Name -in @('opencode.exe', 'opencode-cli.exe')
  $isDesktop = $p.Name -eq 'OpenCode.exe'
  $isOpenCodeShell = ($p.Name -in @('powershell.exe', 'pwsh.exe')) -and ($cmd -match 'opencode(\.cmd|\.exe)?')
  $isMcpNode = ($p.Name -eq 'node.exe') -and (
    $cmd -match '@modelcontextprotocol/server-' -or
    $cmd -match '@morphllm/morphmcp' -or
    $cmd -match 'figma-mcp' -or
    $cmd -match 'puppeteer-mcp-server'
  )

  if ($isCliOpenCode -or $isOpenCodeShell -or $isMcpNode -or ($IncludeDesktopApp -and $isDesktop)) {
    $targets[[int]$p.ProcessId] = $p
  }
}

$summary = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  mode = $(if ($Apply) { 'APPLY' } else { 'DRY_RUN' })
  include_desktop_app = [bool]$IncludeDesktopApp
  target_count = $targets.Count
  targets_by_name = @{}
}

foreach ($g in ($targets.Values | Group-Object Name)) {
  $summary.targets_by_name[$g.Name] = $g.Count
}

Write-Host "=== STOP OPENCODE PROCESS STORM ($($summary.mode)) ==="
$summary | ConvertTo-Json -Depth 5

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run only. Re-run with -Apply to stop these OpenCode/MCP processes."
  exit 0
}

foreach ($p in ($targets.Values | Sort-Object ProcessId -Descending)) {
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    Write-Host "STOPPED $($p.Name) pid=$($p.ProcessId)"
  } catch {
    Write-Host "SKIP pid=$($p.ProcessId) reason=$($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 2
$remaining = @(Get-Process node,opencode,OpenCode,powershell,pwsh -ErrorAction SilentlyContinue)
Write-Host ""
Write-Host "Remaining matching process counts:"
$remaining | Group-Object Name | Select-Object Name,Count | Format-Table -Auto
