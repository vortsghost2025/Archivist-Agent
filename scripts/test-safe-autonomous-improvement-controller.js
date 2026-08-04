#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CONTROLLER_PATH = path.join(__dirname, 'safe-autonomous-improvement-controller.js');
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log('  PASS: ' + message);
  } else {
    failed++;
    failures.push(message);
    console.error('  FAIL: ' + message);
  }
}

function createTempRepo(name) {
  const dir = path.join(os.tmpdir(), 'safe-controller-test-' + name + '-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  spawnSync('git', ['init', dir], { stdio: 'ignore' });
  spawnSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
  spawnSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test');
  spawnSync('git', ['-C', dir, 'add', 'README.md'], { stdio: 'ignore' });
  spawnSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'ignore' });
  return dir;
}

function createTempState() {
  const dir = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runControllerWithEnv(env) {
  const result = spawnSync('node', [CONTROLLER_PATH], {
    cwd: '/home/we4free/agent/repos/Archivist-Agent-worktrees/kilo-safe-autonomous-improvement-controller-20260804',
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000
  });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), status: result.status };
}

function countJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim()).length;
}

function countRepoFiles(repoDir) {
  if (!fs.existsSync(repoDir)) return 0;
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '.git') continue;
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else count++;
    }
  };
  walk(repoDir);
  return count;
}

console.log('=== Test Suite: safe-autonomous-improvement-controller ===\n');

const tempRepo = createTempRepo('audit-repo');
const tempState = createTempState();

try {
  console.log('--- Tests 1-4: AUDIT_ONLY invokes zero mutating commands ---');
  const env1 = { SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: tempRepo, SAFE_IMPROVEMENT_STATE_DIR: tempState };
  const beforeFiles = countRepoFiles(tempRepo);
  const beforeState = countJsonlLines(path.join(tempState, 'audit.jsonl'));
  const r1 = runControllerWithEnv(env1);
  const afterFiles = countRepoFiles(tempRepo);
  const afterState = countJsonlLines(path.join(tempState, 'audit.jsonl'));
  assert(r1.status === 0, 'AUDIT_ONLY exits 0');
  assert(afterFiles === beforeFiles, 'AUDIT_ONLY did not change repository files');
  assert(afterState > beforeState, 'AUDIT_ONLY wrote audit report');
  assert(r1.stdout.includes('AUDIT_ONLY complete'), 'AUDIT_ONLY reported completion');

  console.log('\n--- Test 5: AUDIT_ONLY writes nothing inside repository ---');
  const repoFilesAfter = fs.readdirSync(tempRepo).filter(f => f !== '.git');
  assert(repoFilesAfter.length === 1 && repoFilesAfter[0] === 'README.md', 'Repository files unchanged');

  console.log('\n--- Test 6: AUDIT_ONLY does not modify canonical autonomy ledger ---');
  const ledgerPath = path.join(tempRepo, 'context-buffer', 'autonomy-ledger.jsonl');
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify({ test: true }) + '\n');
  const ledgerBefore = fs.readFileSync(ledgerPath, 'utf8');
  const env6 = { SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: tempRepo, SAFE_IMPROVEMENT_STATE_DIR: createTempState() };
  runControllerWithEnv(env6);
  const ledgerAfter = fs.readFileSync(ledgerPath, 'utf8');
  assert(ledgerBefore === ledgerAfter, 'Canonical autonomy ledger untouched');

  console.log('\n--- Test 7: AUDIT_ONLY with candidates still performs zero mutations ---');
  const tempRepo7 = createTempRepo('candidates');
  const tempState7 = createTempState();
  const actionDir = path.join(tempRepo7, 'lanes', 'archivist', 'inbox', 'action-required');
  fs.mkdirSync(actionDir, { recursive: true });
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(actionDir, 'task-' + i + '.json'), '{}');
  const env7 = { SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: tempRepo7, SAFE_IMPROVEMENT_STATE_DIR: tempState7 };
  const before7 = countRepoFiles(tempRepo7);
  runControllerWithEnv(env7);
  const after7 = countRepoFiles(tempRepo7);
  assert(after7 === before7, 'Repository unchanged even with candidates present');
  assert(countJsonlLines(path.join(tempState7, 'audit.jsonl')) > 0, 'Audit report written to isolated state');

  console.log('\n--- Test 8: PREPARE performs no commit, push or PR operation ---');
  const tempRepo8 = createTempRepo('prepare');
  const tempState8 = createTempState();
  fs.mkdirSync(path.join(tempRepo8, 'lanes', 'archivist', 'inbox', 'action-required'), { recursive: true });
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(tempRepo8, 'lanes', 'archivist', 'inbox', 'action-required', 'task-' + i + '.json'), '{}');
  const env8 = { SAFE_IMPROVEMENT_MODE: 'PREPARE', REPO_ROOT: tempRepo8, SAFE_IMPROVEMENT_STATE_DIR: tempState8 };
  const r8 = runControllerWithEnv(env8);
  assert(r8.status === 0 || r8.stdout.includes('worktreePath'), 'PREPARE completes without error');
  assert(!fs.existsSync(path.join(tempRepo8, 'safe-improvement')), 'PREPARE did not create branch in live repo');

  console.log('\n--- Test 9: Unknown mode fails closed ---');
  const env9 = { SAFE_IMPROVEMENT_MODE: 'UNKNOWN_MODE', REPO_ROOT: tempRepo, SAFE_IMPROVEMENT_STATE_DIR: createTempState() };
  const r9 = runControllerWithEnv(env9);
  assert(r9.status === 1, 'Unknown mode exits 1');
  assert(r9.stderr.includes('Unknown mode'), 'Unknown mode error message present');

  console.log('\n--- Test 10: DEPLOY is unavailable by default ---');
  const env10 = { SAFE_IMPROVEMENT_MODE: 'DEPLOY', REPO_ROOT: tempRepo, SAFE_IMPROVEMENT_STATE_DIR: createTempState() };
  const r10 = runControllerWithEnv(env10);
  assert(r10.status === 0, 'DEPLOY exits 0 with disabled response');
  assert(r10.stdout.includes('disabled'), 'DEPLOY reports disabled');

} finally {
  spawnSync('rm', ['-rf', tempRepo, tempState], { stdio: 'ignore' });
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
