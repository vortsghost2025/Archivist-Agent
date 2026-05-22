# NOW.md — Session Control Surface

**Last updated:** 2026-05-22T11:14:00-04:00
**Updated by:** archivist

---

## Current Mode: OBSERVE

**Machine-readable source of truth:** `lanes/broadcast/active-mode.json`

Mode gates:
- **OBSERVE** — agents may read, log, summarize, measure, report. No production mutations.
- **BUILD** — agents may mutate scoped files after verification plan. Tests must pass before commit.
- **CHAOS-LAB** — agents may mutate only sandbox/branch/staging paths. Never main/master.
- **RECOVERY** — stop feature work. Restore, verify, compare, then unblock.

---

## Live Systems

| System | Status | Notes |
|--------|--------|-------|
| Archivist agent | RUNNING | Only active agent. Codex idle for review. |
| CI pipeline (GitHub Actions) | LIVE | `ci.yml` on master — tsc gate + recovery suite + health check |
| Signing integrity check | LIVE | `signing-integrity.yml` on master |

## Last Known Good

- **Commit:** `b3433dcd` — CI gates + tsconfig.ci.json
- **Recovery suite:** 12/12 passing
- **tsc ci gate:** Zero errors (`npx tsc -p tsconfig.ci.json --noEmit`)
- **Rust build:** Compiles (`cargo build --manifest-path src-tauri/Cargo.toml`)

## Active Blockers

None.

## What Is Stable (Do Not Touch Without Mode Switch)

- `scripts/governance-types.js` — discriminated union enums, exhaustiveSwitch, validateEnum
- `scripts/schema-validator.js` — `'error' in r` narrowing pattern
- `scripts/identity-enforcer.js` — CONVERGED_STATUS_SET, ENFORCEMENT_MODE_SET
- `tsconfig.ci.json` — CI compilation entry points
- `.github/workflows/ci.yml` — CI pipeline
- `src-tauri/` — Rust backend (functional, UI untested headlessly)
- `scripts/mode-check.js` — mode gate utility (readMode, checkMutation, enforceMutation, transitionMode)
- `lanes/broadcast/active-mode.json` — machine-readable mode source of truth

## What Is Next

1. Make Archivist genuinely useful day-to-day (not just governance audits)
2. Ship one concrete thing that proves the infrastructure was worth building
3. Define what "Archivist as partner" actually does in daily practice

## What Should Not Be Touched

- `lanes/broadcast/trust-store.json` — live signing keys
- `.global/algorithm-helpers.js` — crypto core, imported by identity-enforcer
- Any lane inbox/outbox JSON — pre-commit hook validates schema

## Sandbox Ideas (CHAOS-LAB Only)

- Headless Tauri testing strategy (WebView2 headless?)
- Multi-agent orchestration when other lanes come online
- Mobile/remote access to Archivist via Tailscale
- NOW.md auto-update hook on mode transitions

---

## Mode Transition Log

| Timestamp | From | To | Reason |
|-----------|------|----|--------|
| 2026-05-22T10:18:00 | — | OBSERVE | Initial creation. Operator recovering. No active build work. |
