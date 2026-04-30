#!/usr/bin/env node
/**
 * Health‑check script – runs a one‑time monitor snapshot.
 * Exits with status 0 if no critical alerts are active, otherwise exits 1.
 * Used by CI to catch drift before a commit is merged.
 */
const { execSync } = require('child_process');

function runMonitorOnce() {
  try {
    const out = execSync('node scripts/monitor.js --once', { encoding: 'utf8' });
    console.log(out);
    // Look for the "Alerts triggered:" section and parse severity
    const lines = out.split('\n');
    const alertLines = lines.filter(l => l.trim().startsWith('⚠️'));
    // If any alert line contains "CRITICAL" we treat as failure
    for (const line of alertLines) {
      if (line.toUpperCase().includes('CRITICAL')) {
        console.error('[health-check] Critical alert detected');
        process.exit(1);
      }
    }
    // No critical alerts – success
    process.exit(0);
  } catch (e) {
    console.error('[health-check] Monitor execution failed:', e.message);
    process.exit(1);
  }
}

runMonitorOnce();
