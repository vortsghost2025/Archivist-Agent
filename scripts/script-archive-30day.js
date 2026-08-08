#!/usr/bin/env node
'use strict';
// script-archive-30day.js
// Implements SCRIPT_INDEX Rule #3: "scripts unused for 30 days get archived".
//
// This tool derives a "last-used" signal for every tracked script and reports
// (or, with --apply, archives) scripts that have not been touched in >= 30 days.
//
// Last-used heuristic (most recent wins):
//   1. git log: last commit that touched the file (author date)
//   2. filesystem mtime
//   3. recent reference in ~/agent/logs (last line mentioning the basename)
//
// DEFAULT MODE IS DRY-RUN. Nothing is moved unless --apply is passed.
// Archive target: <repo>/scripts/_archived-30day/<YYYY-MM-DD>/<script>

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = !process.argv.includes('--apply');
const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || 30);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const ARCHIVE_ROOT = path.join(SCRIPTS_DIR, '_archived-30day');
const LOG_DIR = path.join(REPO_ROOT, '..', 'logs');
const CUTOFF_MS = DAYS * 24 * 60 * 60 * 1000;

function gitLastTouch(fileRel) {
  try {
    const out = execSync(`git -C "${REPO_ROOT}" log -1 --format=%ci -- "${fileRel}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return new Date(out).getTime();
  } catch (_) {}
  return null;
}

function logLastReference(basename) {
  try {
    const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.log'));
    let best = 0;
    for (const f of files) {
      const p = path.join(LOG_DIR, f);
      const st = fs.statSync(p);
      if (st.mtimeMs > best) {
        // cheap heuristic: only consider logs modified recently enough to matter
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes(basename)) best = Math.max(best, st.mtimeMs);
      }
    }
    return best || null;
  } catch (_) {
    return null;
  }
}

function lastUsed(absPath, relPath, basename) {
  const candidates = [
    gitLastTouch(relPath),
    fs.statSync(absPath).mtimeMs,
    logLastReference(basename),
  ].filter((x) => x && !isNaN(x));
  return candidates.length ? Math.max(...candidates) : null;
}

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error('scripts/ directory not found');
    process.exit(1);
  }
  const files = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_archived'))
    .map((f) => path.join(SCRIPTS_DIR, f));

  const now = Date.now();
  const candidates = [];
  const report = [];

  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs);
    const base = path.basename(abs);
    const used = lastUsed(abs, rel, base);
    const ageDays = used ? (now - used) / CUTOFF_MS : Infinity;
    const stale = used === null || now - used >= CUTOFF_MS;
    report.push({ script: rel, last_used: used ? new Date(used).toISOString() : 'unknown', age_days: isFinite(ageDays) ? Math.round(ageDays * 10) / 10 : 'unknown', stale });
    if (stale) candidates.push({ abs, rel, base, used });
  }

  report.sort((a, b) => (b.age_days === 'unknown' ? -1 : b.age_days) - (a.age_days === 'unknown' ? -1 : a.age_days));
  console.log(`30-DAY SCRIPT ARCHIVE REPORT (cutoff=${DAYS}d, mode=${DRY_RUN ? 'DRY-RUN' : 'APPLY'})`);
  console.log('='.repeat(70));
  for (const r of report) {
    const mark = r.stale ? 'ARCHIVE' : 'keep   ';
    console.log(`${mark}  ${r.script}  (last_used=${r.last_used}, age=${r.age_days}d)`);
  }
  console.log('='.repeat(70));
  console.log(`Total scripts: ${report.length} | Archive candidates: ${candidates.length}`);

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no files moved. Pass --apply to archive candidates.');
    return;
  }

  if (candidates.length === 0) {
    console.log('Nothing to archive.');
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(ARCHIVE_ROOT, stamp);
  fs.mkdirSync(dest, { recursive: true });
  for (const c of candidates) {
    const target = path.join(dest, c.base);
    fs.renameSync(c.abs, target);
    console.log(`archived: ${c.rel} -> ${path.relative(REPO_ROOT, target)}`);
  }
  console.log(`\nArchived ${candidates.length} script(s) to ${path.relative(REPO_ROOT, dest)}`);
}

main();
