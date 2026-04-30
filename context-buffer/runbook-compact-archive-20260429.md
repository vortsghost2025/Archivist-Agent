# Compact Archive Runbook

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-29T17:48:00Z
session_id: unknown

## Purpose
Optionally archive graph snapshot packs during compact and record checksum evidence in compact audit outputs.

## Enable
In PowerShell, before running compact:

```powershell
$env:COMPACT_ARCHIVE = "true" node S:\Archivist-Agent\scripts\run-compact-with-audit.js
```

## What is produced
- Archive zip in `S:\Archivist-Agent\context-buffer\extra-archive-<timestamp>.zip`
- Manifest in `S:\Archivist-Agent\.compact-audit\extra-archive.json`
  - `extra_archive_path`
  - `extra_archive_sha256`
  - `extra_archive_timestamp`

## Verification
1. Check manifest exists:
   - `S:\Archivist-Agent\.compact-audit\extra-archive.json`
2. Check `POST_COMPACT_AUDIT.json` has top-level `extra_archive`.
3. Recompute hash if needed:

```powershell
$m = Get-Content "S:\Archivist-Agent\.compact-audit\extra-archive.json" | ConvertFrom-Json
Get-FileHash $m.extra_archive_path -Algorithm SHA256
```

## Safety Notes
- Read-only relative to lane messages/inboxes.
- No commits/pushes are performed by this workflow.
- Archive is supplementary; tracked source continuity still comes from Git + compact audit hashes.
