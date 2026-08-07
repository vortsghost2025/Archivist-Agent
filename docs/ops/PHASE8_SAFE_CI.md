# Phase 8: Safe Autonomous CI Replacement

## Problem

The previous `we4free-continuous-improvement.service` was an unsafe housekeeping automation that:
- Ran every ~30 minutes via timer without operator oversight
- Used `git add -A` staging ALL dirty files including runtime artifacts
- Auto-committed with generic messages
- Auto-pushed to the current branch
- Had no circuit breaker or cycle limit
- Resulted in 148+ noise commits pushed to remote main branches

## Solution

`safe-ci-daemon.js` — explicit-invocation only, worktree-isolated, allowlist-based CI daemon.

### Safety Model

| Feature | Implementation |
|---------|---------------|
| **Explicit invocation** | No timer. Must be started manually: `systemctl start we4free-safe-ci.service` |
| **Worktree isolation** | Creates `.worktrees/safe-ci-<timestamp>/` for all operations |
| **Allowlist-based** | Only files matching `ALLOWED_PATTERNS` are processed |
| **Forbidden list** | `.env`, `.pem`, `.key`, runtime artifacts are NEVER touched |
| **Dry-run default** | Commits require `--apply` flag |
| **No auto-push** | Commits stay in worktree. Operator pushes manually after review. |
| **Cycle limit** | `--max-cycles N` (default: 10). Stops after N cycles. |
| **Circuit breaker** | Stops on first error in `--apply` mode |
| **Full provenance** | Every action logged to journal with cycle numbers |

### File: `scripts/phase8/safe-ci-daemon.js`

**Usage:**
```bash
# Dry-run (default) — shows what would be committed
node scripts/phase8/safe-ci-daemon.js --repo /path/to/repo

# Apply mode — commits allowed changes to isolated worktree
node scripts/phase8/safe-ci-daemon.js --repo /path/to/repo --apply --max-cycles 1

# Use existing worktree
node scripts/phase8/safe-ci-daemon.js --repo /path/to/repo --worktree /path/to/.worktrees/safe-ci-xxx --apply
```

**After apply mode:**
```bash
# Review commits
git -C /path/to/.worktrees/safe-ci-xxx log --oneline -10

# Push if satisfied
git -C /path/to/.worktrees/safe-ci-xxx push origin HEAD

# Cleanup worktree
git worktree remove /path/to/.worktrees/safe-ci-xxx
```

### Systemd Service: `we4free-safe-ci.service`

```bash
sudo systemctl start we4free-safe-ci.service
sudo systemctl status we4free-safe-ci.service
journalctl -u we4free-safe-ci.service -f
```

**No timer is configured.** This service must be invoked explicitly.

### Allowed Patterns

- `scripts/*.js`, `scripts/*.ps1`, `scripts/*.sh`
- `.github/workflows/*.yml`
- `src-tauri/src/*.rs`, `src-tauri/Cargo.toml`
- `config/*.json`, `config/*.yaml`, `config/*.yml`
- `docs/*.md`
- Root governance files: `AGENTS.md`, `BOOTSTRAP.md`, `GOVERNANCE.md`, `CONSTITUTION.md`, `README.md`

### Forbidden Patterns (never touched)

- `.env`, `.pem`, `.key`, `.p12`, `.jks`, `.secret`
- `context-buffer/*`
- `lanes/*/metrics/*`
- `lanes/*/state/snapshots/*`
- `lanes/*/state/active-owner.json`
- `lanes/*/state/alerts.log`
- `logs/contradiction-adjudicator.json`

## Status

- **Replaced:** `we4free-continuous-improvement.service` (disabled, unsafe)
- **Replacement:** `we4free-safe-ci.service` (installed, tested dry-run, ready for operator use)
- **Old service remains disabled** until operator validates safe-ci behavior

## Next Steps

1. Operator tests `safe-ci-daemon.js` in dry-run mode on each lane repo
2. Operator reviews worktree commits before pushing
3. After validation, old service can be unmasked/removed
