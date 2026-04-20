# FreeAgent Recovery Policy

Date: 2026-04-19
Phase: 4A
Owner: Archivist (implementation), Library (documentation)

## Overview

Recovery discipline defines how the system handles verification failures, quarantine escalation, and operator handoff. The core principle: **recovery cannot override local deterministic rejection**.

---

## Recovery Hierarchy

### Level 0: Local Deterministic Decision

| Status | Action | Recovery Role |
|--------|--------|---------------|
| VALID | Accept, proceed | None |
| INVALID (lane mismatch) | QUARANTINE | Log and notify |
| INVALID (revoked key) | QUARANTINE | Log and notify |
| INVALID (missing signature) | REJECT | Log only |

**Rule:** Local decision is authoritative. No recovery override.

### Level 1: Quarantine Logging

When an item is quarantined:

1. Generate quarantine ID
2. Log to quarantine.log
3. Submit to recovery endpoint (informational)
4. Return structured rejection

**Format:**
```json
{
  "quarantineId": "q-<uuid>",
  "itemId": "...",
  "lane": "...",
  "reason": "QUARANTINED",
  "note": "Lane mismatch detected",
  "retryCount": 1,
  "timestamp": "2026-04-19T..."
}
```

### Level 2: Retry Boundaries

| Retry Count | Action |
|-------------|--------|
| 1-3 | Log, return QUARANTINE |
| 4+ | Escalate to handoff |

**Max retries:** 3 (defined in `constants.js`)

### Level 3: Operator Handoff

When max retries exceeded:

1. Generate handoff signal file
2. Stop processing
3. Alert operator

**Handoff file:** `AGENT_HANDOFF_REQUIRED.md`

---

## Escalation Levels

### Escalation Ladder

```
Local Decision → Quarantine Log → Retry (max 3) → Handoff Signal
```

| Level | Trigger | Response |
|-------|---------|----------|
| 0 | Valid verification | Proceed |
| 1 | Invalid (recoverable) | Quarantine + retry |
| 2 | Max retries exceeded | Handoff signal |
| 3 | Unrecoverable condition | Immediate handoff |

### Unrecoverable Conditions (Skip to Level 3)

- Key revoked
- Trust store corrupted
- Identity mismatch
- Contradictory state

---

## Recovery Endpoint Contract

### Request (Library/SwarmMind → Archivist)

```json
{
  "lane": "library",
  "itemId": "queue-123",
  "reason": "QUARANTINED",
  "note": "Lane mismatch: expected library, got swarmmind",
  "item": { ... },
  "retryCount": 2
}
```

### Response (Archivist → Lane)

```json
{
  "status": "quarantined",
  "quarantineId": "q-456",
  "retryCount": 2,
  "maxRetries": 3,
  "handoffRequired": false,
  "note": "Logged to quarantine. Retry available."
}
```

### Response (Max Retries Exceeded)

```json
{
  "status": "handoff_required",
  "quarantineId": "q-456",
  "retryCount": 4,
  "maxRetries": 3,
  "handoffRequired": true,
  "handoffFile": "AGENT_HANDOFF_REQUIRED.md",
  "note": "Max retries exceeded. Operator intervention required."
}
```

---

## Recovery Cannot Override

### Explicit Policy

```json
{
  "recovery_override_allowed": false,
  "local_decision_authoritative": true
}
```

### Enforcement in Code

```javascript
// VerifierWrapper.js - Recovery response logging
console.log('[RECOVERY] RecoveryEngine response ignored - local verification is authoritative');
console.log('[RECOVERY] Local reason:', reason);

// Recovery response is informational only
// It CANNOT change valid: false to valid: true
```

### Why This Matters

Without this rule:
- Recovery could "fix" a rejection silently
- Deterministic guarantees would be meaningless
- Audit trail would show contradiction

With this rule:
- Every rejection is terminal locally
- Recovery provides context only
- Operator sees the full picture

---

## Quarantine Log Format

**Location:** `S:/Archivist-Agent/logs/quarantine.log`

**Format:** JSONL (one JSON object per line)

```json
{"quarantineId":"q-001","itemId":"item-123","lane":"library","reason":"QUARANTINED","note":"Lane mismatch","retryCount":1,"timestamp":"2026-04-19T21:00:00Z"}
{"quarantineId":"q-002","itemId":"item-124","lane":"swarmmind","reason":"QUARANTINED","note":"Key ID mismatch","retryCount":1,"timestamp":"2026-04-19T21:01:00Z"}
```

---

## Retry Policy

### Retry Schedule

| Retry | Backoff | Action |
|-------|---------|--------|
| 1 | Immediate | Log, notify |
| 2 | 5 seconds | Log, notify |
| 3 | 10 seconds | Log, notify |
| 4 | N/A | Handoff signal |

**Backoff:** `QUARANTINE_BACKOFF_MS = 5000` (defined in constants)

### Retry Count Increment

```javascript
// Only increment if item is re-processed
// Do NOT increment on initial quarantine
if (item.retryCount === undefined) {
  item.retryCount = 1;
} else {
  item.retryCount++;
}
```

---

## Handoff Signal Generation

### Trigger Conditions

1. Retry count exceeds max (3)
2. Unrecoverable condition detected
3. Operator intervention required

### Handoff File Format

**Filename:** `AGENT_HANDOFF_REQUIRED.md`

```markdown
# AGENT HANDOFF REQUIRED

Generated: 2026-04-19T21:00:00Z
Lane: library
ItemId: queue-123

## Reason
Max retries exceeded (4/3)

## Quarantine ID
q-456

## Evidence
- Lane mismatch detected
- Signed payload lane: swarmmind
- Outer lane: library

## Action Required
1. Review quarantine log
2. Determine root cause
3. Resolve or delete item
4. Remove this handoff file

## Operator Signature
[ ] I have reviewed and resolved this handoff
```

---

## No Success By Side Effect

### Definition

"Success by side effect" means:
- Local verification fails
- Some other process "fixes" it
- Result is accepted without re-verification

### Forbidden Patterns

| Pattern | Reason |
|---------|--------|
| Recovery marks valid | Override forbidden |
| Queue auto-accepts after timeout | No timeout acceptance |
| Manual fix without re-verify | Must re-verify after fix |

### Required Pattern

```
Verification fails → Quarantine → (manual fix) → Re-verify → Accept
```

**Not allowed:**
```
Verification fails → Quarantine → (auto-fix) → Accept without re-verify
```

---

## Recovery Flow Diagram

```
┌─────────────────┐
│ Verification    │
│ Request         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Local Verify    │────── VALID ──────► Accept
└────────┬────────┘
         │ INVALID
         ▼
┌─────────────────┐
│ Quarantine      │
│ (retryCount++)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit to       │
│ Recovery        │◄── Informational only
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ retryCount > 3? │── YES ──► Handoff Signal
└────────┬────────┘
         │ NO
         ▼
┌─────────────────┐
│ Return          │
│ QUARANTINED     │
└─────────────────┘
```

---

## Audit Requirements

### Must Log

- Every verification request
- Every rejection with reason
- Every quarantine entry
- Every retry attempt
- Every handoff signal

### Log Locations

| Event | Location |
|-------|----------|
| Verification | Lane logs |
| Quarantine | `quarantine.log` |
| Handoff | Handoff file + logs |

### Retention

- Quarantine logs: 30 days minimum
- Handoff files: Until resolved

---

Last updated: 2026-04-19
