#!/usr/bin/env powershell
# Delete Duplicate SwarmMind Directories
# SAFETY: Only runs after migration verified

param(
    [switch]$WhatIf,
    [switch]$Execute
)

$ErrorActionPreference = "Stop"

$Canonical = "S:\SwarmMind"
$Duplicate1 = "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
$Duplicate2 = "S:\SwarmMind-Self-Optimizing-Multi-Agent-AI-System"
$LogFile = "S:\Archivist-Agent\scripts\deletion-log.txt"

function Write-Log($Message) {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

Write-Log "=== DUPLICATE DIRECTORY DELETION ==="
Write-Log "Canonical: $Canonical"
Write-Log "Duplicate 1: $Duplicate1"
Write-Log "Duplicate 2: $Duplicate2"
Write-Log ""

# Safety Check 1: Verify canonical exists and has files
$CanonicalFiles = 0
if (Test-Path $Canonical) {
    $CanonicalFiles = (Get-ChildItem -Path $Canonical -Recurse -File).Count
}
Write-Log "Canonical files: $CanonicalFiles"

if ($CanonicalFiles -lt 1000) {
    Write-Log "ERROR: Canonical directory has too few files. Migration may have failed."
    Write-Log "Deletion ABORTED for safety."
    exit 1
}

# Safety Check 2: List what will be deleted
$Dup1Size = 0
$Dup2Size = 0

if (Test-Path $Duplicate1) {
    $Dup1Files = (Get-ChildItem -Path $Duplicate1 -Recurse -File).Count
    $Dup1Size = (Get-ChildItem -Path $Duplicate1 -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Log "Duplicate 1: $Dup1Files files, $([math]::Round($Dup1Size/1MB, 2)) MB"
}

if (Test-Path $Duplicate2) {
    $Dup2Files = (Get-ChildItem -Path $Duplicate2 -Recurse -File).Count
    $Dup2Size = (Get-ChildItem -Path $Duplicate2 -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Log "Duplicate 2: $Dup2Files files, $([math]::Round($Dup2Size/1MB, 2)) MB"
}

if (-not (Test-Path $Duplicate1) -and -not (Test-Path $Duplicate2)) {
    Write-Log "No duplicates found. Nothing to delete."
    exit 0
}

# Show what-if mode
if ($WhatIf -and -not $Execute) {
    Write-Log ""
    Write-Log "=== WHATIF MODE (no changes made) ==="
    Write-Log "Would delete:"
    if (Test-Path $Duplicate1) { Write-Log "  - $Duplicate1" }
    if (Test-Path $Duplicate2) { Write-Log "  - $Duplicate2" }
    Write-Log ""
    Write-Log "To actually delete, run with -Execute flag"
    exit 0
}

# Execute deletion
if ($Execute) {
    Write-Log ""
    Write-Log "=== EXECUTING DELETION ==="
    
    $DeletedCount = 0
    
    if (Test-Path $Duplicate1) {
        try {
            Remove-Item -Path $Duplicate1 -Recurse -Force
            Write-Log "[DELETED] $Duplicate1"
            $DeletedCount++
        } catch {
            Write-Log "[ERROR] Failed to delete $Duplicate1 : $($_.Exception.Message)"
        }
    }
    
    if (Test-Path $Duplicate2) {
        try {
            Remove-Item -Path $Duplicate2 -Recurse -Force
            Write-Log "[DELETED] $Duplicate2"
            $DeletedCount++
        } catch {
            Write-Log "[ERROR] Failed to delete $Duplicate2 : $($_.Exception.Message)"
        }
    }
    
    Write-Log ""
    Write-Log "=== DELETION COMPLETE ==="
    Write-Log "Directories deleted: $DeletedCount"
    Write-Log "Canonical remains: $Canonical ($CanonicalFiles files)"
    Write-Log ""
    Write-Log "System now uses canonical path only."
}
