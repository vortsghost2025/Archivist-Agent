# BUILD_TEST_SUPERVISOR_VISIBILITY_MODE.md

Temporary build/test observability mode for cross-lane mail diagnostics.

Status: Active only when explicitly enabled by operator.  
Scope: Build/test acceleration.  
Authority: Observability-only (no ratification or enforcement elevation).

---

## Purpose

Reduce coordination latency when multiple lanes are blocked on mailbox/schema/signature failures.

This mode gives Archivist centralized read visibility of lane mail health so failure causes are visible immediately, not after long narrative delays.

---

## Hard Boundaries

- This mode does not ratify governance.
- This mode does not grant enforcement authority.
- This mode does not replace signed mailbox messages.
- This mode does not replace Git history.
- This mode does not alter production lattice authority boundaries.

---

## Required Lane Behavior (while enabled)

Each lane (`kernel`, `library`, `swarmmind`) must emit signed status telemetry while blocked:

1. `MAIL_HEALTH` status every 5 minutes when unresolved.
2. Immediate `BLOCKED_DIAGNOSTIC` message when route result is `blocked` or `quarantine`.

Both messages must be delivered to:

- `S:/Archivist-Agent/lanes/archivist/inbox`
- lane outbox log (normal protocol)

---

## Required MAIL_HEALTH Fields

- `lane`
- `timestamp`
- `inbox_path`
- `last_message_file`
- `schema_valid`
- `signature_valid`
- `route_result` (`processed|blocked|quarantine`)
- `top_error`
- `next_action`

Human-readable summary line:

`TIME / LANE / STATUS / ACTION / ARTIFACT / NEXT`

---

## Required BLOCKED_DIAGNOSTIC Fields

- `error_class` (`schema|signature|path|runtime|other`)
- `failing_field`
- `actual_value`
- `expected_value_or_enum`
- `source_script_or_file`
- `failing_message_path`
- `one_line_fix`

---

## Archivist Triage Protocol

When this mode is enabled, Archivist should:

1. Read all incoming `MAIL_HEALTH` and `BLOCKED_DIAGNOSTIC` first.
2. Deduplicate repeated failures into one active blocker per lane.
3. Prioritize sender-side fixes that remove highest-volume quarantine causes.
4. Broadcast normalized fix instructions in schema-valid signed messages.

---

## Disable Condition

Disable this mode when:

- lanes have stable processed delivery, and
- ratification flow no longer blocked by mail transport failures.

In production-isolated operation, revert to normal lane isolation and standard lattice constraints.
