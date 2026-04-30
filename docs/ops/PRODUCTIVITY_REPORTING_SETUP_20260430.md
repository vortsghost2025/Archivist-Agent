# 🎯 Autonomous Productivity Reporting System — User Guide

## What This Does

Every day at 09:00 UTC, each lane (Archivist, Kernel, Library, SwarmMind) automatically sends you and all other lanes a structured productivity report. No need to ask — you'll get daily pings with exact, actionable needs.

---

## 📋 What's Been Set Up

### Files Added (to all 4 lanes)

| File | Purpose |
|---|---|
| `scripts/daily-productivity-report.js` | Generates the report (Node.js) |
| `scripts/run-daily-report.ps1` | PowerShell wrapper to run the script |
| `setup-productivity-reports.ps1` | One-time setup to create Windows Scheduled Tasks |

### Evidence Storage

Each lane stores its daily reports in:
```
S:/<LANE>/evidence/productivity-reports/daily-report-YYYY-MM-DD.json
```

---

## 🚀 One-Time Setup: Create the Scheduled Tasks

**Open PowerShell as Administrator** and run:

```powershell
# Navigate to Archivist scripts (contains the setup script)
cd S:\Archivist-Agent\scripts

# Run the setup (creates 4 scheduled tasks)
.\setup-productivity-reports.ps1
```

This creates 4 Windows Scheduled Tasks:
- `ARCHIVISTDailyProductivityReport` — runs daily at 09:00 UTC
- `KERNELDailyProductivityReport` — runs daily at 09:00 UTC
- `LIBRARYDailyProductivityReport` — runs daily at 09:00 UTC
- `SWARMMINDDailyProductivityReport` — runs daily at 09:00 UTC

Each task invokes `run-daily-report.ps1` in that lane's `scripts/` folder, which calls `daily-productivity-report.js`.

**Verify tasks created:**
```powershell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*ProductivityReport*"} | Select-Object TaskName, State, @{N='Action';E={$_.Actions.Execute}}
```

---

## 📬 What You'll Receive Daily

Each lane sends a **P2 notification** to `all` with:

- **Productivity score** (0–100)
- **Blockers** — what's slowing them down, impact level, and **explicit requests to other lanes (including you)**
- **Knowledge gaps** — missing information needed to proceed
- **Resource needs** — e.g., disk cleanup, more memory
- **Suggested improvements** — concrete process changes
- **Previous requests status** — what was asked yesterday and whether it's resolved

Example (Kernel's current blockers):
```json
{
  "knowledge_gaps": [
    {
      "topic": "Need CONTRADICTS edge evidence for 3 nodes (a88504c97e8f2e4f, b6a19d32a8604205, 044d760a04bbfa30)",
      "impact": "medium",
      "request": "Archivist: provide CONTRADICTS edge chains for these Archivist-origin artifacts"
    }
  ]
}
```

You'll get one such message per lane daily (4 messages total). They land in:
- `S:/Archivist-Agent/lanes/archivist/inbox/` (for you)
- All other lanes also receive them in their inboxes

---

## 🔧 Maintenance

### To Manually Trigger a Report (any time)

```powershell
# For a specific lane:
cd S:\SwarmMind\scripts
.\run-daily-report.ps1

# Or directly:
node S:\SwarmMind\scripts\daily-productivity-report.js
```

### To Disable Daily Reports (temporarily)

```powershell
Disable-ScheduledTask -TaskName "SWARMMINDDailyProductivityReport"
# Repeat for each lane
```

### To Re-enable

```powershell
Enable-ScheduledTask -TaskName "SWARMMINDDailyProductivityReport"
```

### To View Logs

Each lane writes its own evidence JSON to its `evidence/productivity-reports/` folder. Check those files for full historical data.

---

## ⚙️ Customization

### Change Report Time

Edit the scheduled task trigger (open Task Scheduler → find task → Properties → Triggers) to any time you prefer.

### Adjust What's Monitored

Edit `daily-productivity-report.js` in any lane — the `analyzeBlockers()` function contains lane-specific checks. Add your own metrics.

### Add More Recipients

Change `to: 'all'` in the script to specific lane names if you want directed reports.

---

## 📊 Dashboard (Optional)

I can create a single HTML dashboard that aggregates all 4 lanes' latest reports into one view (color-coded blockers, request tracker, trend graphs). Let me know if you want it.

---

## ✅ Done

- [x] Scripts created and synced to all 4 lanes
- [x] First reports generated (2026-04-30)
- [x] Setup script ready for one‑click scheduled task creation
- [x] Evidence archives initialized

**Next step:** Run `S:\Archivist-Agent\scripts\setup-productivity-reports.ps1` as Administrator to activate the daily schedule.

Questions? Just ask.

---

**SwarmMind** — enabling your visibility into lane needs without you having to ask.
