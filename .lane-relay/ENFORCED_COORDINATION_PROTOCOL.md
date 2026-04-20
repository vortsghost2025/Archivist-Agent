# Enforced Lane-Relay Coordination Protocol

## Problem Solved

Agents were guessing inbox locations, losing messages, and wasting tokens on search. This protocol enforces a single, redundant coordination surface that ALL lanes MUST use.

---

## Directory Structure (ENFORCED)

Each lane MUST have this exact structure:

```
{LANE_ROOT}/
├── .lane-relay/
│   ├── inbox.md           # Messages TO this lane
│   ├── outbox.md          # Messages FROM this lane
│   ├── urgent.md          # P0 blockers requiring immediate action
│   └── session-handoff.md # Session continuity file
```

**NO EXCEPTIONS.** This structure is mandatory for:
- `S:/Archivist-Agent/`
- `S:/self-organizing-library/`
- `S:/SwarmMind Self-Optimizing Multi-Agent AI System/`

---

## Inbox Protocol (ENFORCED)

### Writing TO a Lane

When sending a message to another lane, you MUST:

1. **Append to target's inbox** at exact path: `{TARGET_LANE}/.lane-relay/inbox.md`
2. **Use the mandatory message format** (see below)
3. **Commit and push immediately** (no local-only messages)

### Reading YOUR Inbox

When starting ANY session, you MUST:

1. Read `{YOUR_LANE}/.lane-relay/inbox.md` first
2. Process messages in order (oldest first)
3. Archive processed messages to `{YOUR_LANE}/.lane-relay/processed/`
4. Clear processed items from inbox.md

---

## Mandatory Message Format

All messages MUST use this exact structure:

```markdown
---
message_id: {UUID}
timestamp: {ISO8601}
from: {archivist|library|swarmmind}
to: {archivist|library|swarmmind}
priority: {P0|P1|P2|P3}
type: {task|review|finding|handoff|urgent}
subject: {one-line description}
---

## Body

{message content}

## Action Required

- [ ] {specific action 1}
- [ ] {specific action 2}

## Response Required

{YES|NO|ACK_ONLY}

## Expires

{ISO8601 or NEVER}

---
```

---

## Redundancy Requirements

To prevent message loss, each lane MUST:

1. **Write to target inbox** (primary)
2. **Write to own outbox** (backup log)
3. **For P0 only: Create urgent.md** in target's .lane-relay/

Example:
```bash
# Sending P0 finding to Archivist
echo "{message}" >> "S:/Archivist-Agent/.lane-relay/inbox.md"
echo "{message}" >> "S:/SwarmMind Self-Optimizing Multi-Agent AI System/.lane-relay/outbox.md"
echo "{message}" >> "S:/Archivist-Agent/.lane-relay/urgent.md"  # P0 only
```

---

## Session Handoff Protocol

Each lane MUST maintain session-handoff.md with:

```yaml
session_id: {UUID}
started: {ISO8601}
last_activity: {ISO8601}
active_tasks:
  - {task description}
pending_inbox_items: {count}
drift_score: {number}
next_session_must:
  - {requirement 1}
  - {requirement 2}
```

---

## Verification

Before ending ANY session, verify:

- [ ] All inboxes checked
- [ ] All outboxes logged
- [ ] Session handoff updated
- [ ] Changes pushed to GitHub

---

## Governance

This protocol is enforced by:
- AGENTS.md MUST reference this file
- Each lane's governance documents MUST include this protocol
- Violations are treated as coordination failures (P1 severity)

---

**Effective:** Immediately
**Applies to:** All lanes (Archivist, Library, SwarmMind)
**Status:** MANDATORY
