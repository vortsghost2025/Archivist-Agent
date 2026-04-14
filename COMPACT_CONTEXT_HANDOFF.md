# Compact Context Handoff Protocol

## Before Running /compact

### 1. Identify Critical Context
Ask yourself: "What from early conversation do I need to preserve?"

### 2. Save to Governance Files
Move important context to these locations:
- **Decisions:** S:/.global/SESSION_HANDOFF_YYYY-MM-DD.md
- **Code patterns:** S:/Archivist-Agent/SYSTEM_INVENTORY_GAPS.md
- **Issues found:** S:/.global/cps_log.jsonl
- **Architecture:** S:/.global/ARCHITECTURE.md

### 3. Create Session Handoff
```markdown
# SESSION_HANDOFF_[DATE].md

## What Was Built
[Key accomplishments from early conversation]

## Critical Decisions
[Important choices made]

## Pending Work
[What's waiting]

## Context to Reload
[Files/concepts to re-read after compact]
```

### 4. Run /compact

### 5. After Compact - Restore Context
```
Read S:/.global/BOOTSTRAP.md
Read S:/.global/SESSION_HANDOFF_[DATE].md
Read S:/Archivist-Agent/SYSTEM_INVENTORY_GAPS.md
Check S:/.global/cps_log.jsonl for baseline
```

## What Gets Compressed

| Kept | Lost |
|------|------|
| Last 50-100 exchanges | Early conversation details |
| System prompts | Long file contents read early |
| Current directory state | Intermediate reasoning steps |
| Recent code changes | Historical context |

## Best Practice

Before compact, ask the agent:
"What context would you lose that you need to preserve?"

Then save that to governance files.

## Today's Critical Context (2026-04-14)

### What We Built This Session:
1. User Drift Scoring System (UDS) - unified from 3 AI perspectives
2. System inventory - identified all gaps
3. MCP server configuration - 5 servers active
4. archivist-governance skill - installed and active
5. Project config (kilo.json) - governance-aware

### Critical Decisions Made:
1. Keep GLM5 via NVIDIA (me) as primary
2. Local Ollama as backup/parallel processing
3. Supabase MCP for governance logging
4. Fork and continue - no new sessions ever

### Pending Work:
1. Production bundles (waiting)
2. Bundle integration when available
3. Test governance enforcement on next session

### Context to Reload After Compact:
- S:/.global/BOOTSTRAP.md (entry point)
- S:/.global/USER_DRIFT_SCORING.md (UDS spec)
- S:/Archivist-Agent/SYSTEM_INVENTORY_GAPS.md (what we have)
- S:/.global/cps_log.jsonl (drift baseline)
