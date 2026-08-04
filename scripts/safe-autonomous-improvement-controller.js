#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONTROLLER_VERSION = '2.1.0';

const VALID_MODES = new Set(['AUDIT_ONLY', 'PREPARE', 'IMPLEMENT', 'PUBLISH', 'DEPLOY']);

function getRepoRoot() { return process.env.REPO_ROOT || '/home/we4free/agent/repos/Archivist-Agent'; }
function getStateDir() { return process.env.SAFE_IMPROVEMENT_STATE_DIR || path.join(os.homedir(), 'agent', 'state', 'safe-improvement-controller'); }
function getMode() { return (process.env.SAFE_IMPROVEMENT_MODE || 'AUDIT_ONLY').toUpperCase(); }

function nowIso() { return new Date().toISOString(); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}
function appendAudit(stateDir, entry) {
  ensureDir(path.dirname(path.join(stateDir, 'audit.jsonl')));
  fs.appendFileSync(path.join(stateDir, 'audit.jsonl'), JSON.stringify(entry) + '\n');
}
function appendCandidate(stateDir, entry) {
  ensureDir(path.join(stateDir, 'candidates'));
  fs.writeFileSync(path.join(stateDir, 'candidates', entry.id + '.json'), JSON.stringify(entry, null, 2));
}

function createDefaultRunners() {
  const { spawnSync } = require('child_process');
  return {
    commandRunner: {
      run(command, args, options) {
        return spawnSync(command, args, Object.assign({ encoding: 'utf8', timeout: 30000 }, options || {}));
      }
    },
    filesystem: {
      existsSync: fs.existsSync.bind(fs),
      readFileSync: fs.readFileSync.bind(fs),
      writeFileSync: fs.writeFileSync.bind(fs),
      mkdirSync: (d, opts) => fs.mkdirSync(d, opts || { recursive: true }),
      readdirSync: fs.readdirSync.bind(fs),
      statSync: fs.statSync.bind(fs),
      unlinkSync: fs.unlinkSync.bind(fs),
      rmSync: (p, opts) => fs.rmSync(p, opts || { recursive: true, force: true })
    },
    clock: {
      nowIso,
      DateNow: Date.now.bind(Date)
    }
  };
}

function discoverLaneServices(serviceRunner) {
  const lanes = [
    { lane: 'archivist', repo: '/home/we4free/agent/repos/Archivist-Agent' },
    { lane: 'kernel', repo: '/home/we4free/agent/repos/kernel-lane' },
    { lane: 'library', repo: '/home/we4free/agent/repos/self-organizing-library' },
    { lane: 'swarmmind', repo: '/home/we4free/agent/repos/SwarmMind' },
    { lane: 'solana-launch', repo: '/home/we4free/agent/repos/solana-launch-lane' }
  ];
  const services = [];
  for (const laneInfo of lanes) {
    const unitName = 'we4free-lane-worker@' + laneInfo.lane + '.lane.service';
    const activeResult = serviceRunner.run('systemctl', ['is-active', unitName]);
    const active = activeResult.status === 0;
    let pid = null;
    let cmd = null;
    if (active) {
      const ps = serviceRunner.run('ps', ['aux'], { encoding: 'utf8' });
      const lines = (ps.stdout || '').split('\n');
      for (const line of lines) {
        if (line.includes('lane-worker.js') && line.includes('--lane ' + laneInfo.lane)) {
          const parts = line.trim().split(/\s+/);
          pid = parts[1];
          cmd = line.trim();
          break;
        }
      }
    }
    services.push({ lane: laneInfo.lane, repo: laneInfo.repo, unit: unitName, active, pid, command: cmd });
  }
  return services;
}

