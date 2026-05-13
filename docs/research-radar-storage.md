# Research Radar Evidence Storage

This directory contains evidence packets collected by the Research Radar system from internet sources (arXiv, GitHub, RSS, etc.).

## Directory Structure

```
evidence/research-radar/
├── v1/                          # Schema version namespace
│   ├── packets/                 # Individual evidence packet files
│   │   ├── YYYY-MM-DD/          # Daily partition (UTC)
│   │   │   ├── {packet_id}.json
│   │   │   └── ...
│   │   └── example/            # Example packets for documentation
│   │       └── example-evidence-packet.json
│   ├── index.json              # Global packet index (packet_id -> metadata)
│   ├── by-source/              # Source-based indexes (optional, for fast lookup)
│   │   ├── arxiv.json          # List of packet IDs from arXiv
│   │   ├── github.json
│   │   └── ...
│   ├── by-status/              # Status-based grouping
│   │   ├── pending.json        # Awaiting review
│   │   ├── approved.json       # Approved for action
│   │   ├── rejected.json       # Rejected
│   │   └── expired.json        # Stale (beyond TTL)
│   ├── state/                  # System state tracks
│   │   ├── current.json        # Active state: thresholds, focus areas, stats
│   │   └── schema_version.txt  # Current schema version string
│   └── logs/                   # Processing logs (rotated)
│       └── ingestion-YYYY-MM-DD.log
├── SCHEMA.md                   # Schema documentation (symlink to schemas/)
└── README.md                   # This file
```

## Packet Schema

Evidence packets use JSON Schema `schemas/research-evidence-packet-v1.json`. Required fields:

| Field | Type | Description |
|-------|------|-------------|
| `packet_id` | string | UUID v4 or ULID identifier |
| `version` | string | Schema version (semver) |
| `source` | enum | One of: arxiv, openalex, semantic_scholar, github, bluesky, hacker_news, youtube, rss, other |
| `url` | URI | Permanent URL to original source |
| `author` | string/array | Author name(s) |
| `published_at` | ISO 8601 | Publication timestamp |
| `license` | string/null | SPDX identifier or null |
| `raw_text` | string | Full extracted content |
| `summary` | string | AI-generated summary (1-3 sentences) |
| `claims` | array | Key claims extracted from source |
| `code_links` | array | URLs to code repositories |
| `paper_links` | array | URLs to related papers |
| `confidence` | float (0–1) | Model confidence in relevance |
| `relevance_score` | float (0–1) | Relevance to project focus areas |
| `risk_level` | enum | low, medium, high, critical |
| `proposed_action` | string | Suggested experiment or change |
| `provenance` | object | Chain of custody metadata |

See `schemas/research-evidence-packet-v1.json` for full schema definition.

## Index Format

### Global Index (`index.json`)

```json
{
  "schema_version": "1.0.0",
  "index_generated_at": "2026-05-13T01:46:56.000Z",
  "packets": {
    "packet-uuid-here": {
      "path": "v1/packets/2026-05-13/packet-uuid-here.json",
      "source": "arxiv",
      "relevance_score": 0.92,
      "risk_level": "medium",
      "verified": false,
      "ingested_at": "2026-05-13T01:46:56.000Z"
    }
  },
  "counters": {
    "total_packets": 4,
    "by_source": { "arxiv": 2, "github": 2 },
    "by_risk_level": { "medium": 3, "low": 1 },
    "by_verification_status": { "pending": 3, "approved": 1 }
  }
}
```

### Source Index (`by-source/{source}.json`)

```json
{
  "source": "arxiv",
  "updated_at": "2026-05-13T01:46:56.000Z",
  "packet_ids": [
    "packet-uuid-1",
    "packet-uuid-2"
  ]
}
```

### Status Index (`by-status/{status}.json`)

```json
{
  "status": "pending",
  "updated_at": "2026-05-13T01:46:56.000Z",
  "packet_ids": [
    "packet-uuid-needing-review"
  ]
}
```

### State (`state/current.json`)

Tracks system-wide configuration and statistics:

```json
{
  "schema_version": "1.0.0",
  "state_updated_at": "2026-05-13T01:46:56.000Z",
  "current_focus_areas": [ /* project focus keywords */ ],
  "relevance_threshold": 0.65,
  "min_confidence": 0.6,
  "auto_approval_enabled": false,
  "pending_review_count": 23,
  "last_scan_completed": "2026-05-13T01:45:00Z",
  "statistics": { /* aggregations */ }
}
```

## Lifecycle

1. **Ingest** — Connector fetches source item → generates packet file in `packets/YYYY-MM-DD/`
2. **Index** — `index.json` updated with packet metadata; source/status indexes refreshed
3. **Score** — Relevance and confidence computed; risk assessed
4. **Review** — Goes to `by-status/pending.json` unless confidence ≥ auto-approval threshold
5. **Act** — If approved, packet triggers bead creation via improvement loop
6. **Archive** — After action or expiry, moved to `by-status/expired.json` (or deleted after retention period)

## Versioning

- Schema version follows semver: `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR; new optional fields increment MINOR; bugfixes increment PATCH
- Current version: **1.0.0**
- Version is stored in each packet's `version` field and tracked in `state/schema_version.txt`
- Migration occurs automatically when reading packets; old-version packets are upgraded on review

## Compatibility with Existing Evidence Protocol

Research Radar evidence packets integrate with the lane evidence exchange protocol (`schemas/inbox-message-v1.json`):

1. **File-based artifacts** — Packets are stored as files; lane messages reference them via `evidence.evidence_path`
2. **Hash verification** — `evidence.evidence_hash` can be computed over the packet JSON for integrity checks
3. **Type classification** — Packets are a new `artifact_type`: `research_evidence` (may be added to enum in future schema v1.4)
4. **Exchange validation** — The `scripts/evidence-exchange-check.js` verifies referenced packet files exist and are readable

**Example lane message:**

```json
{
  "schema_version": "1.3",
  "from": "library",
  "to": "archivist",
  "type": "task",
  "priority": "P1",
  "subject": "Research packet for review",
  "body": "New evidence packet from arXiv on constitutional AI. Relevance: 0.92",
  "evidence": {
    "required": true,
    "evidence_path": "evidence/research-radar/v1/packets/2026-05-13/ex-archivist-governance-001.json",
    "verified": false
  },
  "evidence_exchange": {
    "artifact_path": "evidence/research-radar/v1/packets/2026-05-13/ex-archivist-governance-001.json",
    "artifact_type": "research_evidence",
    "delivered_at": "2026-05-13T01:46:00Z"
  }
}
```

## Maintenance

- **Index rebuild** — If indexes become corrupted, rebuild by scanning `packets/` directory
- **Expiry** — Packets older than 90 days in `pending` status are auto-expired (configurable in `state/current.json`)
- **Cleanup** — Expired packets may be archived to `evidence/research-radar/archive/` after 180 days
- **Integrity checks** — Run `node scripts/evidence-exchange-check.js` regularly to verify all referenced packets exist

## References

- Schema: `schemas/research-evidence-packet-v1.json`
- Convergence evidence protocol: `CONVERGENCE_EVIDENCE_EXCHANGE.md`
- Lane message format: `schemas/inbox-message-v1.json`
- Inbound protocol: `lanes/{lane}/inbox/`
