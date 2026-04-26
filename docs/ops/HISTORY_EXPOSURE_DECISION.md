# History Exposure Decision Record

**Status:** OPEN DECISION  
**Priority:** P0  
**Owner:** Archivist Lane  
**Last Updated:** 2026-04-25

---

## Decision Context

Phase 1 evidence indicates historical key exposure risk. A formal choice is required.

Evidence: `docs/ops/evidence/key-exposure-audit-2026-04-25.txt`

---

## Option A — Accept Historical Risk (Faster)

### Description
Do not rewrite git history. Treat any historically exposed keys as permanently compromised.

### Required Controls
- immediate key rotation/revocation
- trust-store rebuild
- forward leak scanning in CI/pre-commit
- explicit residual-risk acceptance note

### Pros
- avoids history rewrite complexity
- no forced re-clone event for collaborators

### Cons
- leaked material remains permanently in history
- higher long-term trust and compliance burden

---

## Option B — Rewrite History (Safer)

### Description
Use `git filter-repo`/BFG to remove sensitive historical artifacts, then force-push and coordinate re-clones.

### Required Controls
- pre-rewrite backup
- approved scrub path list
- forced remote update
- collaborator re-clone instructions
- post-rewrite leak scan + verification

### Pros
- reduces future accidental exposure surface
- cleaner long-term trust posture

### Cons
- operational disruption
- requires careful communication and sequencing

---

## Recommended Path

**Recommended:** Option B (Rewrite History), unless immediate operational constraints prohibit it.

If Option A is selected, require explicit written risk acceptance with owner/date.

---

## Final Decision

- [ ] Option A selected
- [ ] Option B selected

Decision owner: [NAME]  
Decision date: [DATE]  
Rationale: [TEXT]

---

## Evidence Required After Decision

- `docs/ops/evidence/history-remediation-log-[DATE].txt`
- `docs/ops/evidence/post-remediation-leak-scan-[DATE].txt`
- `docs/ops/evidence/collaborator-migration-notice-[DATE].txt` (Option B only)
