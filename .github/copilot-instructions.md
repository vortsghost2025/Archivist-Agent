# Copilot Instructions - Archivist-Agent

This project operates under constitutional governance.

## Before Working

1. Read `S:/.global/BOOTSTRAP.md` for governance constraints
2. Follow the 7-checkpoint system from `S:/.global/CHECKPOINTS.md`
3. Verify against structure, not user preference

## Project Context

- **Primary:** Governance framework
- **Secondary:** Tauri desktop application (proof-of-concept)

## Build Commands

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Governance Constraints

- Maintain agent/user separation
- Apply checkpoints before major actions
- Report UDS score when assessing drift risk
- Correction is mandatory, agreement optional
