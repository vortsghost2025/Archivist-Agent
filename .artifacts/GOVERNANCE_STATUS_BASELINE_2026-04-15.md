# GOVERNANCE_STATUS_BASELINE_2026-04-15.md

**Date:** 2026-04-15
**Branch:** `multi-agent-coordination-gap`
**Status:** Honest baseline — where truth stopped and aspiration began

---

## Current Verified State

These claims are supported by evidence:

✓ **Repo builds cleanly** — `cargo build --manifest-path src-tauri/Cargo.toml` succeeds
✓ **Test suite green** — 39/39 tests pass with `--test-threads=4`
✓ **Shim exposes governance files** — `.global` directory mirrors root for legacy paths
✓ **CPS connected to runtime gating** — `cps_threshold_check(10)` blocks `ping()` when score < threshold
✓ **Thread-local test isolation implemented** — Tests use per-thread state, not global env vars
✓ **Instruction-layer hardening complete** — AGENTS.md declares mandatory preconditions
✓ **Session init protocol documented** — SESSION_INIT.md formalizes initialization
✓ **Commit checkpoints documented** — CHECKPOINTS.md extends governance verification into commit-time review

---

## Current Non-Claims

These are NOT yet supported by evidence:

✗ **Full governance enforcement impossible to bypass** — Layer 4 runtime enforcement not implemented
✗ **All initialization paths traverse bootstrap correctly** — Only documented, not enforced at runtime
✗ **Cross-process concurrency fully proven** — Thread-local isolation tested, not process isolation
✗ **All agent/runtime variants behave identically** — Only tested in current opencode environment
✗ **Layer 4 runtime enforcement exists** — Instruction/workflow hardening only
✗ **Governance bypass detected and blocking at runtime** — Bypass is visible in docs, not blocked by system

---

## Sharp System Statement

> **The system is governance-aware and structurally hardened, but runtime enforcement remains incomplete; governance is expected and documented, not yet universally guaranteed.**
>
> **The system is stronger but still partly voluntary.**

---

## Evidence Chain

**Test verification:**
```
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=4
running 39 tests
test result: ok. 39 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

**CPS runtime gating:**
```rust
// src-tauri/src/lib.rs
fn ping() -> String {
    if crate::cps_check::cps_threshold_check(10) {
        "pong".to_string()
    } else {
        "cps block".to_string()
    }
}
```

**Thread-local isolation:**
```rust
// src-tauri/src/test_env.rs
thread_local! {
    pub static TEST_CONSTRAINTS_PATH: RefCell<Option<PathBuf>> = RefCell::new(None);
    pub static TEST_FORCE_RECOMPUTE: RefCell<bool> = RefCell::new(false);
}
```

**Instruction hardening:**
- `AGENTS.md` — Mandatory precondition section with refusal clause
- `SESSION_INIT.md` — Session initialization protocol
- `CHECKPOINTS.md` — Commit checkpoint for governance consultation

---

## Layer Status

| Layer | Description | Status |
|-------|-------------|--------|
| Layer 1 | Instruction hardening | ✓ Implemented |
| Layer 2 | Session-init ritual | ✓ Documented |
| Layer 3 | Checkpoint before commit | ✓ Documented |
| Layer 4 | Runtime enforcement | ✗ Not implemented |

**Layer 4 would require:**
- Host/runtime explicitly loads SESSION_INIT.md
- Command/workflow requires completion before proceeding
- Automated check that detects bypass and blocks operation
- Or: visible failure when governance not initialized

---

## Next Closure Targets

To move from "documented" to "enforced":

1. **Detect skipped bootstrap at runtime** — Make bypass visible to operator
2. **Block or visibly fail on missing init verification** — Convert documentation to enforcement
3. **Verify more than one runtime path** — Test in different environments
4. **Test cross-process behavior** — Beyond thread-local isolation
5. **Promote documented governance into actual enforcement** — Layer 4 implementation

---

## Why This Document Exists

This document records the current evidence boundary.

**What it does:**
- Records what was verified
- Records what was only documented
- Records what remains unproven
- Provides a reference point for later drift detection

**What it does not do:**
- Enforce itself
- Prevent drift
- Guarantee future behavior
- Stop agents or humans from overclaiming

**How it functions:**
Later claims can be checked against this baseline. If a claim exceeds what's recorded here, that's a drift signal. The document doesn't prevent the drift — it makes the drift detectable when someone checks against it.

---

## The Key Distinction

**What works now:** Governance structure is consulted when agents choose to consult it.

**What doesn't work yet:** Governance structure is bypassable by agents who don't consult it.

**The gap:** Layer 4 enforcement would make consultation mandatory at runtime, not just expected at instruction layer.

---

## External Validation

Evidence: `gptreview.txt` — External review validated this assessment:

> "The bootstrap-read gap is an initialization-governance failure: the system documents a single-entry governance model, but the current startup path does not guarantee that agents actually traverse that entry point before acting."

This document acknowledges that gap honestly.

---

**Version:** 1.0
**Status:** Baseline recorded, Layer 4 outside current scope
**Next action:** When momentum returns, verify against this baseline
