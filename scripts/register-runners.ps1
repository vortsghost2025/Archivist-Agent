# register-runners.ps1
# Run this from an ELEVATED PowerShell (Run as Administrator)
# This creates Windows scheduled tasks for all 4 lanes

$tasks = @(
  @{ Name = "Archivist-Heartbeat"; Cmd = "node S:\Archivist-Agent\scripts\heartbeat.js --once" },
  @{ Name = "Archivist-Watcher";  Cmd = "node S:\Archivist-Agent\scripts\inbox-watcher.js" },
  @{ Name = "SwarmMind-Heartbeat"; Cmd = "node `"S:\SwarmMind Self-Optimizing Multi-Agent AI System\scripts\heartbeat.js`" --once" },
  @{ Name = "SwarmMind-Watcher";  Cmd = "node `"S:\SwarmMind Self-Optimizing Multi-Agent AI System\scripts\inbox-watcher.js`" --once" },
  @{ Name = "Kernel-Heartbeat";   Cmd = "node S:\kernel-lane\scripts\heartbeat.js --once" },
  @{ Name = "Kernel-Watcher";    Cmd = "node S:\kernel-lane\scripts\inbox-watcher.js" }
)

# Library already registered - just verify
Write-Output "=== Verifying Library (already registered) ==="
schtasks /query /tn "Library-Heartbeat" 2>&1 | Select-Object -First 3
schtasks /query /tn "Library-Watcher" 2>&1 | Select-Object -First 3

Write-Output ""
Write-Output "=== Registering remaining lanes ==="

foreach ($task in $tasks) {
  $result = schtasks /create /tn $task.Name /tr $task.Cmd /sc minute /mo 1 /ru SYSTEM /f 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Output "OK: $($task.Name)"
  } else {
    Write-Output "FAIL: $($task.Name) - $result"
  }
}

Write-Output ""
Write-Output "=== Verification ==="

$allNames = @("Library-Heartbeat", "Library-Watcher") + ($tasks | ForEach-Object { $_.Name })
foreach ($name in $allNames) {
  $result = schtasks /query /tn $name 2>&1
  if ($result -match "Ready|Running") {
    Write-Output "ALIVE: $name"
  } else {
    Write-Output "DEAD:  $name"
  }
}

Write-Output ""
Write-Output "Done. All 4 lanes now persistent."
Write-Output "Heartbeat every 60s. Inbox scan every 60s."
Write-Output "The lattice runs without you watching."
