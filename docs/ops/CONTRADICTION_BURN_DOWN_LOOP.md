# CONTRADICTION_BURN_DOWN_LOOP

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-30T20:49:00Z
session_id: unknown
target_lane: archivist | kernel | library | swarmmind

---

## Purpose

Increase contradiction adjudication throughput without slowing generation throughput.

Core principle:

`generation pace can stay high; resolution pace must have a hard floor.`

---

## Operating Rule

For every session:

1. Minimum adjudication floor: **at least 1 adjudicated node per session**
2. Intake-to-resolution ratio target:
   - for every **X = 10** new contradiction edges surfaced, complete **>= 1 adjudication cycle**
3. If floor is missed, session closes as:
   - `status: blocked`
   - `reason: adjudication_floor_not_met`

---

## Adjudication Cycle (one unit)

A cycle is complete only when all are present:

1. edge/source reference (`edge_id_or_path`)
2. bilateral evidence (`evidence_source`, `evidence_target`)
3. domain (`paper|code|data`)
4. adjudication status (`proven_conflict|proven_spurious|needs_lane_review`)
5. next action owner (`archivist|kernel|library|swarmmind`)

No heuristics-only closes are valid.

---

## Session Checklist (Required)

- [ ] contradictions surfaced count recorded
- [ ] adjudications completed count recorded
- [ ] min floor (`>=1`) met
- [ ] ratio gate (`new_edges / 10 <= adjudications`) met or explicitly waived
- [ ] unresolved backlog carried with owner tags

If ratio gate is not met, add:

`waiver_reason`: explicit short explanation + owner + next-session make-up target

---

## Executable Gate

Use:

```bash
node scripts/contradiction-burndown-gate.js --new-edges <N> --adjudications <M> --backlog-open <B>
```

Optional waiver fields (only if ratio gate is missed):

```bash
--waiver-reason "<text>" --waiver-owner <lane> --waiver-makeup-target "<next-session target>"
```

Behavior:

- emits JSON report to `context-buffer/contradiction-burndown/session-gate-<timestamp>.json`
- exits `0` when gate passes
- exits non-zero (default `42`) when gate blocks session close

Examples:

```bash
# PASS example
node scripts/contradiction-burndown-gate.js --new-edges 12 --adjudications 2 --backlog-open 31

# BLOCK example (min floor fail)
node scripts/contradiction-burndown-gate.js --new-edges 5 --adjudications 0 --backlog-open 31

# WAIVED ratio example
node scripts/contradiction-burndown-gate.js --new-edges 25 --adjudications 1 --backlog-open 31 \
  --waiver-reason "priority incident window" \
  --waiver-owner archivist \
  --waiver-makeup-target "adjudicate 3 nodes next session"
```

---

## Metrics Block (append per session)

```json
{
  "session_id": "unknown",
  "timestamp": "2026-04-30T00:00:00Z",
  "new_contradiction_edges": 0,
  "adjudications_completed": 0,
  "min_floor_met": false,
  "ratio_gate_met": false,
  "waiver_reason": "",
  "backlog_open": 0
}
```

---

## Lane Responsibilities

- `swarmmind`: maximize surfacing quality; tag candidates clearly.
- `library`: evidence normalization and citation integrity.
- `kernel`: execution-path contradiction verification.
- `archivist`: gatekeeper on floor/ratio compliance and closure status.

---

## Closure Conditions

Session is `stable` only if:

1. min adjudication floor met
2. no silent resolution
3. backlog owners assigned
4. contradiction close records contain full evidence tuple

Otherwise: `status: blocked`.
