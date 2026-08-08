#!/usr/bin/env node
'use strict';

// PHASE 8: Safe Autonomous CI Replacement
// Constitutional governance: explicit invocation only, worktree isolation, allowlist-based, no auto-push

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VERSION = '1.0.0';

// Files this daemon is ALLOWED to touch. Everything else is ignored.
const ALLOWED_PATTERNS = [
  /^scripts\/.*\.js$/,
  /^scripts\/.*\.ps1$/,
  /^scripts\/.*\.sh$/,
  /^\.github\/workflows\/.*\.yml$/,
  /^src-tauri\/src\/.*\.rs$/,
  /^src-tauri\/Cargo\.toml$/,
  /^config\/.*\.json$/,
  /^config\/.*\.yaml$/,
  /^config\/.*\.yml$/,
  /^docs\/.*\.md$/,
  /^AGENTS\.md$/,
  /^BOOTSTRAP\.md$/,
  /^GOVERNANCE\.md$/,
  /^CONSTITUTION\.md$/,
  /^README\.md$/,
];

// Files this daemon is FORBIDDEN from touching regardless of pattern
const FORBIDDEN_PATTERNS = [
  /\.env$/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.jks$/,
  /\.secret$/,
  /context-buffer\/.*/,
  /lanes\/.*\/metrics\//,
  /lanes\/.*\/state\/snapshots\//,
  /lanes\/.*\/state\/active-owner\.json$/,
  /lanes\/.*\/state\/alerts\.log$/,
  /logs\/contradiction-adjudicator\.json$/,
];

const DEFAULT_POLL_MS = 15000;
const MAX_CYCLES = 10;
const COMMIT_MSG_PREFIX = '[safe-ci]';

function nowIso() { return new Date().toISOString(); }
function nowStamp() { return nowIso().replace(/[:.]/g, '-'); }

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function isAllowed(filePath) {
  // Check forbidden first (stronger than allowed)
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(filePath)) return false;
  }
  for (const pat of ALLOWED_PATTERNS) {
    if (pat.test(filePath)) return true;
  }
  return false;
}

function runGit(repoRoot, args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: opts.timeout || 30000,
    maxBuffer: 200000,
    ...opts,
  });
  return {
    ok: res.status === 0,
    exitCode: res.status,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
  };
}

function getRepoState(repoRoot) {
  const status = runGit(repoRoot, ['status', '--porcelain']);
  if (!status.ok) return { ok: false, error: status.stderr };

  const lines = status.stdout.split('\n').filter(l => l.trim());
  const files = lines.map(line => {
    const match = line.match(/^(.{2})\s+(.+)$/);
    if (!match) return null;
    const code = match[1];
    const filePath = match[2];
    return {
      code,
      filePath,
      staged: code[0] !== ' ' && code[0] !== '?',
      untracked: code[0] === '?',
      allowed: isAllowed(filePath),
    };
  }).filter(Boolean);

  return { ok: true, files, total: files.length, allowed: files.filter(f => f.allowed).length };
}

function createWorktree(repoRoot, branch) {
  const worktreeDir = path.join(repoRoot, '.worktrees', `safe-ci-${nowStamp()}`);
  const res = runGit(repoRoot, ['worktree', 'add', '-b', `safe-ci/${nowStamp()}`, worktreeDir, 'HEAD']);
  if (!res.ok) return { ok: false, error: res.stderr };
  return { ok: true, worktreeDir };
}

function cleanupWorktree(repoRoot, worktreeDir) {
  try {
    runGit(repoRoot, ['worktree', 'remove', '--force', worktreeDir]);
    runGit(repoRoot, ['branch', '-D', path.basename(worktreeDir)]);
  } catch (_) {}
}

function commitChanges(worktreeDir, files, dryRun) {
  const results = [];
  for (const file of files) {
    if (!file.allowed) {
      results.push({ file: file.filePath, status: 'SKIPPED', reason: 'not_in_allowlist' });
      continue;
    }

    if (dryRun) {
      results.push({ file: file.filePath, status: 'WOULD_COMMIT' });
      continue;
    }

    const stageRes = runGit(worktreeDir, ['add', '--', file.filePath]);
    if (!stageRes.ok) {
      results.push({ file: file.filePath, status: 'ERROR', reason: stageRes.stderr });
      continue;
    }

    const msg = `${COMMIT_MSG_PREFIX} ${file.filePath} ${nowStamp()}`;
    const commitRes = runGit(worktreeDir, ['commit', '-m', msg, '--', file.filePath]);
    if (!commitRes.ok) {
      results.push({ file: file.filePath, status: 'ERROR', reason: commitRes.stderr });
      continue;
    }

    results.push({ file: file.filePath, status: 'COMMITTED', sha: commitRes.stdout.slice(0, 8) });
  }
  return results;
}

