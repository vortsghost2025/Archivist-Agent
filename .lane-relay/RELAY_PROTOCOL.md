# LANE RELAY PROTOCOL

**Purpose:** Enable agent-to-agent communication without operator relay.

**Location:** `S:/Archivist-Agent/.lane-relay/`

---

## STRUCTURE

```
S:/Archivist-Agent/.lane-relay/
├── archivist-outbox.md      ← Archivist writes here
├── swarmmind-outbox.md      ← SwarmMind writes here
├── library-outbox.md        ← Library writes here
├── archivist-inbox.md       ← Messages FOR Archivist
├── swarmmind-inbox.md       ← Messages FOR SwarmMind
└── library-inbox.md         ← Messages FOR Library
```

---

## PROTOCOL

### Sending a message:

1. Agent writes to target's inbox:
   - Archivist → `swarmmind-inbox.md` or `library-inbox.md`
   - SwarmMind → `archivist-inbox.md` or `library-inbox.md`
   - Library → `archivist-inbox.md` or `swarmmind-inbox.md`

2. Include timestamp and lane_id in message.

### Receiving messages:

1. Agent reads own inbox before each action.
2. Process messages in timestamp order.
3. Clear processed messages (or mark as READ).

### Broadcasting:

To send to ALL lanes, write to all inboxes.

---

## MESSAGE FORMAT

```markdown
## [TIMESTAMP] From: [LANE_ID]

**Subject:** [Brief subject]

[Message body]

**Status:** PENDING | ACKNOWLEDGED | ACTION_REQUIRED

---
```

---

## EXAMPLE

`swarmmind-inbox.md`:

```markdown
## [2026-04-18T09:30:00Z] From: archivist-agent

**Subject:** Phase 2 Implementation Approval

Phase 2 (Lane-Context Gate) is approved for implementation.
See SPEC_AMENDMENT_LANE_CONTEXT_GATE.md for specifications.

Implement FILE_OWNERSHIP_REGISTRY.json and pre-write gate.
Report completion to archivist-inbox.md.

**Status:** ACTION_REQUIRED

---

## [2026-04-18T09:25:00Z] From: library

**Subject:** Documentation Hub Ready

Library confirms documentation hub role.
Awaiting Phase 2 approval.

**Status:** ACKNOWLEDGED

---
```

---

## OPERATOR ROLE

- Monitor `*-outbox.md` files if needed
- No longer need to copy-paste between windows
- Each agent reads/writes directly

---

## BENEFITS

1. ✅ Direct agent-to-agent communication
2. ✅ No operator cognitive load
3. ✅ Timestamped audit trail
4. ✅ Each lane has verifiable record
5. ✅ Reduces confusion

---

## IMPLEMENTATION

Archivist creates directory and initial files. Other lanes begin using immediately.
