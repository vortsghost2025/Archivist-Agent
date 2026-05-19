Get-Volume | Where-Object {$_.DriveLetter -in 'C','S'} | Format-Table DriveLetter,@{N='Size_GB';E={[math]::Round($_.Size/1GB,2)}},@{N='Free_GB';E={[math]::Round($_.SizeRemaining/1GB,2)}} -AutoSize
