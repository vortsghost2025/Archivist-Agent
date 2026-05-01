# CONTRADICTION_RESOLUTION_PLAYBOOK

OUTPUT_PROVENANCE:
agent: chatgpt-gpt-5.5-thinking (exterior synthesis, relayed by archivist)
lane: archivist
generated_at: 2026-04-30T20:07:30Z
session_id: unknown
target_lane: archivist | kernel | library | swarmmind

---

## Execution Status

- APPROVED FOR DRAFTING
- NOT APPROVED FOR AUTO-RESOLUTION

---

## Hard Anti-Auto-Resolution Rule

No `CONTRADICTS` edge may be resolved by count, confidence, title similarity, or lane preference alone.

Every resolution requires:

1. source edge ID/path
2. quoted or hashed evidence on both sides
3. domain classification: `paper` | `code` | `data`
4. adjudication status:
   - `proven_conflict`
   - `proven_spurious`
   - `needs_lane_review`
5. next action owner

---

## Required Operating Principles

- visibility != proof
- conflict count != truth
- graph pressure != adjudication

Final instruction to lanes:

> Resolve nothing silently. Classify everything with evidence.

---

## Resolution Record Template (Per Edge)

```json
{
  "edge_id_or_path": "",
  "source_node_id": "",
  "target_node_id": "",
  "domain": "paper|code|data",
  "evidence_source": {
    "quote_or_hash": "",
    "artifact_path": ""
  },
  "evidence_target": {
    "quote_or_hash": "",
    "artifact_path": ""
  },
  "adjudication_status": "proven_conflict|proven_spurious|needs_lane_review",
  "next_action_owner": "archivist|kernel|library|swarmmind",
  "notes": ""
}
```

