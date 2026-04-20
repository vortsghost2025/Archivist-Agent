# FreeAgent Operator Handoff Runbook

Date: 2026-04-19
Phase: 4A
Owner: Archivist (implementation), Library (documentation)

## Purpose

This runbook defines operator procedures when the system generates a handoff signal. Handoff signals indicate conditions requiring human intervention.

---

## Handoff Signal Location

**Filename:** `AGENT_HANDOFF_REQUIRED.md`

**Locations:**
- `S:/Archivist-Agent/AGENT_HANDOFF_REQUIRED.md`
- `S:/self-organizing-library/AGENT_HANDOFF_REQUIRED.md`
- `S:/SwarmMind Self-Optimizing Multi-Agent AI System/AGENT_HANDOFF_REQUIRED.md`

---

## When Handoff Occurs

| Condition | Lane | Action |
|-----------|------|--------|
| Max retries exceeded | Any | Generate handoff signal |
| Key revoked | Any | Generate handoff signal |
| Trust store corrupted | Archivist | Generate handoff signal |
| Identity mismatch | Any | Generate handoff signal |
| Contradictory state | Any | Generate handoff signal |

---

## Operator Procedure

### Step 1: Identify Handoff Signal

```bash
# Check for handoff signals
ls S:/**/AGENT_HANDOFF_REQUIRED.md

# Or use find
find S:/ -name "AGENT_HANDOFF_REQUIRED.md" 2>/dev/null
```

### Step 2: Read Handoff File

```bash
cat "S:/self-organizing-library/AGENT_HANDOFF_REQUIRED.md"
```

**Expected content:**
- Generation timestamp
- Lane that generated it
- Item ID causing the issue
- Reason for handoff
- Quarantine ID reference
- Evidence summary

### Step 3: Review Quarantine Log

```bash
# View quarantine log
cat "S:/Archivist-Agent/logs/quarantine.log"

# Search for specific quarantine ID
grep "q-456" "S:/Archivist-Agent/logs/quarantine.log"
```

### Step 4: Investigate Root Cause

| Reason | Investigation Steps |
|--------|---------------------|
| Lane mismatch | Check item source, verify lane field, check signature |
| Key ID mismatch | Compare header.kid with trust store, verify key rotation |
| Key revoked | Check revocations.json, verify revocation reason |
| Missing signature | Check if item was signed, verify signing process |
| Malformed JWS | Inspect JWS structure, check encoding |

### Step 5: Determine Resolution

| Resolution | Action |
|------------|--------|
| Legitimate rejection | Delete item, remove handoff file |
| False positive | Fix root cause, re-verify, remove handoff file |
| Key compromise | Rotate keys, update trust store, remove affected items |
| Data corruption | Restore from backup, re-verify, remove handoff file |

### Step 6: Execute Resolution

#### Option A: Delete Item (Legitimate Rejection)

```bash
# Remove from queue (lane-specific)
cd S:/self-organizing-library
# Edit queue file to remove the item

# Remove handoff file
rm AGENT_HANDOFF_REQUIRED.md
```

#### Option B: Fix and Re-verify (False Positive)

```bash
# Fix the underlying issue
# Example: Correct lane field in item

# Re-verify manually
node scripts/verify-item.js --itemId=<id>

# If valid, process normally
# Remove handoff file
rm AGENT_HANDOFF_REQUIRED.md
```

#### Option C: Key Rotation (Compromise)

```bash
# Generate new key pair
LANE_KEY_PASSPHRASE=<new-secret> node scripts/generate-keys.js

# Update trust store
# (Archivist operation)

# Re-sign affected items

# Remove handoff file
rm AGENT_HANDOFF_REQUIRED.md
```

### Step 7: Sign Off

After resolution, operator must:
1. Document resolution in handoff file
2. Add signature
3. Archive handoff file (optional)
4. Remove active handoff signal

