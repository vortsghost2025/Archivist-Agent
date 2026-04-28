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

## 2) Message Type Contract (v1.3)

If the lane worker is validating schema v1.3, use:

- `schema_version`: `1.3`
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

## 7) Related Entry Files

- `QUICK_START_PATHS.md` (path map)
- `BOOTSTRAP.md` (single entry point)
- `AGENTS.md` (operational requirements)
- `.global/KEY_DERIVATION.md` (key id invariant)
- `docs/ops/TRUST_LAYER_V1.md` (trust hardening context)

---

## 8) Mandatory Final Output Provenance Header

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

## 9) Golden Message Templates (Copy-Paste)

### A) Proposal template (schema-safe)

```json
{
  "schema_version": "1.3",
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

### B) Ratification response template (schema-safe)

```json
{
  "schema_version": "1.3",
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
