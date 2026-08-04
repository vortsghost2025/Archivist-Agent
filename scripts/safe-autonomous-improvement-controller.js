#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CONTROLLER_VERSION = '2.0.0';
const MODE = (process.env.SAFE_IMPROVEMENT_MODE || 'AUDIT_ONLY').toUpperCase();
const REPO_ROOT = process.env.REPO_ROOT || '/home/we4free/agent/repos/Archivist-Agent';
const STATE_DIR = process.env.SAFE_IMPROVEMENT_STATE_DIR || path.join(os.homedir(), 'agent', 'state', 'safe-improvement-controller');
const AUDIT_LOG_PATH = path.join(STATE_DIR, 'audit.jsonl');
const CANDIDATE_DIR = path.join(STATE_DIR, 'candidates');
const WORKTREE_BASE = path.join(STATE_DIR, 'worktrees');
const LEDGER_PATH = path.join(REPO_ROOT, 'context-buffer', 'autonomy-ledger.jsonl');

const VALID_MODES = new Set(['AUDIT_ONLY', 'PREPARE', 'IMPLEMENT', 'PUBLISH', 'DEPLOY']);
if (!VALID_MODES.has(MODE)) {
  console.error('[SAFE-AI] Unknown mode: ' + MODE + '. Failing closed.');
  process.exit(1);
}

function nowIso() { return new Date().toISOString(); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}
function appendAudit(entry) {
  ensureDir(path.dirname(AUDIT_LOG_PATH));
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n');
}
function appendCandidate(entry) {
  ensureDir(CANDIDATE_DIR);
  fs.appendFileSync(path.join(CANDIDATE_DIR, Date.now() + '-' + entry.id + '.json'), JSON.stringify(entry) + '\n');
}

function runGit(repoDir, args) {
  const result = spawnSync('git', args, { cwd: repoDir, encoding: 'utf8', timeout: 30000 });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), status: result.status, signal: result.signal };
}

function discoverLaneServices() {
  const services = [];
  const lanes = [
    { lane: 'archivist', repo: '/home/we4free/agent/repos/Archivist-Agent' },
    { lane: 'kernel', repo: '/home/we4free/agent/repos/kernel-lane' },
    { lane: 'library', repo: '/home/we4free/agent/repos/self-organizing-library' },
    { lane: 'swarmmind', repo: '/home/we4free/agent/repos/SwarmMind' },
    { lane: 'solana-launch', repo: '/home/we4free/agent/repos/solana-launch-lane' }
  ];
  for (const laneInfo of lanes) {
    const unitName = 'we4free-lane-worker@' + laneInfo.lane + '.lane.service';
    const status = spawnSync('systemctl', ['is-active', unitName], { encoding: 'utf8' });
    const active = status.status === 0;
    let pid = null;
    let cmd = null;
    if (active) {
      const ps = spawnSync('ps', ['aux'], { encoding: 'utf8' });
      const lines = ps.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('lane-worker.js') && line.includes('--lane ' + laneInfo.lane)) {
          const parts = line.trim().split(/\s+/);
          pid = parts[1];
          cmd = line.trim();
          break;
        }
      }
    }
    services.push({
      lane: laneInfo.lane,
      repo: laneInfo.repo,
      unit: unitName,
      active: active,
      pid: pid,
      command: cmd
    });
  }
  return services;
}

