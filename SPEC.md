# Archivist Agent Specification

## Overview
Desktop agent for scanning and classifying folders to reduce visual strain.

## Core Features
1. scan_tree(root, depth) - Enumerate folders without reading contents
2. summarize_folder(path) - Classify folder into Runtime/Interface/Memory/Verification/Research/Unknown

## Classification Buckets
- **Runtime** — Code that executes: agents, servers, processes, orchestration
- **Interface** — UI, desktop shell, cockpit, terminal display
- **Memory** — Logs, docs, transcripts, state files, persistence, indexes
- **Verification** — Tests, reports, metrics, checks, evidence
- **Research** — Theory, papers, concept notes, experiments
- **Unknown** — Cannot determine

## Safety
- Allowed roots only (config/allowed_roots.json)
- Read-only by default
- No auto-deletion
- Approval required for any write actions

## Tech Stack
- Tauri 2.x (Rust backend)
- Vanilla HTML/CSS/JS (frontend)