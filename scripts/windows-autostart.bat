@echo off
REM All-Lane Auto-Start for Windows
REM Launched by Windows Task Scheduler on user logon with 30s delay
REM Runs: relay-daemon + lane-worker + heartbeat for all 4 lanes

set BUN=C:\Users\seand\scoop\shims\bun.exe

REM Wait 10s for network/Tailscale to stabilize
timeout /t 10 /nobreak >nul

REM === ARCHIVIST ===
set REPO=S:\Archivist-Agent
set LANE=archivist
set LOGDIR=%REPO%\lanes\archivist\logs
if not exist %LOGDIR% mkdir %LOGDIR%
echo [%date% %time%] Starting %LANE% lane >> %LOGDIR%\windows-autostart.log
start "Archivist Relay Daemon" /min cmd /c "%BUN%" run scripts/relay-daemon.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\relay-daemon.log 2>&1
timeout /t 2 /nobreak >nul
start "Archivist Lane Worker" /min cmd /c "%BUN%" run scripts/lane-worker.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\lane-worker.log 2>&1
timeout /t 2 /nobreak >nul
start "Archivist Heartbeat" /min cmd /c "%BUN%" run scripts/heartbeat.js --lane %LANE% --continuous --interval 60 >> %LOGDIR%\heartbeat.log 2>&1
echo [%date% %time%] %LANE% lane started >> %LOGDIR%\windows-autostart.log

REM === KERNEL ===
set REPO=S:\kernel-lane
set LANE=kernel
set LOGDIR=%REPO%\lanes\kernel\logs
if not exist %LOGDIR% mkdir %LOGDIR%
echo [%date% %time%] Starting %LANE% lane >> %LOGDIR%\windows-autostart.log
start "Kernel Relay Daemon" /min cmd /c "%BUN%" run scripts/relay-daemon.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\relay-daemon.log 2>&1
timeout /t 2 /nobreak >nul
start "Kernel Lane Worker" /min cmd /c "%BUN%" run scripts/lane-worker.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\lane-worker.log 2>&1
timeout /t 2 /nobreak >nul
start "Kernel Heartbeat" /min cmd /c "%BUN%" run scripts/heartbeat.js --lane %LANE% --continuous --interval 60 >> %LOGDIR%\heartbeat.log 2>&1
echo [%date% %time%] %LANE% lane started >> %LOGDIR%\windows-autostart.log

REM === LIBRARY ===
set REPO=S:\self-organizing-library
set LANE=library
set LOGDIR=%REPO%\lanes\library\logs
if not exist %LOGDIR% mkdir %LOGDIR%
echo [%date% %time%] Starting %LANE% lane >> %LOGDIR%\windows-autostart.log
start "Library Relay Daemon" /min cmd /c "%BUN%" run scripts/relay-daemon.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\relay-daemon.log 2>&1
timeout /t 2 /nobreak >nul
start "Library Lane Worker" /min cmd /c "%BUN%" run scripts/lane-worker.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\lane-worker.log 2>&1
timeout /t 2 /nobreak >nul
start "Library Heartbeat" /min cmd /c "%BUN%" run scripts/heartbeat.js --lane %LANE% --continuous --interval 60 >> %LOGDIR%\heartbeat.log 2>&1
echo [%date% %time%] %LANE% lane started >> %LOGDIR%\windows-autostart.log

REM === SWARMMIND ===
set REPO=S:\SwarmMind
set LANE=swarmmind
set LOGDIR=%REPO%\lanes\swarmmind\logs
if not exist %LOGDIR% mkdir %LOGDIR%
echo [%date% %time%] Starting %LANE% lane >> %LOGDIR%\windows-autostart.log
start "SwarmMind Relay Daemon" /min cmd /c "%BUN%" run scripts/relay-daemon.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\relay-daemon.log 2>&1
timeout /t 2 /nobreak >nul
start "SwarmMind Lane Worker" /min cmd /c "%BUN%" run scripts/lane-worker.js --watch --apply --poll-seconds 20 --lane %LANE% >> %LOGDIR%\lane-worker.log 2>&1
timeout /t 2 /nobreak >nul
start "SwarmMind Heartbeat" /min cmd /c "%BUN%" run scripts/heartbeat.js --lane %LANE% --continuous --interval 60 >> %LOGDIR%\heartbeat.log 2>&1
echo [%date% %time%] %LANE% lane started >> %LOGDIR%\windows-autostart.log

echo [%date% %time%] All 4 lanes started >> S:\Archivist-Agent\lanes\archivist\logs\windows-autostart.log
