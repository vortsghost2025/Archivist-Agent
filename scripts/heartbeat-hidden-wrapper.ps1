param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('archivist','kernel','library','swarmmind')]
  [string]$Lane
)

$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }

$script = 'S:\Archivist-Agent\scripts\heartbeat.js'
$logDir = 'S:\Archivist-Agent\logs\heartbeat'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("heartbeat-$Lane.log")

$ts = (Get-Date).ToString('o')
"[$ts] start lane=$Lane" | Add-Content -Path $logFile -Encoding UTF8

& $node $script --lane $Lane --once *> $null
$exit = $LASTEXITCODE

$ts2 = (Get-Date).ToString('o')
"[$ts2] done lane=$Lane exit=$exit" | Add-Content -Path $logFile -Encoding UTF8
exit $exit
