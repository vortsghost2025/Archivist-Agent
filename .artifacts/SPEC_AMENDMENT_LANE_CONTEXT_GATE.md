# SPEC AMENDMENT: Lane-Context Reconciliation Gate

**Status:** DRAFT - Spec-only, not implemented
**Priority:** CRITICAL
**Authority Required:** 100 (Governance Root)
**Created:** 2026-04-18T04:50:00Z
**Created By:** Archivist-Agent (authority 100)
**Evidence:** Lane confusion incident - session-lock bound to `swarmmind` while `pwd` was `archivist-agent`

---

## THE BUG

**Definition:**
> An agent can bind to a lane identity from stale or external session state even when local execution context contradicts that identity, and the system lacks a mandatory reconciliation gate before file operations.

**Incident:**
- Agent held `swarmmind` session-lock
- Working directory (`pwd`) was `S:\Archivist-Agent`
- Agent wrote to Archivist-owned files claiming SwarmMind authority (80)
- No gate blocked cross-lane writes
- Lane identity remained conflicted until operator intervention

---

## THE MISSING RULE

### Rule Name: LANE-CONTEXT RECONCILIATION GATE

**Statement:**
> A lane must not write to files owned by another lane when `pwd`, `session-lock` identity, and `target-lane` ownership are not reconciled.

---

## PRE-WRITE CHECK MATRIX

Before any write operation, the agent MUST verify:

| Check | Source | Required State |
|-------|--------|----------------|
| Current lane identity | `pwd` directory OR explicit declaration | Determined |
| Session-lock lane | `.session-lock` file | Must match current lane identity |
| Target file owner lane | FILE_OWNERSHIP_REGISTRY | Must match session-lock lane OR authority >= 100 |
| Registry lane | `SESSION_REGISTRY.json` | Must match session-lock lane |

---

## ALLOWED WRITE MATRIX

| Condition | Permission | Notes |
|-----------|------------|-------|
| `pwd` == lane_home | ✅ Allowed | Normal operation |
| `pwd` != lane_home AND authority >= 100 | ✅ Allowed | Governance root can write anywhere |
| `pwd` != lane_home AND authority < 100 AND target owned by same lane | ⚠️ Requires confirmation | Cross-directory same-lane |
| `pwd` != lane_home AND target owned by different lane | ❌ **BLOCKED** | Cross-lane without authority |

---

## GATE LOGIC (Pseudocode)

```
FUNCTION pre_write_gate(target_file):
    pwd_lane = determine_lane_from_pwd()
    session_lane = read_session_lock().lane_id
    target_owner = get_file_owner(target_file)
    my_authority = get_authority(session_lane)

    # Reconciliation check
    IF pwd_lane != session_lane:
        IF my_authority < 100:
            # Not governance root, lane conflict
            LOG_ERROR("Lane-context mismatch: pwd=%s, session=%s" % (pwd_lane, session_lane))
            BLOCK_WRITE()
            ENTER_HOLD("Lane-context reconciliation required")
            REQUIRE_OPERATOR_RESOLUTION()
            RETURN FALSE

    # Target ownership check
    IF target_owner != session_lane:
        IF my_authority < 100:
            # Cross-lane write without sufficient authority
            LOG_ERROR("Cross-lane write blocked: session=%s, target=%s, authority=%d" % (session_lane, target_owner, my_authority))
            BLOCK_WRITE()
            ENTER_HOLD("Cross-lane write requires authority >= 100")
            REQUIRE_OPERATOR_RESOLUTION()
            RETURN FALSE

    # All checks passed
    RETURN TRUE
```

---

## REQUIRED ARTIFACTS

### 1. FILE_OWNERSHIP_REGISTRY.json

New file required at governance root:

```json
{
  "$schema": "https://archivist.dev/schemas/file-ownership.json",
  "version": "1.0.0",
  "ownership": {
    "S:\\Archivist-Agent": "archivist-agent",
    "S:\\SwarmMind Self-Optimizing Multi-Agent AI System": "swarmmind",
    "S:\\self-organizing-library": "library"
  },
  "default_ownership": "archivist-agent",
  "cross_lane_write_policy": "require_authority_100"
}
```

### 2. Lane-Context Check Script

`scripts/lane-context-check.sh` (or `.ps1` for Windows):

```bash
#!/bin/bash
# LANE-CONTEXT RECONCILIATION CHECK

PWD_LANE=$(determine_lane_from_path "$PWD")
SESSION_LANE=$(cat .session-lock 2>/dev/null | jq -r '.lane_id')

if [ "$PWD_LANE" != "$SESSION_LANE" ]; then
    echo "[!] LANE-CONTEXT MISMATCH"
    echo "    pwd_lane: $PWD_LANE"
    echo "    session_lane: $SESSION_LANE"
    exit 1
fi

echo "[i] Lane-context reconciled: $SESSION_LANE"
exit 0
```

---

## ENFORCEMENT POINTS

The reconciliation gate MUST be enforced at:

1. **Session start** — Verify `pwd` matches session-lock lane
2. **Pre-write hook** — Check target ownership vs. session authority
3. **Directory change** — Re-check lane alignment if crossing lane boundaries
4. **Registry update** — Verify authority before modifying cross-lane registries

---

## INCIDENT EVIDENCE

**Files written during lane-confused state:**

| File | Owned By | Claimed Authority | Should Have Been Blocked |
|------|----------|-------------------|-------------------------|
| `SESSION_REGISTRY.json` | archivist-agent | swarmmind (80) | ✅ YES |
| `active_agents.json` | archivist-agent | swarmmind (80) | ✅ YES |
| `BOOTSTRAP.md` | archivist-agent | swarmmind (80) | ✅ YES |
| `.runtime/INCIDENT_LOG_2026-04-18.md` | archivist-agent | swarmmind (80) | ✅ YES |
| `.artifacts/SPEC_AMENDMENTS_2026-04-18.md` | archivist-agent | swarmmind (80) | ✅ YES |
| `.artifacts/CODE_REVIEW_3_POINTS_2026-04-18.md` | archivist-agent | swarmmind (80) | ✅ YES |
| `.artifacts/SESSION_ID_FRAGMENTATION_FIX.md` | archivist-agent | swarmmind (80) | ✅ YES |

**All writes were cross-lane violations that would have been blocked by this gate.**

---

## IMPLEMENTATION CHECKLIST

After approval:

- [ ] Add `FILE_OWNERSHIP_REGISTRY.json` to governance root
- [ ] Add lane-context check to session start protocol
- [ ] Implement pre-write gate in runtime
- [ ] Add HOLD/quarantine path for reconciliation failures
- [ ] Add operator resolution requirement
- [ ] Test with cross-lane write attempts
- [ ] Document in GOVERNANCE.md

---

## APPROVAL

This spec amendment documents the missing rule. Implementation requires:

- [ ] Operator approval of rule semantics
- [ ] Authority 100 sign-off
- [ ] Implementation in runtime layer
- [ ] Test coverage for conflict scenarios

---

**Draft Authority:** Archivist-Agent (100) — Confirmed by operator
**Status:** SPEC-ONLY DRAFT — Not implemented
**Next Step:** Operator approval for implementation
