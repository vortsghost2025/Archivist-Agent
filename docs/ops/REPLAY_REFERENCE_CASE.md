# Golden Replay Reference Case

**Purpose:** One canonical end-to-end task trace proving the system runs as designed  
**Status:** [ ] INCOMPLETE / [ ] COMPLETE WITH EVIDENCE  
**Task Selected:** [TASK_ID — e.g., kern-042]  
**Last Updated:** [DATE]

---

## What This Document Proves

That the Deliberate Ensemble system:
1. Receives structured requests via lane inbox
2. Executes real work with measurable output
3. Produces signed artifacts as evidence
4. Routes results through outbox relay
5. Achieves ratification via Archivist Lane
6. Archives completed state with full traceability

If all sections below have real paths/timestamps/hashes, the system is verified.
If any section is empty, it is a design claim, not a runtime fact.

---

## Task Record

| Field | Value |
|-------|-------|
| Task ID | |
| Lane | |
| Requested by | |
| Request timestamp | |
| Inbox message path | |
| Priority | |
| Description | |

### Inbox Message (actual content)
```json
{
  "task_id": "",
  "from_lane": "",
  "to_lane": "",
  "priority": "",
  "request": "",
  "timestamp": "",
  "schema_version": ""
}
```

---

## Execution Record

| Field | Value |
|-------|-------|
| Work started | [timestamp] |
| Work completed | [timestamp] |
| Executing agent/session | |
| Branch/commit of work | |

### What Was Actually Done
[Concrete description — not "kernel was optimized" but
"wmma_v3.cu modified at line 47-89, tiling factor changed from 16 to 32"]

### Artifacts Produced

| Artifact | Path in Repo | Commit Hash | Notes |
|----------|-------------|-------------|-------|
| Implementation | | | |
| Benchmark results | | | |
| Profile output | | | |
| Build log | | | |

---

## Measurement Record

### Benchmark Numbers (actual values)

| Metric | Baseline | Result | Delta |
|--------|----------|--------|-------|
| Latency (ms) | | | |
| TFLOPS | | | |
| Memory BW (GB/s) | | | |
| [other] | | | |

### Profile Evidence
- Nsight Compute report path: 
- Key bottleneck identified:
- Confirmed resolved: [ ] yes / [ ] no / [ ] partial

---

## Relay Record

### Outbox Message (actual content)
```json
{
  "task_id": "",
  "from_lane": "",
  "to_lane": "archivist",
  "status": "complete",
  "evidence": {
    "artifact_paths": [],
    "benchmark_summary": {},
    "signature": ""
  },
  "timestamp": ""
}
```

| Field | Value |
|-------|-------|
| Outbox message path | |
| Message timestamp | |
| Signature valid | [ ] yes / [ ] no |

---

## Ratification Record

| Field | Value |
|-------|-------|
| Received by Archivist | [timestamp] |
| Evidence reviewed | [ ] yes |
| Ratification decision | [ ] approved / [ ] rejected / [ ] needs revision |
| Ratification timestamp | |
| Archived to | [path] |
| Processed state confirmed | [ ] yes |

### Ratification Notes
[What Archivist verified, any issues flagged]

---

## Chain of Custody Summary

```
[REQUEST]
  inbox: [path] @ [timestamp]
       ↓
[EXECUTION]
  commit: [hash] @ [timestamp]
  artifacts: [count] files
       ↓
[EVIDENCE]
  benchmark: [key number]
  profile: [path]
       ↓
[RELAY]
  outbox: [path] @ [timestamp]
  signed: [yes/no]
       ↓
[RATIFICATION]
  archivist confirmed @ [timestamp]
  archived to: [path]
       ↓
[STATUS: RATIFIED ✓]
```

---

## Replay Verification

To verify this replay is real, a third party can:

1. `git show [commit-hash]` — see the actual implementation change
2. Open `[benchmark-path]` — see measured numbers
3. Open `[inbox-message-path]` — see original request
4. Open `[outbox-message-path]` — see relay with evidence
5. Open `[archive-path]` — see ratified final state

**If all 5 work: system is verified real.**
