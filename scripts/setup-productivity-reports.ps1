# Setup Daily Productivity Report Scheduled Tasks for all 4 lanes
# Run this once after scripts are synced to all lanes

$Lanes = @('swarmmind', 'archivist', 'kernel', 'library')
$BasePath = "S:\{0}\scripts\run-daily-report.ps1"

foreach ($lane in $Lanes) {
    $taskName = "$($lane.ToUpper())DailyProductivityReport"
    $scriptPath = $BasePath -f $lane
    
    Write-Host "Creating scheduled task: $taskName"
    
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At 09:00
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily productivity report for $lane lane" -Force
    
    Write-Host "  ✓ Task created/updated"
}

Write-Host "`nAll 4 lanes scheduled. Daily reports will be generated at 09:00 UTC."
