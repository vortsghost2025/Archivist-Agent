# APRIL15 Reference Ingestion Plan

## Scope and Guardrails

- **Reference source:** `S:/April152026mainreferencepoint`
- **Operating mode:** **READ-ONLY**
- **Hard rule:** Do **not** import, copy, or execute anything from this reference inside active lanes.
- **Hard rule:** No runtime changes, no config mutations, no CI changes, no lane worker edits.
- **Output policy:** Each pass produces **exactly one artifact**.

## Objective

Extract useful knowledge from the reference corpus in controlled stages while preserving active lane stability and preventing context collision.

## Pass 1: Architecture / Theory

- **Input focus:** architectural docs, framework principles, governance concepts, thesis-level structure.
- **Allowed actions:** read, summarize, map concepts to existing Archivist governance vocabulary.
- **Disallowed actions:** code edits outside this pass artifact, lane message schema changes, execution flow changes.
- **Required output (exactly one artifact):**
  - `docs/ops/april15-pass1-architecture-summary.md`

## Pass 2: Runtime / Resilience

- **Input focus:** replay/constraint/drift/resilience logic and operational safety patterns.
- **Allowed actions:** extract candidate controls, classify by applicability (adopt / adapt / reject) for future planning only.
- **Disallowed actions:** enabling controls, wiring tests, changing runtime behavior, adding scripts to active execution paths.
- **Required output (exactly one artifact):**
  - `docs/ops/april15-pass2-runtime-resilience-summary.md`

## Pass 3: Infra / Deploy

- **Input focus:** Terraform/CDK/AWS deployment bundles and infra topology patterns.
- **Allowed actions:** capture deploy architecture options and risk notes for later decision-making.
- **Disallowed actions:** provisioning, credential use, infra plan/apply, deployment pipeline edits.
- **Required output (exactly one artifact):**
  - `docs/ops/april15-pass3-infra-deploy-summary.md`

## Completion Criteria

- Exactly 3 passes completed.
- Exactly 3 artifacts produced (one per pass).
- Zero runtime modifications in active lanes.
- Zero imports from `S:/April152026mainreferencepoint` into active lane execution surfaces.

## Enforcement Checklist (Run Before Closing Each Pass)

- [ ] Source remained read-only.
- [ ] Only one artifact created for this pass.
- [ ] No runtime scripts/configs/tests were modified.
- [ ] No active lane dispatch behavior was changed.
- [ ] Notes are planning-grade only (no hidden implementation work).

