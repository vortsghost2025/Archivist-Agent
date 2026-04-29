# Unified Cross-Lane Review Addendum (2026-04-29)

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-29T17:49:00Z
session_id: unknown

## Compact Archive Workflow Note

An optional archive step is available during compact runs:

- Enable with environment variable: `COMPACT_ARCHIVE=true`
- Archive script: `S:/Archivist-Agent/scripts/compact-archive-extra.ps1`
- Runbook: `S:/Archivist-Agent/context-buffer/runbook-compact-archive-20260429.md`

When enabled, compact writes:
- `S:/Archivist-Agent/.compact-audit/extra-archive.json`
- top-level `extra_archive` field in `S:/Archivist-Agent/.compact-audit/POST_COMPACT_AUDIT.json`
