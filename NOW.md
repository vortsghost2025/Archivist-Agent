# NOW.md — Superseded

**This static file is no longer displayed.** The Governance tab
now reads `read_governance_file("now-md")`, which generates the
content dynamically from live machine state.

## What happened

`governance.rs::generate_now_md()` now synthesizes NOW.md from:
- `lanes/broadcast/active-mode.json` — current mode
- `lanes/broadcast/active-blocker.json` — blockers
- `lanes/broadcast/last-recovery.json` — recovery verdict (optional)
- `git rev-parse HEAD` + `git status --short` — commit + working tree
- `.now-strategy.json` — human-authored strategy sections (optional)

## Why

The static file went stale. Dynamic generation means every time
you open the Governance tab, NOW.md reflects the actual current
state — no manual updates, never out of sync.

## Keeping this file

This file remains on disk so git-aware tools and scripts that
reference `NOW.md` by path don't break. It is not read by the UI.