function evidenceCollector(runners, repoRoot, stateDir) {
  const evidence = {
    timestamp: runners.clock.nowIso(),
    mode: getMode(),
    version: CONTROLLER_VERSION,
    repositories: {},
    laneServices: discoverLaneServices(runners.serviceRunner),
    queueDepth: {},
    autonomyLedgerLastEntry: null,
    autonomyLedgerEntryCount: 0
  };
  const lanes = ['archivist', 'kernel', 'library', 'swarmmind'];
  for (const lane of lanes) {
    const laneDir = path.join(repoRoot, 'lanes', lane);
    if (!runners.filesystem.existsSync(laneDir)) continue;
    const inboxDir = path.join(laneDir, 'inbox');
    const actionDir = path.join(inboxDir, 'action-required');
    let inboxCount = 0;
    let actionCount = 0;
    if (runners.filesystem.existsSync(inboxDir)) {
      try { inboxCount = runners.filesystem.readdirSync(inboxDir).filter(f => f.endsWith('.json')).length; } catch {}
    }
    if (runners.filesystem.existsSync(actionDir)) {
      try { actionCount = runners.filesystem.readdirSync(actionDir).filter(f => f.endsWith('.json')).length; } catch {}
    }
    evidence.queueDepth[lane] = { inbox: inboxCount, actionRequired: actionCount };
  }
  const ledgerPath = path.join(repoRoot, 'context-buffer', 'autonomy-ledger.jsonl');
  const ledgerText = readFileSafe(ledgerPath);
  if (ledgerText) {
    const entries = ledgerText.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    evidence.autonomyLedgerLastEntry = lastEntry ? lastEntry.timestamp : null;
    evidence.autonomyLedgerEntryCount = entries.length;
  }
  return evidence;
}

function makeCandidateId(evidence, lane) {
  return 'lane-backlog-' + lane + '-' + Math.abs(hashCode(JSON.stringify(evidence.queueDepth))).toString(36);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function candidateSelector(evidence, stateDir, runners) {
  const candidates = [];
  const seenIds = new Set();
  for (const [lane, depth] of Object.entries(evidence.queueDepth)) {
    if (depth.actionRequired > 10) {
      const id = makeCandidateId(evidence, lane);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      candidates.push({
        id,
        lane,
        type: 'queue-reduction',
        priority: depth.actionRequired > 50 ? 'P0' : 'P1',
        rationale: 'Action-required queue depth of ' + depth.actionRequired + ' exceeds threshold',
        risk: 'low',
        allowedFiles: ['scripts/lane-worker.js'],
        forbiddenPaths: ['context-buffer/', 'lanes/' + lane + '/inbox/'],
        testCommand: 'node scripts/test-lane-worker.js',
        rollbackPlan: 'Revert lane-worker.js to previous commit',
        resourceBudget: { maxFiles: 1, maxCommitSize: '10KB' }
      });
    }
  }
  if (evidence.autonomyLedgerLastEntry && new Date(evidence.autonomyLedgerLastEntry).getTime() < runners.clock.DateNow() - 30 * 86400000) {
    const id = 'autonomy-ledger-stale';
    if (!seenIds.has(id)) {
      seenIds.add(id);
      candidates.push({
        id,
        lane: 'archivist',
        type: 'ledger-maintenance',
        priority: 'P1',
        rationale: 'Autonomy ledger last entry is older than 30 days',
        risk: 'low',
        allowedFiles: ['scripts/headless-self-audit.js'],
        forbiddenPaths: ['context-buffer/autonomy-ledger.jsonl'],
        testCommand: 'node scripts/test-self-audit.js',
        rollbackPlan: 'Revert headless-self-audit.js to previous commit',
        resourceBudget: { maxFiles: 1, maxCommitSize: '5KB' }
      });
    }
  }
  return candidates.slice(0, 5);
}

function validateGitSafety(runners, repoDir) {
  const issues = [];
  const status = runners.gitRunner.run('status', ['--porcelain'], { cwd: repoDir });
  if (status.status !== 0) { issues.push('git status failed'); return issues; }
  const lines = status.stdout.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const indexStatus = line.substring(0, 1);
    const workStatus = line.substring(1, 2);
    const filePath = line.substring(3).trim();
    if (indexStatus === '?' && workStatus === '?') {
      if (!filePath.startsWith('.git/') && !filePath.startsWith('node_modules/')) {
        issues.push('untracked-file: ' + filePath);
      }
    }
    if (indexStatus !== ' ' || workStatus !== ' ') {
      if (filePath.match(/\.(log|jsonl)$/) || filePath.includes('resource_usage')) {
        issues.push('runtime-state-staged: ' + filePath);
      }
    }
  }
  const branch = runners.gitRunner.run('rev-parse', ['--abbrev-ref', 'HEAD'], { cwd: repoDir });
  const defaultBranches = ['main', 'master'];
  if (defaultBranches.includes(branch.stdout.trim())) {
    issues.push('on-default-branch: ' + branch.stdout.trim());
  }
  return issues;
}

