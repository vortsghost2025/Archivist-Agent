param(
  [ValidateSet('run','status','logs','artifacts','health','deploy','pull-artifacts')]
  [string]$Action = 'status',
  [string]$HostName = 'we4free@192.168.0.171',
  [string]$AgentRoot = '/home/we4free/agent'
)

$sshBase = "ssh -o BatchMode=yes -o ConnectTimeout=8 $HostName"

function Invoke-Remote([string]$Cmd) {
  Write-Host "[REMOTE] $Cmd" -ForegroundColor Cyan
  $full = "$sshBase `"$Cmd`""
  Invoke-Expression $full
}

switch ($Action) {
  'run' {
    Invoke-Remote "export NVM_DIR=`$HOME/.nvm; [ -s `$NVM_DIR/nvm.sh ] && . `$NVM_DIR/nvm.sh; bash $AgentRoot/bin/runner.sh"
  }
  'status' {
    Invoke-Remote "echo HOSTNAME: && hostname && echo USER: && whoami && echo UPTIME: && uptime && echo DISK: && df -h /home/we4free && echo MEM: && free -m"
  }
  'logs' {
    Invoke-Remote "tail -n 40 $AgentRoot/logs/agent.log"
  }
  'artifacts' {
    Invoke-Remote "ls -la $AgentRoot/artifacts/"
  }
  'health' {
    Invoke-Remote "cat $AgentRoot/logs/node-health.json 2>/dev/null || echo 'No health report found'"
  }
  'deploy' {
    $localRunner = "S:/kernel-lane/deploy/ubuntu/runner.sh"
    if (Test-Path $localRunner) {
      Write-Host "[SCP] Deploying runner.sh to $HostName" -ForegroundColor Green
      scp $localRunner "${HostName}:${AgentRoot}/bin/runner.sh"
      Invoke-Remote "chmod +x $AgentRoot/bin/runner.sh"
      Write-Host "[OK] runner.sh deployed" -ForegroundColor Green
    } else {
      Write-Error "runner.sh not found at $localRunner"
      exit 1
    }
  }
  'pull-artifacts' {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $destDir = "S:/kernel-lane/artifacts-from-ubuntu/$timestamp"
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Write-Host "[SCP] Pulling artifacts to $destDir" -ForegroundColor Green
    scp "${HostName}:${AgentRoot}/artifacts/*" "$destDir\"
    Write-Host "[OK] Saved to $destDir" -ForegroundColor Green
  }
}
