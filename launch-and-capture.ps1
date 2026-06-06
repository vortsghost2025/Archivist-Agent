# Launch Tauri app, wait, capture screenshot, kill app
$appPath = "S:\Archivist-Agent\src-tauri\target\release\archivist-agent.exe"

# Kill any existing instance first
Get-Process archivist-agent -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Launch the app
Start-Process -FilePath $appPath -WindowStyle Normal
Write-Output "App launched, waiting 7 seconds for full render..."
Start-Sleep -Seconds 7

# Capture screenshot
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bounds.Size)
$path = 'S:\Archivist-Agent\tauri-screenshot.png'
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved to $path"

# Kill the app
Get-Process archivist-agent -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output "App terminated"
