# SESSION_ID_FRAGMENTATION_FIX

**Priority:** CRITICAL
**Status:** Documented, awaiting approval
**Created:** 2026-04-18T04:35:00Z
**Created By:** SwarmMind (authority 80)

---

## The Bug

| File | SwarmMind Session ID | Status |
|------|---------------------|--------|
| SESSION_REGISTRY.json | `1776476695493-28240` | ✅ Correct |
| active_agents.json | `1776476695493-28240` | ✅ Correct |
| RUNTIME_STATE.json | `1776399805802-28240` | ❌ STALE (April 17) |

---

## Root Cause

Missing step in session startup:

> Session registration updates SESSION_REGISTRY.json but never updates RUNTIME_STATE.json.

The `SESSION_REGISTRY.json` rules (lines 66-74) define `session_start`:
```json
"session_start": [
  "Read SESSION_REGISTRY.json",
  "Read .session-mode file if present",
  "If .session-mode exists, use declared mode",
  "Otherwise default to mode: governing",
  "Check for active sessions on target lanes",
  "If mode == governing: Acquire lock file in own lane",
  "Register session in registry with mode",
  "If mode == governing: Begin heartbeat (60s interval)"
]
```

**MISSING:** `"Update RUNTIME_STATE.json with new session ID"`

---

## Impact

| Impact | Description |
|--------|-------------|
| Self-state drift | RUNTIME_STATE claims wrong session ID |
| Coordination confusion | Upstream lanes see stale ID |
| Trust calculation errors | Timestamps don't match reality |
| Recovery failures | Cannot restore correct session state |

---

## The Fix

### Part 1: Update SwarmMind's RUNTIME_STATE.json
- **Authority Needed:** 80
- **SwarmMind Can Do:** ✅ YES
- **Action:** Update `session.id` and `timestamp` to current values

### Part 2: Add sync step to SESSION_REGISTRY session_start protocol
- **Authority Needed:** 100
- **SwarmMind Can Do:** ❌ NO
- **Action:** Add rule: `"Update RUNTIME_STATE.json session.id and timestamp"`

---

## Authority Check

| Action | Authority Needed | SwarmMind Can Do? |
|--------|------------------|-------------------|
| Fix own RUNTIME_STATE.json | 80 | ✅ YES |
| Update SESSION_REGISTRY rules | 100 | ❌ NO |

---

## Proposed Fix for Part 2 (Spec Amendment)

Add to `SESSION_REGISTRY.json` rules.session_start:

```json
"session_start": [
  "Read SESSION_REGISTRY.json",
  "Read .session-mode file if present",
  "If .session-mode exists, use declared mode",
  "Otherwise default to mode: governing",
  "Check for active sessions on target lanes",
  "If mode == governing: Acquire lock file in own lane",
  "Register session in registry with mode",
  "Update RUNTIME_STATE.json session.id and timestamp",  // NEW
  "If mode == governing: Begin heartbeat (60s interval)"
]
```

---

## Status

- ✅ Bug documented
- ✅ Fix designed
- ✅ Fix can be applied to SwarmMind RUNTIME_STATE.json (Part 1)
- ⏳ Waiting for operator approval or Archivist activation (authority 100) for Part 2

---

## Ready Actions

| Action | Requires | Status |
|--------|----------|--------|
| Apply Part 1 fix | Operator approval | READY |
| Draft Part 2 spec amendment | None (already done) | COMPLETE |
| Implement Part 2 | Authority 100 | BLOCKED |

---

**Review Authority:** SwarmMind (80)
**Changes Made:** None (documentation only)
**Next Action:** Await operator approval for Part 1 implementation
