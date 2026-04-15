# PROJECT REGISTRY
> Tracks all projects managed from Archivist-Agent orchestration center

## Active Projects

_No active projects yet. Projects will be listed here when created._

---

## Project Creation Protocol

### To Create New Project

```
1. Define project scope and name
2. Agent creates: projects/[name]/
3. Agent creates: projects/[name]/.artifacts/
4. Agent creates: projects/[name]/README.md (links to governance)
5. Agent updates this registry
6. Work begins with full governance
```

### Project Template

```
projects/[name]/
├── .artifacts/
│   ├── CURRENT_STATE.md
│   └── SESSION_NOTES.md
├── src/
├── docs/
└── README.md
```

---

## Governance Links

All projects reference:
- Governance: `../../.global/BOOTSTRAP.md`
- Checkpoints: `../../.global/CHECKPOINTS.md`
- User Drift Scoring: `../../.global/USER_DRIFT_SCORING.md`
- Dual Role: `../../.global/GOVERNANCE_DUAL_ROLE.md`

**All projects inherit governance from orchestration center.**

---

## Session Protocol

```
SESSION START:
1. Read ../../.global/BOOTSTRAP.md
2. Read PROJECT_REGISTRY.md
3. Select active project
4. Load project context
5. Work with full governance

PROJECT SWITCH:
1. Checkpoint current project
2. Load new project context
3. Continue with full governance
```

---

## Status Legend

- **ACTIVE**: Currently being worked on
- **PAUSED**: Temporarily stopped, resumable
- **BLOCKED**: Waiting for external dependency
- **COMPLETE**: Finished, archived

---

_Registry initialized. Ready for project creation._
