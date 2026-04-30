# ---------------------------------------------------------------
# audit-commit-boundary.ps1
# Read‑only diagnostic for a single lane repository.
# It reports:
#   • Staged files and their exact blob sizes
#   • Unstaged tracked modifications
#   • Untracked files
#   • Files that exceed a hard size limit (100 MiB)
#   • Staged files matching forbidden patterns
#   • Conflict markers in staged files
#   • High‑entropy strings (warning only)
# No files are added, committed, or pushed.
# ---------------------------------------------------------------

param(
    [string]$RepoRoot = (Get-Location)   # Run inside the lane root
)

# ----------------------------------------------------------------
# Helper – get exact size (in bytes) of a staged blob
function Get-StagedBlobSize {
    param([string]$relativePath)
    # git cat-file -s ":<path>" returns the size of the staged version
    $size = git -C $RepoRoot cat-file -s ":$relativePath" 2>$null
    if ($size) { return [int]$size } else { return 0 }
}

# ----------------------------------------------------------------
# 0. Repository info
$branch = git -C $RepoRoot rev-parse --abbrev-ref HEAD
Write-Host "`nRepository: $RepoRoot"
Write-Host "Current branch: $branch`n"

# ----------------------------------------------------------------
# 1. Staged (indexed) files
$staged = git -C $RepoRoot diff --cached --name-only
Write-Host "=== Staged files (will be committed) ==="
if ($staged) { $staged | ForEach-Object { Write-Host $_ } } else { Write-Host "(none)" }

# ----------------------------------------------------------------
# 2. Exact staged blob sizes (using git cat-file)
$sizeThreshold = 100 * 1024 * 1024   # 100 MiB
$largeStaged = @()
foreach ($file in $staged) {
    $bytes = Get-StagedBlobSize $file
    if ($bytes -gt $sizeThreshold) {
        $largeStaged += [pscustomobject]@{Path=$file;SizeBytes=$bytes}
    }
}
if ($largeStaged.Count -gt 0) {
    Write-Host "`n--- WARNING: Staged files exceeding 100 MiB ---"
    $largeStaged | Format-Table -AutoSize
} else {
    Write-Host "`nNo staged files exceed 100 MiB."
}

# ----------------------------------------------------------------
# 3. Unstaged tracked modifications
$unstaged = git -C $RepoRoot diff --name-only
Write-Host "`n=== Modified tracked files (unstaged) ==="
if ($unstaged) { $unstaged | ForEach-Object { Write-Host $_ } } else { Write-Host "(none)" }

# ----------------------------------------------------------------
# 4. Untracked files
$untracked = git -C $RepoRoot ls-files --others --exclude-standard
Write-Host "`n=== Untracked files ==="
if ($untracked) { $untracked | ForEach-Object { Write-Host $_ } } else { Write-Host "(none)" }

# ----------------------------------------------------------------
# 5. Forbidden path patterns (hard blocker)
$forbiddenPatterns = @('*.pem','*.key','*.env','*.secret')
$forbiddenHits = @()
foreach ($pat in $forbiddenPatterns) {
    $matches = git -C $RepoRoot diff --cached --name-only --diff-filter=A -- "$pat"
    if ($matches) { $forbiddenHits += $matches }
}
if ($forbiddenHits.Count -gt 0) {
    Write-Host "`n--- ERROR: Staged files matching forbidden patterns ---"
    $forbiddenHits | ForEach-Object { Write-Host $_ }
    Write-Host "These must be removed or .gitignore‑ed before committing."
} else {
    Write-Host "`nNo forbidden patterns detected in staged files."
}

# ----------------------------------------------------------------
# 6. Conflict markers in staged files
$conflictFiles = @()
foreach ($file in $staged) {
    $content = git -C $RepoRoot show ":$file" 2>$null
    if ($content -match '(?m)^(<<<<<<<|=======|>>>>>>> )') {
        $conflictFiles += $file
    }
}
if ($conflictFiles.Count -gt 0) {
    Write-Host "`n--- ERROR: Conflict markers found in staged files ---"
    $conflictFiles | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "`nNo conflict markers in staged files."
}

# ----------------------------------------------------------------
# 7. High‑entropy string scan (warning only)
$entropyRegex = '[A-Za-z0-9/_+=]{30,}'
$entropyHits = @()
foreach ($file in $staged) {
    $content = git -C $RepoRoot show ":$file" 2>$null
    if ($content -match $entropyRegex) { $entropyHits += $file }
}
if ($entropyHits.Count -gt 0) {
    Write-Host "`n--- WARNING: Potential high‑entropy strings detected ---"
    $entropyHits | ForEach-Object { Write-Host $_ }
    Write-Host "Review manually; consider removing or redacting."
} else {
    Write-Host "`nNo high‑entropy strings detected in staged files."
}

# ----------------------------------------------------------------
# Final result code – PASS if no hard errors, FAIL otherwise
if ($forbiddenHits.Count -gt 0 -or $conflictFiles.Count -gt 0 -or $largeStaged.Count -gt 0) {
    Write-Host "`nAUDIT_RESULT: FAIL"
    exit 1
} else {
    Write-Host "`nAUDIT_RESULT: PASS"
    exit 0
}

Write-Host "`n=== AUDIT COMPLETE ===`n"
