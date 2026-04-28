# DERIVATION MAP

**Last updated:** 2026-04-16
**Purpose:** Show explicit relationships between projects

---

## RELATIONSHIP TYPES

| Type | Definition |
|------|------------|
| `references` | Explicitly reads/cites another project |
| `derived-from` | Architecture or code originated from another project |
| `archived-from` | Moved to archive, originated from active project |
| `integration-target` | Planned or active integration with another project |
| `unclear` | Relationship cannot be confidently determined |

---

## PROJECT RELATIONSHIPS

### Archivist-Agent

| Relationship | Target | Notes |
|--------------|--------|-------|
| `integration-target` | SwarmMind | SwarmMind governance extension implemented here |
| `references` | GLOBAL_GOVERNANCE.md | Maintains universal rules |
| `references` | self-organizing-library | Uses pattern observatory for Rosetta Stone evidence |
| `derived-from` | federation | Governance framework concepts derived from federation experimentation |

### SwarmMind

| Relationship | Target | Notes |
|--------------|--------|-------|
| `integration-target` | Archivist-Agent | Governance extension integrates here |
| `unclear` | federation | Relationship to consciousness simulation unclear |
| `unclear` | storytime | Relationship unclear |

### self-organizing-library

| Relationship | Target | Notes |
|--------------|--------|-------|
| `references` | Archivist-Agent | Uses governance framework for pattern classification |
| `references` | federation | Indexes federation files for Rosetta patterns |
| `references` | kucoin-margin-bot | Indexes trading bot files for Rosetta patterns |
| `references` | TAKE10 | Indexes OneQueue files for Rosetta patterns |
| `references` | papers | Indexes WE4FREE papers for Rosetta patterns |

### federation

| Relationship | Target | Notes |
|--------------|--------|-------|
| `references` | GLOBAL_GOVERNANCE.md | Project AGENTS.md references universal rules |
| `derived-from` | Archivist-Agent | Governance concepts originally tested here |
| `unclear` | SwarmMind | Relationship to core system unclear |

### kucoin-margin-bot

| Relationship | Target | Notes |
|--------------|--------|-------|
| `unclear` | GLOBAL_GOVERNANCE.md | May reference universal rules (needs AGENTS.md review) |
| `unclear` | Archivist-Agent | Relationship to registry unclear |
| `derived-from` | (unknown) | Origin unclear — appears to be independent development |

### TAKE10

| Relationship | Target | Notes |
|--------------|--------|-------|
| `references` | (internal AGENTS.md) | Has own governance, relationship to global unclear |
| `unclear` | Archivist-Agent | Relationship to registry unclear |
| `unclear` | SwarmMind | Relationship to core system unclear |

### storytime

| Relationship | Target | Notes |
|--------------|--------|-------|
| `unclear` | (all) | Cannot determine relationships — appears to be experiment |

### snac-v2

| Relationship | Target | Notes |
|--------------|--------|-------|
| `unclear` | (all) | Cannot determine relationships — appears to be project variant |
| `unclear` | projects/snac-v2-clean | Relationship unclear (subdirectory in projects/) |

### papers

| Relationship | Target | Notes |
|--------------|--------|-------|
| `references` | Archivist-Agent | Papers describe governance framework implemented here |
| `derived-from` | (research) | Original research, not derived from other projects |

---

## DERIVATION CHAIN

```
papers (WE4FREE research)
    ↓ derived-from (concepts)
Archivist-Agent (governance implementation)
    ↓ integration-target
SwarmMind (core system integration)
    
federation (earlier experiment)
    ↓ tested concepts
Archivist-Agent (governance implementation)

Archivist-Agent (registry)
    ↓ references
self-organizing-library (indexes all)
```

---

## UNCLEAR RELATIONSHIPS (Need Decision)

| From | To | Question |
|------|-----|----------|
| SwarmMind | federation | Is federation an integration target or separate? |
| SwarmMind | storytime | Is storytime related to SwarmMind architecture? |
| federation | SwarmMind | What is the intended relationship? |
| kucoin-margin-bot | Archivist-Agent | Should trading bot be indexed by registry? |
| TAKE10 | Archivist-Agent | Should OneQueue be indexed by registry? |
| TAKE10 | SwarmMind | Is OneQueue an integration target? |
| storytime | (all) | What is storytime and how does it relate? |
| snac-v2 | projects/snac-v2-clean | What is the relationship between these? |
| snac-v2 | (all) | What is snac-v2 and how does it relate? |

---

## SUMMARY

- **Explicit relationships:** 10
- **Unclear relationships:** 9
- **Derivation chains:** 3 (documented above)

---

## NOTES

- Only explicit, documented relationships are included
- "unclear" means relationship cannot be confidently determined without human input
- Do not infer relationships — ask for clarification
