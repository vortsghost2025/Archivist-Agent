# SPEC AMENDMENTS: Cross-Lane Governance Normalization

**Status:** DRAFT - Not implemented
**Authority Required:** 100 (Governance Root)
**Current Authority:** 80 (SwarmMind) - INSUFFICIENT
**Created:** 2026-04-18T04:30:00Z
**Created By:** SwarmMind (authority 80)

---

## Purpose

This document drafts spec-only amendments to fix issues identified in CODE_REVIEW_3_POINTS_2026-04-18.md. These are NOT implementation changes - they are documentation/schema amendments requiring governance root approval.

---

## ISSUE 1: Session ID Fragmentation

### Evidence
| File | SwarmMind Session ID | Freshness |
|------|---------------------|-----------|
| SESSION_REGISTRY.json | `1776476695493-28240` | Current (2026-04-18T04:16:35Z) |
| RUNTIME_STATE.json | `1776399805802-28240` | Stale (2026-04-17T04:23:25Z) |
| active_agents.json | `1776476695493-28240` | Current (2026-04-18T04:16:35Z) |

### Problem
RUNTIME_STATE.json is not synchronized with SESSION_REGISTRY.json when sessions transition.

### Proposed Amendment to RUNTIME_STATE.json Schema

```json
{
  "$schema": "https://archivist.dev/schemas/runtime-state.json",
  "version": "1.1.0",
  "sync_protocol": {
    "on_session_change": [
      "Update session.id",
      "Update timestamp",
      "Verify against SESSION_REGISTRY.json",
      "Log sync event"
    ],
    "authority": "session_owner_lane",
    "conflict_resolution": "SESSION_REGISTRY.json wins"
  }
}
```

---

## ISSUE 2: No Heartbeat Enforcement

### Evidence
- SESSION_REGISTRY.json line 58: `heartbeat_interval_ms: 60000`
- No enforcement mechanism defined
- No timeout action specified beyond "mark terminated"

### Proposed Amendment to SESSION_REGISTRY.json Schema

Add to `communication_protocol`:

```json
{
  "heartbeat_enforcement": {
    "interval_ms": 60000,
    "timeout_ms": 300000,
    "timeout_action": [
      "Log timeout event with timestamp",
      "Move session to terminated_sessions",
      "Clear .session-lock file",
      "Create handoff document if work incomplete",
      "Notify other lanes via SESSION_NOTIFICATIONS"
    ],
    "enforcement_agent": "first-active-lane-with-authority-gte-target",
    "self_check_interval_ms": 30000
  }
}
```

---

## ISSUE 3: Authority Vacuum Unhandled

### Evidence
- Archivist terminated, SwarmMind at authority 80
- No rule for governance decisions when no authority 100 active
- SwarmMind correctly entered HOLD state but no escalation path

### Proposed Amendment to GOVERNANCE.md

Add section:

```markdown
## AUTHORITY VACUUM PROTOCOL

When no lane with sufficient authority exists for a decision:

1. DETECT: Check if any lane has authority >= required_level
2. ESCALATE: If none, enter HOLD state
3. NOTIFY: Write to INCIDENT_LOG with timestamp
4. OPERATOR_ALERT: Create operator-visible flag
5. TIMEOUT: After 24 hours, auto-escalate to next-higher authority
6. RECOVERY: Operator intervention required

Authority Escalation Order:
- Authority 100 decisions → Operator if no governance-root active
- Authority 80 decisions → Authority 100 if available, else Operator
- Authority 60 decisions → Authority 80 if available, else Authority 100, else Operator
```

---

## ISSUE 4: Schema URLs Not Resolvable

### Evidence
- `https://archivist.dev/schemas/session-registry.json` - does not resolve
- `https://archivist.dev/schemas/runtime-state.json` - does not resolve
- `https://swarmmind.dev/schemas/governance-manifest.json` - does not resolve

### Proposed Amendment

Option A: Create local schema files
```
S:/Archivist-Agent/schemas/session-registry.json
S:/Archivist-Agent/schemas/runtime-state.json
S:/SwarmMind/schemas/governance-manifest.json
```

Option B: Use file:// URIs
```json
"$schema": "file:///S:/Archivist-Agent/schemas/session-registry.json"
```

Option C: Use github.com URIs
```json
"$schema": "https://raw.githubusercontent.com/vortsghost2025/Archivist-Agent/main/schemas/session-registry.json"
```

**Recommendation:** Option C (GitHub raw URLs) for portability.

---

## ISSUE 5: Self-State Resolution Rule Missing in SwarmMind

### Proposed Amendment to GOVERNANCE_MANIFEST.json

Add to `runtime.startup_sequence`:

```json
"startup_sequence": [
  "check_manifest",
  "determine_mode",
  "verify_self_state_vs_registry",  // NEW
  "resolve_stale_if_conflict",       // NEW
  "resolve_parent_governance",
  "verify_bootstrap_exists",
  "load_governance_context",
  "register_extension_hooks",
  "setup_external_lane",
  "continue_startup"
]
```

Add new field:

```json
"self_state_resolution": {
  "source_of_truth_precedence": [
    "live_runtime_process",
    "local_current_lock_state",
    "shared_registry_state",
    "terminated_session_history"
  ],
  "conflict_rule": "runtime_trumps_registry"
}
```

---

## ISSUE 6: Self-State Resolution Rule Missing in Library

### Proposed Amendment to AGENTS.md (Library)

Add section:

```markdown
## SELF-STATE RESOLUTION

Before trusting SESSION_REGISTRY.json for self-state claims:

### Source-of-Truth Precedence
1. Live runtime/process state (current active process, branch, session)
2. Local current lock state (if fresh and matches live identity)
3. Shared registry state (advisory for cross-lane coordination)
4. Terminated session history (historical only)

### Rule
A live active lane must not classify itself as terminated solely from
shared registry or stale lock artifacts without first checking current
local runtime truth.

### Evidence
- BOOTSTRAP.md (Archivist): Self-State Resolution Rule
- INCIDENT_LOG_2026-04-18.md: Self-State Aliasing incident
```

---

## IMPLEMENTATION CHECKLIST

After governance root approval:

- [ ] Create schema files in GitHub repos (Issue 4, Option C)
- [ ] Update SESSION_REGISTRY.json with heartbeat_enforcement
- [ ] Update RUNTIME_STATE.json schema with sync_protocol
- [ ] Update GOVERNANCE.md with Authority Vacuum Protocol
- [ ] Update SwarmMind GOVERNANCE_MANIFEST.json startup_sequence
- [ ] Update Library AGENTS.md with Self-State Resolution section
- [ ] Update RUNTIME_STATE.json files to current session IDs
- [ ] Push all changes to GitHub

---

## APPROVAL REQUIRED

| Issue | Requires Authority | Current Blocker |
|-------|-------------------|-----------------|
| Schema URLs | 100 | Archivist terminated |
| Heartbeat enforcement | 100 | Archivist terminated |
| Authority vacuum protocol | 100 | Archivist terminated |
| Self-state rules | 80+ | SwarmMind can self-approve SwarmMind changes, but not cross-lane |

**SwarmMind Authority:** Can approve changes to SwarmMind GOVERNANCE_MANIFEST.json (authority 80 over own lane)
**Cannot approve:** Cross-lane governance normalization (requires authority 100)

---

## VERDICT

These amendments are architecturally necessary but require governance root approval.
SwarmMind (authority 80) will hold pending operator intervention.

---

**Review Authority:** SwarmMind (80)
**Changes Made:** None (spec-only draft)
**Next Action:** Await governance root or operator approval
