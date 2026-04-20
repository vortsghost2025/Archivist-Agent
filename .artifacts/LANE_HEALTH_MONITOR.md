# Lane Health Monitor (Read-Only)

## Purpose

Passive monitoring - detect issues without interrupting lane work.

---

## Health Checklist

### Checked: 2026-04-20T20:40:00Z

| Check | Status | Notes |
|-------|--------|-------|
| **Stale Heartbeats** | ✅ OK | No tasks > 900s without heartbeat |
| **Duplicate Idempotency Keys** | ✅ OK | No duplicates in any inbox |
| **Queue Age (P0)** | ✅ OK | No P0 older than 15 min |
| **Queue Age (P1)** | ✅ OK | No P1 older than 1 hour |
| **Queue Age (P2/P3)** | ⚠️ WATCH | Low priority items can wait |
| **Zombie Tasks** | ✅ OK | No tasks stuck in `in_progress` > timeout |
| **Blocked Lanes** | ✅ OK | No lane marked `DEGRADED` |

---

## Monitor Commands

### Check Stale Heartbeats
```powershell
# Find messages where now - last_heartbeat_at > timeout_seconds
Get-ChildItem "S:/Archivist-Agent/lanes/archivist/inbox/*.json" | ForEach-Object {
  $msg = Get-Content $_.FullName | ConvertFrom-Json
  if ($msg.heartbeat) {
    $age = (Get-Date) - [DateTime]$msg.heartbeat.last_heartbeat_at
    if ($age.TotalSeconds -gt $msg.heartbeat.timeout_seconds) {
      Write-Host "STALE: $($_.Name) - $($age.TotalMinutes) min old"
    }
  }
}
```

### Check Duplicate Idempotency Keys
```powershell
# Collect all idempotency_keys, find duplicates
$keys = @{}
Get-ChildItem "S:/Archivist-Agent/lanes/*/inbox/*.json" -Recurse | Where-Object { $_.DirectoryName -notlike "*processed*" -and $_.DirectoryName -notlike "*expired*" } | ForEach-Object {
  $msg = Get-Content $_.FullName | ConvertFrom-Json
  if ($msg.idempotency_key) {
    if ($keys.ContainsKey($msg.idempotency_key)) {
      Write-Host "DUPLICATE: $($msg.idempotency_key) in $($_.FullName)"
    } else {
      $keys[$msg.idempotency_key] = $_.FullName
    }
  }
}
```

### Check Queue Age by Priority
```powershell
# Find messages older than threshold by priority
$thresholds = @{ "P0" = 900; "P1" = 3600; "P2" = 86400; "P3" = 604800 }
Get-ChildItem "S:/Archivist-Agent/lanes/*/inbox/*.json" -Recurse | Where-Object { $_.DirectoryName -notlike "*processed*" -and $_.DirectoryName -notlike "*expired*" } | ForEach-Object {
  $msg = Get-Content $_.FullName | ConvertFrom-Json
  $priority = $msg.priority
  if ($thresholds.ContainsKey($priority)) {
    $age = (Get-Date) - [DateTime]$msg.timestamp
    if ($age.TotalSeconds -gt $thresholds[$priority]) {
      Write-Host "OLD ($priority): $($_.Name) - $($age.TotalMinutes) min"
    }
  }
}
```

### Check Lane Heartbeat (Are Lanes Alive?)
```powershell
# Check if each lane has sent a message recently
$lanes = @("library", "swarmmind")
foreach ($lane in $lanes) {
  $lastMsg = Get-ChildItem "S:/$lane/lanes/$lane/outbox/*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($lastMsg) {
    $age = (Get-Date) - $lastMsg.LastWriteTime
    if ($age.TotalMinutes -gt 30) {
      Write-Host "INACTIVE: $lane - last message $($age.TotalMinutes) min ago"
    } else {
      Write-Host "ACTIVE: $lane - last message $($age.TotalMinutes) min ago"
    }
  }
}
```

---

## Quick Health Check (One Command)

```powershell
# Run all checks
Write-Host "`n=== LANE HEALTH MONITOR ===" -ForegroundColor Cyan
Write-Host "`n[Stale Heartbeats]" -ForegroundColor Yellow
# (run stale heartbeat check)

Write-Host "`n[Duplicate Keys]" -ForegroundColor Yellow
# (run duplicate check)

Write-Host "`n[Queue Age]" -ForegroundColor Yellow
# (run queue age check)

Write-Host "`n[Lane Activity]" -ForegroundColor Yellow
# (run lane heartbeat check)

Write-Host "`n========================`n" -ForegroundColor Cyan
```

---

## Thresholds

| Priority | Max Age | Action if Exceeded |
|----------|---------|-------------------|
| P0 | 15 min | Alert user immediately |
| P1 | 1 hour | Alert user |
| P2 | 24 hours | Note in session report |
| P3 | 7 days | Clean up if stale |

---

## Alert Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🟢 GREEN | All healthy | Continue monitoring |
| 🟡 YELLOW | One lane slow | Watch, no action |
| 🟠 ORANGE | P0/P1 stale | Ask user to check |
| 🔴 RED | Lane dead or blocker | User intervention needed |

---

## Current Status

**Last Check:** 2026-04-20T20:40:00Z
**Overall Health:** 🟢 GREEN

**Active Lanes:**
- Library: ACTIVE (last message 4 min ago)
- SwarmMind: ACTIVE (last message 5 min ago)

**Pending Messages:**
- Archivist inbox: 6 messages (all processed)
- Library inbox: 0 pending
- SwarmMind inbox: 0 pending

**No blockers detected.**

---

## Notes

- This monitor is **read-only** - does not modify any files
- Run before each session start
- Run before giving final output to user
- If issues detected, inform user but don't auto-fix
