# Set watcher modes across all lanes
param([string]$state)  # "online" or "offline"

# Mapping of lane to desired mode based on overall state
if ($state -eq "offline") {
  $modes = @{
    swarmmind = "auto"
    archivist = "auto"
    kernel   = "auto"
    library  = "auto"
  }
} else {
  $modes = @{
    swarmmind = "agent-assist"
    archivist = "manual"
    kernel   = "manual"
    library  = "manual"
  }
}

foreach ($lane in $modes.Keys) {
  $path = "S:/$lane/lanes/$lane/state/watcher-mode.json"
  $json = @{ mode = $modes[$lane]; lane = $lane; set_at = (Get-Date).ToString('o'); set_by = 'user' } | ConvertTo-Json -Depth 3
  Set-Content -Path $path -Value $json -Encoding utf8
}
