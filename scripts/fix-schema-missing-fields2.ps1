# PowerShell script to insert placeholder signature and key_id into archivist inbox JSON files
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $lines = Get-Content $_.FullName
    # Check if already contains signature and key_id
    if ($lines -match '"signature"' -and $lines -match '"key_id"') {
        return
    }
    # Remove last line (should be closing brace)
    $last = $lines[-1]
    $contentWithoutLast = $lines[0..($lines.Count-2)]
    # Ensure comma before adding new fields if needed
    if ($contentWithoutLast[-1] -notmatch ',') {
        $contentWithoutLast[-1] = $contentWithoutLast[-1] + ','
    }
    $contentWithoutLast += '  "signature": "placeholder-signature",'
    $contentWithoutLast += '  "key_id": "placeholder-key"'
    $contentWithoutLast += $last
    $contentWithoutLast | Set-Content -Path $_.FullName -Encoding utf8
    Write-Host "Patched $($_.Name)"
}