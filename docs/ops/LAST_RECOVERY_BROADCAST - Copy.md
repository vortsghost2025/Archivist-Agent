# Last recovery broadcast (`lanes/broadcast/last-recovery.json`)

## Purpose

Recovery verification produces **two** artifacts:

1. **`.compact-audit/RECOVERY_TEST_RESULTS.json`** — full per-test results (authoritative for debugging).
2. **`lanes/broadcast/last-recovery.json`** — **cross-lane summary** written every time you run:

   ```bash
   node scripts/recovery-test-suite.js
   ```

Mailboxes and chat provide *intent*; this file is the **shared “state as of timestamp T”** so dashboards, Library site tools, and other agents do not show **stale** liveness (e.g. `1/4` after you already fixed heartbeats and re-ran the suite elsewhere).

## When it is written

- **Every** suite completion — verdict **`PROVEN`** or **`CONFLICTED`**.
- Rationale: if we only wrote on `PROVEN`, a failed run would leave an old `PROVEN` on disk and mislead readers. The file always reflects the **latest** run.

## Schema (v1.0)

| Field | Meaning |
|--------|--------|
| `schema_version` | `"1.0"` |
| `artifact` | `"last-recovery"` |
| `timestamp` | ISO-8601 when the suite finished |
| `suite` | e.g. `recovery-verification-v1` |
| `verdict` | **`PROVEN`** — all tests passed; **`CONFLICTED`** — do not treat as safe recovery |
| `summary` | `{ passed, total, all_passed }` |
| `claim` | Human-readable one-line claim |
| `evidence.relative` / `evidence.absolute` | Path to the full JSON report |
| `lane_heartbeats` | Per-lane heartbeat status from the same probe the suite uses (`alive` / `stale` / `no_heartbeat` / `error`) |
| `lane_liveness` | `{ alive_count, expected: 4 }` |
| `run_by` | `scripts/recovery-test-suite.js` |
| `archivist_repo_git_sha` | `git rev-parse HEAD` in Archivist-Agent when available, else `null` |

## Who should read it

- **Library / site / “Deliberate Ensemble”** — prefer this file (or a copy synced to the repo the site builds from) for **“are we green?”** banners instead of cached session memory.
- **Any lane** — after compact/crash, if you need one number: open **`verdict`** and **`lane_heartbeats`**.

## Propagating to all repos

`lanes/broadcast/` is **shared** across the four lane roots. The recovery suite **writes** in **Archivist-Agent** only. To align **Kernel, SwarmMind, Library** copies of broadcast JSON (including this file):

```bash
node scripts/sync-all-lanes.js
```

(Use `--dry-run` first if you want a preview.)

Until sync runs, other repos may have an **older** `last-recovery.json` than Archivist. Treat **Archivist-Agent** as canonical **immediately after** a recovery run; after **sync-all-lanes**, all four match.

## Operational habit

1. Fix heartbeats / state as needed.
2. `node scripts/recovery-test-suite.js` → expect **11/11** and **`verdict: PROVEN`** in `last-recovery.json`.
3. Optional: `node scripts/sync-all-lanes.js` so every lane’s `lanes/broadcast/last-recovery.json` is current.
4. Point dashboards at **`last-recovery.json`** (or the synced path in that repo) — not at an old agent summary.

## Related

- [AGENTS.md](../../AGENTS.md) — lane paths and protocol.
- `scripts/post-compact-audit.js` — heartbeat and contradiction logic used by the suite.
