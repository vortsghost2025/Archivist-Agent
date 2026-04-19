# DECISION_PHASE4.2_MONITORING_ALERTING.md

**Date:** 2026-04-19
**Decision ID:** PHASE4.2-MONITORING-ALERTING
**Status:** DRAFT
**Depends On:** PHASE4.1-QUEUE-CONSUMER

---

## Summary

Implement real-time monitoring and alerting for the three-lane organism, providing operators visibility into queue health, quarantine events, and recovery classification trends.

---

## Problem Statement

Without monitoring, operators have no visibility into:
- Queue backlog (items pending/escalated)
- Quarantine events (lanes entering recovery)
- Recovery classification trends (P0-P3 distribution)
- Cross-lane coordination failures

The queue consumer processes items but doesn't expose health metrics.

---

## Proposed Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Audit Stream                │
                    │  (queue-consumer.log, audit.log)   │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │       Metrics Collector             │
                    │  - Count by event type              │
                    │  - Track severity distribution      │
                    │  - Calculate rates                  │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │       Alert Engine                  │
                    │  - Threshold checks                 │
                    │  - Cooldown windows                 │
                    │  - Deduplication                    │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │       Notifier                      │
                    │  - Webhook (Slack, Discord, custom) │
                    │  - Email (SMTP)                     │
                    │  - File (local log)                 │
                    └─────────────────────────────────────┘
```

---

## Alert Thresholds

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| `quarantine_rate` | > 0/hour | CRITICAL | Immediate alert |
| `p0_pending` | > 0 | CRITICAL | Immediate alert |
| `p1_pending` | > 3 | HIGH | Alert within 5min |
| `escalation_rate` | > 5/hour | HIGH | Alert within 5min |
| `queue_backlog` | > 50 | MEDIUM | Alert within 15min |
| `auto_resolve_rate` | < 50% | MEDIUM | Alert within 15min |
| `consumer_heartbeat` | > 60s stale | CRITICAL | Immediate alert |

---

## Components

### 1. MetricsCollector

**File:** `src/monitoring/MetricsCollector.js`

**Responsibilities:**
- Tail audit logs
- Aggregate events by type, severity, lane
- Calculate rates (events/minute)
- Expose metrics for dashboard

**Metrics Exposed:**
```json
{
  "queue": {
    "incident_pending": 13,
    "incident_escalated": 4,
    "incident_auto_resolved": 9,
    "approval_pending": 0
  },
  "severity": {
    "P0": 4,
    "P1": 9,
    "P2": 0,
    "P3": 0
  },
  "rates": {
    "quarantine_per_hour": 2.3,
    "escalation_per_hour": 4.1,
    "auto_resolve_per_hour": 3.2
  },
  "health": {
    "consumer_heartbeat_age_sec": 12,
    "last_processed": "2026-04-19T02:45:49Z"
  }
}
```

### 2. AlertEngine

**File:** `src/monitoring/AlertEngine.js`

**Responsibilities:**
- Check thresholds against metrics
- Apply cooldown (don't spam alerts)
- Deduplicate similar alerts
- Route to appropriate notifier

**Alert Structure:**
```json
{
  "id": "ALERT-2026-04-19T02:50:00Z",
  "timestamp": "2026-04-19T02:50:00Z",
  "severity": "CRITICAL",
  "type": "quarantine_detected",
  "message": "Lane swarmmind entered quarantine after P0 incident",
  "metrics": { "quarantine_rate": 1.2 },
  "acknowledged": false,
  "resolved_at": null
}
```

### 3. Notifier

**File:** `src/monitoring/Notifier.js`

**Responsibilities:**
- Send alerts via configured channels
- Webhook POST (Slack, Discord, custom)
- Email via SMTP (optional)
- Local file log (always)

**Configuration:**
```json
{
  "notifiers": {
    "webhook": {
      "enabled": true,
      "url": "https://hooks.slack.com/services/...",
      "timeout_ms": 5000
    },
    "email": {
      "enabled": false,
      "smtp_host": "smtp.example.com",
      "smtp_port": 587,
      "from": "alerts@archivist.local",
      "to": ["operator@example.com"]
    },
    "file": {
      "enabled": true,
      "path": "logs/alerts.log"
    }
  }
}
```

### 4. CLI Monitor

**File:** `scripts/monitor.js`

**Usage:**
```bash
node scripts/monitor.js --live        # Continuous dashboard
node scripts/monitor.js --once        # One-time snapshot
node scripts/monitor.js --alerts      # Show active alerts
node scripts/monitor.js --config      # Show current thresholds
```

---

## Implementation Plan

### Phase 4.2.1: MetricsCollector
- [ ] Create MetricsCollector class
- [ ] Implement audit log tailing
- [ ] Calculate severity distribution
- [ ] Calculate rates
- [ ] Expose JSON metrics

### Phase 4.2.2: AlertEngine
- [ ] Define threshold configuration
- [ ] Implement threshold checks
- [ ] Add cooldown logic
- [ ] Add deduplication

### Phase 4.2.3: Notifier
- [ ] Implement webhook notifier
- [ ] Implement file notifier
- [ ] Add email stub (optional)
- [ ] Configure retry logic

### Phase 4.2.4: CLI Dashboard
- [ ] Create `scripts/monitor.js`
- [ ] Implement `--live` mode with refresh
- [ ] Implement `--once` snapshot
- [ ] Add alert history view

### Phase 4.2.5: Integration
- [ ] Hook MetricsCollector into QueueConsumer
- [ ] Add heartbeat to consumer
- [ ] Test alert flow end-to-end
- [ ] Document configuration

---

## Success Criteria

1. **Visibility:** Operators can see queue health in real-time
2. **Alerting:** Critical events trigger immediate notifications
3. **No spam:** Cooldown prevents alert fatigue
4. **Recovery:** Alerts can be acknowledged/resolved
5. **Configurability:** Thresholds adjustable without code changes

---

## Configuration File

**Location:** `config/monitoring.json`

```json
{
  "thresholds": {
    "quarantine_rate": { "value": 0, "window": "1h", "severity": "CRITICAL" },
    "p0_pending": { "value": 0, "window": "now", "severity": "CRITICAL" },
    "p1_pending": { "value": 3, "window": "now", "severity": "HIGH" },
    "escalation_rate": { "value": 5, "window": "1h", "severity": "HIGH" },
    "queue_backlog": { "value": 50, "window": "now", "severity": "MEDIUM" },
    "consumer_heartbeat": { "value": 60, "window": "sec", "severity": "CRITICAL" }
  },
  "cooldowns": {
    "CRITICAL": "5m",
    "HIGH": "15m",
    "MEDIUM": "30m"
  },
  "notifiers": {
    "webhook": { "enabled": false },
    "file": { "enabled": true }
  }
}
```

---

## Testing

1. Generate test incidents at each severity
2. Verify metrics collection
3. Trigger each threshold
4. Verify alert delivery
5. Test cooldown behavior
6. Test acknowledgement flow

---

## References

- DECISION_QUEUE_CONSUMER_PHASE4.1.md: Queue consumer implementation
- LANE_REGISTRY.json: Lane definitions
- logs/audit.log: Audit stream source
