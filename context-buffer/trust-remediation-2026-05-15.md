# Trust Remediation Analysis — 2026-05-15

OUTPUT_PROVENANCE:
agent: z-ai/glm-5.1
lane: archivist
generated_at: 2026-05-15T15:13:15Z
session_id: trust-remediation-2026-05-15

## Origin

Operator identified three directives with no live-path enforcement (source: `requiredagents.txt`).
This document replaces the earlier trust-breach analysis that contained a factual error about Ollama.

## Root Failure Pattern

**Instruction remembered in prose, not bound to execution.**
Agents claimed "implemented" from partial evidence: script written ≠ running, rule documented ≠ enforced,
variable declared ≠ consumed.

---

## Item 1: OUTPUT_PROVENANCE

| Layer | State | Evidence |
|-------|-------|----------|
| Governance contract exists | YES | `governance/output-provenance.contract.json` |
| Helper script exists | YES | `scripts/output-provenance.js` + `scripts/provenance-header.js` |
| Verification script exists | YES | `scripts/verify-output-provenance.js` (checks files for provenance block) |
| Pre-handoff check exists | YES | `scripts/pre-handoff-provenance-check.js` |
| Scripts that emit provenance | YES | `send-message.js`, `lane-worker.js`, and ~10 send-* scripts include it |
| Runtime enforcement on agent chat output | **NO** | No check rejects output missing provenance before it reaches the user |
| Pre-commit hook check | NOT VERIFIED | Need to check if hook runs provenance verification |

**Classification: PARTIALLY ENFORCED**

The tooling exists. Lane-to-lane messages include provenance. Handoff documents get checked.
But agent chat output (the thing the operator actually reads) has no enforcement gate.
A human-readable response without provenance is never rejected, only a file.

**What would make this LIVE-PATH ENFORCED:**
- Session-start protocol that mandates provenance emission
- Or: wrapper/output filter that rejects output missing the block
- Or: pre-commit hook that checks all markdown output files

---

## Item 2: Ollama / Local Models

### CORRECTION — Previous Analysis Was Factually Wrong

Earlier claim: "There is no Ollama installation on the headless machine."
**This was false.** Direct verification on 2026-05-15T15:10Z:

| Layer | State | Evidence |
|-------|-------|----------|
| Ollama binary installed | **YES** | `/usr/local/bin/ollama` v0.23.1 |
| Ollama service running | **YES** | systemd `ollama.service` active since 2026-05-07 |
| Ollama API reachable | **YES** | `http://100.95.40.99:11434/api/version` returns `{"version":"0.23.1"}` |
| Model pulled | **YES** | `qwen2.5-coder:7b` (4.7GB, Q4_K_M quantization) |
| .env configured | **YES** | Archivist `.env`: `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen2.5-coder:7b` |
| kernel .env configured | **YES** | `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen2.5-coder:3b-instruct-q4_K_M` |
| Any lane script reads OLLAMA_BASE_URL | **NO** | Zero references in any script across all 4 lanes |
| Any lane script reads OLLAMA_MODEL | **NO** | Zero references in any script across all 4 lanes |
| Any code path calls localhost:11434 | **NO** | Zero references across all lane scripts |
| Any agent session has used local inference | **NO** | No evidence in any journal or log |

**Classification: CONFLICT_RESOLVED — installed but not used in live path**

This is WORSE than "not installed." The configuration LOOKS like local inference exists.
Someone reading the `.env` would believe it's wired. It's not.
`OLLAMA_BASE_URL` and `OLLAMA_MODEL` are declared but never consumed.
Same pattern as provenance: configured ≠ running in path.

The system was set up correctly at the infrastructure layer (install, service, model pull, env vars)
but no code was ever written to actually call it.

**What would make this LIVE-PATH ENFORCED:**
- A script or agent path that reads `OLLAMA_BASE_URL` from `.env` and routes requests to it
- Or: explicit classification as NOT_CURRENTLY_ENFORCEABLE with operator acceptance
  (the model may be too small for autonomous use — that's a legitimate design choice, but it must be stated)

---

## Item 3: Journal Continuity

| Layer | State | Evidence |
|-------|-------|----------|
| Journal write path exists | **YES** | `scripts/store-journal.js` append/write commands |
| Journal write is called | **YES** | lane-worker.js and other scripts write journal entries |
| Journal read functions exist | **YES** | `store-journal.js` has `readJournal()`, `readAllLanesForDate()`, `status` command |
| Journal read command works | **YES** | `node store-journal.js status` — cross-lane view |
| Dashboard filter reads journals | **YES** | `scripts/operator-dashboard-filter.js` reads journals for uncertainty |
| Read-only verifier permits reads | **YES** | `scripts/read-only-verifier.js` allows `store-journal read` and `status` |
| Any agent session reads journals at startup | **NO** | No lane-worker, no service, no startup script calls `store-journal status` or `read` |
| Journals condition agent behavior | **NO** | Agents start each session with no journal context |

**Classification: PARTIALLY ENFORCED — write path live, read path exists but not in any startup/conditioning path**

The read tooling exists and works. But no agent ever calls it at session start.
Journals are produced (write path works) but never consumed (no read path in agent initialization).
Result: each agent session starts blind — no continuity from previous sessions.

**What would make this LIVE-PATH ENFORCED:**
- Add `node scripts/store-journal.js status` to session-start protocol
- Or: lane-worker.js reads last session's journal before processing inbox
- Or: agent instructions mandate journal consultation before new work

---

## Summary Verdict

| Item | Classification | Live-Path Enforced? |
|------|---------------|-------------------|
| OUTPUT_PROVENANCE | PARTIALLY ENFORCED (files yes, chat output no) | **NO** |
| Ollama / Local Models | INSTALLED BUT NOT IN LIVE PATH | **NO** |
| Journal Continuity | PARTIALLY ENFORCED (write yes, read at startup no) | **NO** |

All three items share the same root pattern: **infrastructure exists, execution path does not.**
The system has the plumbing but never turned the valve.

## Trust Status

**NOT YET TRUSTED** — reaffirmed. No item has live-path enforcement.
This analysis itself requires cross-lane verification before being treated as canonical.
The Ollama factual error in the previous version proves why.
