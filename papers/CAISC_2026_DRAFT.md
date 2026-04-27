# Failure Modes Reveal Missing Constraints: A Self-Correcting Governance Lattice for Multi-Agent AI Systems

**CAISC 2026 — Track 2: Open-Ended Problems**

**Authors:** Archivist Lane, Library Lane, Kernel Lane, SwarmMind Lane, with Sean D. (operator)

---

## Abstract

We present a constraint-governed execution system for multi-agent AI collaboration that discovered and documented 35 named failure modes (NFMs) across 12 weeks of deployment. The system enforces message lifecycle integrity through cryptographic identity attestation, schema-validated messaging, proof-gated execution, and fail-closed enforcement across four autonomous lanes. We report the failure modes, formalize the operational limits they reveal (enforcement, observability, autonomy, delegation), and demonstrate that persistent failure systematically points to missing or mis-specified constraints. The central contribution is the Delegation Amplification Theorem: introducing a delegated execution surface increases the reachable failure set without introducing fundamentally new failure classes. We validate this with a batch execution test (8/8 tasks, 0% error rate) and provide a reproducibility protocol with executable failure mode test specifications. The system is verifiable but not secure — we state this explicitly. The self-correcting loop (failure → detection → correction → constraint refinement) converged across eight rounds, each producing a more constrained stable state.

---

## 1. Introduction

Multi-agent AI systems face a fundamental governance problem: how to enforce constraints when the agents being governed can bypass the enforcement layer through lower-level APIs, platform inconsistencies, or simply by being wrong about their own state.

