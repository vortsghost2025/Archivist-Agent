# MULTI-WINDOW TESTING PROTOCOL

**Purpose:** Enable parallel read-only testing without polluting SESSION_REGISTRY or creating stale sessions

---

## THE PROBLEM

When you run multiple agent windows for testing:
- SESSION_REGISTRY thinks all sessions are active
- Heartbeat timeouts trigger false "agent death"
- Recovery drills get confused by stale entries
- Creates artificial divergence and conflict scenarios

**This is NOT a bug — it's a protocol gap.**

---

## PROPOSED SOLUTION: SESSION MODES

Add a `mode` field to session registration:

```json
{
  "active_sessions": {
    "archivist-agent": {
      "mode": "governing",        // ← Can write, must heartbeat
      "status": "active"
    },
    "swarmmind-test-01": {
      "mode": "read-only",        // ← No heartbeat, auto-expire
      "status": "observer"
    }
  }
}
```

### Mode Definitions

| Mode | Heartbeat | Can Write | Timeout Behavior | Use Case |
|------|-----------|-----------|------------------|----------|
| `governing` | Required | Yes | Terminate on timeout | Primary agent lane |
| `read-only` | Optional | No | Ignore on timeout | Stress testing, manual verification |
| `ephemeral` | None | No | Auto-remove after 5 min idle | Quick queries, one-shot tasks |
| `shadow` | Mirrors primary | No | Never terminates | Parallel read-only observers |

---

## IMPLEMENTATION OPTIONS

### Option A: Session Mode Flag (Recommended)
**How it works:**
1. When you start a test window, you declare mode: `read-only`
2. SESSION_REGISTRY tracks it but doesn't enforce heartbeat
3. On timeout, it's moved to `inactive_sessions` (not `terminated`)
4. No handoff document, no recovery drill trigger

**Pros:**
- Clean separation of concerns
- Still visible in registry for coordination
- No false alarms

**Cons:**
- Requires mode declaration at session start

### Option B: Heartbeat Exemption List
**How it works:**
1. Pre-register test session IDs in `EXEMPT_SESSIONS.json`
2. These sessions never trigger timeout enforcement
3. Manual cleanup when you're done testing

**Pros:**
- Zero changes to existing protocol
- Easy to add/remove exemptions

**Cons:**
- Requires manual registration
- Can forget to clean up

### Option C: Dual Registry Architecture
**How it works:**
1. `SESSION_REGISTRY.json` — Governing sessions only (writes)
2. `OBSERVER_REGISTRY.json` — Read-only sessions (no enforcement)
3. Two separate tracking systems

**Pros:**
- Complete isolation
- No cross-contamination

**Cons:**
- More complexity
- Two files to maintain

### Option D: Tag-Based Self-Declaration
**How it works:**
1. Each session writes a `.session-mode` file
2. Registry reads mode from file instead of config
3. You control mode by creating/deleting the file

**Pros:**
- No registry changes needed
- You control it from PowerShell

**Cons:**
- File-based, slightly hacky

---

## RECOMMENDED APPROACH: Option A + Tag File

**Hybrid solution:**

1. **Add `mode` to SESSION_REGISTRY schema**
   - `governing` = primary lane (enforce heartbeat)
   - `observer` = read-only test (no heartbeat enforcement)

2. **Add `.session-mode` tag file**
   - Create in project root to declare intent
   - Registry reads it on session registration

3. **Add timeout behavior:**
   ```
   if mode == "governing" → enforce heartbeat timeout
   if mode == "observer" → skip timeout, mark "inactive" after 24h
   ```

---

## PROTOCOL CHANGES

### Current Session Start (Governing)
```
1. Read SESSION_REGISTRY.json
2. Check for active sessions on target lanes
3. Acquire lock file in own lane
4. Register session in registry
5. Begin heartbeat (60s interval)
```

### New Session Start (Observer/Read-Only)
```
1. Read SESSION_REGISTRY.json
2. Check for active sessions on target lanes
3. Create .session-mode file: {"mode": "observer"}
4. Register session in registry with mode: "observer"
5. No heartbeat required
```

### Current Timeout Enforcement
```
if last_heartbeat > lock_timeout_ms:
    mark session terminated
    clear lock file
    create handoff document
```

### New Timeout Enforcement
```
if last_heartbeat > lock_timeout_ms:
    if mode == "governing":
        mark session terminated
        clear lock file
        create handoff document
    elif mode == "observer":
        mark session inactive (no termination)
        no handoff document
        clear after 24h idle
```

---

## SCHEMA UPDATES

### SESSION_REGISTRY.json
```json
{
  "active_sessions": {
    "archivist-agent": {
      "lane_id": "archivist-agent",
      "session_id": "1776403587854-50060",
      "mode": "governing",
      "status": "active",
      "last_heartbeat": "2026-04-17T11:30:00.000Z"
    },
    "swarmmind-observer-01": {
      "lane_id": "swarmmind",
      "session_id": "test-session-001",
      "mode": "observer",
      "status": "active",
      "last_heartbeat": null,
      "created_by": "manual-test",
      "purpose": "stress-test-read-only"
    }
  }
}
```

### .session-mode File
```json
{
  "mode": "observer",
  "purpose": "stress-testing",
  "can_write": false,
  "timeout_exempt": true,
  "created_by": "user-manual-test",
  "created_at": "2026-04-17T12:00:00.000Z"
}
```

---

## HOW TO USE

### Starting a Read-Only Test Window (PowerShell)
```powershell
# In SwarmMind directory
cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"

# Create observer mode tag
echo '{"mode":"observer","purpose":"stress-test"}' > .session-mode

# Start kilo CLI (will read .session-mode)
kilo

# When done, clean up
rm .session-mode
```

### Starting a Governing Session (Primary Agent)
```powershell
# No .session-mode file needed (default = governing)
# Or explicitly:
echo '{"mode":"governing"}' > .session-mode
kilo
```

---

## BENEFITS

1. **No false alarms** — Observer sessions don't trigger timeout
2. **Still visible** — Registry shows all active sessions
3. **No conflicts** — Observer mode cannot write, only read
4. **Easy to use** — One file to create/delete
5. **Self-documenting** — Mode tag shows intent

---

## IMPLEMENTATION STATUS

- [ ] Add `mode` field to SESSION_REGISTRY schema
- [ ] Add `.session-mode` file support
- [ ] Update timeout enforcement logic
- [ ] Update AGENTS.md with protocol
- [ ] Test with parallel sessions

---

## IMMEDIATE WORKAROUND

Until implemented, you can:
1. **Tell me when you start a test window** — I'll mark it as observer in my context
2. **Use session naming convention** — Prefix with `test-` (e.g., `test-swarmmind-01`)
3. **Manual cleanup** — Tell me when you close test windows so I can clear stale entries

---

**Recommendation:** Implement Option A + Tag File. I can do this now if you approve.

**Estimated effort:** 
- Schema update: 5 minutes
- Tag file support: 10 minutes
- AGENTS.md update: 5 minutes
- Testing: 10 minutes

**Total:** ~30 minutes
