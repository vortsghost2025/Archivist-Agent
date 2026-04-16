# NEEDS DECISION

**Last updated:** 2026-04-16
**Purpose:** List items that could not be confidently classified — no fixes, only decisions needed

---

## UNCLASSIFIED DIRECTORIES

### S:\IDEAGAIN

**What is there:** backend.log, backend.tar.gz, .env.example, commit.sh
**Cannot determine:** Is this an active project, a backup, or an archive?
**Decision needed:** Should this be moved to `_ARCHIVED` or kept active?

---

### S:\storytime

**What is there:** .aider.chat.history.md, .aider.conf, .aider.input.history, .gitattributes, .gitignore
**Cannot determine:** Is this an experiment, a backup, or an active project?
**Decision needed:** What is storytime? Should it be archived?

---

### S:\snac-v2

**What is there:** .gitattributes, .gitignore, .pre-commit-config.yaml, 0_4kilo.md
**Cannot determine:** Relationship to `projects\snac-v2-clean` unclear
**Decision needed:** What is snac-v2? How does it relate to projects directory?

---

### S:\projects

**What is there:** `snac-v2-clean` and `workspace` subdirectories
**Cannot determine:** Is this an active project container or a staging area?
**Decision needed:** What is projects/ for? Should contents be moved elsewhere?

---

### S:\vector

**What is there:** Empty or minimal content
**Cannot determine:** Purpose unclear
**Decision needed:** What is vector? Should it be archived or removed?

---

### S:\c

**What is there:** `Users` subdirectory
**Cannot determine:** Is this a redirect, mount point, or Windows artifact?
**Decision needed:** What is c/? Should it be left alone?

---

### S:\s

**What is there:** Empty or minimal content
**Cannot determine:** Purpose unclear
**Decision needed:** What is s/? Should it be archived or removed?

---

### S:\.git_DISABLED_2026-04-08

**What is there:** Disabled git configuration
**Cannot determine:** Why was this disabled? Should it be removed?
**Decision needed:** What happened 2026-04-08? Should this be cleaned up?

---

## OWNERSHIP CONFLICTS

### GLOBAL_GOVERNANCE.md vs S:\.global\

**Conflict:** Universal rules at `S:\GLOBAL_GOVERNANCE.md` but governance docs also exist at `S:\.global\`
**Cannot determine:** Which is canonical? Should .global be merged or archived?
**Decision needed:** Is .global a duplicate, archive, or separate reference?

---

### federation AGENTS.md vs federation content

**Conflict:** Federation has own AGENTS.md but also has FORTRESS content in root files
**Cannot determine:** Is federation fully self-contained or does it still have root dependencies?
**Decision needed:** Review federation AGENTS.md for completeness

---

## DUPLICATE PATTERNS

### SESSION_*.md files

**Pattern:** Session handoff files appear across multiple projects (federation, Archivist-Agent)
**Cannot determine:** Is this intentional Rosetta Stone pattern or accidental duplication?
**Decision needed:** Should SESSION files be consolidated in library index?

---

### AGENTS.md files

**Pattern:** Multiple AGENTS.md files exist (root, .global, Archivist-Agent, federation, TAKE10)
**Cannot determine:** Are all correctly scoped? Any still causing governance bleed?
**Decision needed:** Audit all AGENTS.md files for proper layering

---

## RELATIONSHIP GAPS

### kucoin-margin-bot → Archivist-Agent

**Gap:** Trading bot has extensive documentation but unclear relationship to registry
**Cannot determine:** Should kucoin-margin-bot be indexed? Does it reference global governance?
**Decision needed:** Create AGENTS.md for kucoin-margin-bot? What scope?

---

### TAKE10 → SwarmMind

**Gap:** OneQueue (TAKE10) has own governance but unclear relationship to core system
**Cannot determine:** Is TAKE10 an integration target for SwarmMind or separate?
**Decision needed:** Define relationship between TAKE10 and SwarmMind

---

### storytime → (all)

**Gap:** Cannot determine any relationships for storytime
**Cannot determine:** Is this an experiment, prototype, or inactive?
**Decision needed:** What is storytime's purpose and relationships?

---

### snac-v2 → projects/snac-v2-clean

**Gap:** Both exist, relationship unclear
**Cannot determine:** Is snac-v2 the original and snac-v2-clean the cleaned version?
**Decision needed:** Which is canonical? Should one be archived?

---

## TOP 5 DECISIONS NEEDED

1. **S:\IDEAGAIN** — Archive or keep active? If archive, move to `_ARCHIVED\backups`
2. **S:\storytime** — Archive or keep active? If archive, move to `_ARCHIVED\backups`
3. **S:\snac-v2 vs S:\projects\snac-v2-clean** — Which is canonical? Archive the other
4. **S:\.global vs S:\GLOBAL_GOVERNANCE.md** — Merge, archive .global, or keep separate?
5. **kucoin-margin-bot AGENTS.md** — Create one? What relationship to registry?

---

## SUMMARY

- **Unclassified directories:** 8
- **Ownership conflicts:** 2
- **Duplicate patterns:** 2
- **Relationship gaps:** 4
- **Top decisions needed:** 5

---

## NOTES

- This file lists ONLY decisions needed — no fixes
- All unknowns require human input before classification
- Do not modify, move, or delete anything based on this file
- Update this file as decisions are made
