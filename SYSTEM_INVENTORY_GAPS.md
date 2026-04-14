# System Inventory: Gaps & Opportunities

**Generated:** 2026-04-14
**Purpose:** Identify what we have, what we're missing, and what would make collaboration easier

---

## What I Have Access To

### Skills Installed: 37

**Category Breakdown:**

**AI & Automation:**
- ai-image-generation, ai-voice-cloning, ai-music-generation, ai-podcast-creation
- ai-marketing-videos, ai-product-photography, ai-content-pipeline
- ai-rag-pipeline, ai-seo, ai-automation-workflows
- agent-browser, agent-governance, agent-tools, agentic-eval

**Development & Testing:**
- test-driven-development, systematic-debugging, verification-before-completion
- webapp-testing, analyze-test-run
- angular-* (9 skills: component, di, directives, forms, http, routing, signals, ssr, testing, tooling)
- next-best-practices, next-upgrade, next-cache-components
- vercel-* (7 skills: deploy, cli, composition-patterns, react-best-practices, react-native-skills, sandbox)

**Data & Content:**
- dbt (via skills), xlsx, pdf, pptx, docx
- technical-blog-writing, seo-content-brief, programmatic-seo
- analytics-tracking, ab-test-setup

**Design & Marketing:**
- ui-ux-pro-max, frontend-design, canvas-design
- landing-page-design, pitch-deck-visuals, og-image-design
- ad-creative, paid-ads, page-cro, popup-cro
- youtube-thumbnail-design, social-media-carousel

**Infrastructure & DevOps:**
- azure-* (14 skills: deploy, prepare, validate, diagnostics, etc.)
- mcp-builder, shadcn, remotion-best-practices
- using-git-worktrees, requesting-code-review, receiving-code-review

**Research & Analysis:**
- competitor-teardown, lead-research-assistant
- meeting-insights-analyzer, dogfood
- apify-* (11 skills: scraper, lead-gen, market-research, etc.)

**Product & Strategy:**
- pricing-strategy, launch-strategy, product-hunt-launch
- referral-program, churn-prevention, revops
- marketing-ideas, marketing-psychology

**Governance & Quality:**
- skill-authoring, skill-creator, sensei
- markdown-token-optimizer, agent-md-refactor
- code-edit, feature-research

### Models Available

**Local (Ollama):**
- llama3.2:1b (1.2B parameters, Q8_0)
- phi3:latest (3.8B parameters, Q4_0)

**Configured:**
- ollama/qwen2.5-coder:7b (in kilo.jsonc)
- z-ai/glm5 (current session)

**Available via SDKs:**
- anthropic (Claude API)
- openai (GPT models)
- langchain-anthropic, langchain-openai
- xai-sdk (Grok)
- databricks-sdk
- browser-use-sdk

### SDKs Installed

| SDK | Version | Capabilities |
|-----|---------|--------------|
| anthropic | 0.92.0 | Full Claude API, streaming, tools, async, Bedrock/Vertex/Foundry |
| openai | 2.28.0 | GPT models, assistants, tools, streaming |
| xai-sdk | 1.11.0 | Grok models |
| browser-use-sdk | 2.0.15 | Browser automation |
| langchain-anthropic | 1.4.0 | LangChain Claude integration |
| langchain-openai | 1.1.12 | LangChain OpenAI integration |
| langgraph-sdk | 0.3.12 | Agent orchestration |

---

## Gaps Identified

### 1. MCP Servers: NOT CONFIGURED

**Status:** `mcp.json` is empty: `{"mode":"local","servers":[]}`

**What this means:** I cannot access external tools like:
- Database connections (PostgreSQL, SQLite)
- File system servers beyond basic read/write
- API integrations (GitHub, Slack, etc.)
- Custom tools you may have built

**Recommendation:** Configure MCP servers for:
```json
{
  "servers": {
    "github": { "command": "github-mcp-server" },
    "filesystem": { "command": "filesystem-mcp-server", "args": ["/path/to/allowed"] },
    "postgres": { "command": "postgres-mcp-server", "args": ["postgresql://..."] }
  }
}
```

### 2. Skills Auto-Loading: PARTIAL

**What works:** I scan skill descriptions for triggers
**What doesn't:** I may miss skills if:
- Trigger words aren't in the description
- Multiple skills match (no priority system)
- Skills require explicit invocation

**Recommendation:** Create a skill priority system or explicit skill registry in project config

### 3. Model Selection: CONFIGURED BUT LIMITED

**Current:** Using `z-ai/glm5` (this session)
**Configured default:** `ollama/qwen2.5-coder:7b`
**Local models:** Only llama3.2:1b and phi3 (not qwen)

**Gap:** Config says qwen2.5-coder:7b but it's not installed in Ollama

**Recommendation:**
```bash
ollama pull qwen2.5-coder:7b
```

