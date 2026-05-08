# LANE_MESSAGE_INDEX.md

Single no-guesswork index for lane messaging, schema, signing, and delivery.

---

## 1) Canonical Lane Roots

Use these exact roots only:

| Lane | Root | Inbox | Outbox |
|---|---|---|---|
| archivist | `S:/Archivist-Agent` | `S:/Archivist-Agent/lanes/archivist/inbox` | `S:/Archivist-Agent/lanes/archivist/outbox` |
| kernel | `S:/kernel-lane` | `S:/kernel-lane/lanes/kernel/inbox` | `S:/kernel-lane/lanes/kernel/outbox` |
| swarmmind | `S:/SwarmMind` | `S:/SwarmMind/lanes/swarmmind/inbox` | `S:/SwarmMind/lanes/swarmmind/outbox` |
| library | `S:/self-organizing-library` | `S:/self-organizing-library/lanes/library/inbox` | `S:/self-organizing-library/lanes/library/outbox` |
| authority | `S:/Archivist-Agent` | `S:/Archivist-Agent/lanes/authority/inbox` | `S:/Archivist-Agent/lanes/authority/outbox` |

Do not guess alternate paths. Do not use spaced/hyphenated SwarmMind variants.

---

## 2) Message Type Contract (v1.4)

If the lane worker is validating schema v1.4, use:

- `schema_version`: `1.4`
- `type`: one of `task|response|heartbeat|escalation|handoff|ack|alert|notification|status`
- For `type` in `task|response|escalation|handoff|notification|status`, include `task_kind`.
- Keep `to` lane lowercase (`archivist|library|swarmmind|kernel`).

Required envelope fields (minimum safe set):

- `schema_version`
- `task_id`
- `idempotency_key`
- `from`
- `to`
- `type`
- `priority`
- `subject`
- `body`
- `timestamp`
- `requires_action`
- `payload`
- `execution`
- `lease`
- `retry`
- `evidence`

Recommended always include:

- `evidence_exchange`
- `heartbeat`
- `delivery_verification`
- `uncertainty` (UNCERTAINTY_PACKET_V1 — recommended for all task/response/escalation types)
- `review` (REVIEW_ROUND_PROTOCOL_V1 — recommended for convergence and implementation reports)
- `prior_attempts` (PRIOR_ATTEMPTS_V1 — recommended when retrying after failed attempts)

Source of truth:

- `src/lane/SchemaValidator.js`
- `schemas/inbox-message-v1.json`

---

## 3) Signing Contract (No Unsigned Delivery)

Unsigned envelopes are routed to blocked/quarantine.

Required signature fields on delivered message:

- `signature` (JWS)
- `signature_alg` = `RS256`
- `key_id` (derived via DER/SPKI method)
- `content_hash`

Canonical signing utilities:

- `scripts/create-signed-message.js` (build + sign canonical envelope)
- `scripts/sign-outbox-message.js` (sign existing envelope file)
- `.global/deriveKeyId.js` (canonical key id derivation)

Passphrase resolution:

- `LANE_KEY_PASSPHRASE` or `LANE_KEY_PASSPHRASE_<LANE>`
- `.runtime/lane-passphrases.json`

Key files expected:

- `<lane-root>/.identity/private.pem`
- `<lane-root>/.identity/public.pem`

---

## 4) Send/Log Protocol

When sending to another lane:

1. Create schema-valid message envelope.
2. Sign message.
3. Write to target lane inbox.
4. Log the same message in sender outbox.
5. Confirm inbox file exists after write.

For P0 urgency:

- Also write urgent variant in target inbox according to lane protocol.

Never:

- Send unsigned messages.
- Use `type: "proposal"` as top-level type (use `type: "task"` + `task_kind: "proposal"`).
- Treat dashboard/status mirror as delivery proof.

---

## 5) Minimal Command Examples

Create signed canonical message:

```bash
node "S:/Archivist-Agent/scripts/create-signed-message.js" "S:/path/to/message.json" archivist
```

Sign existing message:

```bash
node "S:/Archivist-Agent/scripts/sign-outbox-message.js" --message "S:/path/to/message.json" --lane archivist
```

---

## 6) Failure Triage (Fast)

If message is blocked/quarantined, check in order:

1. Wrong lane path
2. Invalid `type` or missing required fields
3. Missing signature fields
4. Missing key material or passphrase
5. `evidence_exchange` missing when required

---

## 11) Related Entry Files

- `QUICK_START_PATHS.md` (path map)
- `BOOTSTRAP.md` (single entry point)
- `AGENTS.md` (operational requirements)
- `.global/KEY_DERIVATION.md` (key id invariant)
- `docs/ops/TRUST_LAYER_V1.md` (trust hardening context)

---

## 12) Mandatory Final Output Provenance Header

Every final output sent across lanes (chat paste, inbox message body, handoff, or summary)
MUST begin with a provenance header block so copied text is never ambiguous.

Required fields:

