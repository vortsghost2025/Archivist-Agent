# Lane Autopilot Watchers (Build/Test)

This runbook removes manual "poke each lane" behavior by keeping lane workers in watch mode.

## 1) Watch Script Check (Package Scripts)

Current status:

- `archivist` (`S:/Archivist-Agent`)
  - Root `package.json` watch script: not present
  - Worker scripts present: `scripts/inbox-watcher.js`, `scripts/lane-worker.js`
- `kernel` (`S:/kernel-lane`)
  - Root `package.json` watch script: not present
  - Worker scripts present: `scripts/inbox-watcher.js`, `scripts/lane-worker.js`
- `library` (`S:/self-organizing-library`)
  - Root `package.json` watch script: present (`watch: node scripts/inbox-watcher.js --watch`)
  - Worker scripts present: `scripts/inbox-watcher.js`, `scripts/lane-worker.js`
- `swarmmind` (`S:/SwarmMind`)
  - Root `package.json` watch script: not present
  - Worker scripts present: `scripts/inbox-watcher.js`, `scripts/lane-worker.js`

Validation command:

- `node "S:/Archivist-Agent/scripts/check-lane-watch-support.js"`

## 2) Background Startup (PowerShell)

Recommended single-process control for all four lanes:

- `Start-Process -FilePath node -ArgumentList "S:/Archivist-Agent/scripts/lane-autopilot-orchestrator.js","--poll-seconds","10" -WindowStyle Minimized`

Forensic/ratification-safe (manual cadence, no auto-claim/no file moves):

- `Start-Process -FilePath node -ArgumentList "S:/Archivist-Agent/scripts/lane-autopilot-orchestrator.js","--poll-seconds","10","--manual-cadence" -WindowStyle Minimized`

Per-lane direct fallback (if you do not want a shared orchestrator):

- `Start-Process -FilePath node -ArgumentList "scripts/lane-worker.js","--lane","archivist","--apply","--watch","--poll-seconds","10" -WorkingDirectory "S:/Archivist-Agent" -WindowStyle Minimized`
- `Start-Process -FilePath node -ArgumentList "scripts/lane-worker.js","--lane","kernel","--apply","--watch","--poll-seconds","10" -WorkingDirectory "S:/kernel-lane" -WindowStyle Minimized`
- `Start-Process -FilePath node -ArgumentList "scripts/lane-worker.js","--lane","library","--apply","--watch","--poll-seconds","10" -WorkingDirectory "S:/self-organizing-library" -WindowStyle Minimized`
- `Start-Process -FilePath node -ArgumentList "scripts/lane-worker.js","--lane","swarmmind","--apply","--watch","--poll-seconds","10" -WorkingDirectory "S:/SwarmMind" -WindowStyle Minimized`

## 3) Orchestrator Behavior

File: `scripts/lane-autopilot-orchestrator.js`

- Spawns `lane-worker` watch loops for all lanes (or subset with `--lanes`)
- Uses `--apply --watch` in default mode (continuous apply)
- Uses `--watch --manual-cadence` in forensic mode (no moves, no auto-claim)
- Restarts a lane worker if it exits unexpectedly
- Streams prefixed logs for each lane

Examples:

- All lanes: `node scripts/lane-autopilot-orchestrator.js --poll-seconds 10`
- All lanes forensic-safe: `node scripts/lane-autopilot-orchestrator.js --poll-seconds 10 --manual-cadence`
- Subset: `node scripts/lane-autopilot-orchestrator.js --lanes archivist,library --poll-seconds 5`

## 4) Verify It Is Running

- Smoke once per lane:
  - `node scripts/lane-worker.js --json`
- Watch health:
  - `node scripts/inbox-watcher.js --health`

## 4b) Surgical Queue Clear (`--apply-once`)

Use one-shot apply to process exactly one cycle and exit:

- `node scripts/lane-worker.js --lane archivist --apply-once --max-files 25 --json`
- `node scripts/lane-worker.js --lane library --apply-once --max-files 10 --json`

Notes:

- `--apply-once` runs one pass, moves at most `--max-files`, then exits.
- Use this while orchestrator runs in `--manual-cadence` to avoid racey background moves.

## 4c) Lattice Freedom Daily Pulse

Generate the 4-line lane pulse and publish to broadcast:

- `node scripts/publish-lattice-freedom-pulse.js`

Broadcast outputs:

- `lanes/broadcast/lattice-freedom-pulse-latest.json`
- `lanes/broadcast/lattice-freedom-pulse-YYYY-MM-DD.json`

## 5) Stop

- If using orchestrator terminal, `Ctrl+C`
- If started with `Start-Process`, stop by PID from Task Manager or:
  - `Get-Process node | Where-Object { $_.Path -like "*node*" } | Stop-Process -Force`

## 6) Notes

- This setup is intended for build/test acceleration.
- Governance authority still remains in ratified artifacts and signed mailbox protocol.
- Autopilot handles processing cadence, not constitutional ratification.
