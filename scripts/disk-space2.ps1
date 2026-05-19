$drives = @('C','S')
foreach ($d in $drives) {
    $drive = Get-PSDrive -Name $d
    $used = $drive.Used
    $free = $drive.Free
    Write-Output "${d}: Used=$([math]::Round($used/1GB,2))GB Free=$([math]::Round($free/1GB,2))GB Total=$([math]::Round(($used+$free)/1GB,2))GB"
}
