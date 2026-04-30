# Create Daily Productivity Report Scheduled Tasks (User-Level)
# Uses current user account instead of SYSTEM — no admin required

$Lanes = @(
  @{ Name = "SWARMMIND"; Path = "S:\SwarmMind\scripts\run-daily-report.ps1" },
  @{ Name = "ARCHIVIST"; Path = "S:\Archivist-Agent\scripts\run-daily-report.ps1" },
  @{ Name = "KERNEL"; Path = "S:\kernel-lane\scripts\run-daily-report.ps1" },
  @{ Name = "LIBRARY"; Path = "S:\self-organizing-library\scripts\run-daily-report.ps1" }
)

foreach ($lane in $Lanes) {
  $taskName = "$($lane.Name)DailyProductivityReport"
  $scriptPath = $lane.Path
  
  Write-Host "Creating task: $taskName"
  
  # Delete existing if present
  schtasks /Delete /TN $taskName /F 2>$null
  
  # Create task running as current user (no /RU flag = current user)
  $result = schtasks /Create `
    /TN $taskName `
    /TR "powershell.exe -File `"$scriptPath`"" `
    /SC DAILY `
    /ST 09:00 `
    /RL HIGHEST `
    /F
    
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Created successfully"
  } else {
    Write-Error "  ✗ Failed with exit code $LASTEXITCODE"
  }
}

Write-Host "`nAll tasks created. Verify with: schtasks /Query /FO TABLE /V | findstr /I `"ProductivityReport`""
