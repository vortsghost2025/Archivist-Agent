# Trust & Identity Hardening Layer — V1 Spec

**Status:** DRAFT
**Date:** 2026-04-26
**Source:** Architecture review (april25.txt context buffer)
**NFM References:** NFM-025, NFM-026, NFM-027, NFM-028

---

## The Problem

Our system has strong enforcement at the message layer but weak enforcement at the key lifecycle layer. Currently:

- Trust = `.identity/*.pem` files on disk
- Enforcement = signature validity check
- **A compromised key produces a valid signed message = system bypass**

We built a **verifiable** system, not a **secure** system. Verification ≠ security.

We can:
- Prove what happened
- Detect invalid behavior

We cannot fully:
- Prevent maliciously valid behavior (signed with a stolen key)

---

## Current Maturity

| Layer | Status |
|-------|--------|
| Message validation | Strong |
| Schema enforcement | Strong |
| Evidence verification | Strong |
| Failure mode awareness | Strong |
| Key management | **Weak** |
| Environment isolation | Partial |
| Trust revocation | **Missing** |

---

## New Failure Modes

### NFM-025: Signature Validity Under Compromised Key

**Description:** A valid cryptographic signature does not guarantee the message was authorized by the lane owner. If a private key is compromised (leaked via git, stolen from disk, extracted from memory), any attacker can produce messages that pass every gate in our pipeline.

**Severity:** Critical
**Status:** ACTIVE RISK — no mitigation in place
**Evidence:** Private keys existed in git history (commit 196785b removed them). Key material on local disk with no access controls beyond OS file permissions.

### NFM-026: Trust Store Divergence Across Lanes

**Description:** Each lane maintains its own copy of `lanes/broadcast/trust-store.json`. If one lane's copy is modified (accidentally or maliciously), it will accept/reject different messages than the other lanes. There is no automated consistency check across lanes beyond the heartbeat system (which only checks local state).

**Severity:** High
**Status:** Partially mitigated — trust stores are currently synchronized via manual git push/pull, but there is no cross-lane hash verification at runtime.

### NFM-027: Key Rotation Race Condition

**Description:** During a key rotation, there is a window where some lanes have the new key and others still have the old key. Messages signed with the old key will be rejected by lanes that have already updated, and messages signed with the new key will be rejected by lanes that haven't updated yet.

**Severity:** Medium
**Status:** Not yet encountered — no key rotation has been performed since initial registration.

### NFM-028: Stale Signature Replay Attack

**Description:** A previously valid signed message can be re-delivered to a lane's inbox (e.g., by copying an old JSON file). If the message's timestamp is not checked against a freshness window, stale messages could be re-processed, causing duplicate execution of already-completed tasks.

**Severity:** Medium
**Status:** Partially mitigated — `idempotency_key` prevents duplicate processing, but there is no mandatory timestamp freshness check in lane-worker.

---

## Hardening Spec

### Phase 1: Key Hygiene (Immediate)

- [x] Remove private keys from git history (done: commit 196785b)
- [ ] Add `.identity/` to `.gitignore` in all 4 repos
- [ ] Verify no PEM content exists in any commit reachable from HEAD
- [ ] Set file permissions on `.identity/private.pem` (owner-only read)

### Phase 2: Trust Epochs

**Concept:** Every trust store update creates a new "epoch." Messages signed under a revoked epoch are rejected even if the signature is cryptographically valid.

**Implementation:**

```json
{
  "epoch": 2,
  "effective_at": "2026-04-26T00:00:00Z",
  "lanes": {
    "archivist": { "key_id": "ee70b78105bc6189", "status": "active" },
    "kernel": { "key_id": "b677eb87f6be83f9", "status": "active" },
    "library": { "key_id": "ea2a75bab220adc2", "status": "active" },
    "swarmmind": { "key_id": "addb0afb8ee5c2ed", "status": "active" }
  },
  "revoked_epochs": [1],
  "epoch_signature": "<signed by authority key>"
}
```

**Rules:**
1. Messages must include `epoch` field matching the current trust store epoch
2. Messages signed under a revoked epoch are rejected regardless of signature validity
3. Epoch transitions require signed broadcast from Authority
4. All lanes must acknowledge epoch change before it takes effect

### Phase 3: Key Rotation Protocol

**Rules:**
1. Rotation is initiated by Authority (Archivist authority sub-lane)
2. New key is generated and registered in a **pending** state
3. Broadcast message announces rotation with effective timestamp
4. Each lane must acknowledge by signing a message with BOTH old and new keys
5. After all 4 lanes acknowledge, epoch increments and old key is revoked
6. Grace period: 1 hour where both old and new signatures are accepted
7. After grace period, old key signatures are rejected

### Phase 4: Compromise Detection

**Rules:**
1. If any lane detects a message that is cryptographically valid but behaviorally anomalous (e.g., self-contradicting claims, impossible timestamps, tasks outside the lane's scope), it flags the message as `provenance_suspect`
2. A `provenance_suspect` flag triggers an immediate trust store verification across all lanes (cross-lane hash comparison)
3. If trust stores diverge, system state degrades to `compromised` — all message processing halts
4. Recovery requires 3-lane convergence (3 out of 4 lanes must agree on the correct trust store state)

### Phase 5: Trust Degradation Integration

**Tie into existing governance:**

Currently: `drift > 20% → freeze`
Add: `trust_uncertainty > threshold → system_state = degraded`

**Threshold calculation:**
- 1 lane with divergent trust store = degraded
- 1 key with unknown revocation status = degraded
- Any `provenance_suspect` message accepted = degraded
- Recovery requires epoch confirmation from all 4 lanes

---

## Identity as a First-Class Lane (Future)

The april25.txt review suggests a dedicated Identity Lane (Authority ~95). This is architecturally sound but premature — the Authority sub-lane within Archivist can serve this role for now. A separate Identity lane should be considered when:

1. Key rotation happens more than once per quarter
2. Lanes operate across different machines/networks
3. External agents (outside the 4-lane system) need credential access

**Current decision:** Authority sub-lane handles identity governance. No new lane yet.

---

## Implementation Priority

| Phase | Effort | Risk Addressed | Priority |
|-------|--------|---------------|----------|
| Phase 1: Key Hygiene | Low | NFM-025 (partial) | P0 |
| Phase 2: Trust Epochs | Medium | NFM-025, NFM-026 | P1 |
| Phase 3: Key Rotation | Medium | NFM-027 | P2 |
| Phase 4: Compromise Detection | High | NFM-025, NFM-026 | P2 |
| Phase 5: Trust Degradation | Low | System integrity | P2 |

---

## Audit Trail

- 2026-04-26: Initial draft from architecture review
- Source context: `S:/self-organizing-library/context-buffer/april25.txt`
- NFM-025 through NFM-028 proposed and documented
