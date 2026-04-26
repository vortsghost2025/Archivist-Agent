# Local Secret Hardening Plan

**Status:** IN PROGRESS  
**Priority:** P0  
**Owner:** Archivist Lane  
**Last Updated:** 2026-04-25

---

## Objective

Reduce local machine secret exposure and eliminate unsafe key handling patterns.

---

## Findings from Phase 1

Observed local files:
- `.identity/private.pem`
- `.identity/public.pem`
- `.identity/tmp.pem`
- `.identity/test-temp/private.pem`
- `.identity/test-temp/public.pem`

These may be expected for runtime/testing, but current lifecycle is too permissive.

---

## Hardening Actions

## A) Remove Unsafe Temporary Material

- [ ] Delete `.identity/tmp.pem`
- [ ] Delete `.identity/test-temp/*` from active lane paths
- [ ] If test keys needed, regenerate ephemeral keys per test run in temp OS directory

## B) Constrain Runtime Key Storage

- [ ] Keep only active runtime keypair in `.identity/` with strict file ACLs
- [ ] Move long-lived backup key material to encrypted vault (not repo path)
- [ ] Prohibit plaintext key dumps outside controlled runtime path

## C) Add Automated Guardrails

- [ ] Pre-commit secret scanner for key/token patterns
- [ ] CI leak scan on PR and main branch
- [ ] Block commit on positive secret findings

## D) Access Control Baseline (Windows)

- [ ] Restrict `.identity/` access to current operator account
- [ ] Verify inherited permissions are removed where possible
- [ ] Log ACL baseline in evidence file

---

## Verification Checklist

- [ ] No `tmp.pem` or test-temp keys remain in lane `.identity/`
- [ ] Active key path documented and minimal
- [ ] Secret scan runs clean
- [ ] ACL baseline captured

---

## Evidence Outputs

- `docs/ops/evidence/local-secret-hardening-[DATE].txt`
- `docs/ops/evidence/acl-baseline-[DATE].txt`
- `docs/ops/evidence/secret-scan-local-[DATE].txt`
