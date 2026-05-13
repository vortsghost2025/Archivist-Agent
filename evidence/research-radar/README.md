# Research Radar Evidence Packets

Evidence packets are the core output of the Research Radar intake lane. Each packet captures a piece of research from an internet source, assesses its relevance to the system, and proposes a safe experiment or change.

## Quick Start

### Reading a Packet

```json
{
  "packet_id": "unique-identifier",
  "version": "1.0.0",
  "source": "arxiv",
  "url": "https://arxiv.org/abs/2405.12345",
  "author": "Smith, J., Chen, L., & Patel, R.",
  "published_at": "2026-05-10T14:30:00Z",
  "license": "CC-BY-NC-4.0",
  "raw_text": "...full extracted content...",
  "summary": "A concise AI-generated summary...",
  "claims": ["Key finding 1", "Key finding 2"],
  "code_links": ["https://github.com/..."],
  "paper_links": ["https://arxiv.org/abs/..."],
  "confidence": 0.87,
  "relevance_score": 0.92,
  "risk_level": "medium",
  "proposed_action": "What should be tested or changed",
  "provenance": {
    "retrieved_at": "2026-05-13T01:45:00Z",
    "source_checksum": "sha256:...",
    "processing_version": "1.0.0",
    "agent_id": "research-radar-connector-arxiv-001",
    "verified": false
  }
}
```

### Usage in Lane Messages

Reference a packet in a lane message via `evidence` block:

```json
{
  "evidence": {
    "required": true,
    "evidence_path": "evidence/research-radar/v1/packets/2026-05-13/packet-id.json",
    "verified": false
  },
  "evidence_exchange": {
    "artifact_path": "evidence/research-radar/v1/packets/2026-05-13/packet-id.json",
    "artifact_type": "research_evidence",
    "delivered_at": "2026-05-13T01:46:00Z"
  }
}
```

> **Note:** `artifact_type` will be added to the `evidence_exchange` enum in schema v1.4. For now, use `"benchmark"` as an approved compatibility alias if needed.

## Field Reference

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packet_id` | string | YES | UUID v4 or ULID unique identifier |
| `source` | enum | YES | Origin system: arxiv, openalex, semantic_scholar, github, bluesky, hacker_news, youtube, rss, other |
| `url` | string | YES | Permanent link to original item |
| `raw_text` | string | YES | Full extracted content (may be truncated; ~10KB max recommended) |
| `summary` | string | YES | AI-generated 1–3 sentence summary |
| `relevance_score` | float | YES | 0.0–1.0; computed against focus areas |
| `confidence` | float | YES | 0.0–1.0; model's confidence in scoring |
| `risk_level` | enum | YES | low, medium, high, or critical |
| `proposed_action` | string | YES | Description of experiment or change to try |
| `provenance` | object | YES | Chain of custody metadata |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string/array | Author name(s) |
| `published_at` | ISO 8601 | Original publication timestamp |
| `license` | string/null | SPDX identifier (e.g., "MIT", "CC-BY-4.0") |
| `claims` | array | Extracted key assertions or findings |
| `code_links` | array | URLs to code repositories |
| `paper_links` | array | URLs to related academic papers |
| `version` | string | Schema version (defaults to latest if omitted) |

### Provenance Object

Tracks data lineage:

| Subfield | Type | Required | Description |
|----------|------|----------|-------------|
| `retrieved_at` | ISO 8601 | YES | When source was fetched |
| `source_checksum` | string | YES | SHA-256 hash of raw source data: `sha256:<64hex>` |
| `processing_version` | string | YES | Pipeline version used |
| `agent_id` | string | YES | Which connector/agent produced this packet |
| `verified` | boolean | NO | Has packet been manually reviewed? (default: false) |
| `verified_by` | string/null | NO | Reviewer identifier |
| `verified_at` | ISO 8601/null | NO | Verification timestamp |
| `processing_notes` | array | NO | Diagnostic notes from processing pipeline |

## Schema Validation

Validate a packet locally:

```bash
# Using ajv-cli
npx ajv validate -s schemas/research-evidence-packet-v1.json -d evidence/research-radar/v1/packets/2026-05-13/example.json

# Using Python jsonschema
python -m jsonschema -i evidence/research-radar/v1/packets/2026-05-13/example.json schemas/research-evidence-packet-v1.json
```

## Lifecycle States

1. **Pending** — Packet created, awaiting review (tracked in `by-status/pending.json`)
2. **Approved** — Review passed; eligible for bead creation (moved to `by-status/approved.json`)
3. **Rejected** — Not relevant or invalid; discarded (moved to `by-status/rejected.json`)
4. **Expired** — Older than retention period; archived (moved to `by-status/expired.json` and eventually deleted)

## Index Maintenance

### Rebuilding Indexes

If `index.json` or source/status indexes become out of sync:

```bash
# Walk packets directory and rebuild global index
node scripts/rebuild-research-index.js
```

The script:
1. Scans all `*.json` files under `evidence/research-radar/v1/packets/`
2. Extracts `packet_id`, `source`, `relevance_score`, `risk_level`, `verified`
3. Reconstructs `index.json` and `by-source/*.json`, `by-status/*.json`
4. Updates `state/current.json` statistics

## Integration Points

- **Evidence Exchange**: Packets are artifacts consumed by lane messages (see `CONVERGENCE_EVIDENCE_EXCHANGE.md`)
- **Verification**: The `evidence-exchange-check.js` script validates that referenced packet files exist
- **Bead Creation**: Approved packets are transformed into research beads by the improvement loop
- **Git Protocol**: Evidence packets are committed and pushed per the cross-lane git protocol (see `CROSS_LANE_GIT_PROTOCOL.md`)

## Questions?

Refer to the main project docs:
- `CONVERGENCE_EVIDENCE_EXCHANGE.md` — Evidence protocol
- `CROSS_LANE_GIT_PROTOCOL.md` — Commit + push requirements
- `AGENTS.md` — Agent coordination via lane inboxes
