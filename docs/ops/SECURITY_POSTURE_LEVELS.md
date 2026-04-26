# Security Posture Levels

**Date:** 2026-04-26
**Purpose:** Gate when to escalate hardening controls. Each level has exact requirements. Don't harden beyond your current level — but don't advance without meeting its controls.

---

## Level 1: Local Dev (Current)

**Threat model:** Only you have access to this machine. Keys are local agent identity keys, not production secrets.

| Control | Required | Current Status |
|---------|----------|----------------|
| Keys not in git HEAD | Yes | Done (196785b) |
| `.identity/` in `.gitignore` | Yes | Partial — not all repos |
| Private key owner-only read | Recommended | Not enforced |
| Trust store sync across lanes | Manual (git push/pull) | Working |
| Key rotation | Not required | Never performed |
| Revocation mechanism | Not required | Not implemented |
| Epoch tracking | Not required | Not implemented |
| Timestamp freshness check | Not required | Not implemented |

**Acceptable risk:** Key exposure requires local machine access. Lane identity keys are test credentials, not production secrets. NFM-025 is documented but acceptable at this level.

**Advancement trigger:** Any lane operates on a different machine, or any non-you entity gets access to the system.

---

## Level 2: Internal Shared

**Threat model:** Multiple people or machines can access the system. Keys could be read by other users on the same machine or network.

| Control | Required | Notes |
|---------|----------|-------|
| All Level 1 controls | Yes | |
| `.identity/` in `.gitignore` (all repos) | Yes | Verify all 4 repos |
| Private key owner-only read (chmod 600) | Yes | On all lanes |
| Trust epoch tracking | Yes | Implement TRUST_LAYER_V1 Phase 2 |
| Cross-lane trust store hash verification at runtime | Yes | Automatic, not manual |
| Key rotation protocol | Yes | At least one rotation performed |
| Revocation broadcast | Yes | Compromised keys can be revoked |
| Message timestamp freshness window | Yes | Reject messages older than 24h |
| NFM-025 mitigation | Yes | Compromised key detection + degraded state |

**Acceptable risk:** Insider threat (someone with machine access) is the boundary. External attackers blocked by network perimeter.

**Advancement trigger:** System exposed to any network, or keys used to authorize actions beyond this machine.

---

## Level 3: External Prod

**Threat model:** System is reachable from the internet. Keys authorize real-world actions. Compromise has real consequences.

| Control | Required | Notes |
|---------|----------|-------|
| All Level 2 controls | Yes | |
| Keys stored in HSM or vault | Yes | Not on filesystem |
| Key rotation enforced (quarterly minimum) | Yes | Automated |
| Full NFM-025 through NFM-028 mitigation | Yes | All implemented |
| Identity as first-class lane or service | Recommended | Authority sub-lane may be sufficient |
| Audit log tamper-evidence | Yes | Append-only, signed |
| Rate limiting on message acceptance | Yes | Prevent replay flooding |
| 3-lane convergence for trust changes | Yes | No single lane can modify trust store |
| Intrusion detection on key usage | Yes | Alert on anomalous signing patterns |
| Encrypted key at rest | Yes | Passphrase-protected PEM or vault |

**Acceptable risk:** Only nation-state-level attackers. System designed to detect and degrade rather than prevent all attacks.

**Advancement trigger:** System controls real resources (money, infrastructure, user data).

---

## Decision Framework

When considering hardening work, ask:

1. **What level am I at?** (Currently: Level 1)
2. **What level do I need?** (Stays Level 1 until multi-machine or multi-user)
3. **Is there a specific threat driving the upgrade?** (Don't harden speculatively)
4. **Do I meet all controls for my current level?** (Check table above)

**Rule:** Don't implement Level 2 controls until you need Level 2. Don't implement Level 3 controls until you need Level 3. But **do** document the gaps (we have — NFM-025 through NFM-028) so the path is clear when escalation is needed.

---

## Current Gaps (Level 1)

- [ ] `.identity/` in `.gitignore` for all 4 repos (2 of 4 done)
- [ ] Verify no PEM content in reachable git history (scanning needed)

Everything else is Level 2+ and can wait.

---

## Escalation Checklist

Before moving from Level 1 to Level 2:

- [ ] Run `git log --all -- '*.pem' '*.key'` on all 4 repos to confirm no key material in history
- [ ] Add `.identity/` to `.gitignore` in all 4 repos
- [ ] Implement trust epochs (TRUST_LAYER_V1 Phase 2)
- [ ] Add cross-lane trust store hash verification to heartbeat
- [ ] Perform one key rotation (proves the protocol works)
- [ ] Add 24h timestamp freshness check to lane-worker

Before moving from Level 2 to Level 3:

- [ ] Move keys from filesystem to vault/HSM
- [ ] Enable encrypted-at-rest keys
- [ ] Implement 3-lane convergence for trust store changes
- [ ] Set up audit log with tamper-evidence
- [ ] Implement rate limiting on inbox acceptance
- [ ] Full NFM-025 through NFM-028 mitigation verified
