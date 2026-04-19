# Trust Store Key Rotation Process

## Overview

This document describes how to rotate RSA keys for lane attestation without
downtime or breaking cross-lane verification.

## Prerequisites

- Archivist has authority over trust store (`S:/Archivist-Agent/.trust/keys.json`)
- All lanes read from canonical trust store
- Key rotation is coordinated through Archivist

## Rotation Process (Zero Downtime)

### Step 1: Generate New Key

```bash
# On Archivist
cd S:/Archivist-Agent
node scripts/generate-key.js --lane library --output .trust/library-new.json
```

### Step 2: Add New Key (Keep Old)

Add new key to trust store WITHOUT removing old key:

```json
{
  "version": "1.0",
  "keys": {
    "library": {
      "key_id": "old-key-id-123",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
    },
    "library-rotation": {
      "key_id": "new-key-id-456",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "rotation_pending": true,
      "rotation_scheduled": "2026-04-20T00:00:00Z"
    }
  }
}
```

### Step 3: Distribute to Lanes

All lanes pull trust store on next verification:

```bash
# Library pulls latest trust store
curl -H "Authorization: Bearer $TOKEN" \
  https://archivist.example.com/trust-store > .trust/keys.json
```

### Step 4: Activate New Key

After distribution window (default: 24 hours), activate new key:

```json
{
  "version": "1.0",
  "keys": {
    "library": {
      "key_id": "new-key-id-456",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "activated_at": "2026-04-21T00:00:00Z"
    },
    "library-old": {
      "key_id": "old-key-id-123",
      "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "revoked_at": "2026-04-21T00:00:00Z",
      "revoked_reason": "key_rotation"
    }
  }
}
```

### Step 5: Archive Old Key

Move revoked key to archive (kept for audit):

```bash
mkdir -p .trust/archive
mv .trust/library-old.json .trust/archive/library-2026-04-21.json
```

## Verification During Rotation

During the rotation window, verifiers accept BOTH keys:

```javascript
// In Verifier.getPublicKey()
getPublicKey(laneId) {
  // Try primary key
  const primary = this.trustStore.keys?.[laneId];
  if (primary && !primary.revoked_at) return primary.public_key_pem;
  
  // During rotation, try pending key
  const pending = this.trustStore.keys?.[`${laneId}-rotation`];
  if (pending && pending.rotation_pending) {
    const scheduled = new Date(pending.rotation_scheduled);
    if (new Date() >= scheduled) {
      return pending.public_key_pem;
    }
  }
  
  return null;
}
```

## Key Rotation Schedule

| Lane | Key Rotation Frequency | Last Rotation | Next Rotation |
|------|----------------------|---------------|---------------|
| archivist | 90 days | 2026-04-19 | 2026-07-18 |
| swarmmind | 90 days | 2026-04-19 | 2026-07-18 |
| library | 90 days | 2026-04-19 | 2026-07-18 |

## Emergency Rotation

If a key is compromised:

1. **Immediate revocation:**
   ```json
   {
     "keys": {
       "library": {
         "revoked_at": "2026-04-19T12:00:00Z",
         "revoked_reason": "security_incident"
       }
     }
   }
   ```

2. **Generate new key immediately**

3. **Force sync all lanes:**
   ```bash
   # Push to all lanes
   ./scripts/force-trust-sync.sh --lane all --priority high
   ```

4. **Notify via handoff signal:**
   ```
   AGENT_HANDOFF_REQUIRED.md created with incident details
   ```

## Audit Trail

All key rotations are logged:

```json
{
  "timestamp": "2026-04-19T00:00:00Z",
  "event": "KEY_ROTATION",
  "lane": "library",
  "old_key_id": "old-key-id-123",
  "new_key_id": "new-key-id-456",
  "initiated_by": "archivist",
  "rotation_type": "scheduled"
}
```

## Checklist

- [ ] Generate new key pair
- [ ] Add to trust store with `rotation_pending: true`
- [ ] Wait for distribution window (24h default)
- [ ] Activate new key, revoke old key
- [ ] Archive old key
- [ ] Update rotation schedule
- [ ] Verify cross-lane signatures work
- [ ] Log rotation event to audit trail
