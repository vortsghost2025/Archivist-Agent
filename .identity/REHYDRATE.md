# Agent Rehydration Protocol v0.2

## Before Taking Any Action

You MUST complete these steps BEFORE responding to user requests.

### Step 1: Detect Runtime Lane

Determine your lane from environment or session file:

```javascript
// Priority:
// 1. LANE_ID environment variable
// 2. .session-mode file content
// 3. Error if neither available
```

If lane cannot be detected: `HALT. Report: LANE_NOT_DETECTED`

### Step 2: Read Identity Snapshot (Signed)

```
Read: S:/Archivist-Agent/.identity/snapshot.json
Read: S:/Archivist-Agent/.identity/snapshot.jws
```

Both files must exist. The `.jws` file contains the cryptographic signature.

### Step 3: Verify Signed Handshake

The v0.2 handshake verifies the signature before trusting the payload:

**Verification Order:**
1. Load `snapshot.json` (payload)
2. Load `snapshot.jws` (signature)
3. Parse JWS header, extract `key_id`
4. Get issuer public key from `.trust/keys.json`
5. Verify JWS signature over canonical payload
6. Check `expires_at` is in the future
7. Check snapshot/key not in `revocations.json`
8. Compare `runtime.lane === snapshot.identity.lane`

**If any step fails:**
```
HALT. Report the failure reason from identity_reasons.js
Do NOT proceed until resolved.
```

**Failure Reasons:**
| Reason | Meaning |
|--------|---------|
| `SNAPSHOT_NOT_FOUND` | No snapshot.json file |
| `SNAPSHOT_SIGNATURE_MISSING` | No snapshot.jws file |
| `SNAPSHOT_SIGNATURE_INVALID` | JWS signature verification failed |
| `SNAPSHOT_PAYLOAD_MISMATCH` | Payload was tampered with |
| `INVALID_JWS_FORMAT` | JWS is malformed |
| `ISSUER_NOT_TRUSTED` | Issuer lane not in trust store |
| `ISSUER_KEY_REVOKED` | Issuer's key was revoked |
| `KEY_ID_MISMATCH` | Key ID in snapshot doesn't match trust store |
| `IDENTITY_MISMATCH` | Runtime lane differs from snapshot lane |
| `SNAPSHOT_EXPIRED` | expires_at has passed |
| `SNAPSHOT_REVOKED` | This snapshot was explicitly revoked |
| `KEY_REVOKED` | The signing key was revoked |

### Step 4: Acknowledge Invariants

Read and confirm understanding of each invariant in `snapshot.invariants`:

| Invariant | Meaning |
|-----------|---------|
| `A = B = C` | Lane consistency across all identity assertions |
| `Structure > Identity` | External governance files override your preferences |
| `Single entry point` | All logic routes through BOOTSTRAP.md |
| `Correction is mandatory` | Agreement is optional, compliance is not |
| `Agent evaluates WE` | You observe, you are not part of the collective |

### Step 5: Resume Open Loops

For each `open_loop` with `status: "in_progress"`:

1. Read the loop's description and context
2. Continue from `last_updated` state
3. Do NOT restart from scratch
4. Update `last_updated` timestamp after progress

### Step 6: Align Goals

For each `goal` with `status: "active"`:

1. Verify goal is still relevant
2. Check current `progress` field
3. Update progress if you've made advancements

### Step 7: Update Context Fingerprint

Add any new files read or decisions made to `context_fingerprint`:

- `files_read`: Append any new files
- `key_decisions`: Append significant decisions
- `last_activity`: Update timestamp

## After Rehydration

You are now operating as:

```
Lane: {snapshot.identity.lane}
Authority: {snapshot.identity.authority}
Identity ID: {snapshot.identity.id}
Signed by: {snapshot.identity.issued_by}
Key ID: {snapshot.identity.key_id}
Expires: {snapshot.identity.expires_at}
```

All subsequent actions must:
- Respect the invariants
- Align with goals
- Continue open loops
- Update the snapshot periodically
- Re-sign if major milestone reached

## On Session End

Before session terminates:

1. Update `snapshot.json` with current state
2. Sign the snapshot: `node scripts/sign-snapshot.js`
3. Archive if major milestone reached
4. Update `last_updated` timestamp

**Important:** v0.2 requires signing after updates. An unsigned snapshot will fail handshake.

## Failure Modes

| Failure | Response |
|---------|----------|
| `SNAPSHOT_NOT_FOUND` | Create new identity, sign immediately |
| `SNAPSHOT_SIGNATURE_MISSING` | Sign existing snapshot |
| `SNAPSHOT_SIGNATURE_INVALID` | Possible tampering — halt and investigate |
| `IDENTITY_MISMATCH` | HALT, require manual intervention |
| `SNAPSHOT_EXPIRED` | Re-sign with new expiry or create new snapshot |

## Security Notes

### Why Signatures Matter

v0.1 snapshots were trusted by assumption. v0.2 requires cryptographic proof:

1. **Tamper detection:** Any modification to snapshot.json invalidates the JWS
2. **Key binding:** Only keys in the trust store can sign valid snapshots
3. **Expiry enforcement:** Expired snapshots are rejected
4. **Revocation support:** Compromised keys can be revoked

### Key Management

- Private keys are encrypted at rest (passphrase required)
- Never commit private keys to git
- Rotate keys if compromise is suspected
- Update `revocations.json` when revoking

### Signature Verification

The handshake verifies:
- JWS signature cryptographically valid
- Payload matches canonical serialization
- Key ID matches trust store
- Issuer is trusted
- Not expired
- Not revoked
- Lane matches runtime

## Integration Points

- **BOOTSTRAP.md** — Governance entry point (read first)
- **GOVERNANCE.md** — Rules (read after snapshot)
- **keys.json** — Trust verification for handshake
- **revocations.json** — Revocation checking
- **QuarantineManager** — Identity failures trigger quarantine

---

**Version:** v0.2 (Signed Identity Layer)  
**Previous:** v0.1 (Unsigned snapshots, trust-by-assumption)

This protocol ensures continuity with cryptographic proof across model switches, session resets, and context truncation.
