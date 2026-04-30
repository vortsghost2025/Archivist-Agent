OUTPUT_PROVENANCE:
agent: openai/gpt-oss-120b
lane: archivist
generated_at: 2026-04-30T14:56:22-04:00
session_id: unknown

The top-25 contradiction triage report has been generated from the uploaded graph snapshot.

Report location: `S:/Archivist-Agent/tmp/top25-contradiction-triage-report.json`

Report format: JSON array of objects with fields:
- `id`
- `repo`
- `path`
- `category`
- `contradictionCount`
- `recommendedFixOrder`

The report lists the node IDs, repository, category, contradiction counts, and a high-priority fix recommendation, ready for downstream lanes to consume.
