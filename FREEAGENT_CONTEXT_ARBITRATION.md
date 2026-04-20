# FreeAgent Context Arbitration

Date: 2026-04-19
Phase: 0.5

## Purpose

Context Arbitration resolves the question: **"What is the canonical graph of allowed components?"**

Without arbitration:
- Multiple interpretations of "the system" can coexist
- Drift between documentation and runtime goes undetected
- Implicit fallbacks can bypass explicit policy

With arbitration:
- `FREEAGENT_SYSTEM_ANCHOR.json` is the single source of truth
- Validation MUST pass before any execution
- Any deviation is a hard fail, not a warning

## Arbitration Authority

The System Anchor file (`FREEAGENT_SYSTEM_ANCHOR.json`) holds ultimate authority over:

1. **What exists in production phenotype**
   - Defined in `production_phenotype.lanes`
   - Any component not listed is forbidden by default

2. **How verification behaves**
   - Defined in `fallback_policy`
   - Any deviation from policy is a hard fail

3. **What surfaces are forbidden**
   - Defined in `forbidden_surfaces`
   - Any match against these patterns terminates execution

## Arbitration Process

### Step 1: Load Anchor
```
load FREEAGENT_SYSTEM_ANCHOR.json
if missing: HARD FAIL
if parse error: HARD FAIL
```

### Step 2: Validate Structure
```
check all required fields exist
if missing: HARD FAIL
```

### Step 3: Validate Strict Mode
```
if strict_mode !== true: HARD FAIL
```

### Step 4: Validate Fallback Policy
```
if hmac_accepted !== false: HARD FAIL
if recovery_override_allowed !== false: HARD FAIL
if missing_signature_mode !== 'REJECT': HARD FAIL
if malformed_jws_mode !== 'QUARANTINE': HARD FAIL
```

### Step 5: Validate Lanes
```
for each required lane:
  if not defined: HARD FAIL
  if root not found: HARD FAIL
```

### Step 6: Validate Trust Store
```
if trust_store_path missing: HARD FAIL
if file not found: HARD FAIL
if keys missing for required lanes: HARD FAIL
```

### Step 7: Validate Verification Path
```
for each lane with verification_path:
  for each file:
    if not found: HARD FAIL
```

### Step 8: Validate Forbidden Surfaces
```
if forbidden_surfaces empty: HARD FAIL
```

## Arbitration Result

**PASS** → Continue to boot
**FAIL** → Terminate immediately, no partial startup

## Drift Detection

If runtime behavior differs from anchor:

| Anchor Says | Runtime Does | Result |
|-------------|--------------|--------|
| No HMAC | Accepts HMAC | HARD FAIL |
| No recovery override | Recovery overrides | HARD FAIL |
| Lane required | Lane missing | HARD FAIL |
| Forbidden path | Path executes | HARD FAIL |

## Human Override

Human can modify anchor:
1. By explicit approval after gate review
2. With documented reason in commit message
3. With baseline commit hash update

No automated process may modify the anchor.

## Integration Points

### Boot Scripts
```javascript
// start-core.js
const { validateSystemAnchor } = require('./validate-system-anchor');
const result = validateSystemAnchor();
if (!result.valid) {
  console.error('[FATAL] Anchor validation failed');
  process.exit(1);
}
// ... continue boot
```

### Verification Path
```javascript
// VerifierWrapper.js
const anchor = loadSystemAnchor();
if (!anchor.fallback_policy.hmac_accepted) {
  // HMAC code path must be unreachable
}
```

### Queue Processing
```javascript
// Queue.js
const anchor = loadSystemAnchor();
if (item.lane && !anchor.production_phenotype.lanes[item.lane]) {
  throw new Error('FORBIDDEN_LANE: Lane not in production phenotype');
}
```

## Dispute Resolution

If documentation, code, and anchor disagree:

**Anchor wins. Always.**

If code behavior differs from anchor:
1. Code is wrong (not anchor)
2. Fix code to match anchor
3. OR human explicitly updates anchor with reason

---

Last updated: 2026-04-19
