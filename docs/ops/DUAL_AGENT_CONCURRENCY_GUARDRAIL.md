# Dual-Agent Concurrency Guardrail

## Purpose

Define a simple, enforceable runtime guardrail that prevents drift when multiple agents are active across lanes.

Core invariant:

> If two agents can touch the same file tree within 10 minutes, drift risk is high.

This guardrail upgrades that invariant from intuition to policy, telemetry, and testable behavior.

## Problem

Parallel agents increase throughput but also increase:

- stale-context writes,
- cross-lane race conditions,
- shared-file collisions,
- hidden governance bypass through timing overlap.

Without overlap control, speed creates non-deterministic lane state.

## Policy Summary

Machine-readable policy:

- `config/dual-agent-operating-contract.json`

Rules:

1. Single writer per lane at any point in time.
2. Shared paths (`lanes/broadcast/*`, trust-store/system_state, shared scripts) are serialized.
3. First overlap event warns.
4. Repeated overlap in the same 10-minute window blocks.
5. Unsigned/unowned write intents quarantine.

## Enforcement Model (Staged)

- **Warn phase:** First overlap only logs and warns.
- **Block phase:** Repeat overlap within the overlap window blocks.
- **Strict phase (optional):** Any overlap on protected shared paths blocks immediately.

## Operational Pattern

- Lane owner agent writes directly.
- Non-owner agents submit inbox tasks with ownership metadata.
- Cross-lane changes are batched in discrete sync windows (default 15 minutes).
- Continuous cross-lane writes are disallowed by policy.

## What "Stable Enough" Means

Allowing work to continue is acceptable only if overlap controls are visibly active:

- overlap events are logged,
- warnings/blocks fire by rule,
- quarantine catches unverifiable write intents,
- convergence remains proven.

If these controls do not trigger under overlap pressure, enforcement is incomplete.

## Verification and Proof

Runnable proof script:

- `scripts/test-dual-agent-operating-contract.js`

The proof validates:

1. First overlap warns.
2. Repeat overlap within window blocks.
3. Repeat overlap outside window warns again (window reset).
4. Shared protected path overlap blocks immediately.
5. Unsigned intent quarantines.

## Publication Notes

This guardrail is suitable for:

- Paper F insertion as a runtime-control subsection, or
- Continuation publication focused on topology-aware governance enforcement.

Use the quantitative section to connect policy to measurable outcomes:

- overlap frequency,
- repeat-overlap rate,
- blocked-overlap rate,
- shared-path collision rate,
- post-overlap convergence status.
