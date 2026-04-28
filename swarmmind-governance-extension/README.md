# SwarmMind Governance Extension

**Purpose:** Extend SwarmMind trace capture for human-agent governance collaboration.

**Role:** This extension adds governance fields to SwarmMind traces. It does NOT verify truth, enforce governance, or replace external lanes.

---

## What This Extension Does

1. **Accepts human input** — CLI or JSON file with human actions
2. **Adds governance fields** — `governance_check`, `drift_signal`, `branch`
3. **Merges with SwarmMind traces** — Combines agent traces with human input
4. **Exports for external review** — Structured JSON for isolation lane validation

## What This Extension Does NOT Do

- Declare truth
- Enforce governance constraints
- Replace BOOTSTRAP.md checks
- Substitute for external validation lanes

---

## Trace Schema Extension

### Base SwarmMind Trace Entry

```json
{
  "timestamp": "2026-04-15T20:30:00Z",
  "agentId": "planner-001",
  "agentName": "Planner",
  "action": "task_start",
  "details": {}
}
```

### Governance-Extended Trace Entry

```json
{
  "timestamp": "2026-04-15T20:30:00Z",
  "source": "agent",
  "agentId": "planner-001",
  "agentName": "Planner",
  "action": "propose",
  "claim": "Fix test isolation using thread-local state",
  "evidence": ["test_env.rs:15-30", "cargo test --test-threads=4 passed"],
  "governance_check": "passed",
  "drift_signal": "none",
  "branch": "main",
  "details": {}
}
```

### Governance Fields

| Field | Values | Purpose |
|-------|--------|---------|
| `source` | `agent` \| `human` | Who made this trace entry |
| `claim` | string | What was claimed (optional for human entries) |
| `evidence` | string[] | Evidence references supporting claim |
| `governance_check` | `passed` \| `failed` \| `skipped` \| `unknown` | Was governance consulted? |
| `drift_signal` | `none` \| `warning` \| `measured` \| `critical` | Drift status at this point |
| `branch` | `main` \| `alternative` \| `corrected` \| `abandoned` | Decision branch |

---

## Usage

### 1. Capture Agent Trace (from SwarmMind)

```bash
cd "S:\SwarmMind"
npm start
# SwarmMind generates traces internally
# Export: node export-trace.js > traces/agent-session.json
```

### 2. Capture Human Input

```bash
# Create human trace entries
node human-input.js --action challenge --claim "Evidence doesn't support 'closed'" --drift-signal warning
```

### 3. Merge Traces

```bash
node merge-traces.js --agent traces/agent-session.json --human traces/human-session.json --output traces/merged.json
```

### 4. Export for External Review

```bash
node export-for-review.js --input traces/merged.json --output artifacts/trace-for-review.json
```

---

## Integration Modes (from SPEC)

- **Mode 1 (Current):** Separate tool — human manually captures input
- **Mode 2 (Future):** Embedded — auto-capture from conversation
- **Mode 3 (Future):** Post-session — parse session artifacts

This extension implements **Mode 1** with hooks for Mode 2.

---

## Connection to Governance

This extension connects to:

- `S:\Archivist-Agent\BOOTSTRAP.md` — governance entry point
- `S:\Archivist-Agent\AGENTS.md` — agent instructions
- `S:\Archivist-Agent\SESSION_INIT.md` — session initialization
- `S:\Archivist-Agent\CHECKPOINTS.md` — pre-action checks

The `governance_check` field records whether the agent consulted governance before making a decision.

---

## Files

```
swarmmind-governance-extension/
├── README.md                    — This file
├── package.json                 — Node config
├── lib/
│   ├── trace-schema.js          — Schema validation
│   ├── human-input.js           — Human trace capture
│   ├── merge-traces.js          — Combine agent + human
│   └── export-for-review.js     — Format for external lanes
├── bin/
│   └── governance-trace.js      — CLI entry point
└── examples/
    └── sample-merged-trace.json — Example output
```

---

**Version:** 0.1.0 (Proof of Concept)
**Status:** Mode 1 implementation - manual capture
