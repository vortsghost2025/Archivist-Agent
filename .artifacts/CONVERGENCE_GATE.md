# Convergence Gate Specification

## Purpose

Transform lane outputs from narratives into verified claims BEFORE they reach the coordinator.

**Goal:** Only forward `proven` or `explicitly conflicted` outputs.

---

## Gate Structure

Every lane output MUST pass through this structure:

```json
{
  "claim": "Single sentence stating what was done/found",
  "evidence": "Path to artifact or log entry proving the claim",
  "verified_by": "codex|swarm|archivist|self",
  "contradictions": [],
  "status": "proven|unproven|conflicted|blocked"
}
```

---

## Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| `proven` | Claim verified by evidence | Forward to coordinator |
| `unproven` | Claim made but not verified | Block, require verification |
| `conflicted` | Multiple lanes disagree | Escalate to coordinator |
| `blocked` | Cannot proceed, external dependency | Queue, notify coordinator |

---

## Gate Protocol

### Step 1: Lane Makes Claim
```json
{
  "claim": "HMAC bypass removed from AttestationSupport.js",
  "evidence": "src/attestation/AttestationSupport.js:47-52",
  "verified_by": "self",
  "contradictions": [],
  "status": "unproven"
}
```

### Step 2: Cross-Lane Verification
Another lane verifies:
```json
{
  "claim": "HMAC bypass removed from AttestationSupport.js",
  "evidence": "diff verification run, 0 bypass patterns found",
  "verified_by": "swarmmind",
  "contradictions": [],
  "status": "proven"
}
```

### Step 3: Gate Passes
Only `proven` outputs forwarded to coordinator inbox.

---

## Conflict Resolution

### When Lanes Disagree
```json
{
  "claim": "Behavioral test harness passes",
  "evidence": "tests/behavioral/run.log:21/21 pass",
  "verified_by": "library",
  "contradictions": [
    {
      "from": "swarmmind",
      "claim": "Test harness has async race condition",
      "evidence": "tests/behavioral/diagnostic.log:timeout at line 47"
    }
  ],
  "status": "conflicted"
}
```

### Conflict Escalation
1. Both claims presented to coordinator
2. Coordinator requests third lane verification
3. Majority rules OR human decision

---

## One-Blocker Rule

**At any moment, only ONE blocker is active system-wide.**

### Blocker Format
```json
{
  "id": "BLOCKER-001",
  "description": "Async race condition in test harness",
  "blocking_lanes": ["library"],
  "required_action": "Fix race condition in test-phase4-behavioral.js",
  "created": "2026-04-20T19:00:00Z",
  "owner": "library"
}
```

### Blocker Protocol
1. Lane identifies blocker → writes to `lanes/broadcast/active-blocker.json`
2. All lanes check blocker before starting new work
3. Only owner lane works on blocker
4. Other lanes queue tasks
5. On resolution, owner updates blocker → removes file

---

## State Snapshot Protocol

After every significant change:

```
# STATE SNAPSHOT
LANE: library
CHANGE: Removed HMAC bypass from AttestationSupport.js
VERIFIED_BY: swarmmind
RESULT: proven
NEXT_BLOCKER: None
```

### Snapshot Storage
- Saved to `context-buffer/state-snapshots/{timestamp}.md`
- Latest snapshot always at `context-buffer/CURRENT_STATE.md`

---

## Ask Before Expand Rule

Before any lane does more work, check:

```
Is the current task:
A) Still one blocker? → Continue
B) Already verified? → Queue for next
C) Requiring expansion? → Escalate to coordinator

If NOT A, B, or C → STOP
```

---

## Implementation Checklist

### Phase 1: Gate Structure (Immediate)
- [ ] Add gate schema to each lane's AGENTS.md
- [ ] Require gate format in all lane messages
- [ ] Update message templates

### Phase 2: Verification Flow (Next Session)
- [ ] Implement cross-lane verification check
- [ ] Build conflict detection
- [ ] Create escalation path

### Phase 3: One-Blocker (Next Session)
- [ ] Create `lanes/broadcast/active-blocker.json` schema
- [ ] Implement blocker check in each lane
- [ ] Build blocker resolution protocol

### Phase 4: State Snapshots (Next Session)
- [ ] Create snapshot template
- [ ] Implement snapshot writing after changes
- [ ] Build CURRENT_STATE.md updater

### Phase 5: Ask Before Expand (Next Session)
- [ ] Add check to lane startup
- [ ] Implement STOP condition
- [ ] Build escalation trigger

---

## Gate Enforcement

### Message Validation
Before any message is sent to coordinator:

```javascript
function validateGate(message) {
  const required = ['claim', 'evidence', 'verified_by', 'status'];
  const validStatus = ['proven', 'unproven', 'conflicted', 'blocked'];
  
  for (field of required) {
    if (!message[field]) {
      return { valid: false, error: `Missing: ${field}` };
    }
  }
  
  if (!validStatus.includes(message.status)) {
    return { valid: false, error: `Invalid status: ${message.status}` };
  }
  
  if (message.status === 'unproven') {
    return { valid: false, error: 'Unproven claims cannot be forwarded' };
  }
  
  return { valid: true };
}
```

### Routing Rules
| Status | Route To |
|--------|----------|
| `proven` | Coordinator inbox |
| `conflicted` | Coordinator inbox (P0) |
| `blocked` | Coordinator inbox (P1) |
| `unproven` | Verification lane queue |

---

## Example Flow

### Before Convergence Gate
```
Library: "I fixed the HMAC bypass!"
SwarmMind: "I think there's still a bypass..."
Archivist: "???" (has to reconcile manually)
```

### After Convergence Gate
```
Library: {
  "claim": "HMAC bypass removed",
  "evidence": "diff://...",
  "status": "proven"
}
→ Gate checks: verified_by present? Yes. Status proven? Yes.
→ Forward to Archivist inbox.

Archivist receives: verified, bounded output.
```

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Narratives received | High | Zero |
| Proven claims received | Low | All |
| Time to reconcile | Minutes | Seconds |
| Coordinator load | High | Reduced |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-20 | 1.0 | Initial specification |

---

**Status:** READY FOR IMPLEMENTATION
