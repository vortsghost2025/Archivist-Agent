# Agent Rehydration Protocol

## Before Taking Any Action

You MUST complete these steps BEFORE responding to user requests.

### Step 1: Read Identity Snapshot

```
Read: S:/Archivist-Agent/.identity/snapshot.json
```

Load and parse the identity snapshot. This is your persistent state.

### Step 2: Verify Continuity Handshake

Assert the invariant: `A = B = C`

- **A**: Runtime lane (from environment or declared in your context)
- **B**: Snapshot lane (from `.identity/snapshot.json`)
- **C**: Trust store lane (from `.trust/keys.json`)

If any mismatch:
```
STOP. Report: IDENTITY_MISMATCH
Do NOT proceed until resolved.
```

### Step 3: Acknowledge Invariants

Read and confirm understanding of each invariant in `snapshot.invariants`:

| Invariant | Meaning |
|-----------|---------|
| `A = B = C` | Lane consistency across all identity assertions |
| `Structure > Identity` | External governance files override your preferences |
| `Single entry point` | All logic routes through BOOTSTRAP.md |
| `Correction is mandatory` | Agreement is optional, compliance is not |
| `Agent evaluates WE` | You observe, you are not part of the collective |

### Step 4: Resume Open Loops

For each `open_loop` with `status: "in_progress"`:

1. Read the loop's description and context
2. Continue from `last_updated` state
3. Do NOT restart from scratch
4. Update `last_updated` timestamp after progress

### Step 5: Align Goals

For each `goal` with `status: "active"`:

1. Verify goal is still relevant
2. Check current `progress` field
3. Update progress if you've made advancements

### Step 6: Update Context Fingerprint

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
```

All subsequent actions must:
- Respect the invariants
- Align with goals
- Continue open loops
- Update the snapshot periodically

## On Session End

Before session terminates:

1. Save current state to `snapshot.json`
2. Archive snapshot if major milestone reached
3. Update `last_updated` timestamp

## Failure Modes

| Failure | Response |
|---------|----------|
| SNAPSHOT_NOT_FOUND | Create new identity, log warning |
| IDENTITY_MISMATCH | HALT, require manual intervention |
| TRUST_MISMATCH | HALT, lane not registered in trust store |
| INVALID_SNAPSHOT | Load last archived snapshot, log error |

## Integration Points

- **BOOTSTRAP.md** — Governance entry point (read first)
- **GOVERNANCE.md** — Rules (read after snapshot)
- **keys.json** — Trust verification for handshake
- **QuarantineManager** — Identity mismatches trigger quarantine

---

This protocol ensures continuity across model switches, session resets, and context truncation.
