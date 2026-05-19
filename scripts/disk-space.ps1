Get-PSDrive C,S | Select-Object Name,@{N='Used_GB';E={[math]::Round($_.Used/1GB,2)}},@{N='Free_GB';E={[math]::Round($_.Free/1GB,2)}},@{N='Total_GB';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}}