function auditOnly(runners, evidence, stateDir) {
  const existingCandidates = [];
  const candidatesDir = path.join(stateDir, 'candidates');
  if (runners.filesystem.existsSync(candidatesDir)) {
    try {
      for (const f of runners.filesystem.readdirSync(candidatesDir)) {
        if (f.endsWith('.json')) {
          try {
            const existing = JSON.parse(runners.filesystem.readFileSync(path.join(candidatesDir, f), 'utf8'));
            existingCandidates.push(existing);
          } catch {}
        }
      }
    } catch {}
  }
  const newCandidates = candidateSelector(evidence, stateDir, runners);
  const mergedCandidates = [];
  const seenIds = new Set();
  for (const c of existingCandidates) {
    mergedCandidates.push(c);
    seenIds.add(c.id);
  }
  for (const c of newCandidates) {
    if (!seenIds.has(c.id)) {
      mergedCandidates.push(c);
      seenIds.add(c.id);
      appendCandidate(stateDir, c);
    }
  }
  const report = {
    timestamp: runners.clock.nowIso(),
    mode: getMode(),
    version: CONTROLLER_VERSION,
    phase: 'AUDIT_ONLY',
    status: 'complete',
    evidence,
    candidates: mergedCandidates,
    mutations: {
      repositoryFilesChanged: false,
      indexChanged: false,
      branchCreated: false,
      commitCreated: false,
      remoteRefChanged: false,
      githubMutated: false,
      serviceRestarted: false
    }
  };
  appendAudit(stateDir, report);
  console.log('[SAFE-AI] AUDIT_ONLY complete. Candidates: ' + mergedCandidates.length);
  return report;
}

function prepare(runners, candidate, repoRoot, stateDir) {
  const repoMap = {
    archivist: '/home/we4free/agent/repos/Archivist-Agent',
    kernel: '/home/we4free/agent/repos/kernel-lane',
    library: '/home/we4free/agent/repos/self-organizing-library',
    swarmmind: '/home/we4free/agent/repos/SwarmMind',
    'solana-launch': '/home/we4free/agent/repos/solana-launch-lane'
  };
  const repoDir = repoMap[candidate.lane];
  if (!repoDir) return { error: 'unknown-lane: ' + candidate.lane };
  if (!runners.filesystem.existsSync(repoDir)) return { error: 'repository-not-found: ' + repoDir };
  const repoUrlResult = runners.gitRunner.run('remote', ['get-url', 'origin'], { cwd: repoDir });
  if (repoUrlResult.status !== 0 || !repoUrlResult.stdout.trim()) return { error: 'no-remote' };
  const branch = 'safe-improvement/' + candidate.id;
  ensureDir(path.join(stateDir, 'worktrees'));
  const worktreePath = path.join(stateDir, 'worktrees', candidate.id);
  if (runners.filesystem.existsSync(worktreePath)) {
    return { error: 'worktree-collision', path: worktreePath };
  }
  const fetchResult = runners.gitRunner.run('fetch', ['--no-tags', 'origin'], { cwd: repoDir });
  if (fetchResult.status !== 0) return { error: 'fetch-failed', details: fetchResult.stderr };
  const defaultBranchResult = runners.gitRunner.run('rev-parse', ['--abbrev-ref', 'origin/HEAD'], { cwd: repoDir });
  const defaultBranch = defaultBranchResult.stdout.trim().replace('origin/', '');
  const createResult = runners.gitRunner.run('worktree', ['add', '--force', worktreePath, 'origin/' + defaultBranch], { cwd: repoDir });
  if (createResult.status !== 0) return { error: 'worktree-create-failed', details: createResult.stderr };
  const branchResult = runners.gitRunner.run('checkout', ['-b', branch], { cwd: worktreePath });
  if (branchResult.status !== 0) {
    runners.gitRunner.run('worktree', ['remove', '--force', worktreePath], { cwd: repoDir });
    return { error: 'branch-create-failed', details: branchResult.stderr };
  }
  const contract = {
    repository: repoDir,
    baseSha: runners.gitRunner.run('rev-parse', ['HEAD'], { cwd: worktreePath }).stdout.trim(),
    branch,
    worktreePath,
    defaultBranch,
    allowedFiles: candidate.allowedFiles,
    forbiddenPaths: candidate.forbiddenPaths,
    testCommand: candidate.testCommand,
    rollbackPlan: candidate.rollbackPlan,
    resourceBudget: candidate.resourceBudget
  };
  runners.filesystem.writeFileSync(path.join(stateDir, 'candidates', candidate.id + '-contract.json'), JSON.stringify(contract, null, 2));
  appendAudit(stateDir, { timestamp: runners.clock.nowIso(), phase: 'PREPARE', candidate: candidate.id, status: 'complete', contract });
  return contract;
}

