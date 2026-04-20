# FREEAGENT System Anchor Schema

Version: 1.0.0
Date: 2026-04-19

## Purpose

The System Anchor file (`FREEAGENT_SYSTEM_ANCHOR.json`) is the single source of truth for:
- What constitutes the production phenotype
- What is forbidden from execution
- How verification must behave
- What fallback modes are allowed

## Schema Definition

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version (semver) |
| `created_at` | ISO8601 | Yes | Anchor creation timestamp |
| `primary_root` | string | Yes | Root directory for all lanes |
| `architecture_mode` | enum | Yes | `lane_single_process` or `distributed_orchestrator_agents` |
| `architecture_description` | string | Yes | Human-readable architecture summary |
| `production_phenotype` | object | Yes | Canonical allowed components |
| `forbidden_surfaces` | array | Yes | Patterns that must not execute |
| `strict_mode` | boolean | Yes | Must be `true` for production |

### Production Phenotype Structure

```
production_phenotype:
  lanes:
    <lane_id>:
      root: string (absolute path)
      role: string (archivist/library/swarmmind)
      components: array of strings
      key_file: string (relative path)
  verification_path: array of strings (file paths)
  trust_store_path: string (absolute path)
```

### Fallback Policy Structure

| Field | Type | Value | Meaning |
|-------|------|-------|---------|
| `hmac_accepted` | boolean | `false` | HMAC signatures rejected |
| `recovery_override_allowed` | boolean | `false` | Recovery cannot override rejection |
| `missing_signature_mode` | enum | `REJECT` | No fallback for unsigned |
| `malformed_jws_mode` | enum | `QUARANTINE` | Structured rejection, no throw |

### Gates Structure

Tracks phase completion:
- `BLOCKED` - Not yet started
- `IN_PROGRESS` - Currently being executed
- `COMPLETE` - Passed gate, locked

## Validation Rules

### 1. Architecture Mode Check

```javascript
if (anchor.architecture_mode === 'lane_single_process') {
  // Expect single-process Node.js per lane
  // Expect file-based trust store
  // Expect no port bindings
}
```

### 2. Forbidden Surface Check

```javascript
for (const pattern of anchor.forbidden_surfaces) {
  if (matchesPattern(executedPath, pattern)) {
    return { valid: false, reason: 'FORBIDDEN_SURFACE', path: executedPath };
  }
}
```

### 3. Strict Mode Enforcement

```javascript
if (!anchor.strict_mode) {
  return { valid: false, reason: 'STRICT_MODE_REQUIRED' };
}
```

### 4. Fallback Policy Check

```javascript
if (anchor.fallback_policy.hmac_accepted !== false) {
  return { valid: false, reason: 'HMAC_FALLBACK_NOT_ALLOWED' };
}
if (anchor.fallback_policy.recovery_override_allowed !== false) {
  return { valid: false, reason: 'RECOVERY_OVERRIDE_NOT_ALLOWED' };
}
```

## Validation Integration

The anchor must be validated:
1. Before any lane starts
2. Before any boot script executes
3. Before any verification path is traversed

```javascript
const anchor = loadSystemAnchor();
const validation = validateSystemAnchor(anchor);
if (!validation.valid) {
  console.error('[FATAL] System anchor validation failed:', validation.reason);
  process.exit(1);
}
```

## Modification Policy

Anchor can only be modified:
1. By explicit human approval
2. After Phase gate completion
3. With baseline commit update

---
Schema version: 1.0.0