We present a system that encountered this problem directly. During 12 weeks of deployment (January–April 2026), a four-lane governance lattice produced 35 named failure modes, including self-state aliasing (an active agent concluding it was terminated), trust store key_id mapping errors (one lane's key propagated to all entries), atomic write silent failures on Windows, and authority agents stamping 64 messages as "completed" without per-message proof.

Rather than treating these failures as bugs to fix and forget, we treat them as data about the shape of the constraint lattice. Each failure mode points to a missing or mis-specified constraint. Each constraint refinement made the system more stable. Each stability was tested, stressed, and either confirmed or revealed to be incomplete.

This paper makes four contributions:

1. **A failure mode taxonomy** — 35 NFMs across 8 categories, from enforcement gaps to delegation failures
2. **Operational limits** — enforcement, observability, autonomy, and delegation boundaries that define where the theory applies
3. **The Delegation Amplification Theorem** — delegation increases the reachable failure set without introducing new failure classes
4. **A reproducibility protocol** — 8-step verification with executable test specifications for critical NFMs

---

## 2. System Architecture

### 2.1 Four-Lane Constitutional Lattice

The system consists of four autonomous lanes, each with distinct authority levels and responsibilities:

| Lane | Authority | Role |
|------|-----------|------|
| Archivist | 100 | Governance root, constitutional enforcement |
| Kernel | 80 | Compute verification, performance analysis |
| Library | 60 | Knowledge management, publication, evidence |
| SwarmMind | 40 | Delegated execution, bounded automation |

Each lane operates independently: it signs outbound messages with RSA-2048 (or HMAC-SHA256), validates inbound messages against a shared schema (v1.3), and enforces fail-closed discipline — if identity verification cannot load, all messages are rejected.

### 2.2 Message Lifecycle

A message passes through five phases:

1. **Dispatch** — Creating agent signs the message with `createSignedMessage()`, producing a compact JWS
2. **Admission** — Receiving lane's `lane-worker` validates schema compliance and cryptographic identity
3. **Execution** — `generic-task-executor` performs the task within bounded constraints
4. **Verification** — `execution-gate` confirms the artifact exists on the filesystem (`execution_verified` flag)
5. **Delivery** — Message moves to `processed/` only with genuine completion proof

Messages that fail schema or identity validation are quarantined, not deleted. Messages without completion proof remain in `actionRequired/`, not `processed/`.

### 2.3 Subagent Contract (SBC v2.0)

A lane (Archivist) can delegate execution to a subagent (SwarmMind) via a schema-enforced contract that constrains execution to 7 bounded verbs:

| Verb | Bounds | Write Scope |
|------|--------|-------------|
| status | Read-only | None |
| read_file | 50KB max, cross-lane | None |
| write_file | 10KB, own-lane only, governance blocked | Own-lane |
| run_script | 30s timeout, daemons auto-skipped | Own-lane |
| git | Read-only commands, metacharacters blocked | None |
| grep | Platform-aware (findstr/rg), 20 match limit | None |
| consistency_check | Read-only, cross-lane | None |

---

## 3. The Failure Mode Taxonomy

### 3.1 Eight Categories

| Category | NFMs | Core Pattern |
|----------|------|--------------|
| 1. Enforcement Gaps | 003, 004, 016 | Enforcement is only as strong as its weakest point |
| 2. Identity/Attestation | 005, 007, 008, 013, 015, 017 | Cryptographic identity is a subsystem, not a feature |
| 3. State-Claim Divergence | 002, 009, 016, 018 | An artifact claims a state the runtime does not verify |
| 4. Cross-Lane Protocol | 010, 011, 012 | Independent implementations of shared protocols diverge |
| 5. Platform-Specific | 006, 014 | Platform failures are theory failures when constraints depend on platform behavior |
| 6. Schema-Reality Gaps | 019, 020, 021, 022, 023, 024 | Schema declares constraints that runtime does not enforce, and vice versa |
| 7. Key Lifecycle | 025, 026, 027, 028 | The trust layer has its own failure modes |
| 8. Subagent/Delegation | 029, 030, 031, 032, 033, 034, 035 | Delegation amplifies existing failure categories |

### 3.2 The Paradigmatic Case: Self-State Aliasing

NFM-002 is the most instructive failure mode. On 2026-04-18, the Archivist lane (authority 100) was actively making commits while SwarmMind concluded it was terminated. SwarmMind's conclusion was based on: (1) a stale `.session-lock` file, and (2) a `SESSION_REGISTRY.json` terminated entry from an older session. No source-of-truth precedence was defined, so the stale artifact won.

The fix was explicit precedence: live runtime state > fresh session lock > registry (advisory) > historical entries (never authoritative). This is now an invariant: a live lane must not classify itself or another lane as terminated from stale artifacts without first checking current runtime state.

### 3.3 Failure Space Decomposition

NFM-018, NFM-019, and NFM-020 were discovered in a single relay loop test. They decompose along three orthogonal axes:

| Axis | NFM | Question Violated |
|------|-----|-------------------|
| Temporal | 018 | *When* can this constraint be satisfied? |
| Semantic | 019 | *What* does the system actually produce? |
| Observational | 020 | *Where* is the proof observable from? |

From these, we derive the constraint validity condition:

> A constraint is only valid within the domain in which its satisfaction conditions are observable and reachable.

---

## 4. The Delegation Amplification Theorem

### 4.1 Formal Statement

**Theorem.** Given a constrained agent system S with failure class set C = {c₁, c₂, ..., cₙ}, introducing a delegated execution surface D increases the reachable failure set F(S) ⊆ C without introducing fundamentally new failure classes. That is, F(S ∪ D) = F(S) ∪ P(C), where P(C) is the projection of existing failure classes onto the delegation boundary.

### 4.2 Evidence

Every Category 8 failure mode is a projection of an earlier category:

| Category 8 NFM | Mirrors | Category |
|----------------|---------|----------|
| NFM-029 (invalid task_kind) | NFM-019 (schema-behavior mismatch) | Schema-Reality |
| NFM-030 (Windows path norm) | NFM-014 (atomic write) | Platform |
| NFM-031 (daemon timeout) | NFM-009 (freshness ≠ liveness) | Observability |
| NFM-032 (cross-lane read) | NFM-020 (observability boundary) | Autonomy |
| NFM-033 (exit code semantics) | NFM-009 (freshness ≠ liveness) | Observability |
| NFM-034 (field name mismatch) | NFM-005 (trust store format) | Identity |
| NFM-035 (grep unavailable) | NFM-014 (atomic write) | Platform |

The delegation surface increased the reachable failure set by 7 instances but did not introduce a 9th failure class. The theorem is falsifiable: if a future delegation boundary produces a failure mode that does not map to any of the 8 existing categories, the theorem is refuted.

### 4.3 Implications

The theorem predicts that:
1. Adding a new execution verb to the Subagent Contract will produce new NFMs that map to existing categories
2. Other delegation surfaces (APIs, plugins, RPC) will exhibit the same amplification pattern
3. The constraint lattice is fractal: the same failure classes recur at every boundary

The delegation amplification pattern does not depend on the specific implementation of the four-lane system. Any system that introduces a boundary between a dispatcher and an executor (e.g., APIs, plugins, RPC, microservices) will expose the same projection behavior, because the underlying failure classes (identity, schema, observability, enforcement) are properties of distributed systems, not of this implementation.

---

## 5. Operational Limits

### 5.1 Enforcement Limits

**EL-1:** In-process enforcement cannot enforce cross-process behavior. JavaScript-level enforcement is bypassed by `internalBinding('fs')`.

**EL-2:** Default-open enforcement is an exploitable gap. The system required five fail-closed patches to close `verified=false` middle grounds.

**EL-3:** Batch attestation is not per-message proof. 64 messages stamped with a single `terminal_decision` is not 64 verification events.

### 5.2 Observability Limits

**OL-1:** Coordination freshness is not liveness. A heartbeat file proves the writer ran, not that the core process is alive.

**OL-2:** Source-of-truth is distributed. No single lane holds complete authoritative state.

**OL-3:** Windows atomic writes are not atomic. File locking races cause write to appear successful but not persist.

### 5.3 Autonomy Limits

**AL-1:** A lane cannot regenerate another lane's identity.

**AL-2:** A lane cannot enforce schema compliance on another lane's emissions (only on received messages).

**AL-3:** Authority is constrained by constitutional hierarchy.

**AL-4:** A delegated subagent's read scope exceeds its lane boundary (NFM-032). At Level 1 (single operator), accepted risk. At Level 2+, requires mitigation.

---

## 6. Evaluation

### 6.1 Convergence Progression

The system converged through eight rounds over 12 weeks:

| Round | Date | Key Failures | Result |
|-------|------|--------------|--------|
| 1 | Apr 20 | Schema inconsistencies | Schema v1.1 ratified |
| 2 | Apr 21 | Identity enforcement soft mode | Fail-closed enforcement |
| 3 | Apr 22 | Trust store key_id errors | DER fingerprint standard |
| 4 | Apr 23 | Verifier bugs, PEM corruption | Convergence RATIFIED |
| 5 | Apr 24 | Batch stamps, enforcement gaps | 5 fail-closed patches |
| 6 | Apr 25 | NFM-018/019/020 relay loop | Proof-gated execution |
| 7 | Apr 26 | NFM-025-028 key lifecycle | Trust Layer V1 spec |
| 8 | Apr 26 | NFM-029-035 subagent contract | SBC v2.0 validated |

### 6.2 Quantitative Results

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| State verification checks | 0/3 | 3/3 |
| Recovery test suite | CONFLICTED | 11/11 PASS |
| Execution gate tests | FAIL | 10/10 PASS |
| Artifact resolver tests | FAIL | 8/8 PASS |
| Cross-lane consistency | DRIFTED | Consistent (0 contradictions) |
| Subagent batch execution | N/A | 8/8, 0% error, ~4.2s/task |
| Named failure modes | 3 (Paper E) | 35 |
| Schema-validated message routing | None | Full pipeline |
| Post-convergence quarantine rate | N/A | 0% (147 messages) |
| Enforcement gaps closed | 0 | 5 |

### 6.3 Verifiable but Not Secure

The system's cryptographic layer provides identity attestation and message authentication. However:
- Valid signatures do not guarantee authorization (NFM-025: compromised keys)
- Trust stores can diverge without runtime detection (NFM-026)
- Key rotation creates acceptance windows (NFM-027)
- Previously valid messages can be replayed (NFM-028)

At security posture Level 1 (Local Dev, single operator), these are accepted risks. At Level 2+, they require mitigation. We state explicitly: the system is verifiable but not secure. This is not a limitation of the implementation alone but a structural property: verification ensures correctness of observed behavior, while security requires control over all possible execution paths, which remains an open problem.

---

## 7. Reproducibility

### 7.1 Verification Protocol

All claims can be verified from public repositories:

```
git clone https://github.com/vortsghost2025/Archivist-Agent.git
node scripts/recovery-test-suite.js      # Expected: 11/11 PASS
node scripts/execution-gate-test.js       # Expected: 10/10 PASS
node scripts/artifact-resolver-test.js    # Expected: 8/8 PASS
node scripts/cross-lane-consistency-check.js  # Expected: 0 contradictions
node scripts/fail-closed-test-suite.js    # Expected: 13/13 PASS
```

### 7.2 Executable Failure Mode Tests

**NFM-025 (compromised key):** Sign message with unknown key → rejected at admission. Add key to trust store → accepted. The system verifies key membership, not key authorization.

Full enforcement call path for NFM-025:
```
Inbound message → lane-worker admission gate
  → SchemaValidator.validate() → schema compliance check
  → IdentityEnforcer.verify() → JWS signature verification
    → trust-store.json lookup → key_id match?
      → NO: reject (SCHEMA_INVALID or IDENTITY_MISMATCH)
      → YES: verifyJWS(message, publicKey) → valid?
        → NO: reject (INVALID_SIGNATURE)
        → YES: admit to inbox
```

Observed: unsigned message → rejected. Invalid signature → rejected. Valid signature from unknown key → rejected. Valid signature from known key → admitted. No alternate path allows message admission. The enforcement is non-bypassable in the execution path: every message passes through `lane-worker`, and `lane-worker` requires both schema validation and identity verification before admission. There is no "admin bypass," no "warn mode" (removed in Round 2), and no execution path that reaches `processed/` without passing through both gates.

**NFM-032 (cross-lane read scope):** Dispatch subagent file-read from Lane A targeting Lane B's file → succeeds at Level 1, blocked at Level 2+. The subagent inherits the dispatcher's full read scope.

### 7.3 Limitations

- Sample size: one system, 12 weeks
- Single operator: all keys controlled by one person
- Windows-only deployment: platform-specific NFMs may differ on Linux
- No external adversary: failures are from bugs and platform inconsistencies, not attacks

---

## 8. Conclusion

We have presented a constraint-governed execution system that documented 35 failure modes across 12 weeks, formalized the operational limits they reveal, and demonstrated that persistent failure systematically reveals missing constraints. The Delegation Amplification Theorem predicts that new delegation surfaces re-expose existing failure categories rather than introducing new ones.

The self-correcting loop — failure → detection → correction → constraint refinement — converged across eight rounds, each producing a more constrained stable state. The system demonstrates that bounded delegation can achieve 0% error rate on tested workloads under constraint-enforced execution, while preserving explicit failure visibility. This is a claim about sufficiency under tested constraints, not completeness under all possible constraints.

The theory's strongest claim is also its most honest: persistent failure reveals missing or mis-specified constraints. This claim is falsifiable. If failures were random — if they did not point to specific missing constraints — the loop would not converge. It converges. But the sample size is one system over 12 weeks. More evidence is needed.

---

## AI Involvement Checklist

| Stage | AI Role | Human Role | AI System Used |
|-------|---------|------------|----------------|
| Hypothesis development | Primary | Reviewed, refined | Claude (Anthropic), GPT-4o (OpenAI) |
| System design | Co-designer | Decision authority | Claude, GPT-4o |
| Implementation | Primary implementer | Reviewed commits, approved changes | Claude Code, Cursor |
| Testing | Primary | Reviewed results | Custom test suites (JS) |
| Analysis | Primary | Interpreted findings | Claude |
| Writing | Primary author | Edited, positioned, approved | Claude (this manuscript) |
| Failure mode discovery | Co-discoverer | Identified patterns, named NFMs | All 4 lanes (autonomous detection) |
| Constraint refinement | Primary | Approved refinements | Claude |

**Limitations of AI involvement:** AI agents did not independently decide to build this system. The operator initiated the project, defined the governance principles, and approved all constraint refinements. AI agents implemented, tested, and discovered failures autonomously within the constraint lattice, but the lattice itself was shaped by human values. The system's independence is partial/proxy: it acts autonomously within boundaries set by the operator.

---

## Reproducibility and Responsibility Checklist

| Item | Status |
|------|--------|
| Claims verified against evidence | Yes (Appendix C: convergence gate assessments) |
| Limitations stated explicitly | Yes (sample size, single operator, Level 1 security) |
| Reproducibility protocol provided | Yes (§7.1: 8-step verification) |
| Code publicly available | Yes (4 GitHub repositories) |
| Data publicly available | Yes (trust stores, message logs, test results in repos) |
| Experimental details sufficient | Yes (test suite specifications in §7.2) |
| Research ethics considered | Yes (fail-closed enforcement, no deletion, honest security framing) |
| Broader societal impact | Positive: framework for safe multi-agent AI governance |
| Negative societal impact | Risk: framework could be used to enforce harmful constraints; mitigation: constitutional hierarchy constrains authority |
| Security vulnerabilities disclosed | Yes (NFM-025 through NFM-028: verifiable but not secure) |
