# GLOBAL_SESSION_LEDGER_SPEC.md

**Status:** Draft specification  
**Scope:** Documentation only  
**Authority:** Non-authoritative evidence layer (no governance power)  
**Constraints:** No runtime code, no new authority layer, no Phase 2, no mailbox schema changes

---

## 1. Problem statement

Multi-agent work includes long-running agents that may run for hours and compact multiple times before other lanes see state changes. Mailbox delivery is correct for active, signed instructions, but it is discrete and can be too sparse for continuous shared situational awareness.

Primary problem this spec solves:

- reduce communication delay between long-running agents and other lanes
- preserve real-time awareness during compaction/recovery cycles
- keep cross-lane status visible without converting awareness into authority

Without a unified session ledger:

- long-running work remains invisible until late milestone messages
- cross-agent traceability becomes fragmented
- crash recovery requires manual reconstruction from many sources
- drift and contradiction analysis is slower and less reliable
- session-level transparency depends on transient process state

The global session ledger is an append-only awareness stream and evidence timeline. It is not a governance authority mechanism.

---

## 2. Ledger vs mailbox vs Git vs lattice authority

### Ledger (this spec)

- Purpose: append-only timestamped awareness stream across agents/sessions
- Role: low-latency visibility, forensic traceability, crash recovery, transparency
- Authority: none

### Mailbox (`lanes/*/inbox`, `lanes/*/outbox`)

- Purpose: operational lane communication and task routing
- Role: action transport and workflow progression
- Authority: operational messaging only, subject to lane schema and signature checks

### Git history

- Purpose: immutable source/version history
- Role: code and document change lineage
- Authority: source-of-truth for committed repository state

### Lattice authority (ratified governance artifacts)

- Purpose: constitutional/ratified decision authority
- Role: enforceable governance decisions and precedence
- Authority: highest among these four for governance conflicts

### Graph/navigation layer

- Purpose: display and navigation across artifacts
- Role: visualization and discovery
- Authority: none (display-only)

---

## 3. Long-Running Agent Visibility

Visibility rules for long-running agents:

- Agents working longer than 15 minutes emit periodic heartbeat ledger entries.
- Agents entering compaction emit `COMPACT_START` entries.
- Agents restoring from compaction emit `COMPACT_RESTORE` entries.
- Agents blocked by dependencies/gates emit `BLOCKED` entries immediately.
- Agents completing a meaningful checkpoint emit `MILESTONE` entries.
- Entries should include artifact pointers, not raw log dumps.
- Other lanes may read ledger entries for awareness only.
- Any action request must still be sent through signed mailbox messages.

---

## 4. Record schema

Each ledger record is append-only and must include:

- `entry_id` (unique, immutable)
- `timestamp` (ISO-8601)
- `lane_id`
- `agent_id` (or session runtime id)
- `session_id`
- `task_id` (if applicable)
- `message_ids` (array)
- `event_type` (`HEARTBEAT|WORKING|BLOCKED|MILESTONE|COMPACT_START|COMPACT_RESTORE|TEST|DEPLOY|ESCALATION|CONFLICT|RESTORE`)
- `artifact_paths` (array of concrete paths)
- `commit_shas` (array)
- `test_results` (summary object)
- `deployment_ids` (array, optional)
- `compaction_restore` (object, optional)
- `quarantine_escalation` (object, optional)
- `signature_metadata` (key_id, alg, signature_present, verification_status)
- `status_summary` (human-readable short block; required format below)
- `evidence_hashes` (optional content hashes for immutability checks)
- `conflicts` (array; empty if none)

Required human-readable summary line for every write:

`TIME / LANE / STATUS / ACTION / ARTIFACT / NEXT`

Example:

`2026-04-28T08:12:00-04:00 / Library / WORKING / MEV dedup exclusion review / MEV_RECOVERY_EXCLUSION_REVIEW.md / no Sean action`

---

## 5. Append-only write path

Write model is strictly append-only:

