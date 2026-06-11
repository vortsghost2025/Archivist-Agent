# PowerShell script to set valid placeholder values for 'signature' and 'key_id' in archivist inbox JSON files
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
# Example JWT (header.payload.signature) – syntactically valid base64url parts
$signature = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
# 16‑hex‑character key identifier
$keyId = 'abcdef1234567890'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $json = Get-Content -Raw -Path $_.FullName | ConvertFrom-Json
    $json.signature = $signature
    $json.key_id = $keyId
    $newText = $json | ConvertTo-Json -Depth 10
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($_.FullName, $newText, $utf8NoBom)
    Write-Host "Updated $($_.Name)"
}