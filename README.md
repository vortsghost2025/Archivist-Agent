# Archivist Agent

Mission: Turn file chaos into readable structure.

A desktop agent that scans approved folders, classifies files into 6 buckets (Runtime/Interface/Memory/Verification/Research/Unknown), and generates INDEX.md summaries to reduce visual strain.

## Quick Start

```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# Run development server
cargo tauri dev
```

## Tools

- `scan_tree(root, depth)` — Enumerate folder structure up to specified depth
- `summarize_folder(path)` — Classify folder purpose and extract key metadata

## Configuration

Edit `config/allowed_roots.json` to set which folders the agent can access.

## Accessibility

- Giant text mode (24px default)
- High contrast dark theme
- Keyboard-first navigation
- Text-to-speech for summaries