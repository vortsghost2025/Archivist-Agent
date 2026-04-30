# Call Playbook (60 min) - Governance + Lanes Demo

## Goal (framing in first 60 seconds)
- Show progress since initial help session.
- Demonstrate a live, governance-constrained multi-agent workflow.
- Prove read-only truth discipline: no false PASS under drift.

## Non-negotiable boundaries to state early
- This demo is non-implementation.
- No runtime mutations during the call.
- Read-only evidence + orchestration only.
- Claims are labeled as `proven`, `unproven`, or `needs_lane_review`.

## What to have visible before she joins
- `S:/self-organizing-library/context-buffer/Goal of this call.txt`
- `S:/Archivist-Agent/context-buffer/call-playbook-20260429.md` (this file)
- One terminal running `scripts/watch-lane-activity.ps1` (read-only monitor)
- `S:/Archivist-Agent/context-buffer/relay-exterior-hardening-20260429.txt` (for multi-archivist coordination)
- `S:/Archivist-Agent/context-buffer/runbook-compact-archive-20260429.md` (compact safety runbook)

## 60-minute run-of-show

### 0-5 min: context and intent
- Open `Goal of this call.txt`.
- Say: "We are validating truth model robustness, not shipping code today."
- Highlight core invariant: never output false PASS when domain is invalid.

### 5-15 min: architecture and truth model
- Explain decision lanes:
  - `BLOCKED` = cannot execute
  - `INVALID_DOMAIN` = executed but not truth-verifiable
  - `PASS/FAIL` = executed and verifiable
- Emphasize domain-gate-before-truth-classification.

### 15-25 min: live lane visibility (read-only)
- Show lane monitor output from `watch-lane-activity.ps1`.
- Point out:
  - heartbeat freshness by lane
  - active PID/watch health
  - risk line (none vs warning)
- Explain this prevents "blind orchestration."

### 25-35 min: compact/restore safety path
- Open runbook.
- Show archive gating:
  - `COMPACT_ARCHIVE=true`
  - `run-compact-with-audit.js`
- Explain outputs:
  - `POST_COMPACT_AUDIT.json`
  - optional `extra_archive` manifest/hash
  - recovery evidence artifacts

### 35-45 min: multi-archivist collaboration
- Open `relay-exterior-hardening-20260429.txt`.
- Explain how two archivists coordinate with provenance headers and strict boundaries.
- Show that risky watcher is quarantined and only read-only monitor remains.

### 45-55 min: open technical review prompts (from her expertise)
- Ask directly:
  1) Hidden bypass paths in truth model?
  2) Is concurrency attack proof realistic?
  3) Best next failure injection?
  4) How to explain this to conventional IT teams?

### 55-60 min: close with explicit next action
- Summarize in 3 lines:
  - What is proven
  - What remains unproven
  - Next smallest safe step
- Ask for one recommendation to prioritize in the next pass.

## 30-second explanation script (if you want it verbatim)
"I run four lanes under governance constraints. Execution is allowed, but truth claims are gated by verification domain validity. If context, evidence, or execution state drifts, we do not emit PASS. During this call I am only showing read-only monitoring, audit-safe compact/restore controls, and cross-agent coordination with provenance so decisions are evidence-first."

## If time gets tight (compressed plan)
- Show only:
  1) Goal file
  2) live monitor
  3) compact runbook
  4) one relay artifact
- Then spend remaining time on her feedback questions.
