# PowerShell script to rewrite JSON files without UTF-8 BOM
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    # Check for BOM (0xEF,0xBB,0xBF)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes,3,$bytes.Length-3)
        [System.IO.File]::WriteAllText($_.FullName,$content,[System.Text.Encoding]::UTF8)
        Write-Host "Removed BOM from $($_.Name)"
    }
}