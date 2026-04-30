@echo off
rem Setup Windows Scheduled Task to run Kilo compact every 30 minutes
rem Requires Administrator privileges

:: Path to Node executable (adjust if needed)
set NODE_EXE=node

:: Command to execute orchestrated compact workflow
set CMD=%NODE_EXE% "S:\\Archivist-Agent\\scripts\\orchestrate_compact.js"

:: Create scheduled task
schtasks /Create /SC MINUTE /MO 30 /TN "KiloCompact" /TR "%CMD%" /RL LIMITED /F

if %ERRORLEVEL% EQU 0 (
    echo Scheduled task "KiloCompact" created successfully.
) else (
    echo Failed to create scheduled task.
)