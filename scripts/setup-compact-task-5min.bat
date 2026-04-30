@echo off
rem Delete existing KiloCompact task (requires admin)
schtasks /Delete /TN "KiloCompact" /F
rem Create new task to run every 5 minutes
schtasks /Create /SC MINUTE /MO 5 /TN "KiloCompact" /TR "node \"S:\\Archivist-Agent\\scripts\\orchestrate_compact.js\"" /RL LIMITED /F
if %ERRORLEVEL% EQU 0 (
    echo KiloCompact scheduled task recreated with 5‑minute interval.
) else (
    echo Failed to create KiloCompact task.
)