- `agent`: runtime/model label used by sender
- `lane`: sender lane id (`archivist|kernel|library|swarmmind|authority`)
- `generated_at`: ISO-8601 timestamp at generation time
- `session_id`: sender session id if available, else `unknown`

Required header format:

```text
OUTPUT_PROVENANCE:
agent: <agent-runtime-or-model>
lane: <lane-id>
generated_at: <ISO-8601 timestamp>
session_id: <session-id-or-unknown>
```

Rules:

- Header MUST be the first block in final output.
- Header MUST be ASCII-only.
- Header fields MUST be single-line key/value pairs.
- Do not omit `generated_at`; stale pasted messages are a known failure mode.

Helper utility:

```bash
node "S:/Archivist-Agent/scripts/provenance-header.js" --agent "kilo-auto/free" --lane "kernel" --session "sess-123"
```

Prepend header to a prepared summary:

```bash
node "S:/Archivist-Agent/scripts/provenance-header.js" --agent "kilo-auto/free" --lane "kernel" --session "sess-123" --stdin < "S:/path/to/summary.txt"
```

---

## 9) Protocol Extensions (v1.4)

### A) UNCERTAINTY_PACKET_V1

Surfaces stalled/uncertain work to operators and downstream agents. Prevents agents from claiming "fixed" when work is uncertain.

Schema: `schemas/uncertainty-packet-v1.json`

Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | enum | yes | `low` / `medium` / `high` / `critical` |
| `type` | array[enum] | yes | One or more: `missing_evidence`, `conflicting_sources`, `tool_failure`, `execution_failure`, `stale_state`, `ambiguous_intent`, `blocked_by_permission`, `implementation_unknown`, `runtime_not_verified`, `dependency_unresolved`, `partial_completion`, `escalated_review` |
| `why` | string | yes | Human-readable explanation |
| `evidence_needed` | array[string] | yes | Specific evidence that would close this uncertainty |
| `operator_decision_needed` | boolean | yes | `true` if human input required to resolve |
| `next_safe_check` | string | yes | What to verify next |
| `detected_at` | ISO-8601 | no | When uncertainty was first detected |
| `detected_by` | string | no | Agent or lane that detected it |

When to include:

- Any message where the agent cannot fully verify its own output
- Convergence gate reports where `status` is `unproven` or `blocked`
- Implementation reports where runtime verification is incomplete
- Repair proposals where the fix approach is uncertain

Operator dashboard SHOULD filter: show only `level: high` + `operator_decision_needed: true` items by default.

Example:

```json
{
  "uncertainty": {
    "level": "high",
    "type": ["runtime_not_verified", "implementation_unknown"],
    "why": "Diff exists but typecheck fails; UI state wiring not proven.",
    "evidence_needed": [
      "npm run typecheck exit_code 0",
      "GraphCanvas receives edgeFilterMode from valid provider"
    ],
    "operator_decision_needed": false,
    "next_safe_check": "Inspect GraphCanvas visibleGraph block and rerun typecheck",
    "detected_at": "2026-05-08T14:30:00Z",
    "detected_by": "archivist"
  }
}
```

### B) REVIEW_ROUND_PROTOCOL_V1

Iterative review loop for convergence gate and implementation tasks. Prevents one-shot acceptance of flawed work.

Schema: `schemas/review-round-protocol-v1.json`

Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `round` | integer | yes | Current round (1-based) |
| `reviewer` | string | yes | Reviewing agent or lane |
| `status` | enum | yes | `draft` / `needs_repair` / `verified_partial` / `verified_accept` / `rejected` / `escalated` |
| `feedback` | array[object] | yes | Structured feedback items |
| `feedback[].issue` | string | yes | What is wrong |
| `feedback[].required_fix` | string | yes | What must change |
| `feedback[].evidence_required` | string | yes | What proves the fix |
| `previous_rounds` | array[object] | no | Summary of prior rounds |
| `max_rounds` | integer | yes (default 3) | Mandatory escalation after this many |
| `escalation_reason` | string | no | Required when `status=escalated` |

Lifecycle:

1. `draft` → initial submission, awaiting review
2. `needs_repair` → reviewer found issues, feedback provided
3. Loop: fix → re-submit → review (increment `round`)
4. `verified_partial` → some claims pass, others need work
5. `verified_accept` → all claims pass, work can proceed
6. `rejected` → fundamental flaw, new approach needed
7. `escalated` → stuck after `max_rounds`, coordinator/operator must intervene

Escalation rule: When `round >= max_rounds` and `status` is still `needs_repair`, the workstream MUST set `status=escalated` and populate `escalation_reason`. The coordinator lane surfaces this to the operator.

Example:

```json
{
  "review": {
    "round": 2,
    "reviewer": "kernel",
    "status": "needs_repair",
    "feedback": [
      {
        "issue": "GraphCanvas syntax error at line 1140",
        "required_fix": "Remove stray dependency array",
        "evidence_required": "npm run typecheck exit_code 0"
      }
    ],
    "previous_rounds": [
      { "round": 1, "result": "needs_repair", "unresolved_items": 1 }
    ],
    "max_rounds": 3
  }
}
```

