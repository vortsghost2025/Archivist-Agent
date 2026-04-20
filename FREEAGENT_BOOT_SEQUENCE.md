# FreeAgent Boot Sequence

Date: 2026-04-19
Phase: 2
Architecture Mode: `lane_single_process`

## Canonical Boot Order

### Step 1: System Anchor Validation

```bash
cd S:/Archivist-Agent
node scripts/validate-system-anchor.js
```

**MUST PASS** before any other steps.

Exit codes:
- 0 = valid, can proceed
- 1 = invalid, must not start

### Step 2: Health Checks

```bash
cd S:/Archivist-Agent
node scripts/health-core.js
```

Validates:
- Trust store exists and has all lanes
- System anchor exists and valid
- Identity files exist (snapshot.jws, private.pem)

Exit codes:
- 0 = healthy
- 1 = missing components

### Step 3: Smoke Tests

```bash
cd S:/Archivist-Agent
node scripts/smoke-core.js
```

Validates:
- Syntax checks on verification path files
- Trust store format valid
- Anchor strict mode enabled
- Identity files present

Exit codes:
- 0 = all tests passed
- 1 = tests failed

### Step 4: Lane Startup (Per-Lane)

#### Library

```bash
cd S:/self-organizing-library
LANE_KEY_PASSPHRASE=<secret> npm run governed-start
```

#### SwarmMind

```bash
cd "S:/SwarmMind Self-Optimizing Multi-Agent AI System"
LANE_KEY_PASSPHRASE=<secret> npm start
```

#### Archivist

```bash
cd S:/Archivist-Agent
node load-context.js
```

**Note:** Archivist hosts trust store, does not require governed-start for basic operation.

---

## One-Command Boot

```bash
cd S:/Archivist-Agent
node scripts/start-core.js
```

This runs:
1. Anchor validation
2. Health checks
3. Smoke tests

Then prints instructions for starting individual lanes.

---

## Identity Signing Requirement

Before lane startup, identity files must be signed:

### Library (Already Signed)

```bash
cd S:/self-organizing-library/.identity
# snapshot.jws exists (generated 2026-04-19)
```

### SwarmMind (Requires Signing)

```bash
cd "S:/SwarmMind Self-Optimizing Multi-Agent AI System/.identity"
LANE_KEY_PASSPHRASE=<secret> node sign-snapshot.js
```

**Note:** SwarmMind identity snapshot exists but requires passphrase to sign.

---

## Failure Handling

### Anchor Validation Failure

- **Action:** DO NOT START
- **Resolution:** Fix anchor file or runtime configuration
- **Rollback:** Reset to last known good anchor

### Health Check Failure

- **Action:** STOP, do not proceed to smoke tests
- **Resolution:** Missing files must be restored or generated
- **Rollback:** Check git status, restore from last commit

### Smoke Test Failure

- **Action:** STOP, syntax errors detected
- **Resolution:** Fix syntax errors before proceeding
- **Rollback:** `git checkout -- <file>` to restore

### Lane Startup Failure

- **Action:** Lane cannot start
- **Resolution:** Check LANE_KEY_PASSPHRASE is set
- **Rollback:** Verify passphrase matches key

---

## Environment Variables Required

| Lane | Variable | Purpose |
|------|----------|---------|
| Library | `LANE_KEY_PASSPHRASE` | Decrypt private key |
| SwarmMind | `LANE_KEY_PASSPHRASE` | Decrypt private key |
| Archivist | (none) | Trust store host |

---

## Startup Sequence Diagram

```
start-core.js
    │
    ├─→ validate-system-anchor.js
    │       │
    │       └─→ PASS → continue
    │           FAIL → exit(1)
    │
    ├─→ health-core.js
    │       │
    │       └─→ PASS → continue
    │           FAIL → exit(2)
    │
    └─→ smoke-core.js
            │
            └─→ PASS → print instructions
                FAIL → exit(3)
```

---

Last updated: 2026-04-19
