OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-28T22:32:00Z
session_id: unknown

# Phase 2 Enablement Packet (Constraint Discovery -> Optimization)

## Objective

Begin Phase 2 on `2026-05-12` with a controlled progression from constraint discovery to optimization, preserving lane governance and minimizing regression risk.

## Scope

- In scope:
  - Constraint discovery over active lane workflows and relay paths.
  - Constraint ranking by impact, reversibility, and verification cost.
  - Pilot optimization on top-ranked constraints.
  - Governance-compliant evidence capture and cross-lane verification.
- Out of scope:
  - Architectural rewrites outside validated bottlenecks.
  - Any bypass of signed message protocol, schema checks, or lane ownership.
  - Parallel expansion while a single active blocker is unresolved.

## Preconditions (Go/No-Go)

Phase 2 execution starts only if all conditions are true:

1. `lanes/broadcast/active-blocker.json` is absent, or explicitly marked resolved.
2. Relay health remains stable (no retry storm signatures, no NaN queue metrics).
3. Inbox watchers are running and producing fresh heartbeat/log evidence.
4. Last recovery status is `PROVEN` in `lanes/broadcast/last-recovery.json`.
5. Governance roles remain unchanged:
   - Review authority: Kernel
   - Escalation authority: Archivist
6. `lanes/archivist/inbox/quarantine/` contains zero unresolved `P0` messages.
7. `lanes/archivist/inbox/` contains zero unresolved `P0` messages.

## Library-Unavailable Contingency (Website Focus Window)

When Library lane is intentionally unavailable, Phase 2 may proceed in degraded mode under these constraints:

1. Library is marked `temporarily_unavailable` in the kickoff evidence note.
2. No Phase 2 task requires net-new Library-authored schema changes.
3. Library-dependent tasks are moved to a deferred queue with explicit owner `archivist` and status `blocked_external`.
4. Verification authority remains Kernel; Archivist may not self-certify Library-owned claims as `proven`.
5. Any output that would normally require Library sign-off is labeled `provisional` until Library returns.

Allowed in degraded mode:
- Constraint discovery, scoring, and pilot design led by Archivist.
- Optimization pilots on relay, queue hygiene, and cross-lane process mechanics.
- Evidence capture and convergence gate routing via Kernel review path.

Not allowed in degraded mode:
- Promoting Library-spec-related changes to final `proven` status.
- Expanding scope into schema/spec governance domains owned by Library.

### P0 Clearance Protocol (Mandatory Before Phase 2)

Run this clearance sequence before declaring "Phase 2 Ready":

1. Enumerate all `P0` envelopes in:
   - `lanes/archivist/inbox/`
   - `lanes/archivist/inbox/quarantine/`
2. For each item, mark one final disposition:
   - `processed` (completed and moved to processed archive),
   - `resolved` (superseded by newer proven artifact),
   - `archived` (explicitly retained as non-actionable evidence).
3. Record disposition evidence in:
   - `context-buffer/phase2/p0-clearance-YYYYMMDD.md`
4. Re-run the P0 sweep and require a zero-open-P0 result before kickoff.

## Deferred Work Register (Library Busy)

Create and maintain:
- `context-buffer/phase2/deferred-library-work-YYYYMMDD.json`

Minimum fields per deferred item:
- `id`, `title`, `reason`, `blocked_by`, `owner`, `created_at`, `recheck_date`, `unblock_condition`

## Phase 2 Workstream Structure

### Workstream A - Constraint Discovery

Goal: Produce a proven inventory of constraints that materially affect throughput, correctness, and operator burden.

Required outputs:
- `context-buffer/phase2/constraint-inventory-YYYYMMDD.json`
- `context-buffer/phase2/constraint-evidence-YYYYMMDD.md`

Constraint fields:
- `id`, `lane`, `surface`, `description`, `symptom`
- `impact_score` (1-5), `frequency_score` (1-5), `recoverability_score` (1-5)
- `verification_method`, `evidence_path`, `status` (`proven|unproven|conflicted|blocked`)

Exit criteria:
- Minimum 8 proven constraints across at least 3 lanes.
- No unresolved contradictions in evidence exchange.

### Workstream B - Prioritization and Selection

Goal: Select the smallest high-leverage optimization set without violating one-blocker discipline.

Selection formula:
- `priority_index = (impact_score * frequency_score) - recoverability_score`

Required outputs:
- `context-buffer/phase2/priority-matrix-YYYYMMDD.md`
- `context-buffer/phase2/optimization-candidates-YYYYMMDD.json`

Exit criteria:
- Top 3 constraints selected with explicit rollback paths.
- Each candidate has owner lane, verifier lane, and bounded blast radius.

### Workstream C - Optimization Pilots

Goal: Implement and validate constrained improvements on selected targets.

Pilot rules:
- One active optimization blocker at a time.
- Each pilot must include:
  - Baseline metric snapshot.
  - Change artifact.
  - Post-change metric snapshot.
  - Reversal procedure.

Required outputs:
- `context-buffer/phase2/pilot-<id>-baseline.json`
- `context-buffer/phase2/pilot-<id>-result.json`
- `context-buffer/phase2/pilot-<id>-rollback.md`

Exit criteria:
- At least 2 pilots marked `proven`.
- No increase in governance violations, quarantine events, or relay instability.

## Acceptance Criteria (Phase 2 Kickoff Success)

Kickoff week is successful when all conditions below are met:

1. Constraint inventory generated and signed off by owning lanes.
2. Prioritization completed with explicit rationale and evidence links.
3. First optimization pilot launched with baseline metrics and rollback path.
4. Convergence gate status for kickoff packet is `proven`.
5. No unresolved `P0` items in `inbox/` or `inbox/quarantine/` at close of kickoff cycle.

## Cadence and Operating Rhythm

- Daily:
  - Inbox triage by priority.
  - Active blocker check.
  - Recovery truth check (`last-recovery.json`).
- Every 48h:
  - Constraint inventory refresh.
  - Priority index recalculation.
- Weekly:
  - Phase 2 review with Kernel (review authority) and Archivist escalation audit.

## Risk Register (Initial)

- Risk: Hidden coupling between relay hygiene and watcher timing.
  - Mitigation: Pair relay metrics with heartbeat lag tracking before optimization.
- Risk: Local optimization degrades cross-lane consistency.
  - Mitigation: Require verifier lane sign-off before `proven`.
- Risk: Scope creep during optimization.
  - Mitigation: Enforce one-blocker rule and bounded blast radius template.

## First Blocker Candidate (Proposed)

- Candidate: Constraint discovery instrumentation completeness.
- Why first: It unlocks all downstream prioritization with low reversibility risk.
- Definition of done:
  - Inventory schema locked.
  - Evidence capture template adopted across lanes.
  - First cross-lane constraint set marked `proven`.

## Immediate Actions for 2026-05-12

1. Run session-start inbox sweep and blocker check.
2. Create `context-buffer/phase2/` artifact directory.
3. Publish initial constraint inventory template.
4. Assign owner/verifier pairs for discovery pass.
5. Open first blocker and start Workstream A.