function implement(runners, contract) {
  const worktreePath = contract.worktreePath;
  const safety = validateGitSafety(runners, worktreePath);
  if (safety.length > 0) {
    return { passed: false, phase: 'git-safety', issues: safety };
  }
  const diffResult = runners.gitRunner.run('diff', ['--name-only'], { cwd: worktreePath });
  const untrackedResult = runners.gitRunner.run('ls-files', ['--others', '--exclude-standard'], { cwd: worktreePath });
  const allChanged = [
    ...new Set([
      ...diffResult.stdout.split("\n").filter(f => f.trim()),
      ...untrackedResult.stdout.split("\n").filter(f => f.trim())
    ])
  ];
  if (allChanged.length === 0) {
    return { passed: false, phase: 'no-diff', issue: 'no substantive implementation diff' };
  }
  const maxFiles = (contract.resourceBudget && contract.resourceBudget.maxFiles) || 1;
  if (allChanged.length > maxFiles) {
    return { passed: false, phase: 'file-count', issue: 'changed files ' + allChanged.length + ' exceed max ' + maxFiles };
  }
  for (const f of allChanged) {
    const isAllowed = contract.allowedFiles.some(af => f === af || f.startsWith(af));
    if (!isAllowed) {
      return { passed: false, phase: 'allowed-files', issue: 'unauthorized-file: ' + f };
    }
    for (const forbidden of contract.forbiddenPaths) {
      if (f.startsWith(forbidden)) {
        return { passed: false, phase: 'forbidden-path', issue: 'forbidden-path: ' + f };
      }
    }
  }
  const runtimePatterns = [/\.(log|jsonl)$/, /resource_usage/, /heartbeat-/, /snapshot/];
  for (const f of allChanged) {
    for (const pat of runtimePatterns) {
      if (pat.test(f)) {
        return { passed: false, phase: 'runtime-state', issue: 'runtime-state-detected: ' + f };
      }
    }
  }
  if (!contract.testCommand) {
    return { passed: false, phase: 'no-test', issue: 'no test command in contract' };
  }
  const testResult = runners.commandRunner.run('bash', ['-lc', contract.testCommand], { cwd: worktreePath, encoding: 'utf8', timeout: 120000 });
  if (testResult.status !== 0) {
    return { passed: false, phase: 'test-failed', exitCode: testResult.status, details: testResult.stderr || testResult.stdout };
  }
  appendAudit(contract.worktreePath ? path.join(contract.worktreePath, '..', '..', getStateDir()) : getStateDir(), { timestamp: runners.clock.nowIso(), phase: 'IMPLEMENT', branch: contract.branch, status: 'complete', testsPassed: true, exitCode: testResult.status });
  return { passed: true, worktreePath, branch: contract.branch, testOutput: testResult.stdout, exitCode: testResult.status };
}