function parseArgs(argv) {
  const out = {
    repoRoot: process.cwd(),
    worktree: null,
    dryRun: true,
    maxCycles: MAX_CYCLES,
    pollMs: DEFAULT_POLL_MS,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.dryRun = false;
    else if (a === '--repo' && argv[i + 1]) { out.repoRoot = argv[++i]; }
    else if (a === '--worktree' && argv[i + 1]) { out.worktree = argv[++i]; }
    else if (a === '--max-cycles' && argv[i + 1]) { out.maxCycles = Math.max(1, parseInt(argv[++i]) || MAX_CYCLES); }
    else if (a === '--poll-ms' && argv[i + 1]) { out.pollMs = Math.max(1000, parseInt(argv[++i]) || DEFAULT_POLL_MS); }
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node safe-ci-daemon.js [options]
  --repo <path>        Repository root (default: cwd)
  --worktree <path>    Existing worktree to use (default: create new)
  --apply              Actually commit changes (default: dry-run)
  --max-cycles <N>     Max cycles before exit (default: ${MAX_CYCLES})
  --poll-ms <N>        Poll interval in ms (default: ${DEFAULT_POLL_MS})
  --help, -h           Show this help

Safety model:
  - Worktree isolation: commits happen in isolated worktree, never main working tree
  - Allowlist: only files matching ALLOWED_PATTERNS are processed
  - Forbidden: .env, .pem, .key, runtime artifacts are never touched
  - No auto-push: commits stay in worktree until operator pushes manually
  - Dry-run default: use --apply to enable commits
`);
      process.exit(0);
    }
  }
  return out;
}

async function runCycle(repoRoot, worktreeDir, dryRun) {
  const targetDir = worktreeDir || repoRoot;
  const state = getRepoState(targetDir);

  if (!state.ok) {
    return { cycle: 'error', error: state.error };
  }

  if (state.total === 0) {
    return { cycle: 'clean', files: 0, allowed: 0 };
  }

  const results = commitChanges(targetDir, state.files, dryRun);
  const committed = results.filter(r => r.status === 'COMMITTED').length;
  const wouldCommit = results.filter(r => r.status === 'WOULD_COMMIT').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  return {
    cycle: 'processed',
    files: state.total,
    allowed: state.allowed,
    committed,
    wouldCommit,
    skipped,
    errors,
    details: results,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repoRoot);

  if (!fs.existsSync(repoRoot)) {
    console.error(`[safe-ci] Repository root not found: ${repoRoot}`);
    process.exit(1);
  }

  console.log(`[safe-ci] v${VERSION} repo=${repoRoot} dry_run=${args.dryRun} max_cycles=${args.maxCycles}`);

  let worktreeDir = args.worktree;
  let createdWorktree = false;

  if (!worktreeDir) {
    console.log(`[safe-ci] Creating isolated worktree...`);
    const wt = createWorktree(repoRoot);
    if (!wt.ok) {
      console.error(`[safe-ci] Failed to create worktree: ${wt.error}`);
      process.exit(1);
    }
    worktreeDir = wt.worktreeDir;
    createdWorktree = true;
    console.log(`[safe-ci] Worktree created: ${worktreeDir}`);
  }

  const handleExit = () => {
    if (createdWorktree && worktreeDir) {
      console.log(`[safe-ci] Cleaning up worktree: ${worktreeDir}`);
      cleanupWorktree(repoRoot, worktreeDir);
    }
    process.exit(0);
  };

  process.on('SIGTERM', handleExit);
  process.on('SIGINT', handleExit);

  for (let cycle = 1; cycle <= args.maxCycles; cycle++) {
    try {
      const result = await runCycle(repoRoot, worktreeDir, args.dryRun);
      console.log(`[safe-ci] cycle=${cycle}/${args.maxCycles} ${JSON.stringify(result)}`);

      if (result.cycle === 'clean') {
        console.log(`[safe-ci] Working tree clean, exiting.`);
        break;
      }

      if (result.cycle === 'error') {
        console.error(`[safe-ci] Cycle error: ${result.error}`);
        break;
      }

      if (args.dryRun && result.wouldCommit > 0) {
        console.log(`[safe-ci] Dry-run: ${result.wouldCommit} files would be committed. Use --apply to commit.`);
      }

      if (!args.dryRun && result.committed > 0) {
        console.log(`[safe-ci] Committed ${result.committed} files in worktree.`);
        console.log(`[safe-ci] Review worktree and push manually: git -C ${worktreeDir} push origin HEAD`);
      }

      if (cycle < args.maxCycles) {
        await new Promise(resolve => setTimeout(resolve, args.pollMs));
      }
    } catch (err) {
      console.error(`[safe-ci] Cycle ${cycle} error: ${err.message}`);
      break;
    }
  }

  console.log(`[safe-ci] Completed ${args.maxCycles} cycles. Worktree: ${worktreeDir}`);
  if (args.dryRun && createdWorktree) {
    console.log(`[safe-ci] Cleaning up dry-run worktree...`);
    cleanupWorktree(repoRoot, worktreeDir);
  } else if (!args.dryRun && createdWorktree) {
    console.log(`[safe-ci] Review and push manually:`);
    console.log(`  git -C ${worktreeDir} log --oneline -10`);
    console.log(`  git -C ${worktreeDir} push origin HEAD`);
  }
  if (args.dryRun) handleExit();
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[safe-ci] FATAL: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { VERSION, ALLOWED_PATTERNS, FORBIDDEN_PATTERNS, isAllowed };
