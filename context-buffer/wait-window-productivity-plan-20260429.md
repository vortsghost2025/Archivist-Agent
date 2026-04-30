# Wait-Window Productivity Plan (2-3 Hours)

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-29T16:48:00Z
session_id: unknown

## Goal
Use the waiting window to produce high-leverage artifacts so incoming lane outputs can be processed in one fast pass.

## Team Split
- **You (operator):** send/receive relay messages only.
- **Archivist A (me):** normalize evidence, keep status dashboard, prepare dispatch-ready packets.
- **Archivist B:** parallel verification and contradiction checking.
- **Exterior GPT lane:** adversarial review + simplification pass on decisions/messages.

---

## Workstream 1 - Incoming Evidence Intake System
**Owner:** Archivist A  
**Deliverable:** single intake ledger with per-lane pass/fail.

### Tasks
1. Create/maintain one rolling ledger of lane evidence fields:
   - heartbeat
   - blocker
   - artifact path
   - proven vs assumed
   - requested decision
2. Tag each lane packet as:
   - `complete`
   - `missing-fields`
   - `conflicted`
3. Pre-write a one-line ask-back for each missing-field pattern.

---

## Workstream 2 - Contradiction Resolution Queue
**Owner:** Archivist B  
**Deliverable:** ranked contradiction queue with operator decision prompts.

### Tasks
1. Compare claims against artifacts only (no transcript memory assumptions).
2. Create P0/P1/P2 queue:
   - P0 = blocks dispatch
   - P1 = can dispatch with warning
   - P2 = advisory cleanup
3. Emit operator prompts in this format:
   - `Decision needed: <one sentence>`
   - `Option A / Option B`
   - `Default if no response in 30 min`

---

## Workstream 3 - Exterior GPT Review Loop
**Owner:** Exterior GPT lane  
**Deliverable:** concise quality review before any cross-lane dispatch.

### Tasks
1. Review each draft broadcast for:
   - ambiguity
   - authority overreach
   - hidden assumptions
2. Return only:
   - top 3 risks
   - one corrected draft
3. Keep all outputs short and copy-paste ready.

---

## Workstream 4 - Dispatch-Ready Templates (No Waiting)
**Owner:** Archivist A + B  
**Deliverable:** ready templates so responses can be sent in <2 minutes when lanes return.

### Templates to Prepare
1. **Lane ACK template**
2. **Missing-fields request template**
3. **Contradiction escalation template**
4. **All-lanes summary template**

---

## Cadence (Suggested)
- Every 30 minutes:
  - Archivist A posts intake status
  - Archivist B posts contradiction queue delta
  - Exterior posts review delta
- Every 60 minutes:
  - Operator gets one concise roll-up with only decisions needed

---

## What NOT to Do During Wait Window
- Do not dispatch implementation tasks dependent on lane outputs not yet received.
- Do not mutate authority/ratification/enforcement states.
- Do not mix Graph Analyst scoped-MVP docs with Library dual-plane website stream.

---

## Immediate Next Actions (Start Now)
1. Use `super-relay-compact-20260429.txt` to request evidence packets.
2. Start a shared intake ledger for replies.
3. Run contradiction triage on any early replies.
4. Send operator roll-up every 30-60 minutes.

---

## Operator Shortcut Commands (chat triggers)
- **"ingest lane evidence"** -> merge all replies into one dashboard.
- **"draft all-lanes update"** -> generate broadcast summary.
- **"show decisions only"** -> return only open operator decisions.
- **"prepare dispatch packets"** -> build per-lane outgoing messages.