function publish(runners, contract, testResult) {
  if (!testResult || !testResult.passed) {
    return { passed: false, error: 'implement-failed', details: testResult };
  }
  const worktreePath = contract.worktreePath;
  const diffCheck = runners.gitRunner.run('diff', ['--check'], { cwd: worktreePath });
  if (diffCheck.status !== 0) {
    return { passed: false, error: 'diff-check-failed', details: diffCheck.stderr };
  }
  const changedFiles = runners.gitRunner.run('diff', ['--name-only'], { cwd: worktreePath }).stdout.split('\n').filter(f => f.trim());
  const untrackedFiles = runners.gitRunner.run('ls-files', ['--others', '--exclude-standard'], { cwd: worktreePath }).stdout.split('\n').filter(f => f.trim());
  const allFiles = [...changedFiles, ...untrackedFiles];
  for (const f of allFiles) {
    const isAllowed = contract.allowedFiles.some(af => f === af || f.startsWith(af));
    if (!isAllowed) {
      return { passed: false, error: 'unauthorized-file', file: f };
    }
    const content = runners.filesystem.readFileSync(path.join(worktreePath, f), 'utf8');
    const secretPatterns = [/SUGGESTION_SIGNING_KEY/, /private\.key/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /password/i];
    for (const pat of secretPatterns) {
      if (pat.test(content)) {
        return { passed: false, error: 'secret-like-content', file: f, pattern: pat.toString() };
      }
    }
    const runtimePatterns = [/\.(log|jsonl)$/, /resource_usage/, /heartbeat-/, /snapshot/];
    for (const pat of runtimePatterns) {
      if (pat.test(f)) {
        return { passed: false, error: 'runtime-state-file', file: f };
      }
    }
    for (const forbidden of contract.forbiddenPaths) {
      if (f.startsWith(forbidden)) {
        return { passed: false, error: 'forbidden-path', file: f };
      }
    }
  }
  const branchResult = runners.gitRunner.run('rev-parse', ['--abbrev-ref', 'HEAD'], { cwd: worktreePath });
  const branch = branchResult.stdout.trim();
  const defaultBranches = ['main', 'master'];
  if (defaultBranches.includes(branch)) {
    return { passed: false, error: 'on-default-branch', branch };
  }
  for (const f of allFiles) {
    runners.gitRunner.run('add', ['--', f], { cwd: worktreePath });
  }
  const commitMessage = '[SAFE-AI] ' + contract.branch + ': scoped implementation';
  const commitResult = runners.gitRunner.run('commit', ['-m', commitMessage], { cwd: worktreePath });
  if (commitResult.status !== 0) {
    const hookFailure = commitResult.stderr || commitResult.stdout;
    return { passed: false, error: 'commit-failed', details: hookFailure, hookFailure: true };
  }
  const localSha = runners.gitRunner.run('rev-parse', ['HEAD'], { cwd: worktreePath }).stdout.trim();
  const repoDir = contract.repository;
  const pushResult = runners.gitRunner.run('push', ['origin', branch], { cwd: worktreePath });
  if (pushResult.status !== 0) {
    return { passed: false, error: 'push-failed', details: pushResult.stderr };
  }
  const remoteShaResult = runners.gitRunner.run('ls-remote', ['origin', 'refs/heads/' + branch], { cwd: repoDir });
  const remoteSha = remoteShaResult.stdout.split('\t')[0].trim();
  if (!localSha || !remoteSha || localSha !== remoteSha) {
    return { passed: false, error: 'sha-mismatch', local: localSha, remote: remoteSha };
  }
  const repoOwner = contract.repository.split('/').slice(-2, -1)[0];
  const repoName = contract.repository.split('/').pop();
  const prResult = runners.githubRunner.run('pr', ['create', '--repo', repoOwner + '/' + repoName, '--title', '[SAFE-AI] ' + contract.branch, '--body', 'Auto-generated by safe-autonomous-improvement-controller v' + CONTROLLER_VERSION, '--draft', '--head', branch]);
  let prUrl = null;
  let prNumber = null;
  if (prResult && prResult.ok) {
    const match = (prResult.stdout || '').match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
    if (match) {
      prUrl = match[0];
      prNumber = parseInt(match[1]);
    }
  }
  if (!prUrl || !prNumber) {
    return { passed: false, error: 'pr-creation-failed', stdout: prResult && prResult.stdout, stderr: prResult && prResult.stderr };
  }
  appendAudit(getStateDir(), { timestamp: runners.clock.nowIso(), phase: 'PUBLISH', branch, status: 'complete', localSha, remoteSha, prUrl, prNumber });
  return { passed: true, branch, localSha, remoteSha, prUrl, prNumber };
}

