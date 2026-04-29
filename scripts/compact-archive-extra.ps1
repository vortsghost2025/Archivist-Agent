$packDir = "S:\Archivist-Agent\context-buffer\graph-snapshot-packs"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$archive = "S:\Archivist-Agent\context-buffer\extra-archive-$timestamp.zip"
$manifestPath = "S:\Archivist-Agent\.compact-audit\extra-archive.json"

if (-not (Test-Path $packDir)) {
  Write-Error "Pack directory not found: $packDir"
  exit 1
}

Compress-Archive -Path "$packDir\*" -DestinationPath $archive -Force
$hash = Get-FileHash $archive -Algorithm SHA256

$record = @{
  extra_archive_path = $archive
  extra_archive_sha256 = $hash.Hash
  extra_archive_timestamp = (Get-Date).ToString("o")
}

$record | ConvertTo-Json -Depth 5 | Out-File $manifestPath -Encoding utf8
Write-Host "Archive manifest written: $manifestPath"
