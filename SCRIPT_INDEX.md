# Ubuntu Headless Script Index

Canonical index of active scripts on the Ubuntu machine.
Agents: READ THIS FILE FIRST to discover available tooling.

## GUI / Vision Tooling

| Script | Path | Purpose | Status |
|--------|------|---------|--------|
| `describe-screen.sh` | `scripts/describe-screen.sh` | Capture the desktop and describe it via the remote RTX 5060 ollama (Tailscale `100.95.92.117:11434`, model `qwen3.5:2b`, vision). Args: `[model] [prompt] [existing-file]`. Env: `OLLAMA_HOST`. | ACTIVE (2026-08-07) |
| `gui-health-check.sh` | `scripts/gui-health-check.sh` | Relaunch the Archivist Tauri app if dead, warn if running without a mapped window, warn if disk < 10G. Runs every 2 min via `archivist-gui-watch.timer` (systemd). Log: `context-buffer/gui-health.log`. | ACTIVE (2026-08-07) |
| `desktop-probe.sh` | `scripts/desktop-probe.sh` | Vision-in-loop desktop health probe: capture + ask remote RTX 5060 (qwen3.5:2b) for anomalies (black screen, frozen UI, error dialogs). Logs non-HEALTHY findings. Runs every 15 min via `archivist-desktop-probe.timer` (systemd). Log: `context-buffer/desktop-probe.log`. | ACTIVE (2026-08-07) |
