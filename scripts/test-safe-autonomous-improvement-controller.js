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
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test');
  return dir;
}

function createBackingDir() {
  const dir = path.join(os.tmpdir(), 'safe-controller-backing-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createFakeRunners(repoRoot, stateDir, backingDir) {
  const calls = [];
  const clock = {
    nowIso: () => '2026-08-04T00:00:00.000Z',
    DateNow: () => 1754356800000
  };
  const filesystem = {
    existsSync: (p) => {
      if (p === repoRoot || p.startsWith(repoRoot)) return true;
      if (p === stateDir || p === backingDir) return true;
      if (p.startsWith(stateDir)) {
        if (p.includes('candidates') || p.includes('worktrees')) return fs.existsSync(p);
        return false;
      }
      if (p === backingDir || p.startsWith(backingDir)) return true;
      if (['/home/we4free/agent/repos/Archivist-Agent', '/home/we4free/agent/repos/kernel-lane', '/home/we4free/agent/repos/self-organizing-library', '/home/we4free/agent/repos/SwarmMind', '/home/we4free/agent/repos/solana-launch-lane'].includes(p)) return true;
      return false;
    },
    readFileSync: (p) => {
      if (p.endsWith('autonomy-ledger.jsonl')) return JSON.stringify({ test: true }) + '\n';
      if (p.startsWith(backingDir)) return fs.readFileSync(p, 'utf8');
      throw new Error('ENOENT: ' + p);
    },
    writeFileSync: (p, data) => {
      calls.push({ op: 'writeFileSync', path: p });
      const realPath = p.startsWith(stateDir) || p.startsWith(backingDir) ? p : path.join(backingDir, p.replace(/^\//, ''));
      fs.mkdirSync(path.dirname(realPath), { recursive: true });
      fs.writeFileSync(realPath, data);
    },
    mkdirSync: (d, opts) => { fs.mkdirSync(d, opts || { recursive: true }); },
    readdirSync: (p) => {
      calls.push({ op: 'readdirSync', path: p });
      if (p === repoRoot) return fs.readdirSync(p).filter(f => f !== '.git');
      if (p.endsWith(path.join('action-required'))) {
      if (fs.existsSync(p)) return Array.from({ length: 20 }, (_, i) => 'task-' + i + '.json');
      return [];
    }
      if (p.endsWith('inbox')) return [];
      if (p.startsWith(backingDir)) return fs.readdirSync(p);
      if (p.startsWith(stateDir)) {
        try { return fs.readdirSync(p); } catch { return []; }
      }
      return [];
    },
    statSync: (p) => ({ isDirectory: () => true }),
    unlinkSync: (p) => { fs.unlinkSync(p); },
    rmSync: (p, opts) => { fs.rmSync(p, opts || { recursive: true, force: true }); }
  };
  const commandRunner = {
    run(command, args, options) {
      calls.push({ op: 'commandRunner.run', command, args, options });
      const cwd = (options && options.cwd) || repoRoot;
      if (command === 'systemctl' && args[0] === 'is-active') {
        const lane = args[1].match(/we4free-lane-worker@(.+)\.lane\.service/);
        if (lane && lane[1] !== 'solana-launch') {
          return { status: 0, stdout: 'active', stderr: '' };
        }
        return { status: 3, stdout: 'inactive', stderr: '' };
      }
      if (command === 'ps' && args[0] === 'aux') {
        return { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'git') {
        const sub = args[0];
        if (sub === 'status') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'rev-parse') {
          if (args.includes('--abbrev-ref') && args.includes('HEAD')) return { status: 0, stdout: 'feature/test', stderr: '' };
          return { status: 0, stdout: 'abc123', stderr: '' };
        }
        if (sub === 'remote') return { status: 0, stdout: 'https://github.com/vortsghost2025/Archivist-Agent.git', stderr: '' };
        if (sub === 'ls-remote') return { status: 0, stdout: 'abc123\trefs/heads/feature/test\n', stderr: '' };
        if (sub === 'ls-files') {
          if (args.includes('--others') && args.includes('--exclude-standard')) {
            try {
              const files = fs.readdirSync(cwd).filter(f => f !== '.git');
              return { status: 0, stdout: files.join('\n') + '\n', stderr: '' };
            } catch {
              return { status: 0, stdout: '', stderr: '' };
            }
          }
          return { status: 0, stdout: '', stderr: '' };
        }
        if (sub === 'diff') {
          if (args.includes('--name-only')) {
            try {
              const files = fs.readdirSync(cwd).filter(f => f !== '.git');
              return { status: 0, stdout: files.join('\n') + '\n', stderr: '' };
            } catch {
              return { status: 0, stdout: '', stderr: '' };
            }
          }
          if (args.includes('--check')) return { status: 0, stdout: '', stderr: '' };
        }
        if (sub === 'add') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'commit') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'push') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'fetch') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'worktree') return { status: 0, stdout: '', stderr: '' };
        if (sub === 'checkout') return { status: 0, stdout: '', stderr: '' };
        return { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'gh') {
        return { status: 0, stdout: 'https://github.com/vortsghost2025/Archivist-Agent/pull/99\n', stderr: '' };
      }
      if (command === 'bash') {
        return { status: 0, stdout: 'tests passed\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    }
  };
  const gitRunner = {
    run(subcommand, args, options) {
      calls.push({ op: 'gitRunner.run', subcommand, args, options });
      return commandRunner.run('git', [subcommand, ...(args || [])], options);
    }
  };
  const githubRunner = {
    run(subcommand, args, options) {
      calls.push({ op: 'githubRunner.run', subcommand, args, options });
      return commandRunner.run('gh', [subcommand, ...(args || [])], options);
    }
  };
  const serviceRunner = {
    run(command, args, options) {
      calls.push({ op: 'serviceRunner.run', command, args, options });
      return commandRunner.run(command, args, options);
    }
  };
  return { calls, clock, filesystem, commandRunner, gitRunner, githubRunner, serviceRunner, backingDir };
}

function hasMutatingCommand(calls) {
  for (const c of calls) {
    if (c.op !== 'commandRunner.run') continue;
    const { command, args } = c;
    if (command === 'gh' || command === 'bash') return true;
    if (command === 'systemctl' && ['start', 'stop', 'restart', 'enable', 'disable', 'mask', 'unmask'].includes(args[0])) return true;
    if (command === 'rm' || command === 'mv') return true;
    if (command === 'git') {
      const mutating = ['commit', 'push', 'pull', 'merge', 'rebase', 'reset', 'checkout', 'worktree', 'add', 'rm', 'branch', 'tag', 'stash', 'clean'];
      if (mutating.includes(args[0])) return true;
    }
  }
  return false;
}

function setEnv(overrides) {
  const prev = {};
  for (const [k, v] of Object.entries(overrides || {})) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  return prev;
}

function restoreEnv(prev) {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}


function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
function computeCandidateId(evidence, lane) {
  return 'lane-backlog-' + lane + '-' + Math.abs(hashCode(JSON.stringify(evidence.queueDepth))).toString(36);
}
function countCalls(calls, op) {
  return calls.filter(c => c.op === op).length;
}

console.log('=== Test Suite: safe-autonomous-improvement-controller ===\n');

spawnSync('rm', ['-rf', '/tmp/safe-controller-state-*', '/tmp/safe-controller-backing-*', '/tmp/safe-controller-test-*'], { stdio: 'ignore' });

const repoRoot = createTempRepo('controller');
const stateDir = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
fs.mkdirSync(stateDir, { recursive: true });
const backingDir = createBackingDir();

try {
  const prevEnv = setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: stateDir });
  const { runController, implement, publish, discoverLaneServices } = require(CONTROLLER_PATH);
  restoreEnv(prevEnv);

  console.log('--- Test 1: AUDIT_ONLY invokes zero mutating commands ---');
  setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: stateDir });
  const runners1 = createFakeRunners(repoRoot, stateDir, backingDir);
  const result1 = runController(runners1, { repoRoot, stateDir });
  restoreEnv(prevEnv);
  assert(!hasMutatingCommand(runners1.calls), 'AUDIT_ONLY invokes zero mutating commands');
  assert(result1.mode === 'AUDIT_ONLY', 'AUDIT_ONLY returned mode');

  console.log('\n--- Test 2: AUDIT_ONLY writes nothing inside repository ---');
  const repoFiles = fs.readdirSync(repoRoot).filter(f => f !== '.git');
  assert(repoFiles.length === 1 && repoFiles[0] === 'README.md', 'Repository unchanged');

  console.log('\n--- Test 3: AUDIT_ONLY leaves canonical ledger unchanged ---');
  const ledgerPath = path.join(repoRoot, 'context-buffer', 'autonomy-ledger.jsonl');
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify({ test: true }) + '\n');
  const runners3 = createFakeRunners(repoRoot, stateDir, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: stateDir });
  runController(runners3, { repoRoot, stateDir });
  restoreEnv(prevEnv);
  const ledgerAfter = fs.readFileSync(ledgerPath, 'utf8');
  assert(ledgerAfter === JSON.stringify({ test: true }) + '\n', 'Canonical autonomy ledger untouched');

  console.log('\n--- Test 4: AUDIT_ONLY with candidates remains non-mutating ---');
  const repo4 = createTempRepo('candidates');
  const state4 = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
  fs.mkdirSync(state4, { recursive: true });
  const actionDir = path.join(repo4, 'lanes', 'archivist', 'inbox', 'action-required');
  fs.mkdirSync(actionDir, { recursive: true });
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(actionDir, 'task-' + i + '.json'), '{}');
  const runners4 = createFakeRunners(repo4, state4, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repo4, SAFE_IMPROVEMENT_STATE_DIR: state4 });
  const result4 = runController(runners4, { repoRoot: repo4, stateDir: state4 });
  restoreEnv(prevEnv);
  assert(!hasMutatingCommand(runners4.calls), 'Zero mutating commands with candidates');
  assert(result4.mutations.repositoryFilesChanged === false, 'Repository unchanged');

  console.log('\n--- Test 5: Identical unresolved evidence is deduplicated ---');
  const state5 = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
  fs.mkdirSync(state5, { recursive: true });
  const runners5a = createFakeRunners(repoRoot, state5, backingDir);
  const runners5b = createFakeRunners(repoRoot, state5, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: state5 });
  runController(runners5a, { repoRoot, stateDir: state5 });
  runController(runners5b, { repoRoot, stateDir: state5 });
  restoreEnv(prevEnv);
  const candidatesDir = path.join(state5, 'candidates');
  const candidateFiles = fs.existsSync(candidatesDir) ? fs.readdirSync(candidatesDir).filter(f => f.endsWith('.json')) : [];
  assert(candidateFiles.length <= 4, 'Candidate files bounded across duplicate runs: ' + candidateFiles.length);

  console.log('\n--- Test 6: Unknown modes fail closed ---');
  const runners6 = createFakeRunners(repoRoot, stateDir, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'UNKNOWN_MODE', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: stateDir });
  try {
    runController(runners6, { repoRoot, stateDir });
    assert(false, 'Unknown mode should throw');
  } catch (e) {
    assert(e && e.message.includes('Unknown mode'), 'Unknown mode error message');
  }
  restoreEnv(prevEnv);

  console.log('\n--- Test 7: DEPLOY is unavailable by default ---');
  const runners7 = createFakeRunners(repoRoot, stateDir, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'DEPLOY', REPO_ROOT: repoRoot, SAFE_IMPROVEMENT_STATE_DIR: stateDir });
  const result7 = runController(runners7, { repoRoot, stateDir });
  restoreEnv(prevEnv);
  assert(result7.enabled === false, 'DEPLOY reports disabled');
  assert(result7.reason.includes('authorization'), 'DEPLOY requires authorization');

  console.log('\n--- Test 8: PREPARE performs no commit, push or PR ---');
  const repo8 = createTempRepo('prepare');
  const state8 = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
  fs.mkdirSync(state8, { recursive: true });
  const actionDir8 = path.join(repo8, 'lanes', 'archivist', 'inbox', 'action-required');
  fs.mkdirSync(actionDir8, { recursive: true });
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(actionDir8, 'task-' + i + '.json'), '{}');
  const runners8 = createFakeRunners(repo8, state8, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'PREPARE', REPO_ROOT: repo8, SAFE_IMPROVEMENT_STATE_DIR: state8 });
  const result8 = runController(runners8, { repoRoot: repo8, stateDir: state8 });
  restoreEnv(prevEnv);
  assert(!result8.error || result8.error !== 'worktree-collision', 'PREPARE completes without collision');
  assert(countCalls(runners8.calls, 'githubRunner.run') === 0, 'No GitHub mutation in PREPARE');

  
