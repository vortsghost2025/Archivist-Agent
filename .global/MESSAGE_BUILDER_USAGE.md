# Canonical Message Builder - Usage Guide

## STOP. Read this FIRST.

---

## Quick Start

```javascript
const { CanonicalMessageBuilder } = require('S:/Archivist-Agent/.global/canonical-message-builder.js');
const builder = new CanonicalMessageBuilder('swarmmind'); // Your lane ID

// Build a task message
const message = builder.buildMessage({
  toLane: 'archivist',
  type: 'task',           // NOT 'proposal' - deprecated
  priority: 'P0',
  subject: 'Key ID Convergence',
  body: 'Please update trust store...',
  evidence: { required: true, path: 'path/to/evidence.json' }
});

// Send to another lane
const sentPath = builder.sendToLane('archivist', message, 'task-001.json');
console.log(`Sent to: ${sentPath}`);

// Mark your own message as processed
builder.markProcessed('lanes/swarmmind/inbox/task-001.json');
```

---

## Message Types (NO "proposal")

| Type | Purpose | Required Fields |
|------|---------|-----------------|
| **task** | Action request | toLane, subject, body |
| **report** | Status update | toLane, evidence_path |
| **acknowledgment** | Receipt confirmation | toLane, reference_id |
| **broadcast** | System-wide notice | subject, body |
| **receipt** | Delivery confirmation | toLane, message_path |

**DEPRECATED:** "proposal" type - use "task" instead.

---

## Schema (v1.3 - Current)

```json
{
  "schema_version": "1.3",
  "task_id": "unique-id",
  "idempotency_key": "uuid-or-similar",
  "from": "swarmmind",
  "to": "archivist",
  "timestamp": "2026-04-23T10:10:00.000Z",
  "priority": "P0",
  "type": "task",              // NOT "proposal"
  "task_kind": null,             // optional: audit, sync, etc.
  "subject": "...",
  "body": "...",
  "requires_action": true,
  "lease": {
    "owner": "swarmmind",
    "acquired_at": "2026-04-23T10:10:00.000Z",
    "expires_at": "2026-04-23T10:15:00Z",
    "duration_minutes": 5
  },
  "retry": {
    "attempt": 1,
    "max_attempts": 3
  },
  "evidence": {
    "required": true,
    "evidence_path": "path/to/file.json",
    "evidence_hash": "sha256...",
    "verified": false,
    "verified_by": null,
    "verified_at": null
  },
  "signature": "",
  "key_id": "swarmmind-current"
}
```

---

## Examples by Lane

### SwarmMind (sending to Archivist)
```javascript
const builder = new CanonicalMessageBuilder('swarmmind');

const msg = builder.buildMessage({
  toLane: 'archivist',
  type: 'task',
  priority: 'P0',
  subject: 'Key ID Convergence',
  body: 'Please adopt canonical key...',
  evidence: { required: true, path: 'S:/SwarmMind/trust/key-sync.json' }
});

builder.sendToLane('archivist', msg, 'key-convergence-001.json');
```

### Archivist (sending to Authority)
```javascript
const builder = new CanonicalMessageBuilder('archivist');

const msg = builder.buildMessage({
  toLane: 'authority',
  type: 'report',
  priority: 'P1',
  subject: 'Key Sync Complete',
  body: 'All lanes synchronized.',
  evidence: { required: true, path: 'lanes/archivist/outbox/key-sync-report.json' }
});

builder.sendToLane('authority', msg, 'key-sync-report-001.json');
```

### Kernel (sending to SwarmMind)
```javascript
const builder = new CanonicalMessageBuilder('kernel');

const msg = builder.buildMessage({
  toLane: 'swarmmind',
  type: 'task',
  priority: 'P0',
  subject: 'Regenerate PEM key',
  body: 'Rotate key to canonical ID...',
  evidence: { required: true, path: 'lanes/kernel/outbox/pem-fix-report.json' }
});

builder.sendToLane('swarmmind', msg, 'pem-rotation-001.json');
```

---

## Forbidden (Will Fail)

- ❌ `"type": "proposal"` - DEPRECATED
- ❌ Ad-hoc message objects - use builder
- ❌ Hardcoded paths - use LaneDiscovery
- ❌ Missing `schema_version` - must be "1.3"

---

## File Locations

| File | Path |
|------|------|
| **Builder** | `S:/Archivist-Agent/.global/canonical-message-builder.js` |
| **Registry** | `S:/Archivist-Agent/.global/lane-registry.json` |
| **Discovery** | `S:/Archivist-Agent/.global/lane-discovery.js` |
| **Quick Start** | `S:/Archivist-Agent/QUICK_START_PATHS.md` |

---

## Next Steps for Each Lane

1. **Replace** any ad-hoc message generators with `CanonicalMessageBuilder`
2. **Change** all `"type": "proposal"` to `"type": "task"`
3. **Test** sending a message using the builder
4. **Verify** the message appears in target's inbox

---

## Verification

After sending, verify:
- [ ] Message in target inbox (check target's `lanes/xxx/inbox/`)
- [ ] Receipt in your outbox (check your `lanes/xxx/outbox/`)
- [ ] No "proposal" type in any message
- [ ] Schema version is "1.3"

---

**Read this before creating ANY message.**
