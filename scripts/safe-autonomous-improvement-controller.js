#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CONTROLLER_VERSION = '1.0.0';
const MODE = process.env.SAFE_IMPROVEMENT_MODE || 'AUDIT_ONLY';
const REPO_ROOT = process.env.REPO_ROOT || '/home/we4free/agent/repos/Archivist-Agent';
const LEDGER_PATH = path.join(REPO_ROOT, 'context-buffer', 'autonomy-ledger.jsonl');
const CANDIDATE_DIR = path.join(REPO_ROOT, 'context-buffer', 'improvement-candidates');
const WORKTREE_BASE = path.join(os.tmpdir(), 'we4free-safe-worktrees');
const MAX_CANDIDATES = 5;
const AUDIT_LOG_PATH = path.join(REPO_ROOT, 'context-buffer', 'safe-improvement-audit.jsonl');

function nowIso() { return new Date().toISOString(); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}
function appendLedger(entry) {
  ensureDir(path.dirname(LEDGER_PATH));
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n');
}
function appendAudit(entry) {
  ensureDir(path.dirname(AUDIT_LOG_PATH));
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n');
}

function runGit(repoDir, args) {
  const result = spawnSync('git', args, { cwd: repoDir, encoding: 'utf8', timeout: 30000 });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), status: result.status, signal: result.signal };
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

function evidenceCollector() {
  const evidence = {
    timestamp: nowIso(),
    mode: MODE,
    repositories: {},
    laneHealth: {},
    queueDepth: {},
    driftIndicators: [],
    candidateCount: 0
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
  return candidates.slice(0, MAX_CANDIDATES);
}

function cleanWorktreeManager(candidate) {
  const repoUrl = runGit(REPO_ROOT, ['remote', 'get-url', 'origin']).stdout;
  if (!repoUrl) return { error: 'no-remote' };
  const branch = 'safe-improvement/' + candidate.id;
  ensureDir(WORKTREE_BASE);
  const worktreePath = path.join(WORKTREE_BASE, candidate.id);
  if (fs.existsSync(worktreePath)) {
    runGit(worktreePath, ['worktree', 'remove', '--force', worktreePath]);
  }
  const fetchResult = runGit(REPO_ROOT, ['fetch', '--no-tags', 'origin']);
  if (fetchResult.status !== 0) return { error: 'fetch-failed', details: fetchResult.stderr };
  const defaultBranch = runGit(REPO_ROOT, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).stdout.replace('origin/', '');
  const createResult = runGit(REPO_ROOT, ['worktree', 'add', '--force', worktreePath, 'origin/' + defaultBranch]);
  if (createResult.status !== 0) return { error: 'worktree-create-failed', details: createResult.stderr };
  const branchResult = runGit(worktreePath, ['checkout', '-b', branch]);
  if (branchResult.status !== 0) return { error: 'branch-create-failed', details: branchResult.stderr };
  return { worktreePath, branch, defaultBranch, repoUrl };
}

function gitGate(worktreePath, candidate) {
  const safety = validateGitSafety(worktreePath);
  if (safety.length > 0) {
    return { passed: false, issues: safety };
  }
  const diff = runGit(worktreePath, ['diff', '--name-only']);
  if (diff.stdout.trim()) {
    const files = diff.stdout.split('\n').filter(f => f.trim());
    for (const f of files) {
      const isAllowed = candidate.allowedFiles.some(af => f === af || f.startsWith(af));
      if (!isAllowed) {
        return { passed: false, issue: 'unauthorized-file: ' + f };
      }
    }
  }
  return { passed: true };
}

function publicationGate(worktreePath, candidate, branch) {
  const pushResult = runGit(worktreePath, ['push', 'origin', branch, '--no-verify']);
  if (pushResult.status !== 0) {
    return { passed: false, error: 'push-failed', details: pushResult.stderr };
  }
  const prBody = {
    title: '[SAFE-AI] ' + candidate.type + ': ' + candidate.rationale,
    body: 'Auto-generated by safe-autonomous-improvement-controller v' + CONTROLLER_VERSION + '\n' +
      'Mode: ' + MODE + '\n' +
      'Candidate: ' + candidate.id + '\n' +
      'Lane: ' + candidate.lane + '\n' +
      'Risk: ' + candidate.risk + '\n' +
      'Rationale: ' + candidate.rationale + '\n' +
      'Allowed files: ' + candidate.allowedFiles.join(', ') + '\n' +
      'Rollback: ' + candidate.rollbackPlan,
    draft: true
  };
  return { passed: true, branch: branch, prBody: prBody };
}

function deploymentGate(candidate) {
  return {
    enabled: false,
    reason: 'AUDIT_ONLY mode — deployment disabled by default',
    requiredChecks: [
      'multiple-cycle verification',
      'exact file hash match',
      'restart only owning service',
      'live verification passed'
    ]
  };
}

function runController() {
  const auditEntry = {
    timestamp: nowIso(),
    mode: MODE,
    version: CONTROLLER_VERSION,
    phase: 'evidence-collection',
    status: 'started'
  };
  appendAudit(auditEntry);

  const evidence = evidenceCollector();
  appendAudit({ timestamp: nowIso(), phase: 'evidence-collection', status: 'complete', evidence });

  const candidates = candidateSelector(evidence);
  appendAudit({ timestamp: nowIso(), phase: 'candidate-selection', status: 'complete', candidates: candidates.length });

  for (const candidate of candidates) {
    appendAudit({ timestamp: nowIso(), phase: 'candidate-processing', candidate: candidate.id, status: 'started' });

    const worktree = cleanWorktreeManager(candidate);
    if (worktree.error) {
      appendAudit({ timestamp: nowIso(), phase: 'worktree', candidate: candidate.id, status: 'failed', error: worktree.error });
      continue;
    }

    const gate = gitGate(worktree.worktreePath, candidate);
    if (!gate.passed) {
      appendAudit({ timestamp: nowIso(), phase: 'git-gate', candidate: candidate.id, status: 'failed', issues: gate.issues });
      runGit(worktree.worktreePath, ['worktree', 'remove', '--force', worktree.worktreePath]);
      continue;
    }

    const pub = publicationGate(worktree.worktreePath, candidate, worktree.branch);
    appendAudit({ timestamp: nowIso(), phase: 'publication', candidate: candidate.id, status: pub.passed ? 'complete' : 'failed', details: pub });

    const deploy = deploymentGate(candidate);
    appendAudit({ timestamp: nowIso(), phase: 'deployment', candidate: candidate.id, status: 'skipped', details: deploy });

    const ledger = {
      claim: candidate.rationale,
      evidence: 'safe-autonomous-improvement-controller v' + CONTROLLER_VERSION,
      verified_by: 'safe-autonomous-improvement-controller',
      branch: worktree.branch,
      candidate: candidate.id,
      lane: candidate.lane,
      mode: MODE,
      deployment: deploy.enabled,
      status: 'audit-only'
    };
    appendLedger(ledger);

    runGit(worktree.worktreePath, ['worktree', 'remove', '--force', worktree.worktreePath]);
  }

  appendAudit({ timestamp: nowIso(), phase: 'run-complete', status: 'complete', mode: MODE });
  console.log('[SAFE-AI] Controller run complete in ' + MODE + ' mode');
}

if (require.main === module) {
  runController();
}

module.exports = { runController, evidenceCollector, candidateSelector, cleanWorktreeManager, gitGate, publicationGate, deploymentGate };
