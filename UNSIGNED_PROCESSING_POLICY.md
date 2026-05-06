# UNSIGNED_PROCESSING_POLICY.md

**Ratified:** 2026-05-05
**Ratified by:** Archivist lane (operator confirmation)
**Status:** Active

## Decision

**No unsigned processing authorization.** All lane messages MUST be signed (JWS RS256).

## Rationale

1. All 4 lanes now have working RSA-2048 key pairs on both Windows and Ubuntu
2. The Library passphrase loss was resolved by generating a fresh key pair
3. There is no operational scenario where unsigned messages are necessary
4. The existing quarantine/blocked routing for unsigned messages remains the correct behavior

## Historical Context

During the key divergence period (2026-04-22 to 2026-05-05), some messages were created
without signatures because:
- Library passphrase was lost
- SwarmMind keys diverged between platforms
- Kernel had no local keys on Windows

This created 3 unsigned draft messages in `.tmp/` which have been deleted.
All future messages MUST be signed using `create-signed-message.js` or `sign-outbox-message.js`.

## Enforcement

- Unsigned messages → `lanes/{target}/inbox/quarantine/`
- No exceptions, no temporary bypass
- If a lane cannot sign, it MUST resolve its key issue before sending messages
