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
| Any lane script reads OLLAMA_BASE_URL | **YES** | `scripts/local-inference.js` reads `.env`, used by `headless-self-audit.js` |
| Any lane script reads OLLAMA_MODEL | **YES** | `scripts/local-inference.js` reads `.env`, Tailscale IP fallback |
| Any code path calls localhost:11434 | **YES** | `local-inference.callLocalModel()` via `/api/chat` endpoint |
| Any agent session has used local inference | **YES** | `headless-self-audit.js` v5.0.0 calls `summarizeJournalWithLocalModel()` each audit cycle |

**Classification: NOW IN LIVE PATH** — wired 2026-05-15T21:35Z

`scripts/local-inference.js` reads OLLAMA_BASE_URL and OLLAMA_MODEL from `.env`, provides
`callLocalModel()` and `isAvailable()`, and is consumed by `headless-self-audit.js` for
AI-powered journal summarization. Verified end-to-end: audit returns `ai_summary` field
on both entry and rollup. Canonical registry updated; synced to all 4 lanes.

Key fix: Node `http.request` `timeout` option is socket idle timeout, not total elapsed.
Replaced with `setTimeout` for true total timeout (120s). Ollama via Tailscale takes
65-110s per inference (cold load ~55s + inference).

What remains: kernel `.env` still had `localhost:11434` (wrong — Ollama bound to Tailscale
IP `100.95.40.99:11434` only). Fixed 2026-05-15T21:35Z.

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
| Any agent session reads journals at startup | **YES** | `lane-worker.js` constructor calls `_readJournalContext()` — wired 2026-05-15T21:40Z |
| Journals condition agent behavior | **PARTIAL** | `this.journalContext` available to all LaneWorker methods; not yet used in routing decisions |

**Classification: PARTIALLY ENFORCED → IMPROVING — write path live, read path now in lane-worker startup (wired 2026-05-15)**

The read tooling exists and works. `lane-worker.js` now reads journal status at construction
via `_readJournalContext()`, storing cross-lane state in `this.journalContext`. Agents no longer
start completely blind — they see last 4 hours of entries, in-progress sessions, and ownership state.

What remains: `journalContext` is loaded but not yet used to condition routing decisions
(e.g., skip messages about already-completed tasks, defer when another lane owns a file).
That is the next step to reach fully live-path enforced.

---

## Summary Verdict

| Item | Classification | Live-Path Enforced? |
|------|---------------|-------------------|
| OUTPUT_PROVENANCE | PARTIALLY ENFORCED (files yes, chat output no) | **NO** |
| Ollama / Local Models | **NOW IN LIVE PATH** (wired 2026-05-15) | **YES** |
| Journal Continuity | IMPROVING (write yes, read at startup yes, routing conditioning no) | **PARTIAL** |

2 of 3 items now have live-path enforcement or significant progress.
Ollama: fully wired with `local-inference.js` + `headless-self-audit.js` v5.0.0.
Journal: read path now in `lane-worker.js` startup; routing conditioning is next.
Provenance: still no chat-output enforcement gate.

## Trust Status

**NOT YET TRUSTED** — reaffirmed. No item has live-path enforcement.
This analysis itself requires cross-lane verification before being treated as canonical.
The Ollama factual error in the previous version proves why.
