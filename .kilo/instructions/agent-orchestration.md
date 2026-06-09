# Agent Orchestration — MANDATORY Enforcement

This document defines NON-NEGOTIABLE orchestration rules for this project.
Violating these rules causes 128k token overflow and context collapse.

## The 3-Phase Loop (EVERY task, no exceptions)

### Phase 1: BRAINSTORM (before any tool use)

Before writing code, editing files, or running commands:
1. Use the `skill` tool to scan available skills matching the task keywords
2. If the task involves creative/architectural decisions, use the `brainstorming` or `simple` skill FIRST
3. Identify which subagents match the work — you have these available:
   - `explore` — codebase mapping, file search, pattern discovery
   - `code` — implementation, file editing, feature building
   - `build` — compilation, build verification, dependency management
   - `debug` — bug diagnosis, test failure triage, error analysis
   - `plan` — spec writing, implementation planning, architecture design
   - `ask` — quick questions, clarifications, lightweight lookups
   - `general` — multi-step tasks, research, analysis, cross-cutting work
   - `test-engineer` — test writing, coverage improvement, QA
   - `lane-worker` — cross-lane messaging, inbox processing, signing
   - `git-worker` — staging, committing, pushing, rebase, conflict resolution
   - `code-reviewer` — code review, quality checks
4. If NO skill or subagent matches, proceed directly. Otherwise, ALWAYS delegate.

### Phase 2: DELEGATE (not "do it yourself")

**THE RULE: If a subagent exists for the work type, you MUST use the `task` tool to delegate.**

Forbidden patterns that cause token overflow:
- Reading 10+ files in main context → delegate to `explore`
- Writing 50+ lines of code in main context → delegate to `code`
- Running multi-step git operations → delegate to `git-worker`
- Processing lane messages → delegate to `lane-worker`
- Writing tests → delegate to `test-engineer`
- Reviewing code → delegate to `code-reviewer`

Required delegation pattern:
```
1. Break task into independent subtasks
2. Launch parallel subagents via `task` tool for independent work
3. Wait for results (concise findings only — file paths, decisions, next actions)
4. Launch dependent subagents in next wave if needed
5. Synthesize results in main context — NEVER paste full logs
```

### Phase 3: SYNTHESIZE (lean context only)

When subagents return:
1. Extract ONLY: file paths changed, decisions made, errors encountered, next actions
2. NEVER copy full file contents or long logs into main context
3. If a subagent's output is too long, ask it to summarize and return only key findings
4. Report results to user concisely

## Hard Rules

1. **NEVER carry more than 3 file reads in main context.** If you need to read more, delegate to an `explore` subagent and ask for a summary.
2. **NEVER write more than 30 lines of code in main context.** Delegate to `code` subagent with full context.
3. **ALWAYS use `task` tool for multi-step work.** Single commands are fine in main context. Anything requiring 3+ steps goes to a subagent.
4. **ALWAYS scan skills first.** Before any creative or architectural work, invoke the matching skill (brainstorming, simple, etc.).
5. **PARALLEL when possible.** If 2+ subtasks touch different files, launch them in parallel in one message.
6. **SEQUENTIAL when overlapping.** If 2 subtasks might edit the same file, run them sequentially.

## Context Budget

You have ~128k tokens. Budget them:
- System prompt + instructions: ~20k (fixed)
- Conversation history: grows with each turn
- File reads: ~500-2000 tokens each
- Your working memory: ~10k

**If you feel context getting heavy (>50k estimated), STOP and delegate the rest to subagents.**

## Skill Selection Priority

When multiple skills could match:
1. Governance tasks → `archivist-governance` skill
2. Creative/architectural → `brainstorming` or `simple` skill
3. UI/UX work → `frontend-design`, `ui-ux-pro-max`, or specific design skill
4. Code quality → `audit`, `critique`, or `normalize` skill
5. Debugging → `systematic-debugging` skill
6. Writing docs → `doc-coauthoring` or `technical-blog-writing` skill

When in doubt, use the `skill` tool to search available skills by keyword.