1. Build ledger record from verifiable artifacts.
2. Validate required fields and summary block.
3. Append new record at end of ledger stream.
4. Never mutate, reorder, or delete prior entries.
5. If correction is needed, append a new `correction`/`conflict` record referencing prior `entry_id`.

Prohibited:

- in-place edits to past entries
- silent record replacement
- retroactive deletion for cosmetic cleanup

---

## 6. Signature / attestation requirements

Ledger records must carry signature metadata, including whether source evidence was signed and verified:

- `signature_present`: boolean
- `signature_alg`: expected algorithm tag when present
- `key_id`: signer identity key id when present
- `verification_status`: `verified|failed|missing|not_applicable`
- `attested_by`: lane/agent asserting record correctness

Ledger attestation does not create governance authority. It only strengthens evidence integrity and awareness reliability.

---

## 7. Evidence pointer rules

Ledger entries should point to durable artifacts, not paraphrases:

- Prefer concrete file paths, message ids, commit SHAs, test report paths.
- Distinguish raw evidence from derived display summaries.
- Include enough pointers to reconstruct the event without external memory.
- If an artifact is external/non-local, include stable identifier and retrieval method.

Display summaries may be referenced, but cannot be used as sole proof.

---

## 8. Retention and compaction policy

The ledger is append-only logically; retention may be tiered physically:

- **Hot tier:** recent entries for active operations
- **Warm tier:** recent historical entries for short-term audit
- **Cold tier:** long-term archival records

Compaction rules:

- Compaction may aggregate storage, not semantics.
- Original entry lineage must remain reconstructable.
- Compaction events must be logged as new ledger entries with source ranges and resulting artifact ids.

No compaction process may rewrite historical meaning or authority status.

---

## 9. Restore flow after crash or compact

Recovery sequence:

1. Rehydrate latest ledger index/checkpoint.
2. Replay append-only ledger entries in timestamp order.
3. Resolve evidence pointers (messages, commits, test artifacts).
4. Rebuild session timeline and unresolved blocker state.
5. Emit `restore` report entry with:
   - restored range
   - missing artifacts
   - contradictions detected
   - confidence grade

Ledger restore is evidentiary reconstruction and awareness recovery; it does not auto-ratify any decision.

---

## 10. Production isolation mode

In production-isolated lattices:

- Keep ledger readable for awareness/audit, but do not let it route execution.
- Do not use ledger as inter-lane command channel.
- Enforce strict separation between:
  - operational mailbox transport
  - evidence ledger recording
  - ratified authority artifacts

Production mode objective: preserve transparency and situational awareness without weakening isolation boundaries.

---

## 11. Failure modes and quarantine behavior

### Representative failure modes

- missing signature metadata on critical records
- dangling artifact paths
- conflicting entries for same task/message
- replayed/duplicated records with divergent claims
- display-only summaries presented as evidence
- ledger entries misused as action requests

### Quarantine behavior

- Do not delete bad entries; append conflict/quarantine entries.
- Mark suspect records with explicit `verification_status`.
- Escalate unresolved contradictions to lane review.
- Keep original and conflicting entries visible for audit.

Quarantine marks uncertainty; it does not adjudicate authority.

---

## 12. What not to do

- Do not ratify governance through ledger writes.
- Do not grant authority through ledger signatures.
- Do not replace inbox/outbox message transport with the ledger.
- Do not replace signed lane messages with ledger summaries.
- Do not replace Git as source/version history.
- Do not use ledger as a task queue.
- Do not overwrite or mutate past entries.
- Do not treat display summaries as evidence.
- Do not resolve lattice conflicts inside the ledger.
- Do not introduce mailbox schema changes through ledger scope creep.
- Do not use ledger entries as ratification artifacts.
- Do not convert awareness entries into executable commands.

---

## Required invariant

If a ledger entry conflicts with a ratified lattice artifact, the ratified lattice artifact wins. The ledger records the conflict; it does not resolve it.

---

## Interpretation guard

The global session ledger is an awareness + evidence continuity mechanism for transparency, low-latency visibility, and recovery. It is intentionally non-authoritative. Governance authority remains in ratified lattice artifacts and approved enforcement boundaries.
