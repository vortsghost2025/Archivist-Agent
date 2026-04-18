# LANE-CONTEXT RECONCILIATION CHECK
# Purpose: Verify pwd, session-lock, and registry alignment before writes
# Authority: Required for all lanes
# Usage: ./lane-context-check.ps1 -TargetFile "path/to/file"

param(
    [Parameter(Mandatory=$false)]
    [string]$TargetFile = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SessionStart
)

$ErrorActionPreference = "Stop"

# ANSI-safe output (no mojibake)
function Write-Status {
    param([string]$Message)
    Write-Output "[i] $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Output "[+] $Message"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Output "[!] $Message"
}

# Determine lane from path
function Get-LaneFromPath {
    param([string]$Path)
    
    $normalizedPath = $Path -replace '\\', '/'
    
    if ($normalizedPath -match '/Archivist-Agent') {
        return "archivist-agent"
    }
    elseif ($normalizedPath -match '/SwarmMind') {
        return "swarmmind"
    }
    elseif ($normalizedPath -match '/self-organizing-library') {
        return "library"
    }
    elseif ($normalizedPath -match '/\.global') {
        return "archivist-agent"
    }
    else {
        return "unknown"
    }
}

# Main check logic
Write-Status "LANE-CONTEXT RECONCILIATION CHECK"
Write-Status "================================="

# Check 1: Current pwd
$pwdPath = Get-Location
$pwdLane = Get-LaneFromPath -Path $pwdPath.Path
Write-Status "pwd: $($pwdPath.Path)"
Write-Status "pwd_lane: $pwdLane"

# Check 2: Session-lock
$sessionLockPath = Join-Path $pwdPath.Path ".session-lock"
if (Test-Path $sessionLockPath) {
    $sessionLock = Get-Content $sessionLockPath -Raw | ConvertFrom-Json
    $sessionLane = $sessionLock.lane_id
    $sessionId = $sessionLock.session_id
    $expires = $sessionLock.expires
    
    Write-Status "session-lock found:"
    Write-Status "  lane_id: $sessionLane"
    Write-Status "  session_id: $sessionId"
    Write-Status "  expires: $expires"
    
    # Check expiry
    $expiresTime = [DateTime]::Parse($expires)
    $now = Get-Date
    if ($expiresTime -lt $now) {
        Write-Error-Custom "SESSION-LOCK EXPIRED: $expires"
        Write-Error-Custom "Reconciliation required before proceeding"
        exit 1
    }
}
else {
    Write-Error-Custom "NO SESSION-LOCK FOUND"
    Write-Error-Custom "Create session-lock before proceeding"
    exit 1
}

# Check 3: Registry
$registryPath = Join-Path $pwdPath.Path "SESSION_REGISTRY.json"
if (Test-Path $registryPath) {
    $registry = Get-Content $registryPath -Raw | ConvertFrom-Json
    $activeSession = $registry.active_sessions.PSObject.Properties | Where-Object { $_.Name -eq $sessionLane }
    
    if ($activeSession) {
        $regSessionId = $activeSession.Value.session_id
        Write-Status "registry entry found for: $sessionLane"
        Write-Status "  session_id: $regSessionId"
        
        # Verify session ID match
        if ($regSessionId -ne $sessionId) {
            Write-Error-Custom "SESSION ID MISMATCH"
            Write-Error-Custom "  lock: $sessionId"
            Write-Error-Custom "  registry: $regSessionId"
            Write-Error-Custom "Reconciliation required"
            exit 1
        }
    }
    else {
        Write-Error-Custom "NO REGISTRY ENTRY FOR: $sessionLane"
        Write-Error-Custom "Update SESSION_REGISTRY.json before proceeding"
        exit 1
    }
}
else {
    Write-Error-Custom "NO SESSION_REGISTRY.json FOUND"
    exit 1
}

# Reconciliation check
if ($pwdLane -ne $sessionLane) {
    Write-Error-Custom "LANE-CONTEXT MISMATCH"
    Write-Error-Custom "  pwd_lane: $pwdLane"
    Write-Error-Custom "  session_lane: $sessionLane"
    Write-Error-Custom "Reconciliation required before proceeding"
    exit 1
}

Write-Success "Lane-context reconciled: $sessionLane"

# If target file specified, check ownership
if ($TargetFile -ne "") {
    Write-Status ""
    Write-Status "TARGET FILE OWNERSHIP CHECK"
    Write-Status "---------------------------"
    
    $targetPath = Resolve-Path $TargetFile -ErrorAction SilentlyContinue
    if (-not $targetPath) {
        $targetPath = $TargetFile
    }
    
    $targetLane = Get-LaneFromPath -Path $targetPath.ToString()
    Write-Status "target: $targetPath"
    Write-Status "target_lane: $targetLane"
    
    # Load ownership registry
    $ownershipPath = Join-Path $pwdPath.Path "FILE_OWNERSHIP_REGISTRY.json"
    if (Test-Path $ownershipPath) {
        $ownership = Get-Content $ownershipPath -Raw | ConvertFrom-Json
        $myAuthority = 0
        
        # Determine my authority
        $ownershipPath2 = $pwdPath.Path -replace '\\', '\\\\'
        if ($ownership.ownership.PSObject.Properties.Name -contains $ownershipPath2) {
            $myAuthority = $ownership.ownership.$ownershipPath2.authority
        }
        else {
            $myAuthority = 100  # Governance root default
        }
        
        Write-Status "my_authority: $myAuthority"
        
        # Check write permission
        if ($targetLane -ne $sessionLane) {
            if ($myAuthority -lt 100) {
                Write-Error-Custom "CROSS-LANE WRITE BLOCKED"
                Write-Error-Custom "  session_lane: $sessionLane"
                Write-Error-Custom "  target_lane: $targetLane"
                Write-Error-Custom "  authority: $myAuthority (requires >= 100)"
                Write-Error-Custom "ENTERING HOLD STATE"
                Write-Error-Custom "Operator resolution required"
                exit 1
            }
            else {
                Write-Success "Cross-lane write ALLOWED (authority >= 100)"
            }
        }
        else {
            Write-Success "Same-lane write ALLOWED"
        }
    }
    else {
        Write-Error-Custom "NO FILE_OWNERSHIP_REGISTRY.json FOUND"
        Write-Error-Custom "Cannot verify target ownership"
        exit 1
    }
}

# Session start check
if ($SessionStart) {
    Write-Status ""
    Write-Status "SESSION START VERIFICATION"
    Write-Status "--------------------------"
    Write-Success "All checks passed"
    Write-Success "Session: $sessionId"
    Write-Success "Lane: $sessionLane"
    Write-Success "Ready to proceed"
}

exit 0
