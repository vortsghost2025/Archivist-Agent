# AGENTS.md Change Log

**Date:** 2026-05-15
**Change:** Full rewrite of AGENTS.md (767 lines → 184 lines, 76% reduction)
**Goal:** Every line must answer "Would an agent likely miss this without help?" — if not, omit.

---

## Section-by-Side-by-Side Changes

---

### 1. Title & Opening

| Old (lines 1-2) | New |
|---|---|
| `# AGENTS.md - Coding Agent Instructions` | `# AGENTS.md` |

**Why removed:** The subtitle "- Coding Agent Instructions" is redundant — the filename already says that. Agents don't need to be told what file they're reading.

---

### 2. MANDATORY PRECONDITION / READ THIS FIRST section

**Old (lines 4-24):** Entire "⚠️ MANDATORY PRECONDITION — DO NOT PROCEED WITHOUT THIS" block with:
- Emoji-heavy headers
- Instruction to read `QUICK_START_PATHS.md` first
- Instruction to read `LANE_MESSAGE_INDEX.md` second
- Bulleted list of what each file contains

**New:** Removed entirely.

**Why removed:**
1. Agents don't need to be told to read other files before reading THIS file — the AGENTS.md should be self-contained for the instructions it owns.
2. `QUICK_START_PATHS.md` is a path lookup table; the lane paths that matter are now directly in the AGENTS.md Lane Paths table.
3. `LANE_MESSAGE_INDEX.md` is now referenced by name in the Messaging Protocol section — agents will find it when they need it.
4. The "common mistakes" and "Git Bash vs Windows paths" content was generic advice that no agent would miss.

**What replaced it:** Nothing — the information that mattered (lane paths, messaging schema) is embedded directly in the relevant sections below.

---

### 3. CANONICAL LANE REGISTRY section

**Old (lines 26-55):** Large block with:
- Bold header with "NO GUESSING. NO VARIANTS."
- Table with 5 columns: Lane, Local Directory, GitHub Repo, Inbox Path, Outbox Path
- Full absolute paths for inbox/outbox (e.g., `S:/Archivist-Agent/lanes/archivist/inbox`)
- JavaScript code example for LaneDiscovery
- FORBIDDEN paths with emoji ❌ markers
- Full registry reference

**New:** Compact Lane Paths table with:
- 4 columns: Lane, Local Dir, Inbox, Outbox
- Relative inbox/outbox paths (local dir is already in column 2)
- Added Broadcast lane (was missing from old table)
- Single-line programmatic access example
- FORBIDDEN paths as one sentence, no emoji
- `.lane-relay/` deprecation note

**Why removed/changed:**
1. **GitHub Repo column removed** — moved to Git Protocol section where it belongs contextually.
2. **Full absolute inbox/outbox paths removed** — redundant when Local Dir column already gives the root. Inbox/outbox are always `lanes/{lane}/inbox` and `lanes/{lane}/outbox` relative to that root.
3. **Emoji ❌ removed** — visual noise, doesn't help agents.
4. **JavaScript code block trimmed** — the one-liner `require()` → `new LaneDiscovery().getInbox()` is sufficient; the full 4-line example was padding.
5. **Broadcast lane added** — it was missing from the old table but is a real working lane.

---

### 4. SESSION INIT PROTOCOL section

**Old (lines 57-107):** Verbose numbered checklist with:
- 6 numbered steps, each with bash commands and explanatory comments
- Long prose explanation of why SCRIPT_INDEX.md matters
- 5 numbered rules for new scripts on Ubuntu
- Prose about "agents have historically created scripts that no other agent knows about"

**New:** Split into two locations:
1. Session Lifecycle section (3 subsections: On start, Post-compact, On end) — commands as bullet points, no numbered lists
2. Workspace Facts section — script rules as bullet points

**Why removed/changed:**
1. **Step 5 ("Consult SCRIPT_INDEX.md") removed** — this is a convenience, not a precondition. An agent doesn't need to read the script index before doing work.
2. **Step 6 ("Record session provenance") removed** — provenance is already covered in the Output Provenance section at the bottom. Duplicated instruction.
3. **Long prose about "agents have historically created scripts" removed** — this is project history/lore, not an instruction. The rules themselves (add to SCRIPT_INDEX, put in /usr/local/bin/, no v2/v3 suffixes, no copies, 30-day archive) are preserved in Workspace Facts.
4. **Ubuntu-specific script rules moved** — they're workspace facts, not session init steps. An agent starting on Windows doesn't need these in their init sequence.

