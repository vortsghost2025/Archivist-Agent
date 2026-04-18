# Continuity Specification

## Purpose
This document defines the *expressed phenotype continuity* mechanism that ties together the three system lanes (Archivist‑Agent, SwarmMind, Self‑Organizing‑Library). It records **what** is persisted, **how** it is verified, and **why** it matters for safe reconstruction.

## Components
1. **PHENOTYPE_REGISTRY.json** – A JSON witness listing every library artifact (books, DB schema, HTML assets) together with a deterministic SHA‑256 hash of its contents. The list order is canonical and defined by the librarian.
2. **Constitutional fingerprint** – SHA‑256 over the four core governance files (`BOOTSTRAP.md`, `COVENANT.md`, `GOVERNANCE.md`, `CPS_ENFORCEMENT.md`). Guarantees the structural rule set has not changed.
3. **Continuity fingerprint** – SHA‑256 of the concatenated artifact hashes from `PHENOTYPE_REGISTRY.json`. Represents the *expressed phenotype* of the memory lane.
4. **Lineage metadata** – `parent_session_id`, `origin_handoff`, and `generation_timestamp` stored in `RUNTIME_STATE.json` linking a reconstruction to its predecessor.
5. **Hand‑off document** – A human‑readable markdown (`SESSION_HANDOFF_YYYY‑MM‑DD.md`) that records the two fingerprints and lineage fields for audit.

## Verification Flow
1. **`verify_recovery.sh`** (read‑only) reads the fingerprints from `RUNTIME_STATE.json`, the hand‑off markdown, and recomputes the continuity fingerprint from `PHENOTYPE_REGISTRY.json`.
2. It checks equality of all three values; a mismatch aborts the lane.
3. It ensures lineage fields are non‑null; missing lineage yields `RECONSTRUCTED_UNTRUSTED`.
4. (Future) a phenotype‑health check may run a lightweight CPS/UDS sanity suite.

## Governance Integration
The SwarmMind resolver (`scripts/resolve-governance-v2.js`) now **pre‑executes** `verify_recovery.sh`. If verification fails, the resolver aborts before any mode determination, preventing an untrusted session from assuming governance authority.

## Rationale
- The continuity fingerprint is *expressed phenotype*: it captures the actual content of the memory lane, not just a minimal recovery core.
- Separating structural (constitutional) and content (continuity) fingerprints lets us detect both rule changes and data drift.
- Lineage guarantees an immutable chain of trust across sessions.

## Maintenance
- Whenever a library artifact is added/removed/updated, regenerate `PHENOTYPE_REGISTRY.json` and recompute the continuity fingerprint.
- Update the hand‑off document with the new fingerprints and lineage values.
- Commit and push all changes atomically (Git Protocol Rule 1).
