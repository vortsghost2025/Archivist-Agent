# STATE SNAPSHOT
LANE: archivist
CHANGE: Implemented P0 sender hardening and Phase A OBSERVE-only gap detector guardrails in shared message builders/validators.
VERIFIED_BY: self
RESULT: proven
NEXT_BLOCKER: Complete source sweep for legacy ad-hoc send scripts still bypassing canonical builders.

## Evidence
- `src/lane/SchemaValidator.js`
  - Added `normalizeMessageForSchema()` for legacy enum alias normalization:
    - `execution.mode`: `constitutional` -> `manual`
    - `execution.engine`: `governance` -> `opencode`
    - `heartbeat.status`: `active` -> `in_progress`
    - `evidence_exchange.artifact_type`: `proposal` -> `artifact`
  - Enforced normalization in `createMessage()` and `deliverMessage()`.
- `.global/canonical-message-builder.js`
  - Now builds via `createMessage()` to ensure full v1.3 envelope.
  - Added supported message types: `notification`, `status`.
  - Added required blocks: `payload`, `execution`, `heartbeat`, canonical `lease/retry`.
- `scripts/create-signed-message.js`
  - Added schema normalization pass to canonical signing builder output.

## Verification
- Canonical builder emits schema-valid message.
- Canonical signing builder normalizes legacy alias values and validates.
- Lint check reports no issues on touched files.
