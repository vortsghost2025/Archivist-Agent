# PowerShell script to dump first 8 bytes of JSON files in archivist inbox
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $hex = ($bytes[0..7] | ForEach-Object { $_.ToString('X2') }) -join ' '
    Write-Host "${($_.Name)}:`t$hex"
}