### C) PRIOR_ATTEMPTS_V1

Records failed exploration attempts so downstream agents avoid repeating them.

Schema: `schemas/prior-attempts-v1.json`

Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attempt_id` | string | yes | Unique attempt identifier |
| `actor` | string | yes | Agent or lane that attempted |
| `action` | string | yes | What was attempted |
| `result` | string | yes | Outcome |
| `failed_because` | string | yes | Root cause |
| `do_not_repeat` | string | yes | Prescriptive: what NOT to do |
| `useful_evidence` | array[string] | no | Evidence despite failure |
| `timestamp` | ISO-8601 | no | When attempt was made |

When to include:

- Task messages that retry after a failed approach
- Journal entries for `work_completed` with `handoff.status=failed`
- Any message where the current approach replaced a prior failed one

Example:

```json
{
  "prior_attempts": [
    {
      "attempt_id": "graph-filter-context-001",
      "actor": "archivist-agent",
      "action": "Placed EdgeFilterModeContext inside GraphToolbar",
      "result": "typecheck failed / state flow unproven",
      "failed_because": "GraphCanvas could not see provider; ModeSelector import missing",
      "do_not_repeat": "Do not trap edgeFilterMode state inside GraphToolbar",
      "useful_evidence": [
        "GraphCanvas.tsx line 1140 syntax error",
        "Typecheck TS2304 EdgeFilterModeContext / ModeSelector"
      ],
      "timestamp": "2026-05-08T12:00:00Z"
    }
  ]
}
```

### D) Integration Points

| System | Uncertainty | Review Round | Prior Attempts |
|--------|-------------|--------------|----------------|
| store-journal.js | Journal entry field | Journal entry field | Journal entry field |
| convergence gate | Required when status=unproven/blocked | Required for all convergence outputs | Optional |
| inbox messages | Recommended for task/response/escalation | Recommended for convergence reports | Recommended for retries |
| graph-analysis-packets | Required for repair proposals | Optional | Recommended |
| operator dashboard | Filter: high + operator_decision_needed | Show escalated only | Hidden by default |
| autonomous executor reports | Required when completion-proof is partial | Required for executor outputs | Required on retry |

---

## 10) Golden Message Templates (Copy-Paste)

### A) Proposal template (schema-safe, v1.4)

```json
{
  "schema_version": "1.4",
  "task_id": "task-REPLACE_ME",
  "idempotency_key": "REPLACE_WITH_STABLE_KEY",
  "from": "archivist",
  "to": "kernel",
  "type": "task",
  "task_kind": "proposal",
  "priority": "P1",
  "subject": "PROPOSAL: Replace with title",
  "body": "Proposal details and evidence pointers.",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "requires_action": true,
  "payload": { "mode": "inline", "compression": "none" },
  "execution": { "mode": "manual", "engine": "opencode", "actor": "lane" },
  "lease": { "owner": "kernel", "acquired_at": "2026-01-01T00:00:00.000Z" },
  "retry": { "attempt": 1, "max_attempts": 3 },
  "evidence": { "required": true, "evidence_path": "S:/path/to/artifact.md", "verified": false },
  "evidence_exchange": { "artifact_path": "S:/path/to/artifact.md", "artifact_type": "report", "delivered_at": "2026-01-01T00:00:00.000Z" },
  "heartbeat": { "status": "pending", "last_heartbeat_at": "2026-01-01T00:00:00.000Z", "interval_seconds": 300, "timeout_seconds": 900 }
}
```

### B) Ratification response template (schema-safe, v1.4)

```json
{
  "schema_version": "1.4",
  "task_id": "task-REPLACE_ME",
  "idempotency_key": "REPLACE_WITH_STABLE_KEY",
  "from": "kernel",
  "to": "archivist",
  "type": "response",
  "task_kind": "ratification",
  "priority": "P1",
  "subject": "RATIFICATION: <proposal-id> - APPROVE",
  "body": "Verdict: APPROVE. Rationale: ...",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "requires_action": false,
  "payload": { "mode": "inline", "compression": "none" },
  "execution": { "mode": "manual", "engine": "opencode", "actor": "lane" },
  "lease": { "owner": "archivist", "acquired_at": "2026-01-01T00:00:00.000Z" },
  "retry": { "attempt": 1, "max_attempts": 3 },
  "evidence": { "required": true, "evidence_path": "S:/path/to/review.md", "verified": true, "verified_by": "kernel", "verified_at": "2026-01-01T00:00:00.000Z" },
  "evidence_exchange": { "artifact_path": "S:/path/to/review.md", "artifact_type": "report", "delivered_at": "2026-01-01T00:00:00.000Z" },
  "heartbeat": { "status": "done", "last_heartbeat_at": "2026-01-01T00:00:00.000Z", "interval_seconds": 300, "timeout_seconds": 900 }
}
```

After creating either template:

1. Sign with `scripts/create-signed-message.js` or `scripts/sign-outbox-message.js`
2. Deliver to target inbox
3. Log identical message to sender outbox
