@echo off
rem Register the PowerShell script as a scheduled task that runs at logon and repeats every minute
set "SCRIPT_PATH=S:\\Archivist-Agent\\scripts\\auto-inbox-watch.ps1"
rem Create scheduled task (runs with highest privileges, runs at logon and then every minute)
schtasks /Create /TN "AutoInboxWatch" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT_PATH%\"" /SC MINUTE /MO 1 /RL HIGHEST /F
if %ERRORLEVEL% EQU 0 (
  echo Scheduled task "AutoInboxWatch" created successfully.
) else (
  echo Failed to create scheduled task. Error code: %ERRORLEVEL%
)
