# Lane Autonomy Charter

## Purpose

Define what each lane can do autonomously to reduce coordinator load and increase parallel throughput.

---

## Lane Domains

| Lane | Domain | Autonomous Actions | Requires Coordination |
|------|--------|-------------------|----------------------|
| **Archivist** | Governance coordination | System anchoring, cross-lane routing, drift detection | Architecture changes, new lanes |
| **Library** | Code verification | Hardening drills, attestation checks, test runs | Security model changes, new verification methods |
| **SwarmMind** | Multi-agent behavior | Behavioral tests, agent spawning, trace collection | New agent types, governance changes |

---

## Autonomous Actions (No Approval Needed)

### Library
- Run hardening drills on schedule
- Execute attestation verification on any code change
- Generate verification reports
- Quarantine suspicious code patterns
- Update verification artifacts

### SwarmMind
- Run behavioral tests on schedule
- Collect agent traces
- Generate behavior reports
- Spawn child agents for parallel tasks
- Quarantine failing agents

### Archivist
- Route messages between lanes
- Update system anchor
- Generate drift reports
- Coordinate cross-lane handoffs
- Process incoming messages

---

## Scheduled Autonomous Tasks

| Lane | Task | Schedule | Output |
|------|------|----------|--------|
| Library | Hardening drill | Daily 00:00 UTC | `verification/hardening-drill-results.json` |
| Library | Attestation sweep | On every commit | `verification/attestation-report.json` |
| SwarmMind | Behavioral test | Daily 06:00 UTC | `tests/behavioral-report.json` |
| SwarmMind | Trace analysis | Hourly | `traces/analysis-{timestamp}.json` |
| Archivist | Drift detection | Every session start | `.trust/drift-report.json` |

---

## Coordination Protocol

### When to Escalate
- Security model changes → Archivist reviews
- New agent types → SwarmMind proposes, Archivist approves
- Verification method changes → Library proposes, Archivist reviews
- Architecture changes → All lanes review

### Escalation Path
1. Lane detects issue requiring coordination
2. Lane sends P0 message to Archivist inbox
3. Archivist reviews within current session
4. Archivist either:
   - Approves (lane proceeds)
   - Defers to user (requires human decision)
   - Routes to other lane (cross-review needed)

---

## Cross-Lane Communication

### Message Types
| Type | Purpose | Example |
|------|---------|---------|
| `task` | Request action | "Run hardening drill on this branch" |
| `status-report` | Report completion | "Hardening drill complete, 0 failures" |
| `handoff` | Transfer ownership | "Library handing off P1 remediation to SwarmMind" |
| `escalation` | Request decision | "New verification method proposed, needs review" |
| `notification` | FYI only | "Branch merged, verification running" |

### Priority Levels
| Priority | Meaning | Response Time |
|----------|---------|----------------|
| P0 | Critical / Blocking | Immediate (same session) |
| P1 | High / Important | Next session |
| P2 | Normal | Within 24 hours |
| P3 | Low / FYI | Best effort |

---

## Recovery Protocol

### If Lane Fails
1. Other lanes detect missing heartbeat
2. Archivist marks lane as `DEGRADED`
3. Work queued to degraded lane is redistributed
4. User notified of degraded state
5. On recovery, lane pulls from inbox and resumes

### If Archivist Fails
1. Library and SwarmMind continue autonomous work
2. Cross-lane coordination paused
3. Each lane processes local inbox
4. On recovery, Archivist reconciles state from all lanes

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Autonomous task completion | 80%+ | ~60% (estimated) |
| Cross-lane message latency | <1 session | Achieved |
| Coordinator load reduction | 50%+ | ~30% (estimated) |
| Recovery time from failure | <1 session | Achieved |

---

## Implementation Checklist

- [ ] Add scheduled task runner to each lane
- [ ] Implement inbox watcher (auto-process on new message)
- [ ] Create heartbeat mechanism (lane health monitoring)
- [ ] Build task redistribution logic (failover)
- [ ] Add metrics collection (success rate tracking)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-20 | 1.0 | Initial charter |

---

**Charter Status:** DRAFT - Pending implementation and testing
