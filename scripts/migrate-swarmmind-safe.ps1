#!/usr/bin/env powershell
# SwarmMind Safe Migration Script
# Migrates work from duplicate directories to canonical S:/SwarmMind
# Does NOT delete source until verified

param(
    [switch]$WhatIf,
    [switch]$VerifyOnly,
    [switch]$Execute
)

$ErrorActionPreference = "Stop"

$Canonical = "S:\SwarmMind"
$Duplicate1 = "S:\SwarmMind Self-Optimizing Multi-Agent AI System"
$Duplicate2 = "S:\SwarmMind-Self-Optimizing-Multi-Agent-AI-System"
$LogFile = "S:\Archivist-Agent\scripts\swarmmind-migration-log.txt"

function Write-Log($Message) {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

function Get-FileHashSafe($Path) {
    try {
        return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    } catch {
        return $null
    }
}

# Step 1: Inventory all directories
Write-Log "=== SWARMMIND MIGRATION INVENTORY ==="
Write-Log "Canonical: $Canonical"
Write-Log "Duplicate 1: $Duplicate1"
Write-Log "Duplicate 2: $Duplicate2"
Write-Log ""

$Files1 = @()
$Files2 = @()
$CanonicalFiles = @()

if (Test-Path $Duplicate1) {
    $Files1 = Get-ChildItem -Path $Duplicate1 -Recurse -File
    Write-Log "Duplicate 1 files: $($Files1.Count)"
}

if (Test-Path $Duplicate2) {
    $Files2 = Get-ChildItem -Path $Duplicate2 -Recurse -File
    Write-Log "Duplicate 2 files: $($Files2.Count)"
}

if (Test-Path $Canonical) {
    $CanonicalFiles = Get-ChildItem -Path $Canonical -Recurse -File
    Write-Log "Canonical files: $($CanonicalFiles.Count)"
}

# Step 2: Build file hash database for conflict detection
Write-Log ""
Write-Log "=== BUILDING FILE DATABASE ==="
$FileDatabase = @{}

foreach ($File in $Files1) {
    $RelativePath = $File.FullName.Substring($Duplicate1.Length + 1)
    $FileDatabase[$RelativePath] = @{
        Source = "Duplicate1"
        FullPath = $File.FullName
        Size = $File.Length
        LastWrite = $File.LastWriteTime
    }
}

foreach ($File in $Files2) {
    $RelativePath = $File.FullName.Substring($Duplicate2.Length + 1)
    if ($FileDatabase.ContainsKey($RelativePath)) {
        # Conflict - file exists in both duplicates
        $Existing = $FileDatabase[$RelativePath]
        if ($File.LastWriteTime -gt $Existing.LastWriteTime) {
            # Duplicate2 has newer version
            $FileDatabase[$RelativePath] = @{
                Source = "Duplicate2"
                FullPath = $File.FullName
                Size = $File.Length
                LastWrite = $File.LastWriteTime
                Conflict = $true
            }
        }
    } else {
        $FileDatabase[$RelativePath] = @{
            Source = "Duplicate2"
            FullPath = $File.FullName
            Size = $File.Length
            LastWrite = $File.LastWriteTime
        }
    }
}

Write-Log "Total unique files to migrate: $($FileDatabase.Count)"

# Step 3: Show what would be copied (WhatIf mode)
if ($WhatIf -or $VerifyOnly) {
    Write-Log ""
    Write-Log "=== MIGRATION PREVIEW (WhatIf) ==="
    
    $Migrated = 0
    $Skipped = 0
    $Conflicts = 0
    
    foreach ($Entry in $FileDatabase.GetEnumerator()) {
        $RelativePath = $Entry.Key
        $Source = $Entry.Value.Source
        $SourcePath = $Entry.Value.FullPath
        $TargetPath = Join-Path $Canonical $RelativePath
        
        if ($Entry.Value.Conflict) {
            $Conflicts++
            Write-Log "[CONFLICT] $RelativePath (using $Source version)"
        }
        
        if (Test-Path $TargetPath) {
            $Skipped++
        } else {
            $Migrated++
            Write-Log "[COPY] $RelativePath"
        }
    }
    
    Write-Log ""
    Write-Log "=== MIGRATION SUMMARY ==="
    Write-Log "Files to migrate: $Migrated"
    Write-Log "Files already in canonical: $Skipped"
    Write-Log "Conflicts resolved: $Conflicts"
    Write-Log ""
    Write-Log "To execute migration, run with -Execute flag"
    
    exit 0
}

# Step 4: Execute migration
if ($Execute) {
    Write-Log ""
    Write-Log "=== EXECUTING MIGRATION ==="
    
    $Migrated = 0
    $Failed = 0
    $Skipped = 0
    
    foreach ($Entry in $FileDatabase.GetEnumerator()) {
        $RelativePath = $Entry.Key
        $SourcePath = $Entry.Value.FullPath
        $TargetPath = Join-Path $Canonical $RelativePath
        
        if (Test-Path $TargetPath) {
            $Skipped++
            continue
        }
        
        # Create target directory
        $TargetDir = Split-Path -Parent $TargetPath
        if (-not (Test-Path $TargetDir)) {
            New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        }
        
        try {
            Copy-Item -Path $SourcePath -Destination $TargetPath -Force
            $Migrated++
            Write-Log "[OK] $RelativePath"
        } catch {
            $Failed++
            Write-Log "[FAIL] $RelativePath : $($_.Exception.Message)"
        }
    }
    
    Write-Log ""
    Write-Log "=== MIGRATION COMPLETE ==="
    Write-Log "Migrated: $Migrated"
    Write-Log "Failed: $Failed"
    Write-Log "Skipped (already exist): $Skipped"
    Write-Log ""
    
    # Step 5: Verification
    Write-Log "=== VERIFYING CANONICAL ==="
    $CanonicalFilesAfter = Get-ChildItem -Path $Canonical -Recurse -File
    Write-Log "Canonical files after migration: $($CanonicalFilesAfter.Count)"
    
    Write-Log ""
    Write-Log "MIGRATION COMPLETE"
    Write-Log "IMPORTANT: Original directories NOT deleted yet."
    Write-Log "Verify canonical directory has all files, then manually delete duplicates."
}
