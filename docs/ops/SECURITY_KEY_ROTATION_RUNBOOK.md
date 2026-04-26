# Security Key Rotation Runbook

**Status:** OPEN — must be closed with evidence before system is considered secure  
**Priority:** P0 — blocks all other trust claims  
**Owner:** Archivist Lane  
**Last Updated:** [DATE]

---

## Why This Exists

Key material was identified as tracked in git history.
This creates a permanent exposure risk regardless of subsequent .gitignore changes.
Forward safety requires rotation + history remediation.

## Threat Model

| Risk | Severity | Notes |
|------|----------|-------|
| Keys in git history readable by anyone with repo access | CRITICAL | .gitignore does not fix history |
| Keys in forks/clones already pulled | HIGH | Cannot be recalled |
| Signing provenance broken if keys compromised | HIGH | Invalidates past artifacts |

---

## Remediation Steps

### Phase 1: Identify Scope
- [ ] Run `git log --all --full-history -- '*key*' '*secret*' '*.pem' '*.env'`
- [ ] Run `git grep -i 'key\|secret\|token' $(git rev-list --all)`
- [ ] Document: which files, which commits, which key material types
- [ ] Record findings in: `docs/ops/evidence/key-exposure-audit-[DATE].txt`

### Phase 2: Rotate All Exposed Keys
- [ ] Identify every service/system using exposed keys
- [ ] Generate new keys for each
- [ ] Update all systems to use new keys
- [ ] Verify new keys are functional before revoking old
- [ ] Revoke old keys at source (API provider, signing system, etc.)
- [ ] Record rotation timestamps in: `docs/ops/evidence/key-rotation-log-[DATE].txt`

### Phase 3: History Remediation
- [ ] Use `git filter-repo` (preferred) or `BFG Repo Cleaner` to scrub history
  ```bash
  # Example — adapt to actual file paths
  git filter-repo --path secrets/lane_signing.key --invert-paths
  git filter-repo --path .env --invert-paths
  ```
- [ ] Force push cleaned history to all branches
- [ ] Notify all collaborators to re-clone (old clones contain old history)
- [ ] Record cleaned commit range in evidence log

### Phase 4: Forward Prevention
- [ ] Confirm `.gitignore` covers all key patterns
- [ ] Add pre-commit hook or `git-secrets` / `gitleaks` scan
  ```bash
  # gitleaks example
  gitleaks detect --source . --report-path docs/ops/evidence/gitleaks-scan-[DATE].json
  ```
- [ ] Commit hook config to repo
- [ ] Document in CONTRIBUTING.md

---

## Closure Criteria

This runbook is CLOSED when ALL of the following exist:

| Evidence File | Description |
|---------------|-------------|
| `evidence/key-exposure-audit-[DATE].txt` | Scope of what was exposed |
| `evidence/key-rotation-log-[DATE].txt` | What was rotated, when, confirmed working |
| `evidence/history-remediation-log-[DATE].txt` | What was scrubbed, method used |
| `evidence/gitleaks-scan-[DATE].json` | Clean scan on remediated repo |

**Signed off by:** [Archivist Lane operator]  
**Closure date:** [DATE]  
**Status change:** OPEN → CLOSED WITH EVIDENCE
