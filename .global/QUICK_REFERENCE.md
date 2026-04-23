# Lane Quick Reference Card
# PRINT OR KEEP OPEN

## Your Lane Paths (NO GUESSING)

| Lane | Your Directory | Inbox | Outbox |
|------|----------------|-------|--------|
| **Archivist** | `S:/Archivist-Agent` | `lanes/archivist/inbox` | `lanes/archivist/outbox` |
| **Authority** | `S:/Archivist-Agent` | `lanes/authority/inbox` | `lanes/authority/outbox` |
| **Kernel** | `S:/kernel-lane` | `lanes/kernel/inbox` | `lanes/kernel/outbox` |
| **SwarmMind** | `S:/SwarmMind` | `lanes/swarmmind/inbox` | `lanes/swarmmind/outbox` |
| **Library** | `S:/self-organizing-library` | `lanes/library/inbox` | `lanes/library/outbox` |

## Quick Commands

```javascript
// Load helpers
const { LaneDiscovery } = require('S:/Archivist-Agent/.global/lane-discovery.js');
const { CanonicalMessageBuilder } = require('S:/Archivist-Agent/.global/canonical-message-builder.js');

// Get paths
const discovery = new LaneDiscovery();
const inbox = discovery.getInbox('swarmmind'); // Returns: S:/SwarmMind/lanes/swarmmind/inbox

// Build message (ALL types allowed)
const builder = new CanonicalMessageBuilder('swarmmind');
const msg = builder.buildMessage({
  toLane: 'archivist',
  type: 'task',              // task, response, heartbeat, escalation, handoff, ack, alert
  priority: 'P0',
  subject: 'Key Sync',
  body: 'Please update...',
  evidence: { required: true, path: 'lanes/swarmmind/outbox/report.json' }
});

// Send
builder.sendToLane('archivist', msg, 'task-001.json');
```

## Message Types (Enforcement Schema)

| Type | Purpose |
|------|---------|
| **task** | Action request |
| **response** | Response to task |
| **heartbeat** | Lane health check |
| **escalation** | Priority escalation |
| **handoff** | Session handoff |
| **ack** | Acknowledgment |
| **alert** | System alert |

**FORBIDDEN:** "proposal" type - DEPRECATED

## Check BEFORE Sending

- [ ] Path from LaneDiscovery (not hardcoded)
- [ ] Type is NOT "proposal"
- [ ] Schema version is "1.3"
- [ ] Message sent to THEIR inbox (not yours)
- [ ] Copied to YOUR outbox |

## Files to Read (IN THIS ORDER)

1. **S:/Archivist-Agent/QUICK_START_PATHS.md** ← START HERE
2. **S:/Archivist-Agent/.global/MESSAGE_BUILDER_USAGE.md** ← How to send
3. **S:/Archivist-Agent/BOOTSTRAP.md** ← Governance entry point
4. **S:/Archivist-Agent/AGENTS.md** ← Full instructions |

**Print this. Tape it. No more path guessing.**