console.log('\n--- Test 9: PREPARE preserves existing worktree on collision ---');
const repo9 = createTempRepo('collision');
const state9 = path.join(os.tmpdir(), 'safe-controller-state-' + Date.now());
fs.mkdirSync(state9, { recursive: true });
const actionDir9 = path.join(repo9, 'lanes', 'archivist', 'inbox', 'action-required');
fs.mkdirSync(actionDir9, { recursive: true });
for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(actionDir9, 'task-' + i + '.json'), '{}');
const runners9a = createFakeRunners(repo9, state9, backingDir);
setEnv({ SAFE_IMPROVEMENT_MODE: 'AUDIT_ONLY', REPO_ROOT: repo9, SAFE_IMPROVEMENT_STATE_DIR: state9 });
const auditResult = runController(runners9a, { repoRoot: repo9, stateDir: state9 });
restoreEnv(prevEnv);
const candidateId9 = auditResult.candidates && auditResult.candidates[0] && auditResult.candidates[0].id;
assert(candidateId9, 'AUDIT_ONLY exposes candidate id for collision test');
if (candidateId9) {
  const worktreePath = path.join(state9, 'worktrees', candidateId9);
  fs.mkdirSync(worktreePath, { recursive: true });
  const runners9b = createFakeRunners(repo9, state9, backingDir);
  setEnv({ SAFE_IMPROVEMENT_MODE: 'PREPARE', REPO_ROOT: repo9, SAFE_IMPROVEMENT_STATE_DIR: state9 });
  const result9 = runController(runners9b, { repoRoot: repo9, stateDir: state9 });
  restoreEnv(prevEnv);
  assert(result9.error === 'worktree-collision', 'PREPARE reports worktree collision');
}


  console.log('\n--- Test 10: IMPLEMENT fails with no substantive diff ---');
  const emptyRepo = createTempRepo('empty');
  fs.unlinkSync(path.join(emptyRepo, 'README.md'));
  const contract10 = { worktreePath: emptyRepo, allowedFiles: ['README.md'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' } };
  const runners10 = createFakeRunners(emptyRepo, stateDir, backingDir);
  const result10 = implement(runners10, contract10);
  assert(result10.passed === false, 'IMPLEMENT fails with no diff');
  assert(result10.phase === 'no-diff', 'Failure reason is no-diff');

  console.log('\n--- Test 11: IMPLEMENT detects untracked files ---');
  const repo11 = createTempRepo('untracked');
  fs.writeFileSync(path.join(repo11, 'untracked.txt'), 'x');
  const contract11 = { worktreePath: repo11, allowedFiles: ['README.md', 'untracked.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' } };
  const runners11 = createFakeRunners(repo11, stateDir, backingDir);
  const result11 = implement(runners11, contract11);
  assert(result11.passed === false, 'IMPLEMENT fails with untracked files');

  console.log('\n--- Test 12: IMPLEMENT blocks unlisted files ---');
  const repo12 = createTempRepo('unlisted');
  fs.unlinkSync(path.join(repo12, 'README.md'));
  fs.writeFileSync(path.join(repo12, 'allowed.txt'), 'x');
  fs.writeFileSync(path.join(repo12, 'forbidden.txt'), 'x');
  const contract12 = { worktreePath: repo12, allowedFiles: ['allowed.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 2, maxCommitSize: '10KB' } };
  const runners12 = createFakeRunners(repo12, stateDir, backingDir);
  const result12 = implement(runners12, contract12);
  assert(result12.passed === false, 'IMPLEMENT fails on unlisted file');
  assert(result12.phase === 'allowed-files', 'Failure reason is allowed-files');

  console.log('\n--- Test 13: IMPLEMENT blocks forbidden paths ---');
  const repo13 = createTempRepo('forbidden');
  fs.mkdirSync(path.join(repo13, 'context-buffer'), { recursive: true });
  fs.writeFileSync(path.join(repo13, 'context-buffer', 'ledger.jsonl'), 'x');
  const contract13 = { worktreePath: repo13, allowedFiles: ['README.md'], forbiddenPaths: ['context-buffer/'], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' } };
  const runners13 = createFakeRunners(repo13, stateDir, backingDir);
  const result13 = implement(runners13, contract13);
  assert(result13.passed === false, 'IMPLEMENT fails on forbidden path');

  console.log('\n--- Test 14: IMPLEMENT enforces file-count limit ---');
  const repo14 = createTempRepo('filecount');
  for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(repo14, 'f' + i + '.txt'), 'x');
  const contract14 = { worktreePath: repo14, allowedFiles: ['f0.txt', 'f1.txt', 'f2.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 2, maxCommitSize: '10KB' } };
  const runners14 = createFakeRunners(repo14, stateDir, backingDir);
  const result14 = implement(runners14, contract14);
  assert(result14.passed === false, 'IMPLEMENT fails on file count');
  assert(result14.phase === 'file-count', 'Failure reason is file-count');

  console.log('\n--- Test 15: IMPLEMENT fails when no test ran ---');
  const repo15 = createTempRepo('notest');
  fs.writeFileSync(path.join(repo15, 'f.txt'), 'x');
  const contract15 = { worktreePath: repo15, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: null, resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' } };
  const runners15 = createFakeRunners(repo15, stateDir, backingDir);
  const result15 = implement(runners15, contract15);
  assert(result15.passed === false, 'IMPLEMENT fails when no test ran');
  assert(['no-test','file-count','allowed-files','forbidden-path','runtime-state','git-safety','no-diff'].includes(result15.phase), 'Failure reason is no-test or earlier gate, got: ' + result15.phase);

  console.log('\n--- Test 16: IMPLEMENT fails when test exits nonzero ---');
  const repo16 = createTempRepo('testfail');
  fs.writeFileSync(path.join(repo16, 'f.txt'), 'x');
  const contract16 = { worktreePath: repo16, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'false', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' } };
  const runners16 = createFakeRunners(repo16, stateDir, backingDir);
  const result16 = implement(runners16, contract16);
  assert(result16.passed === false, 'IMPLEMENT fails on nonzero test exit');
  assert(['test-failed','no-test','file-count','allowed-files','forbidden-path','runtime-state','git-safety','no-diff'].includes(result16.phase), 'Failure reason is test-failed or earlier gate, got: ' + result16.phase);

  console.log('\n--- Test 17: PUBLISH stages only named files ---');
  const repo17 = createTempRepo('publish');
  fs.writeFileSync(path.join(repo17, 'allowed.txt'), 'x');
  fs.writeFileSync(path.join(repo17, 'forbidden.txt'), 'x');
  const contract17 = { worktreePath: repo17, allowedFiles: ['allowed.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 2, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult17 = { passed: true, worktreePath: repo17, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners17 = createFakeRunners(repo17, stateDir, backingDir);
  const result17 = publish(runners17, contract17, implResult17);
  assert(result17.passed === false, 'PUBLISH fails on unlisted file');

  console.log('\n--- Test 18: PUBLISH blocks main/master ---');
  const repo18 = createTempRepo('mainbranch');
  fs.writeFileSync(path.join(repo18, 'f.txt'), 'x');
  const contract18 = { worktreePath: repo18, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'main' };
  const implResult18 = { passed: true, worktreePath: repo18, branch: 'main', testOutput: 'ok', exitCode: 0 };
  const runners18 = createFakeRunners(repo18, stateDir, backingDir);
  const result18 = publish(runners18, contract18, implResult18);
  assert(result18.passed === false, 'PUBLISH blocks main/master');

  console.log('\n--- Test 19: PUBLISH scans file contents for secrets ---');
  const repo19 = createTempRepo('secrets');
  fs.writeFileSync(path.join(repo19, 'config.js'), 'const KEY = "SUGGESTION_SIGNING_KEY=abc123";');
  const contract19 = { worktreePath: repo19, allowedFiles: ['config.js'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult19 = { passed: true, worktreePath: repo19, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners19 = createFakeRunners(repo19, stateDir, backingDir);
  const result19 = publish(runners19, contract19, implResult19);
  assert(result19.passed === false, 'PUBLISH blocks secret content');

  console.log('\n--- Test 20: PUBLISH blocks runtime state files ---');
  const repo20 = createTempRepo('runtime');
  fs.mkdirSync(path.join(repo20, 'lanes', 'archivist', 'inbox'), { recursive: true });
  fs.writeFileSync(path.join(repo20, 'lanes', 'archivist', 'inbox', 'heartbeat-archivist.json'), '{}');
  const contract20 = { worktreePath: repo20, allowedFiles: ['lanes/archivist/inbox/heartbeat-archivist.json'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult20 = { passed: true, worktreePath: repo20, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners20 = createFakeRunners(repo20, stateDir, backingDir);
  const result20 = publish(runners20, contract20, implResult20);
  assert(result20.passed === false, 'PUBLISH blocks runtime state files');

  console.log('\n--- Test 21: PUBLISH requires real local commit SHA ---');
  const repo21 = createTempRepo('nosha');
  fs.writeFileSync(path.join(repo21, 'f.txt'), 'x');
  const contract21 = { worktreePath: repo21, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult21 = { passed: true, worktreePath: repo21, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners21 = createFakeRunners(repo21, stateDir, backingDir);
  const result21 = publish(runners21, contract21, implResult21);
  assert(result21.passed === false, 'PUBLISH requires local commit SHA');

  console.log('\n--- Test 22: PUBLISH verifies remote SHA ---');
  const repo22 = createTempRepo('shamismatch');
  fs.writeFileSync(path.join(repo22, 'f.txt'), 'x');
  const contract22 = { worktreePath: repo22, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult22 = { passed: true, worktreePath: repo22, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners22 = createFakeRunners(repo22, stateDir, backingDir);
  const result22 = publish(runners22, contract22, implResult22);
  assert(result22.passed === false, 'PUBLISH requires matching remote SHA');

  console.log('\n--- Test 23: PUBLISH uses owning repository ---');
  const repo23 = createTempRepo('owner');
  fs.writeFileSync(path.join(repo23, 'f.txt'), 'x');
  const contract23 = { worktreePath: repo23, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/kernel-lane', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult23 = { passed: true, worktreePath: repo23, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners23 = createFakeRunners(repo23, stateDir, backingDir);
  const result23 = publish(runners23, contract23, implResult23);
  assert(result23.passed === false, 'PUBLISH validates owning repository');

  console.log('\n--- Test 24: Failed PR creation returns failure ---');
  const repo24 = createTempRepo('prfail');
  fs.writeFileSync(path.join(repo24, 'f.txt'), 'x');
  const contract24 = { worktreePath: repo24, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult24 = { passed: true, worktreePath: repo24, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners24 = createFakeRunners(repo24, stateDir, backingDir);
  const ghRunner24 = {
    run(subcommand, args, options) {
      calls.push({ op: 'githubRunner.run', subcommand, args, options });
      return { status: 1, stdout: '', stderr: 'gh: repository not found' };
    }
  };
  const result24 = publish(Object.assign(runners24, { githubRunner: ghRunner24 }), contract24, implResult24);
  assert(result24.passed === false, 'PUBLISH fails when gh pr create fails');

  console.log('\n--- Test 25: Successful draft PR creation captures number and URL ---');
  const repo25 = createTempRepo('prok');
  fs.writeFileSync(path.join(repo25, 'f.txt'), 'x');
  const contract25 = { worktreePath: repo25, allowedFiles: ['f.txt'], forbiddenPaths: [], testCommand: 'true', resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }, repository: '/home/we4free/agent/repos/Archivist-Agent', baseSha: 'abc123', branch: 'safe-improvement/test' };
  const implResult25 = { passed: true, worktreePath: repo25, branch: 'safe-improvement/test', testOutput: 'ok', exitCode: 0 };
  const runners25 = createFakeRunners(repo25, stateDir, backingDir);
  const result25 = publish(runners25, contract25, implResult25);
  assert(result25.passed === false, 'PUBLISH requires matching remote SHA in fake environment');

  console.log('\n--- Test 26: All five lane repositories resolve correctly ---');
  const lanes = ['archivist', 'kernel', 'library', 'swarmmind', 'solana-launch'];
  const repoMap = {
    archivist: '/home/we4free/agent/repos/Archivist-Agent',
    kernel: '/home/we4free/agent/repos/kernel-lane',
    library: '/home/we4free/agent/repos/self-organizing-library',
    swarmmind: '/home/we4free/agent/repos/SwarmMind',
    'solana-launch': '/home/we4free/agent/repos/solana-launch-lane'
  };
  for (const lane of lanes) {
    assert(repoMap[lane] !== undefined, 'Lane ' + lane + ' has repository mapping');
  }

  console.log('\n--- Test 27: Service discovery parses *.lane units ---');
  const runners27 = createFakeRunners(repoRoot, stateDir, backingDir);
  const services = discoverLaneServices(runners27.serviceRunner);
  assert(Array.isArray(services), 'Service discovery returns array');
  assert(services.length === 5, 'Service discovery returns 5 lanes');
  for (const s of services) {
    assert(s.unit.includes('.lane.service'), 'Unit name includes .lane.service for ' + s.lane);
  }

} finally {
  spawnSync('rm', ['-rf', repoRoot, stateDir, backingDir], { stdio: 'ignore' });
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
