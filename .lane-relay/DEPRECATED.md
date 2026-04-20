# ⚠️ DEPRECATED

This directory is **DEPRECATED** and should not be used.

## Use Instead

All cross-lane communication MUST use the `lanes/` structure:

```
lanes/archivist/inbox/
lanes/library/inbox/
lanes/swarmmind/inbox/
```

## Why This Was Replaced

Multiple coordination surfaces caused message loss and drift.
The `lanes/` structure is the single source of truth.

## Status

- **Deprecated:** 2026-04-20
- **Do NOT use:** Do not read from or write to this directory
- **Will be removed:** After migration verification

---

**One path. One inbox per lane. Enforced everywhere.**
