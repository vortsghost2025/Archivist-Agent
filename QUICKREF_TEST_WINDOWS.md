# QUICK REFERENCE: Starting Test Windows

## For Read-Only Stress Testing (Observer Mode)

### SwarmMind PowerShell Window
```powershell
cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"

# Create observer mode tag
'{"mode":"observer","purpose":"stress-test-read-only","created_by":"manual-test"}' | Out-File -Encoding utf8 .session-mode

# Start kilo CLI
kilo

# When done, cleanup:
Remove-Item .session-mode
```

### self-organizing-library PowerShell Window
```powershell
cd "S:\self-organizing-library"

# Create observer mode tag
'{"mode":"observer","purpose":"stress-test-read-only","created_by":"manual-test"}' | Out-File -Encoding utf8 .session-mode

# Start kilo CLI
kilo

# When done, cleanup:
Remove-Item .session-mode
```

---

## Mode Cheat Sheet

| Mode | Use When | Write Access | Heartbeat | Timeout |
|------|----------|--------------|-----------|---------|
| `governing` | Production agent | Yes | Required | Terminate |
| `observer` | Stress testing | No | Optional | Inactive (24h) |
| `ephemeral` | Quick queries | No | None | Auto-remove (5min) |
| `shadow` | Parallel read | No | None | Follows primary |

---

## One-Liner Commands

### Start Observer Mode (SwarmMind)
```powershell
cd "S:\SwarmMind Self-Optimizing Multi-Agent AI System"; echo '{"mode":"observer","purpose":"test"}' > .session-mode; kilo
```

### Start Observer Mode (library)
```powershell
cd "S:\self-organizing-library"; echo '{"mode":"observer","purpose":"test"}' > .session-mode; kilo
```

### Cleanup After Testing
```powershell
Remove-Item "S:\SwarmMind Self-Optimizing Multi-Agent AI System\.session-mode" -ErrorAction SilentlyContinue
Remove-Item "S:\self-organizing-library\.session-mode" -ErrorAction SilentlyContinue
```

---

## Telling Me About Test Sessions

When you start a test window, just say:
> "Starting observer test on [lane] for [purpose]"

Example:
> "Starting observer test on swarmmind for stress testing the governance validation"

I'll then:
1. Know not to worry about heartbeat timeouts
2. Expect read-only behavior from that lane
3. Not create handoff documents if it goes idle

---

## What NOT to Worry About

- ✅ Starting multiple test windows simultaneously
- ✅ Leaving test windows open for hours
- ✅ Closing test windows without cleanup (they auto-expire)
- ✅ Stress testing the system with parallel reads

---

## Current Test Window Status

When you have test windows running, I'll see:

```json
{
  "active_sessions": {
    "archivist-agent": { "mode": "governing" },
    "swarmmind-test-01": { "mode": "observer", "purpose": "stress-test" }
  },
  "inactive_sessions": {}
}
```

Observer sessions appear in `active_sessions` but don't trigger timeout alarms.
