# Ubuntu Headless Script Index

Canonical index of active scripts on the Ubuntu machine.
Agents: READ THIS FILE FIRST to discover available tooling.

## GUI / Vision Tooling

| Script | Path | Purpose | Status |
|--------|------|---------|--------|
| `describe-screen.sh` | `scripts/describe-screen.sh` | Capture the desktop and describe it via the remote RTX 5060 ollama (Tailscale `100.95.92.117:11434`, model `qwen3.5:2b`, vision). Args: `[model] [prompt] [existing-file]`. Env: `OLLAMA_HOST`. | ACTIVE (2026-08-07) |
