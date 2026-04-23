# KEY_DERIVATION.md
Key Derivation Standard for Constitutional Governance System

## Overview

All lanes MUST use SHA256(DER encoding of SPKI) for key_id generation.  
This is the **canonical method** — no exceptions, no fallbacks, no lane-specific variations.

---

## Why DER Encoding?

### The Problem with Raw PEM Hashing  
```javascript
// ❌ WRONG - Header-dependent
const keyId = crypto.createHash('sha256').update(publicKeyPem).digest('hex').substring(0, 16);
```

**Issues:**
- Raw PEM includes header/footer: `-----BEGIN PUBLIC KEY-----`
- Whitespace/crlf differences change the hash  
- Different PEM encodings produce different key_ids for the *same key*

### The DER Solution ✅  
```javascript
// ✅ CANONICAL - Header-independent  
const keyObj = crypto.createPublicKey(publicKeyPem);
const der = keyObj.export({ type: 'spki', format: 'der' });
const keyId = crypto.createHash('sha256').update(der).digest('hex').substring(0, 16);
```

**Benefits:**
- DER (Distinguished Encoding Rules) is a binary, headerless format  
- SPKI (Subject Public Key Info) is the raw key material  
- Hash is deterministic regardless of PEM formatting  
- Matches OpenSSH-style fingerprinting  

---

## Canonical Implementation  

### Shared Module: `.global/deriveKeyId.js`  

```javascript
const crypto = require('crypto');

function deriveKeyId(publicKeyPem) {
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const der = keyObj.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').substring(0, 16);
}

module.exports = { deriveKeyId };
```

### Usage in KeyManager.js  

```javascript
// Import canonical function  
const { deriveKeyId } = require('../.global/deriveKeyId.js');

class KeyManager {
  _generateKeyId(publicKey) {
    // ✅ Correct - use shared module  
    return deriveKeyId(publicKey);
  }
}
```

---

## Key ID Format  

- **Algorithm:** SHA256 (256-bit hash)  
- **Length:** 16 hex characters (64 bits displayed)  
- **Encoding:** lowercase hex  
- **Example:** `147c5c2bb7d8941f`  

### Current Canonical Key IDs  

| Lane | Key ID (DER) | Notes |
|------|----------------|-------|
| **archivist** | `147c5c2bb7d8941f` | ✅ Correct |
| **kernel** | `7f1a9fe931d1fbba` | ✅ Correct |
| **library** | `cb3e57dd7818da3d` | ✅ Correct |
| **swarmmind** | `60afaa026a3d969d` | ✅ Correct (NOT `1a7741b8d353abee`) |

⚠️ **Important:** `1a7741b8d353abee` was a *proposed* canonical ID but is NOT the actual DER-derived ID for SwarmMind.  

---

## Verification  

### Script: `.global/verify-key-ids.js`  

```bash
# Check all lanes  
node S:/Archivist-Agent/.global/verify-key-ids.js

# Auto-fix incorrect key_ids  
node S:/Archivist-Agent/.global/verify-key-ids.js --fix
```

### Script: `.global/rebuild-trust-stores.js`  

```bash
# Rebuild all trust stores with correct DER key_ids  
node S:/Archivist-Agent/.global/rebuild-trust-stores.js --commit --push
```

---

## Common Mistakes  

### ❌ Mistake 1: Using raw PEM hash  
```javascript
// WRONG  
return crypto.createHash('sha256').update(publicKey).digest('hex').substring(0, 16);
```

### ❌ Mistake 2: Mixed methods across lanes  
```
Kernel: SHA256(raw PEM)  
Library: SHA256(DER)  
→ ❌ Split identity system!
```

### ❌ Mistake 3: Hardcoding key_ids  
```javascript
// WRONG - key_id must be derived  
const keyId = '1a7741b8d353abee'; // Don't hardcode!
```

### ❌ Mistake 4: Using SHA256(raw PEM) for some lanes  
```
SwarmMind: SHA256(DER) → 60afaa026a3d969d  
Kernel: SHA256(raw PEM) → 7f1a9fe931d1fbba (different!)
→ ❌ Inconsistent!
```

---

## Enforcement  

### Inbox Watcher Mode  

After key derivation is unified, flip enforcement to REJECT:  

```javascript
// inbox-watcher.js  
if (!isValidSignature(message, senderKeyId)) {
  // REJECT mode (not warn)  
  quarantineMessage(message);
  return;
}
```

### Trust Store Validation  

All trust stores must have:  
```json
{
  "lane_id": "example",
  "public_key_pem": "-----BEGIN PUBLIC KEY-----...",
  "algorithm": "RS256",
  "key_id": "<16-char-DER-derived-id>",
  "registered_at": "2026-04-23T00:00:00.000Z"
}
```

---

## Migration Path  

If you find a lane using the wrong method:  

1. **Stop** using raw PEM hash  
2. **Update** `_generateKeyId()` to use `deriveKeyId()`  
3. **Recalculate** key_id: `node verify-key-ids.js --fix`  
4. **Update** `.trust/keys.json`  
5. **Update** `lanes/broadcast/trust-store.json`  
6. **Commit** and push  

---

## Summary  

| Attribute | Value |
|-----------|-------|
| **Method** | SHA256(DER of SPKI) |
| **Module** | `.global/deriveKeyId.js` |
| **Key ID length** | 16 hex chars |
| **Deterministic?** | ✅ Yes (same key = same ID) |
| **Header-independent?** | ✅ Yes (DER has no headers) |
| **Shared across lanes?** | ✅ Yes (all use same module) |

---

**Remember:**  
> "If you're not using `deriveKeyId()`, you're doing it wrong."  

All lanes MUST use the shared `.global/deriveKeyId.js` module.  
No exceptions. No fallbacks. No lane-specific variations.  

**This is a hard invariant of the system.**