function deploymentGate() {
  return {
    enabled: false,
    reason: 'DEPLOY mode disabled by default. Requires separate explicit authorization token or config flag.',
    requiredChecks: ['exact committed/deployed hashes', 'owning service', 'backup', 'rollback command', 'syntax and tests', 'available-resource check', 'minimal owning-service restart', 'several verified live cycles']
  };
}

function runController(runners, overrides) {
  const repoRoot = (overrides && overrides.repoRoot) || getRepoRoot();
  const stateDir = (overrides && overrides.stateDir) || getStateDir();
  const mode = getMode();
  if (!VALID_MODES.has(mode)) {
    throw new Error('[SAFE-AI] Unknown mode: ' + mode + '. Failing closed.');
  }
  ensureDir(stateDir);
  appendAudit(stateDir, { timestamp: runners.clock.nowIso(), mode, version: CONTROLLER_VERSION, phase: 'start', status: 'started' });
  const evidence = evidenceCollector(runners, repoRoot, stateDir);
  appendAudit(stateDir, { timestamp: runners.clock.nowIso(), phase: 'evidence-collection', status: 'complete' });

  if (mode === 'AUDIT_ONLY') {
    return auditOnly(runners, evidence, stateDir);
  }
  if (mode === 'PREPARE') {
    const candidates = candidateSelector(evidence, stateDir, runners);
    if (candidates.length === 0) {
      appendAudit(stateDir, { timestamp: runners.clock.nowIso(), phase: 'PREPARE', status: 'no-candidates' });
      console.log('[SAFE-AI] No candidates to prepare.');
      return { status: 'no-candidates' };
    }
    const candidate = candidates[0];
    const result = prepare(runners, candidate, repoRoot, stateDir);
    appendAudit(stateDir, { timestamp: runners.clock.nowIso(), phase: 'PREPARE', candidate: candidate.id, status: result.error ? 'failed' : 'complete', result });
    return result;
  }
  if (mode === 'IMPLEMENT') {
    return { error: 'IMPLEMENT requires explicit contract path via environment variable SAFE_IMPROVEMENT_CONTRACT.' };
  }
  if (mode === 'PUBLISH') {
    return { error: 'PUBLISH requires successful IMPLEMENT result artifact path via environment variable SAFE_IMPROVEMENT_IMPLEMENT_RESULT.' };
  }
  if (mode === 'DEPLOY') {
    return deploymentGate();
  }
  return { error: 'unknown-mode', mode };
}

if (require.main === module) {
  const runners = Object.assign(createDefaultRunners(), {
    commandRunner: createDefaultRunners().commandRunner,
    gitRunner: createDefaultRunners().commandRunner,
    githubRunner: createDefaultRunners().commandRunner,
    serviceRunner: createDefaultRunners().commandRunner,
    filesystem: createDefaultRunners().filesystem,
    clock: createDefaultRunners().clock
  });
  const result = runController(runners);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runController, evidenceCollector, candidateSelector, validateGitSafety, auditOnly, prepare, implement, publish, deploymentGate, VALID_MODES, createDefaultRunners, discoverLaneServices, getMode, getRepoRoot, getStateDir };