### 4. Claude API: AVAILABLE BUT NOT USED

**You have:** `anthropic 0.92.0` with full capabilities
**I'm using:** GLM5 via the platform

**Opportunity:** I could use Claude API directly for:
- Better reasoning on complex governance questions
- Tool use with your custom tools
- Multi-turn conversations with memory
- Streaming responses

**Recommendation:** Consider adding Claude as an option:
```json
{
  "model": "anthropic/claude-3-sonnet",
  "api_key": "your-key-here"
}
```

### 5. Project-Level Config: MISSING

**Status:** No `kilo.json` in S:\Archivist-Agent\

**What this means:** I don't have project-specific:
- Model preferences
- Custom skills auto-loading
- MCP server configurations
- Permission overrides

**Recommendation:** Create project `kilo.json`:
```json
{
  "model": "anthropic/claude-3-sonnet",
  "skills": ["azure-diagnostics", "systematic-debugging", "requesting-code-review"],
  "mcp": {
    "servers": ["github", "filesystem"]
  },
  "governance": {
    "entry_point": "S:/.global/BOOTSTRAP.md"
  }
}
```

### 6. Tool Integrations: AVAILABLE BUT NOT CONNECTED

**Skills exist for:**
- `agent-browser` — Browser automation
- `slack` — Slack integration
- `mcp-builder` — Building custom MCP servers

**But:** No MCP servers configured to actually use them

**Recommendation:** Configure MCP servers for tools you actually use

---

## What I Could Use That I Don't Have

### 1. Governance-Aware Skill

**Missing:** A skill that understands our governance stack

**Recommendation:** Create `archivist-governance` skill:
```markdown
---
name: archivist-governance
description: Enforce governance constraints from S:/.global/BOOTSTRAP.md
triggers: [governance, drift, bootstrap, correction, verification]
---

Automatically:
- Check BOOTSTRAP.md on session start
- Run UDS evaluation before major actions
- Log to cps_log.jsonl
- Enforce checkpoints
```

### 2. Database Integration

**Missing:** Direct database access for logging/querying

**Recommendation:** Configure SQLite MCP server:
```json
{
  "servers": {
    "sqlite": {
      "command": "sqlite-mcp-server",
      "args": ["S:/Archivist-Agent/data/governance.db"]
    }
  }
}
```

### 3. Persistent Memory MCP

**Missing:** Structured memory beyond the governance files

**Recommendation:** Create a memory MCP server:
```json
{
  "servers": {
    "memory": {
      "command": "memory-mcp-server",
      "args": ["S:/Archivist-Agent/memory.json"]
    }
  }
}
```

### 4. Test Runner Integration

**Missing:** Automated test execution with results parsing

**Recommendation:** Add test runner skill or MCP server that:
- Runs cargo test, pytest
- Parses results
- Reports failures to cps_log.jsonl

### 5. CI/CD Integration

**Missing:** Direct GitHub Actions integration

**Recommendation:** Configure GitHub MCP server:
```json
{
  "servers": {
    "github": {
      "command": "github-mcp-server",
      "env": {"GITHUB_TOKEN": "your-token"}
    }
  }
}
```

---

## Recommended Actions

### Immediate (Do Now)

1. **Install qwen2.5-coder:7b** (config expects it)
   ```bash
   ollama pull qwen2.5-coder:7b
   ```

2. **Create project kilo.json**
   - Specify model preference
   - Auto-load governance-relevant skills
   - Configure permissions

3. **Configure at least one MCP server**
   - Start with GitHub or filesystem
   - Test connection
   - Expand from there

### Short-Term (This Week)

4. **Create archivist-governance skill**
   - Auto-loads BOOTSTRAP.md
   - Enforces UDS
   - Integrates with cps_log.jsonl

5. **Set up SQLite MCP server**
   - For structured governance logging
   - Query capabilities for analysis

6. **Add memory MCP server**
   - Session continuity
   - Cross-session learning

### Long-Term (Future)

7. **Create test runner integration**
8. **Add CI/CD integration via GitHub MCP**
9. **Build custom governance MCP server**
10. **Integrate with production bundles**

---

## Questions for You

1. Do you want me to use Claude API directly, or stay with the current platform model?
2. Should I create the archivist-governance skill now?
3. What MCP servers do you actually want configured?
4. Should I pull qwen2.5-coder:7b, or change the default config?
5. Do you want a project-level kilo.json created?

---

## Summary

**What's working:**
- 37 skills installed (good coverage)
- Multiple AI SDKs available
- Governance stack functional

**What's missing:**
- MCP servers (zero configured)
- Project-level config
- Governance-aware skill
- qwen model not installed

**What would help most:**
1. Configure MCP servers
2. Create project kilo.json
3. Add governance skill
4. Install configured model

**The biggest gap:** MCP integration. I have all these tools but no way to use them through a standardized interface.
