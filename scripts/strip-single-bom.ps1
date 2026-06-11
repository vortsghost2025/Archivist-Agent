param([string]$FilePath)
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $content = [System.Text.Encoding]::UTF8.GetString($bytes,3,$bytes.Length-3)
    [System.IO.File]::WriteAllText($FilePath,$content,[System.Text.Encoding]::UTF8)
    Write-Host "Stripped BOM from $FilePath"
} else {
    Write-Host "No BOM in $FilePath"
}