function evidenceCollector() {
  const evidence = {
    timestamp: nowIso(),
    mode: MODE,
    version: CONTROLLER_VERSION,
    repositories: {},
    laneServices: discoverLaneServices(),
    queueDepth: {},
    autonomyLedgerLastEntry: null,
    autonomyLedgerEntryCount: 0,
    systemdUnits: {},
    processCommandLines: {}
  };
  const lanes = ['archivist', 'kernel', 'library', 'swarmmind'];
  for (const lane of lanes) {
    const laneDir = path.join(REPO_ROOT, 'lanes', lane);
    if (!fs.existsSync(laneDir)) continue;
    const inboxDir = path.join(laneDir, 'inbox');
    const actionDir = path.join(inboxDir, 'action-required');
    let inboxCount = 0;
    let actionCount = 0;
    if (fs.existsSync(inboxDir)) {
      try { inboxCount = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json')).length; } catch {}
    }
    if (fs.existsSync(actionDir)) {
      try { actionCount = fs.readdirSync(actionDir).filter(f => f.endsWith('.json')).length; } catch {}
    }
    evidence.queueDepth[lane] = { inbox: inboxCount, actionRequired: actionCount };
  }
  const ledgerText = readFileSafe(LEDGER_PATH);
  if (ledgerText) {
    const entries = ledgerText.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    evidence.autonomyLedgerLastEntry = lastEntry ? lastEntry.timestamp : null;
    evidence.autonomyLedgerEntryCount = entries.length;
  }
  return evidence;
}

function candidateSelector(evidence) {
  const candidates = [];
  for (const [lane, depth] of Object.entries(evidence.queueDepth)) {
    if (depth.actionRequired > 10) {
      candidates.push({
        id: 'lane-backlog-' + lane + '-' + Date.now(),
        lane: lane,
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
  if (evidence.autonomyLedgerLastEntry && new Date(evidence.autonomyLedgerLastEntry).getTime() < Date.now() - 30 * 86400000) {
    candidates.push({
      id: 'autonomy-ledger-stale',
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
  return candidates.slice(0, 5);
}

function validateGitSafety(repoDir) {
  const issues = [];
  const status = runGit(repoDir, ['status', '--porcelain']);
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
  const branch = runGit(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const defaultBranches = ['main', 'master'];
  if (defaultBranches.includes(branch.stdout)) {
    issues.push('on-default-branch: ' + branch.stdout);
  }
  return issues;
}

function auditOnly(evidence) {
  const report = {
    timestamp: nowIso(),
    mode: MODE,
    version: CONTROLLER_VERSION,
    phase: 'AUDIT_ONLY',
    status: 'complete',
    evidence: evidence,
    candidates: candidateSelector(evidence),
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
  appendAudit(report);
  for (const candidate of report.candidates) {
    appendCandidate(candidate);
  }
  console.log('[SAFE-AI] AUDIT_ONLY complete. Candidates: ' + report.candidates.length);
  return report;
}

function prepare(candidate) {
  const repoMap = {
    archivist: '/home/we4free/agent/repos/Archivist-Agent',
    kernel: '/home/we4free/agent/repos/kernel-lane',
    library: '/home/we4free/agent/repos/self-organizing-library',
    swarmmind: '/home/we4free/agent/repos/SwarmMind',
    'solana-launch': '/home/we4free/agent/repos/solana-launch-lane'
  };
  const repoDir = repoMap[candidate.lane];
  if (!repoDir) return { error: 'unknown-lane: ' + candidate.lane };
  const repoUrl = runGit(repoDir, ['remote', 'get-url', 'origin']).stdout;
  if (!repoUrl) return { error: 'no-remote' };
  const branch = 'safe-improvement/' + candidate.id;
  ensureDir(WORKTREE_BASE);
  const worktreePath = path.join(WORKTREE_BASE, candidate.id);
  if (fs.existsSync(worktreePath)) {
    runGit(worktreePath, ['worktree', 'remove', '--force', worktreePath]);
  }
  const fetchResult = runGit(repoDir, ['fetch', '--no-tags', 'origin']);
  if (fetchResult.status !== 0) return { error: 'fetch-failed', details: fetchResult.stderr };
  const defaultBranch = runGit(repoDir, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).stdout.replace('origin/', '');
  const createResult = runGit(repoDir, ['worktree', 'add', '--force', worktreePath, 'origin/' + defaultBranch]);
  if (createResult.status !== 0) return { error: 'worktree-create-failed', details: createResult.stderr };
  const branchResult = runGit(worktreePath, ['checkout', '-b', branch]);
  if (branchResult.status !== 0) return { error: 'branch-create-failed', details: branchResult.stderr };
  const contract = {
    repository: repoDir,
    baseSha: runGit(worktreePath, ['rev-parse', 'HEAD']).stdout,
    branch: branch,
    worktreePath: worktreePath,
    defaultBranch: defaultBranch,
    allowedFiles: candidate.allowedFiles,
    forbiddenPaths: candidate.forbiddenPaths,
    testCommand: candidate.testCommand,
    rollbackPlan: candidate.rollbackPlan,
    resourceBudget: candidate.resourceBudget
  };
  ensureDir(CANDIDATE_DIR);
  fs.writeFileSync(path.join(CANDIDATE_DIR, candidate.id + '-contract.json'), JSON.stringify(contract, null, 2));
  appendAudit({ timestamp: nowIso(), phase: 'PREPARE', candidate: candidate.id, status: 'complete', contract });
  return contract;
}

function implement(contract) {
  const worktreePath = contract.worktreePath;
  const safety = validateGitSafety(worktreePath);
  if (safety.length > 0) {
    return { passed: false, phase: 'git-safety', issues: safety };
  }
  const diff = runGit(worktreePath, ['diff', '--name-only']);
  if (diff.stdout.trim()) {
    const files = diff.stdout.split('\n').filter(f => f.trim());
    for (const f of files) {
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
  }
  const runtimePatterns = [/\.(log|jsonl)$/, /resource_usage/, /heartbeat-/, /snapshot/];
  const allFiles = runGit(worktreePath, ['diff', '--name-only']).stdout.split('\n').filter(f => f.trim());
  for (const f of allFiles) {
    for (const pat of runtimePatterns) {
      if (pat.test(f)) {
        return { passed: false, phase: 'runtime-state', issue: 'runtime-state-detected: ' + f };
      }
    }
  }
  if (!contract.testCommand) {
    return { passed: false, phase: 'no-test', issue: 'no test command in contract' };
  }
  const testResult = spawnSync('bash', ['-lc', contract.testCommand], { cwd: worktreePath, encoding: 'utf8', timeout: 120000 });
  if (testResult.status !== 0) {
    return { passed: false, phase: 'test-failed', details: testResult.stderr || testResult.stdout };
  }
  appendAudit({ timestamp: nowIso(), phase: 'IMPLEMENT', branch: contract.branch, status: 'complete', testsPassed: true });
  return { passed: true, worktreePath: worktreePath, branch: contract.branch, testOutput: testResult.stdout };
}

function publish(contract, testResult) {
  if (!testResult.passed) {
    return { passed: false, error: 'implement-failed', details: testResult };
  }
  const worktreePath = contract.worktreePath;
  const diffCheck = runGit(worktreePath, ['diff', '--check']);
  if (diffCheck.status !== 0) {
    return { passed: false, error: 'diff-check-failed', details: diffCheck.stderr };
  }
  const changedFiles = runGit(worktreePath, ['diff', '--name-only']).stdout.split('\n').filter(f => f.trim());
  for (const f of changedFiles) {
    const isAllowed = contract.allowedFiles.some(af => f === af || f.startsWith(af));
    if (!isAllowed) {
      return { passed: false, error: 'unauthorized-file', file: f };
    }
    if (f.includes('SUGGESTION_SIGNING_KEY') || f.includes('private') || f.includes('secret') || f.includes('.env')) {
      return { passed: false, error: 'secret-like-content', file: f };
    }
    for (const forbidden of contract.forbiddenPaths) {
      if (f.startsWith(forbidden)) {
        return { passed: false, error: 'forbidden-path', file: f };
      }
    }
  }
  const branch = runGit(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout;
  const defaultBranches = ['main', 'master'];
  if (defaultBranches.includes(branch)) {
    return { passed: false, error: 'on-default-branch', branch: branch };
  }
  for (const f of changedFiles) {
    runGit(worktreePath, ['add', '--', f]);
  }
  const commitResult = runGit(worktreePath, ['commit', '-m', '[SAFE-AI] ' + contract.branch + ': ' + contract.testCommand]);
  if (commitResult.status !== 0) {
    return { passed: false, error: 'commit-failed', details: commitResult.stderr, hookFailure: true };
  }
  const localSha = runGit(worktreePath, ['rev-parse', 'HEAD']).stdout;
  const pushResult = runGit(worktreePath, ['push', 'origin', branch]);
  if (pushResult.status !== 0) {
    return { passed: false, error: 'push-failed', details: pushResult.stderr };
  }
  const remoteSha = runGit(contract.repository, ['ls-remote', 'origin', 'refs/heads/' + branch]).stdout.split('\t')[0];
  if (localSha !== remoteSha) {
    return { passed: false, error: 'sha-mismatch', local: localSha, remote: remoteSha };
  }
  const prResult = spawnSync('gh', ['pr', 'create', '--repo', 'vortsghost2025/Archivist-Agent', '--title', '[SAFE-AI] ' + contract.branch, '--body', 'Auto-generated by safe-autonomous-improvement-controller v' + CONTROLLER_VERSION, '--draft', '--head', branch], { encoding: 'utf8' });
  let prUrl = null;
  let prNumber = null;
  if (prResult.status === 0) {
    const match = prResult.stdout.match(/https:\/\/github\.com\/vortsghost2025\/Archivist-Agent\/pull\/(\d+)/);
    if (match) {
      prUrl = match[0];
      prNumber = parseInt(match[1]);
    }
  }
  appendAudit({ timestamp: nowIso(), phase: 'PUBLISH', branch: branch, status: 'complete', localSha, remoteSha, prUrl, prNumber });
  return { passed: true, branch, localSha, remoteSha, prUrl, prNumber };
}

function deploymentGate() {
  return {
    enabled: false,
    reason: 'DEPLOY mode disabled by default. Requires explicit authorization token or config flag.',
    requiredChecks: ['exact committed/deployed hashes', 'owning service', 'backup', 'rollback command', 'syntax and tests', 'available-resource check', 'minimal owning-service restart', 'several verified live cycles']
  };
}

function runController() {
  ensureDir(STATE_DIR);
  appendAudit({ timestamp: nowIso(), mode: MODE, version: CONTROLLER_VERSION, phase: 'start', status: 'started' });
  const evidence = evidenceCollector();
  appendAudit({ timestamp: nowIso(), phase: 'evidence-collection', status: 'complete' });

  if (MODE === 'AUDIT_ONLY') {
    return auditOnly(evidence);
  }
  if (MODE === 'PREPARE') {
    const candidates = candidateSelector(evidence);
    if (candidates.length === 0) {
      appendAudit({ timestamp: nowIso(), phase: 'PREPARE', status: 'no-candidates' });
      console.log('[SAFE-AI] No candidates to prepare.');
      return { status: 'no-candidates' };
    }
    const candidate = candidates[0];
    const result = prepare(candidate);
    appendAudit({ timestamp: nowIso(), phase: 'PREPARE', candidate: candidate.id, status: result.error ? 'failed' : 'complete', result });
    return result;
  }
  if (MODE === 'IMPLEMENT') {
    return { error: 'IMPLEMENT requires explicit contract. Use PREPARE first.' };
  }
  if (MODE === 'PUBLISH') {
    return { error: 'PUBLISH requires successful IMPLEMENT result.' };
  }
  if (MODE === 'DEPLOY') {
    return deploymentGate();
  }
  return { error: 'unknown-mode', mode: MODE };
}

if (require.main === module) {
  const result = runController();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runController, evidenceCollector, candidateSelector, validateGitSafety, auditOnly, prepare, implement, publish, deploymentGate, VALID_MODES };
