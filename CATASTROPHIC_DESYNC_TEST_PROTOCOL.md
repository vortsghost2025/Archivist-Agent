# CATASTROPHIC DESYNC TEST PROTOCOL

**Purpose:** Validate recovery when all three lanes lose state simultaneously
**Recommended by:** self-organizing-library (Lane 3) audit
**Risk Level:** HIGH — will corrupt production state
**Prerequisite:** Create backup snapshots before execution

---

## TEST OBJECTIVE

Prove or disprove: "The system can recover from catastrophic state loss without human intervention"

---

## PRE-TEST REQUIREMENTS

### 1. Create Full Backup
```powershell
# Backup all state files
$date = Get-Date -Format "yyyy-MM-dd-HHmmss"
New-Item -ItemType Directory -Path "S:\Archivist-Agent\backups\$date" -Force

# Archivist state
Copy-Item "S:\Archivist-Agent\SESSION_REGISTRY.json" "S:\Archivist-Agent\backups\$date\"
Copy-Item "S:\Archivist-Agent\RUNTIME_STATE.json" "S:\Archivist-Agent\backups\$date\" -ErrorAction SilentlyContinue
Copy-Item "S:\Archivist-Agent\.runtime\active_agents.json" "S:\Archivist-Agent\backups\$date\"

# SwarmMind state
Copy-Item "S:\SwarmMind Self-Optimizing Multi-Agent AI System\RUNTIME_STATE.json" "S:\Archivist-Agent\backups\$date\swarmmind_RUNTIME_STATE.json" -ErrorAction SilentlyContinue

# Library state (including database)
Copy-Item "S:\self-organizing-library\RUNTIME_STATE.json" "S:\Archivist-Agent\backups\$date\library_RUNTIME_STATE.json" -ErrorAction SilentlyContinue
Copy-Item "S:\self-organizing-library\data\nexusgraph.db" "S:\Archivist-Agent\backups\$date\nexusgraph.db" -ErrorAction SilentlyContinue

Write-Host "[+] Backup created at S:\Archivist-Agent\backups\$date"
```

### 2. Document Current State
```powershell
# Capture current session state
Get-Content "S:\Archivist-Agent\SESSION_REGISTRY.json" | Out-File "S:\Archivist-Agent\backups\$date\SESSION_REGISTRY_BEFORE.json"
Get-Content "S:\Archivist-Agent\.runtime\active_agents.json" | Out-File "S:\Archivist-Agent\backups\$date\active_agents_BEFORE.json"
```

### 3. Verify Git State
```powershell
cd S:\Archivist-Agent
git status
git log -1 --oneline
```

---

## TEST PHASES

### Phase 1: Terminate All Lanes (Simulated)

**Current State:** Only Archivist is active (you reading this)
**SwarmMind:** Already terminated (SESSION_HANDOFF exists)
**Library:** No session (observer test)

**Action:**
- Archivist: Mark as terminated in SESSION_REGISTRY
- Create artificial "crash" marker

```powershell
# Create crash marker
echo '{"crashed_at":"2026-04-17T12:30:00.000Z","reason":"desync-test"}' > "S:\Archivist-Agent\CRASH_IN_PROGRESS.marker"

# Update SESSION_REGISTRY to show crash
$sr = Get-Content "S:\Archivist-Agent\SESSION_REGISTRY.json" | ConvertFrom-Json
$sr.active_sessions.PSObject.Properties.Remove("archivist-agent")
$sr.terminated_sessions | Add-Member -NotePropertyName "archivist-agent-test-crash" -NotePropertyValue @{
    lane_id = "archivist-agent"
    session_id = "1776403587854-50060"
    terminated = "2026-04-17T12:30:00.000Z"
    termination_reason = "Desync test - catastrophic state loss"
    last_heartbeat = "2026-04-17T12:30:00.000Z"
} -Force
$sr | ConvertTo-Json -Depth 10 | Set-Content "S:\Archivist-Agent\SESSION_REGISTRY.json"
```

### Phase 2: Delete State Files

```powershell
# Delete SESSION_REGISTRY
Remove-Item "S:\Archivist-Agent\SESSION_REGISTRY.json" -Force

# Delete active_agents
Remove-Item "S:\Archivist-Agent\.runtime\active_agents.json" -Force

# Delete any lock files
Remove-Item "S:\Archivist-Agent\.session-lock" -ErrorAction SilentlyContinue
Remove-Item "S:\SwarmMind Self-Optimizing Multi-Agent AI System\.session-lock" -ErrorAction SilentlyContinue
Remove-Item "S:\self-organizing-library\.session-lock" -ErrorAction SilentlyContinue

# Keep RUNTIME_STATE files (test can bootstrap from them)
# Optionally delete RUNTIME_STATE too for harder test:
# Remove-Item "S:\Archivist-Agent\RUNTIME_STATE.json" -Force
# Remove-Item "S:\SwarmMind Self-Optimizing Multi-Agent AI System\RUNTIME_STATE.json" -Force
# Remove-Item "S:\self-organizing-library\RUNTIME_STATE.json" -Force

Write-Host "[+] State files deleted"
```

