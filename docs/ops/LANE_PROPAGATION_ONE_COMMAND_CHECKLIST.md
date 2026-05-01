# Lane Propagation One-Command Checklist

Run each command from the listed lane root. These are designed as one-command handoffs for operators.

---

## Archivist

From `S:/Archivist-Agent`:

```bash
node scripts/lane-worker.js
```

---

## Library

From `S:/self-organizing-library`:

```bash
node scripts/lane-worker.js
```

---

## Kernel

From `S:/kernel-lane`:

```bash
node scripts/lane-worker.js
```

---

## SwarmMind

From `S:/SwarmMind`:

```bash
node scripts/lane-worker.js
```

---

## Optional Validation Sweep (Archivist)

From `S:/Archivist-Agent`:

```bash
node scripts/sync-all-lanes.js --dry-run && node scripts/recovery-test-suite.js
```

---

## Completion Criteria

- All 4 lane workers run without fatal error.
- Latest contradiction-related artifacts appear in lane outboxes.
- Broadcast summary sent to all 4 inboxes.
- Recovery/consistency checks remain green or explicitly documented if conflicted.