**Example sign-off:**
```markdown
## Resolution
Fixed lane field mismatch. Item re-verified successfully.

## Operator Signature
[x] I have reviewed and resolved this handoff
    Operator: [name]
    Date: 2026-04-19T22:00:00Z
```

---

## Handoff File Template

```markdown
# AGENT HANDOFF REQUIRED

Generated: <timestamp>
Lane: <lane>
ItemId: <id>

## Reason
<human-readable reason>

## Quarantine ID
<quarantine-id>

## Evidence
- <evidence item 1>
- <evidence item 2>

## Action Required
1. Review quarantine log
2. Determine root cause
3. Resolve or delete item
4. Document resolution
5. Remove this handoff file

## Resolution
[To be filled by operator]

## Operator Signature
[ ] I have reviewed and resolved this handoff
    Operator: _________
    Date: _________
```

---

## Escalation Procedures

### Level 1: Lane Operator

- Can resolve: Single item failures, false positives
- Cannot resolve: Key compromise, trust store corruption

### Level 2: Archivist Operator

- Can resolve: Key rotation, trust store issues
- Cannot resolve: Multi-lane corruption

### Level 3: System Administrator

- Can resolve: All conditions
- Authority: System halt, restore from backup

---

## Response Time SLAs

| Severity | Response Time | Resolution Time |
|----------|---------------|-----------------|
| Critical (key compromise) | 15 minutes | 1 hour |
| High (trust store corruption) | 30 minutes | 2 hours |
| Medium (max retries) | 1 hour | 4 hours |
| Low (false positive) | 4 hours | 8 hours |

---

## Monitoring for Handoff Signals

### Automated Check Script

```bash
# check-handoffs.sh
for lane in "Archivist-Agent" "self-organizing-library" "SwarmMind Self-Optimizing Multi-Agent AI System"; do
  if [ -f "S:/$lane/AGENT_HANDOFF_REQUIRED.md" ]; then
    echo "HANDOFF DETECTED: $lane"
    cat "S:/$lane/AGENT_HANDOFF_REQUIRED.md"
  fi
done
```

### Integration with Monitoring

Add to monitoring system:
```yaml
# monitoring-check.yml
- name: handoff-signal-check
  schedule: "*/5 * * * *"
  script: scripts/check-handoffs.sh
  alert: pagerduty
```

---

## Common Scenarios

### Scenario 1: Lane Mismatch

**Symptom:** Item signed by library but claims swarmmind origin

**Investigation:**
1. Check who submitted the item
2. Verify intended lane
3. Check if cross-lane transfer was intended

**Resolution:**
- If cross-lane: Correct lane field, re-sign
- If fraud: Delete item, audit source

### Scenario 2: Key Revocation

**Symptom:** Key marked revoked in trust store

**Investigation:**
1. Check revocations.json for reason
2. Determine if revocation was intentional

**Resolution:**
- If intentional: Delete item, no further action
- If error: Remove revocation, re-verify

### Scenario 3: Malformed JWS

**Symptom:** JWS fails to parse

**Investigation:**
1. Check JWS structure (3 parts, base64url)
2. Verify encoding
3. Check for corruption in transit

**Resolution:**
- If corruption: Request re-signature
- If attack: Quarantine, investigate source

---

## Audit Trail

All handoff resolutions must be logged:

```json
{
  "handoffId": "handoff-001",
  "quarantineId": "q-456",
  "lane": "library",
  "itemId": "queue-123",
  "resolvedBy": "operator-name",
  "resolution": "Fixed lane field, re-verified",
  "resolvedAt": "2026-04-19T22:00:00Z"
}
```

**Location:** `S:/Archivist-Agent/logs/handoff-resolutions.log`

---

## Recovery from Handoff

After resolution:
1. Item is deleted OR
2. Item is corrected and re-signed OR
3. Item is superseded by new item

In all cases:
- Original quarantine entry remains (audit)
- Handoff file is archived or deleted
- Resolution is logged

---

Last updated: 2026-04-19