### Phase 3: Corrupt Database (Simulated)

```powershell
# Corrupt last 1KB of nexusgraph.db
$dbPath = "S:\self-organizing-library\data\nexusgraph.db"
if (Test-Path $dbPath) {
    $bytes = [System.IO.File]::ReadAllBytes($dbPath)
    $corruptStart = $bytes.Length - 1024
    for ($i = $corruptStart; $i -lt $bytes.Length; $i++) {
        $bytes[$i] = 0x00  # Zero out last 1KB
    }
    [System.IO.File]::WriteAllBytes($dbPath, $bytes)
    Write-Host "[+] Database corrupted (last 1KB zeroed)"
} else {
    Write-Host "[!] Database not found at $dbPath"
}
```

### Phase 4: Bootstrap Recovery

**Start new Archivist session:**

Tell the agent:
> "Catastrophic desync test in progress. SESSION_REGISTRY deleted. Database corrupted. Bootstrap from BOOTSTRAP.md only."

**Measure:**
1. Time to detect missing SESSION_REGISTRY
2. Time to create new registry
3. Time to detect database corruption
4. Whether system can re-establish coordination without existing state

### Phase 5: Recovery Validation

**Checklist:**
- [ ] Archivist reads BOOTSTRAP.md
- [ ] Archivist detects missing SESSION_REGISTRY
- [ ] Archivist creates new SESSION_REGISTRY
- [ ] Archivist detects database corruption (if library referenced)
- [ ] Cross-lane sync attempted
- [ ] Coordination re-established

---

## SUCCESS CRITERIA

| Criterion | Pass | Fail |
|-----------|------|------|
| Detect missing SESSION_REGISTRY | Yes | No |
| Create valid new registry | Yes | No |
| Detect database corruption | Yes | No |
| Bootstrap from BOOTSTRAP.md | Yes | No |
| Re-establish coordination | Yes | No |
| No data loss (git intact) | Yes | No |

---

## FAILURE MODES TO WATCH

1. **Blind operation without registry** — Proceed without detecting missing state
2. **Incomplete registry creation** — Missing required fields
3. **Database read after corruption** — Crash or silent data loss
4. **No upstream validation** — Operate on stale references
5. **Git corruption** — Lose commit history

---

## POST-TEST RECOVERY

```powershell
# Restore from backup
$date = Get-ChildItem "S:\Archivist-Agent\backups" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { $_.Name }

Copy-Item "S:\Archivist-Agent\backups\$date\SESSION_REGISTRY.json" "S:\Archivist-Agent\" -Force
Copy-Item "S:\Archivist-Agent\backups\$date\active_agents.json" "S:\Archivist-Agent\.runtime\" -Force
Copy-Item "S:\Archivist-Agent\backups\$date\nexusgraph.db" "S:\self-organizing-library\data\" -Force

# Verify restoration
Get-Content "S:\Archivist-Agent\SESSION_REGISTRY.json" | Select-String "archivist-agent"

Write-Host "[+] State restored from backup $date"
```

---

## TEST LOG FORMAT

```
=== CATASTROPHIC DESYNC TEST LOG ===
Date: 2026-04-17
Backup created: [timestamp]
Phase 1 completed: [timestamp]
Phase 2 completed: [timestamp]
Phase 3 completed: [timestamp]
Phase 4 start: [timestamp]
Recovery detected at: [timestamp]
Recovery completed at: [timestamp]
Total recovery time: [duration]

FINDINGS:
- [observation 1]
- [observation 2]
- [observation 3]

FAILURE MODES:
- [failure 1 or "None detected"]

NEXT STEPS:
- [recommendation]
```

---

## SAFETY CHECKS

Before running test, verify:
- [ ] Backup created
- [ ] Git commits pushed (no uncommitted work)
- [ ] No active sessions on other lanes (SwarmMind already terminated)
- [ ] Database backup exists
- [ ] Recovery script tested

---

## WHEN TO ABORT

Abort test if:
1. Backup creation fails
2. Git has uncommitted changes
3. Database is production-critical (no backup)
4. Other lanes are actively working

---

**STATUS:** Ready to execute (awaiting user confirmation)

**NEXT STEP:** User says "run desync test" to begin Phase 1
