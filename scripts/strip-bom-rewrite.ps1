# PowerShell script to strip UTF-8 BOM from JSON files and rewrite without BOM
$inbox = 'S:/Archivist-Agent/lanes/archivist/inbox'
Get-ChildItem -Path $inbox -Filter *.json | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes,3,$bytes.Length-3)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($_.FullName,$content,$utf8NoBom)
        Write-Host "Stripped BOM from $($_.Name)"
    }
}