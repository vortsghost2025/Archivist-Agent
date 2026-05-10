#!/usr/bin/env pwsh
# DEPRECATED — Do not use. This script is superseded by hooks/pre-commit.js.
# The tracked hook in hooks/ provides sovereignty, Gate 2, canonical script guard,
# NTFS check, lint, secret scan, trust store validation, and journal preflight.
# Install with: node hooks/install.js
# See: hooks/README.md
#
# This file is retained for reference only and will be removed in a future cleanup.
#
# Original description:
# Pre-commit verification script
# 1) Run lint if defined in package.json (npm script "lint"). This step is optional and will be skipped if no package.json is present.
# 2) Scan staged files for secret patterns (.pem, .key, .jws) and prohibited direct signing calls.
# 3) Exit with non‑zero code on any failure to block the commit

# Lint step (optional)
if (Test-Path "package.json") {
    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction Stop
        if ($pkg.scripts -and $pkg.scripts.lint) {
            Write-Host "Running npm lint..."
            npm run lint
            if ($LASTEXITCODE -ne 0) {
                Write-Error "npm lint failed"
                exit 1
            }
        }
    } catch {
        Write-Warning "Unable to parse package.json – skipping lint step"
    }
}

# Secret scan on staged files
$staged = git diff --cached --name-only
foreach ($file in $staged) {
    if ($file -match "\\.(pem|key|jws)$") {
        Write-Error "Secret file staged for commit: $file"
        exit 1
    }
    # Block direct usage of the low‑level signing script – enforce wrapper
    if ($file -match "sign-outbox-message\.js$") {
        Write-Error "Direct use of sign-outbox-message.js is prohibited. Use sign-with-prevalidation.js instead: $file"
        exit 1
    }
}

exit 0
