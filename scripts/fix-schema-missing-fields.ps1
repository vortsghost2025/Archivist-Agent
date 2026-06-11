# PowerShell script to add placeholder signature and key_id to archivist inbox JSON files
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $json = Get-Content $_.FullName -Raw | ConvertFrom-Json
    $changed = $false
    if (-not $json.PSObject.Properties.Name -contains 'signature') {
        $json | Add-Member -NotePropertyName signature -NotePropertyValue 'placeholder-signature'
        $changed = $true
    }
    if (-not $json.PSObject.Properties.Name -contains 'key_id') {
        $json | Add-Member -NotePropertyName key_id -NotePropertyValue 'placeholder-key'
        $changed = $true
    }
    if ($changed) {
        $json | ConvertTo-Json -Depth 10 | Set-Content -Path $_.FullName -Encoding utf8
        Write-Host "Fixed $($_.Name)"
    }
}