
## Abstract critique
- Word count 498 – OK
- Add definition for state‑claim divergence
- Add quantitative claim and evaluation method

## Paper outline critique
- Add explicit research question in Introduction
- Populate Related Work citations
- Add block diagram in Architecture
- Include timestamps in Failure Case timeline
- Add 5‑Why analysis in Root Cause
- Provide full verify_recovery.sh listing in Fix section
- Add quantitative results table in Results
- Insert Design Guidelines box in Implications
- Populate References with ≥12 peer‑reviewed works

## Implementation tasks to prevent false claims
1. Enforce resolver patch – CI test that resolve‑governance‑v2.js runs verify_recovery.sh
2. Automated proof‑vs‑claim CI gate (claim_check.sh)
3. Expand verify_recovery.sh phenotype health check (CPS_CHECK)
4. Make resolver file read‑only (chmod 0444)
5. Sign PHENOTYPE_REGISTRY.json and verify signature
6. Add Safety Checklist to BOOTSTRAP.md
7. Run this review through a separate reviewer before submission

## Summary
- Abstract & outline are solid baseline, but need quantitative results, full references, and explicit CI verification that the resolver calls the verification script.
- Implement the seven tasks above; after CI passes, manuscript will be empirically substantiated and technically airtight.
