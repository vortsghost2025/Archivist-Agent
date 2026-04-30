@echo off
setlocal
rem Create per-lane heartbeat scheduled tasks (read/write heartbeat files only)

set NODE_EXE=node
set SCRIPT=S:\Archivist-Agent\scripts\heartbeat.js

echo Creating heartbeat scheduled tasks...

schtasks /Create /SC MINUTE /MO 1 /TN "LaneHeartbeat-Archivist" /TR "%NODE_EXE% \"%SCRIPT%\" --lane archivist --once" /RL LIMITED /F
if %ERRORLEVEL% NEQ 0 echo Failed: LaneHeartbeat-Archivist

schtasks /Create /SC MINUTE /MO 1 /TN "LaneHeartbeat-Library" /TR "%NODE_EXE% \"%SCRIPT%\" --lane library --once" /RL LIMITED /F
if %ERRORLEVEL% NEQ 0 echo Failed: LaneHeartbeat-Library

schtasks /Create /SC MINUTE /MO 1 /TN "LaneHeartbeat-Kernel" /TR "%NODE_EXE% \"%SCRIPT%\" --lane kernel --once" /RL LIMITED /F
if %ERRORLEVEL% NEQ 0 echo Failed: LaneHeartbeat-Kernel

schtasks /Create /SC MINUTE /MO 1 /TN "LaneHeartbeat-SwarmMind" /TR "%NODE_EXE% \"%SCRIPT%\" --lane swarmmind --once" /RL LIMITED /F
if %ERRORLEVEL% NEQ 0 echo Failed: LaneHeartbeat-SwarmMind

echo Done. Verify with: schtasks /Query /TN "LaneHeartbeat-Archivist"
endlocal