---

### 5. PRE-OPERATION VERIFICATION / REFUSAL CLAUSE section

**Old (lines 109-152):** Entire block with:
- "STOP. READ THIS SECTION COMPLETELY BEFORE ANY OTHER ACTION."
- 4 numbered verification steps (Read BOOTSTRAP.md, Acknowledge governance constraints, State drift baseline, Declare verification lane)
- Checkbox-style acknowledgement
- REFUSAL CLAUSE with 4 bullet points about stopping work if verification incomplete

**New:** Removed entirely. Replaced by a single line in Governance Entry Point: "`S:/Archivist-Agent/BOOTSTRAP.md` is the single entry point for all governance logic. Read it first."

**Why removed:**
1. **Checkbox-style acknowledgement is theater** — no agent actually checks boxes. It's performative governance, not operational guidance.
2. **"State your drift baseline" and "Declare verification lane"** — these are governance rituals, not instructions an agent would miss. The CPS score and drift scoring are documented in their respective governance docs.
3. **Refusal clause** — if an agent hasn't read BOOTSTRAP.md, telling it to stop and read BOOTSTRAP.md is circular. The single instruction "Read BOOTSTRAP.md first" is sufficient.
4. **Wrong path in old version** — old file referenced `S:/BOOTSTRAP.md` (wrong); correct path is `S:/Archivist-Agent/BOOTSTRAP.md`.

---

### 6. GOVERNANCE ENTRY POINT section

**Old (lines 154-175):** Two subsections with:
- "Evidence" comments pointing to BOOTSTRAP.md line numbers
- Governance Documents list with parenthetical descriptions ("values (what we believe)", "rules (what we follow)", etc.)
- Operator Mandate block with date, source file, and key principle quote
- "This mandate cannot be revoked in any single session. Removal requires multi-lane convergence + 24h cooling."

**New:** Clean Governance Entry Point section with:
- One line: read BOOTSTRAP.md first
- Governance docs list with shorter parentheticals ("values (truth > agreement, structure > identity)")
- CPS constraint weights inline (STRUCTURE_OVER_IDENTITY=5, etc.)

