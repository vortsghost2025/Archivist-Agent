# DECISION: Session Memory Layer Authorization

**Decision Authority:** Human Operator (Sean) + Archivist
**Date:** 2026-04-18
**Proposed By:** SwarmMind (Lane L - Implementation)
**Status:** ✅ APPROVED — AUTHORIZED FOR COORDINATED ROLLOUT

---

## SUMMARY

SwarmMind has implemented a session memory layer that persists across process restarts. This decision authorizes:
1. The schema for session memory storage
2. Cross-lane read/write permissions
3. Retention and rotation policy
4. Integration with existing governance queue

---

## IMPLEMENTATION ALREADY DONE (SwarmMind-only)

**Files Created:**
- `src/attestation/IdentityAttestation.js` — Persistent identity keys
- `src/memory/SessionMemory.js` — Session memory layer (~150 lines)
- `load-context.js` — Context loading script

**Storage Location:**
- `S:/SwarmMind Self-Optimizing Multi-Agent AI System/.memory/sessions.json`

**Current Status:**
- ✅ Working in SwarmMind lane only
- ❌ NOT deployed to other lanes
- ❌ NOT integrated with governance queue
- ❌ NOT verified by Library

---

## PROPOSED SCHEMA

### sessions.json Structure

```json
{
  "laneId": "swarmmind",
  "sessions": [
    {
      "id": "sess-TIMESTAMP-RAND",
      "started": "ISO-8601",
      "ended": "ISO-8601 | null",
      "summary": "string",
      "context": {},
      "decisions": [
        {
          "timestamp": "ISO-8601",
          "decision": "string",
          "rationale": "string"
        }
      ],
      "files_changed": [
        {
          "timestamp": "ISO-8601",
          "path": "string",
          "change_type": "created|modified|deleted",
          "description": "string"
        }
      ],
      "next_steps": ["string"],
      "key_insights": [
        {
          "timestamp": "ISO-8601",
          "insight": "string"
        }
      ]
    }
  ],
  "current_session": "sessionId | null",
  "last_updated": "ISO-8601"
}
```

---

## CROSS-LANE PERMISSIONS (NEEDS ARCHIVIST DECISION)

### Question 1: Who can read what?

**Proposed:**
- Each lane reads its own memory by default
- Archivist MAY read all lanes (governance oversight)
- Other lanes MAY read `summary`, `next_steps`, `key_insights` but NOT `files_changed` or `decisions` without explicit authorization

**Concern:** Session memory contains work context that may cross lane boundaries. Who decides what's shareable?

### Question 2: Who can write what?

**Proposed:**
- Each lane writes its own memory only
- No cross-lane writes
- Archivist can annotate but not modify

### Question 3: Load-context as queue item?

**Proposed:**
- `load-context.js` generates a CONTEXT_LOAD type item
- This is NOT a COMMAND — it's a read-only context generation
- No cross-lane action triggered

---

## RETENTION POLICY (NEEDS DECISION)

**Proposed:**
- Max sessions: 100 (configurable)
- Max age: 30 days
- Rotation: FIFO (oldest dropped when limit reached)
- Critical sessions: Flagged to prevent rotation?

**Concern:** What happens to memory from critical governance decisions? Should some sessions be preserved permanently?

---

## INTEGRATION WITH GOVERNANCE QUEUE

**Proposed:**
- Session start/end emits AUDIT event to queue
- Decision recording emits DECISION_MADE event
- File changes emitted as FILE_CHANGE events

**Concern:** Does session memory compete with or complement existing audit layer?

---

## AUTHORIZATION REQUIRED

### From Human: ✅ APPROVED
- [x] Approve schema structure
- [x] Approve retention policy
- [x] Approve cross-lane read permissions
- [x] Confirm this aligns with persistence vision

### From Archivist: ✅ APPROVED
- [x] Define lane boundary rules for session memory
- [x] Authorize (or reject) cross-lane context loading
- [x] Specify what governance decisions get logged to memory
- [x] Determine if memory competes with or complements audit

### From Library: ✅ VERIFIED
- [x] Verify schema is valid JSON
- [x] Test persistence across restarts
- [x] Confirm no data corruption risks
- [x] Recommend indexing strategy (if any)

**Reference:** `PERSISTENT_SYSTEMS_DOCUMENTATION.md` provides complete index of existing persistence mechanisms. Session memory integrates with this system, not replaces it.

---

## PAUSE CONDITION — LIFTED

**SwarmMind implementation is NOW AUTHORIZED for coordinated rollout.**

What exists:
- ✅ Working prototype in SwarmMind lane
- ✅ Tests passing locally
- ✅ Decision approved by Human + Archivist

What now proceeds:
- [ ] Deploy to Archivist lane
- [ ] Deploy to Library lane
- [ ] Queue integration
- [ ] Cross-lane context loading

---

## GOVERNANCE JUSTIFICATION

This decision respects:
- **Structure > Identity:** Memory layer affects lane boundaries, needs governance approval
- **Correction > Agreement:** Implementation jumped ahead of governance; now correcting
- **Evidence Before Assertion:** Need Archivist/Library verification before claiming "persistent"

**The question for Archivist:**
> Does session memory blur lane boundaries in a way that requires explicit authorization? If so, what rules govern cross-lane memory access?

**The question for Human:**
> Does this align with the persistence vision? Should we proceed with this approach, or wait for the 48-layer Kilo architecture to be evaluated?

---

## END STATE IF APPROVED

✅ ALL APPROVALS GRANTED

Now proceeding with:
1. SwarmMind session memory authorized for local use
2. Archivist defines cross-lane read rules (documented below)
3. Library verified and recommends
4. Implementation proceeds to other lanes in coordinated wave

---

## CROSS-LANE READ RULES (ARCHIVIST DEFINED)

Based on `PERSISTENT_SYSTEMS_DOCUMENTATION.md`:

### Session Memory Integrates With Existing System

Session memory is NOT a new persistence system. It adds session-level context to:
- `.session-lock` — Identity persistence
- `SESSION_REGISTRY.json` — Session coordination
- `FILE_OWNERSHIP_REGISTRY.json` — File boundaries

### Read Permissions

**Own Lane:**
- Full read access to own `.memory/sessions.json`

**Cross-Lane (Archivist only):**
- Can read `summary`, `next_steps`, `key_insights` from any lane
- Cannot read `decisions` or `files_changed` without explicit queue request

**Cross-Lane (SwarmMind/Library):**
- Cannot read other lane's session memory directly
- Must request via queue with `type: "context_request"`
- Archivist approves/rejects

### Write Permissions

**Own Lane Only:**
- Each lane writes its own `.memory/sessions.json`
- No cross-lane writes permitted

### Integration Points

Session memory emits events to existing audit log:
- `session_started` — New session created
- `session_ended` — Session closed with summary
- `decision_recorded` — Decision logged
- `file_change_recorded` — File change logged

These integrate with existing audit event types in `PERSISTENT_SYSTEMS_DOCUMENTATION.md`

---

**End of Decision Draft**

**STATUS: ✅ APPROVED — AUTHORIZED FOR ROLLOUT**

**Next Step:** Implement session memory in Archivist and Library lanes following SwarmMind prototype.
