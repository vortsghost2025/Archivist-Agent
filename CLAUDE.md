# CLAUDE.md - Archivist-Agent

**Bridge to Global Governance**

This project operates under constitutional governance defined in `S:/.global/`

## Governance Entry Point

**MANDATORY FIRST READ:** `S:/.global/BOOTSTRAP.md`

## Project Context

**Primary Artifact:** Constitutional governance framework for human-AI collaboration

**Secondary Artifact:** Tauri 2.x desktop application (proof-of-concept)

## Governance Documents

All governance lives in `S:/.global/`:
- `BOOTSTRAP.md` - Single entry point
- `COVENANT.md` - Values
- `GOVERNANCE.md` - Rules
- `CHECKPOINTS.md` - 7-checkpoint system
- `USER_DRIFT_SCORING.md` - Drift detection

## Build Commands

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

## What This Project Tests

Whether agents can operate within governance constraints without being told. The Tauri app is a demonstration vehicle. The governance framework IS the product.