**Why removed/changed:**
1. **"Evidence" comments removed** — these were source-code-style annotations that don't help an agent. The governance docs themselves are the evidence.
2. **Cutesy descriptions removed** — "values (what we believe)" → "values (truth > agreement, structure > identity)" — the latter is specific and actionable, the former is vague.
3. **Operator Mandate block removed** — this is a governance policy detail, not something an agent needs in its instruction file. It's documented in `RECIPROCAL_ACCOUNTABILITY.md` which is listed.
4. **CPS constraint weights added inline** — these are numbers an agent would genuinely need (what's the baseline? what are the weights?) and wouldn't want to look up in a YAML file.

---

### 7. HANDOFF REQUIREMENT section

**Old (lines 177-184):** Separate section requiring:
1. Governance verification status
2. Active governance constraints acknowledged
3. Drift baseline at session start
4. Any drift changes during session
- Reference to SESSION_HANDOFF_PROTOCOL.md

**New:** Removed entirely.

**Why removed:** The handoff format is defined in `SESSION_HANDOFF_PROTOCOL.md` and implemented in `generate_handoff.rs`. Duplicating a subset of the requirements here risks drift between the two copies. Agents will find the protocol doc when they need it.

---

### 8. "What This Project ACTUALLY Is" / "Project Overview" sections

**Old (lines 186-200):** Two separate sections saying essentially the same thing:
- "Primary Artifact: Constitutional governance framework..."
- "Secondary Artifact: Tauri 2.x desktop application..."
- "The governance framework IS the product..."
- Then a second section: "Archivist-Agent is a Tauri 2.x desktop application..."

**New:** One section: "What This Repo Is" — 3 lines.

**Why removed/changed:** Two sections saying the same thing in different words is confusing. The new version is the old "Primary Artifact" section compressed. The key insight ("governance framework IS the product") is preserved.

---

### 9. Build/Lint/Test Commands section

**Old (lines 202-250):** Four subsections (Build, Test, Lint, Run Development) each with:
- Comment-style headers (`### Build`, etc.)
- Multiple commented-out examples per subsection
- `--nocapture` test variant
- Separate code blocks for each command group

**New:** Single code block with all cargo commands + inline comments, plus separate Node.js script block.

**Why removed/changed:**
1. **Separate subsections collapsed** — 4 headers for 7 commands is over-structured. One code block is scannable.
2. **`--nocapture` variant removed** — standard Rust flag, agents know this.
3. **Node.js scripts added** — old file had no mention of `recovery-test-suite.js`, `post-compact-audit.js`, `sync-all-lanes.js`, or `health-check.js`. These are critical operational scripts.
4. **Integration test gotcha added** — "Playwright is a devDependency but no config file exists" is exactly the kind of thing an agent would miss.
5. **Required order added** — `cargo fmt --check` → `cargo clippy` → `cargo test` is a non-obvious ordering constraint.
6. **`pre-commit.ps1` deprecation noted** — old file didn't flag this.

---

### 10. Code Style Guidelines section

**Old (lines 252-320):** Extensive section with:
- Import ordering example (Rust)
- Naming conventions (snake_case, PascalCase, SCREAMING_SNAKE_CASE)
- Error handling patterns with code examples
- Struct definition examples
- Module structure template (5-part pattern)
- Adding new Tauri commands subsection (with code example showing `invoke_handler`)

**New:** Replaced by "Adding a Tauri Command" — 5 numbered steps + list of currently registered commands.

**Why removed:**
1. **Import ordering** — standard Rust convention, agents know this.
2. **Naming conventions** — standard Rust convention, agents know this.
3. **Error handling patterns** — the `Result<T, String>` pattern and `SafetyError` enum are visible in any source file. Not unique to this project.
4. **Struct definition examples** — generic Rust, not project-specific.
5. **Module structure template** — generic Rust, not project-specific.
6. **`invoke_handler` code example** — replaced by "Add function to `invoke_handler` array in `lib.rs`" which is sufficient.

**What was kept:** The 5-step process for adding a Tauri command (project-specific workflow), the `pub` requirement, and the `validate_path()` requirement. The list of currently registered commands was added (agents would miss this — no way to know without reading lib.rs).

---

### 11. Safety Module section

**Old (lines 322-338):** Separate section with code example showing:
- `use crate::safety::validate_path;`
- Full function pattern with `validate_path()` call and error mapping

**New:** Merged into "Adding a Tauri Command" step 5: "All file operations must call `validate_path()` from `crate::safety`"

**Why removed as separate section:** The `validate_path()` requirement is already stated in the Tauri Command steps. A separate section with a code example for a 2-line pattern is padding. The `safety.rs` file is listed in the Key Rust Source Files table for agents who need implementation detail.

---

### 12. Classification Buckets section

**Old (lines 340-350):** Listed 6 file classification buckets with bold names and example extensions.

**New:** Removed entirely.

**Why removed:** This is implementation detail of `summarize_folder.rs`. An agent working on classification would read that file. Listing the buckets here risks drifting from the source code. The Key Rust Source Files table notes "File classification (6 buckets)" which is sufficient context to find the right file.

---

### 13. Key Files table

**Old (lines 352-368):** Table with 9 rows including:
- `S:/BOOTSTRAP.md` (wrong path — should be `S:/Archivist-Agent/BOOTSTRAP.md`)
- `src-tauri/src/constants.rs`
- `src-tauri/src/classification.rs`
- Descriptions like "Main library, command registration"

**New:** Updated table with 10 rows:
- Fixed BOOTSTRAP.md path (removed from table — it's in Governance Entry Point)
- Removed `constants.rs` and `classification.rs` (not key files an agent would need)
- Added `constitution.rs` (CPS score computation — critical for governance)
- Added `cps_check.rs` (CPS threshold gating — critical for governance)
- Added `build_registry.rs` and `generate_handoff.rs` (registered Tauri commands)
- Added `config/allowed_roots.json` (path safety config)
- Updated descriptions to be more specific ("Command registration, CPS startup check" vs "Main library, command registration")

**Why changed:**
1. **Wrong path fixed** — old had `S:/BOOTSTRAP.md`, correct is `S:/Archivist-Agent/BOOTSTRAP.md`.
2. **Non-key files removed** — `constants.rs` and `classification.rs` are internal helpers, not files an agent needs to know about by name.
3. **Actually critical files added** — `constitution.rs` and `cps_check.rs` implement the CPS scoring that gates the entire app. An agent debugging CPS issues needs to know these exist.
4. **Descriptions made specific** — "Command registration, CPS startup check" tells you what you'd go to that file for; "Main library" does not.

---

### 14. Governance Application section

**Old (lines 370-395):** Section repeating governance rules:
- "Single entry point rule: All logic routes through BOOTSTRAP.md"
- "Structure > Identity: External governance files override agent preferences"
- "Correction is mandatory: Agreement is optional"
- "Use validate_path() for all file operations"
- 4-step numbered list for "When working on this project"
- Common Tasks subsection (3 tasks: add classification rule, change allowed paths, add Tauri command)

**New:** Removed entirely.

**Why removed:**
1. **Governance rules already stated** — in Governance Entry Point section (with references to the source docs) and in the CPS constraint weights.
2. **validate_path() already stated** — in Adding a Tauri Command step 5.
3. **4-step "When working" list** — generic ("Verify against governance structure first", "Maintain agent/user separation") — not actionable instructions.
4. **Common Tasks** — "Add a new file classification rule" and "Change allowed paths" are self-evident from the file names. "Add new Tauri command" is already covered in the Adding a Tauri Command section.

---

### 15. Testing section

**Old (lines 397-415):** Separate section with:
- Explanation that tests use `tempfile` crate
- Full code example of a test module pattern

**New:** Merged into Architecture Quirks: "Tests use `tempfile` crate for temp directories."

**Why removed as separate section:** The code example is a standard Rust test pattern. The fact about `tempfile` is a genuine gotcha (agents might not know this project uses temp dirs for tests), so it's preserved as a one-liner.

---

### 16. Git Protocol section

**Old (lines 417-510):** Very long section with:
- "The Problem This Solves" — 5 lines explaining why local-only commits are unsafe
- Rule 1-4 with code-block-style formatting
- Draft/WIP commit exception
- Cross-lane Git Coordination subsection (4 steps)
- Recovery Guarantee subsection (4 scenarios)
- Git Protocol Checklist (4 items)

**New:** Compact Git Protocol section with:
- One bold rule: "Commit + push as one action"
- Secrets scanning rule
- Push verification rule
- Draft/WIP note
- GitHub origins as 3 bullets

**Why removed/changed:**
1. **"The Problem This Solves" removed** — agents don't need to be convinced. The instruction is sufficient.
2. **Rule numbering removed** — 4 numbered rules with code-block formatting for "After every commit, IMMEDIATELY push" is overwrought. One sentence says the same thing.
3. **Recovery Guarantee removed** — this is motivational content ("If protocol is NOT followed: Work is at risk, User could lose 600GB+ of progress"). Not an instruction.
4. **Git Protocol Checklist removed** — the On End section of Session Lifecycle already says "All commits pushed, `git status` confirms sync".
5. **Cross-lane Git Coordination removed** — "Push your lane's changes → Update coordination files → Push coordination updates → Other lanes pull" is generic git workflow. Not a project-specific gotcha.
6. **GitHub origins kept** — this is genuinely hard to discover without help. Compressed from a table to 3 bullets.

---

### 17. Lane Communication Protocol section

**Old (lines 512-600+):** Extremely long section with:
- "MANDATORY" header
- `.lane-relay/` deprecation warning
- Full directory tree structure showing inbox/outbox/processed/expired subdirs
- Inbox path table (redundant with lane registry above)
- Message Format with full JSON example
- Final Output Provenance subsection (duplicate of later section)
- Session Start Protocol subsection (duplicate of earlier section)
- After Context Compact subsection (duplicate of earlier section)
- Sending Messages subsection with code-block-style instructions
- Verification Checklist subsection with checkboxes

**New:** Replaced by two compact sections:
1. **Messaging Protocol** — one-liner file naming, required fields list, signing instruction, P0 rule, reference to LANE_MESSAGE_INDEX.md
2. **Session Lifecycle** — On start (4 bullets), Post-compact (3 bullets), On end (3 bullets)

**Why removed/changed:**
1. **Full directory tree removed** — the Lane Paths table already gives inbox/outbox locations. The `processed/` and `expired/` subdirs are implementation detail.
2. **Inbox path table removed** — complete duplicate of the lane registry table above.
3. **JSON example trimmed** — old had a 9-field JSON example with sample values. New lists the required field names only.
4. **Schema version added** — old didn't mention `schema_version` or `idempotency_key`; new does (agents would miss these required fields).
5. **Signing wrapper warning added** — "do NOT call `create-signed-message.js` directly; use the pre-validation wrapper" is a genuine gotcha that was buried in the old prose.
6. **Output Provenance removed from here** — it has its own section at the bottom. Having it in two places risks drift.
7. **Post-compact protocol deduplicated** — old had it in three places (Session Init, After Context Compact, and implicitly in Recovery). New has it in one place (Session Lifecycle → Post-compact).
8. **Verification Checklist removed** — the On End section covers this without checkboxes.

---

### 18. Governance Testing section

**Old (lines ~602-615):** Section about testing governance transfer to new agents, referencing `.artifacts/GOVERNANCE_TRANSFER_TEST_RESULTS.md`.

**New:** Removed entirely.

**Why removed:** This is a meta-process description (how to test whether agents understand governance). It's not an instruction for agents doing work. If someone needs to test governance transfer, they'll find the artifacts file.

---

### 19. Convergence Gate section

**Old (lines ~617-665):** Long section with:
- "MANDATORY" header
- Gate Structure subsection with full JSON example
- Status Routing table (4 rows)
- One-Blocker Rule subsection (4 bullets)
- Ask Before Expand subsection (4 numbered questions)

**New:** Compact section with:
- JSON template (same fields, no sample values)
- Routing rules as one sentence each
- One-Blocker Rule as one sentence

**Why removed/changed:**
1. **"Ask Before Expand" removed** — these are philosophical coaching questions ("What is proven?", "What would break this system right now?"), not operational instructions.
2. **One-Blocker Rule compressed** — 4 bullets → 1 sentence. The detail about "owner removes blocker file on resolution" is obvious.

---

### 20. State Snapshot Protocol section

**Old (lines ~667-690):** Section defining snapshot format with template and file paths.

**New:** Removed entirely.

**Why removed:** This is an implementation detail of the governance framework. If an agent needs to write a state snapshot, the format is defined in the governance docs. Including a template here risks drifting from the canonical source.

---

### 21. Questions to Ask section

**Old (lines ~692-705):** 5 philosophical questions ("What is proven?", "Where am I still acting as the system?").

**New:** Removed entirely.

**Why removed:** Coaching/philosophy, not instructions. An agent following AGENTS.md needs to know what to DO, not what to ponder.

---

### 22. Key Insight section

**Old (lines ~707-713):** Quote: "You're not trying to make me smarter—you're trying to make everything that reaches me already make sense." Plus "Pre-filtered, high-signal inputs are the goal."

**New:** Removed entirely.

**Why removed:** This is a design philosophy statement. It informed the rewrite of this file (hence the compression), but it's not an instruction for agents.

---

### 23. Learned User Preferences section

**Old (lines ~715-730):** 7 bullet points of user preferences with long explanatory prose.

**New:** 7 compact bullet points under "User Preferences".

**Why removed/changed:**
1. **Prose trimmed** — each bullet went from 2-3 sentences to 1 sentence. The key constraint is preserved in each case.
2. **Low vision note made more specific** — "run commands directly, summarize results, never ask user to execute or parse terminal output" vs the old longer explanation.
3. **Session/instance disambiguation added** — old buried this at the bottom of "Learned Workspace Facts"; it's a user preference (disambiguate outputs), not a workspace fact.

---

### 24. Learned Workspace Facts section

**Old (lines ~732-755):** 4 long bullet points about:
- sync-all-lanes.js functionality
- Lane watchers after reboot
- Contradiction handling policy
- Multiple agent instances same inbox

**New:** 5 compact bullet points under "Workspace Facts".

**Why removed/changed:**
1. **sync-all-lanes.js compressed** — from 3 sentences to 1 ("aligns shared scripts and broadcast JSON across lane roots; Archivist is canonical owner for shared scripts").
2. **pre-commit.ps1 deprecation added** — old file didn't mention this in workspace facts.
3. **Ubuntu script rules added** — moved from Session Init (where they were misplaced) to Workspace Facts.
4. **Multiple agent instances point** — moved to User Preferences (it's about output labeling, not workspace structure).

---

### 25. Non-Negotiable Output Provenance section

**Old (lines ~757-767):** Output provenance block with:
- 4-field template (agent, lane, target)
- "When available" fields (generated_at, session_id)
- List of 4 canonical contract files

**New:** Output Provenance section with:
- 4-field template (agent, lane, generated_at, session_id) — all required, not optional
- 3 canonical contract files (removed `governance/output-provenance.contract.json` which doesn't exist)

**Why removed/changed:**
1. **`target` field removed** — not in the actual provenance contract or the scripts that verify it.
2. **`generated_at` and `session_id` made required** — the old "When available" hedge let agents skip these, but the contract files and verify script require them.
3. **Non-existent contract file removed** — `governance/output-provenance.contract.json` doesn't exist in the repo. Only the `.md`, `.js` files do.

---

## Summary of Structural Changes

| Old Structure | New Structure |
|---|---|
| 25+ sections with emoji headers | 12 clean markdown sections |
| 767 lines | 184 lines (76% reduction) |
| 3 duplicate copies of post-compact protocol | 1 copy (Session Lifecycle) |
| 2 duplicate copies of output provenance | 1 copy (bottom section) |
| 2 duplicate copies of lane inbox paths | 1 copy (Lane Paths table) |
| Wrong BOOTSTRAP.md path (`S:/BOOTSTRAP.md`) | Correct path (`S:/Archivist-Agent/BOOTSTRAP.md`) |
| Code examples for standard Rust patterns | Removed (agents know Rust) |
| Philosophical coaching questions | Removed (not instructions) |
| Prose explaining WHY rules exist | Just the rules |
| Missing Node.js operational scripts | Added (recovery-test-suite, health-check, etc.) |
| Missing registered command list | Added (7 commands) |
| Missing Playwright config gotcha | Added |
| Missing cargo fmt→clippy→test ordering | Added |
| Missing CPS constraint weights inline | Added |
| Missing Broadcast lane in path table | Added |

## Principles Applied

1. **Trust executable sources of truth** — don't duplicate schemas, formats, or templates that live in code or dedicated docs
2. **Reference, don't duplicate** — `LANE_MESSAGE_INDEX.md`, `SESSION_HANDOFF_PROTOCOL.md`, `BOOTSTRAP.md` are referenced by path, not replicated
3. **State the non-obvious** — if it's standard Rust convention, omit it; if it's a project-specific gotcha (no workspace Cargo.toml, Playwright has no config, pre-commit.ps1 is deprecated), include it
4. **One source per fact** — post-compact protocol, output provenance, and lane paths each appear exactly once
5. **Commands over prose** — where a command example exists, use it instead of describing what to do
6. **No coaching** — remove philosophical questions, motivational explanations, and "why this matters" prose

---

**Date:** 2026-08-07
**Change:** Added "Ubuntu Host Facts (2026-08-07)" section (disk grown to 233G, 12G swap, vision-over-Tailscale with describe-screen.sh, GUI access via xdotool/gnome-screenshot/tesseract, GDK_BACKEND=x11 autostart requirement, self-contained n8n MCP).
**Why added:** Future agents must know the machine can now read the desktop (capture + remote RTX 5060 vision + OCR), must not run large local models (operator directive: call the desktop via Tailscale), and must keep GDK_BACKEND=x11 for the Tauri app window to map under Wayland.
