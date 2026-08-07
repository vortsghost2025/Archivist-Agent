#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { executeTask, LANE_REGISTRY } = require('./generic-task-executor');

const ARCHIVIST = '/home/we4free/agent/repos/Archivist-Agent';
const KERNEL = '/home/we4free/agent/repos/kernel-lane';
const SWARMMIND = '/home/we4free/agent/repos/SwarmMind';
const LIBRARY = '/home/we4free/agent/repos/self-organizing-library';

const LANES = [
  { id: 'archivist', root: ARCHIVIST },
  { id: 'kernel', root: KERNEL },
  { id: 'swarmmind', root: SWARMMIND },
  { id: 'library', root: LIBRARY },
];

const RESEARCH_TARGETS = [
  'https://github.com/tauri-apps/tauri/discussions',
  'https://docs.github.com/en/actions',
  'https://nodejs.org/en/docs',
];

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`${ts} [improvement-loop] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runTask(lane, body, taskKind) {
  try {
    const result = executeTask({ body, task_kind: taskKind }, lane);
    return result;
  } catch (e) {
    return { task_kind: 'error', results: { error: e.message }, summary: `Error: ${e.message}` };
  }
}

function gitCommit(repo, message) {
  try {
    execSync('git add -A', { cwd: repo, encoding: 'utf8' });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repo, encoding: 'utf8' });
    return { committed: true, message };
  } catch (e) {
    return { committed: false, error: e.message };
  }
}

function gitPush(repo) {
  try {
    execSync('git push', { cwd: repo, encoding: 'utf8', timeout: 30000 });
    return { pushed: true };
  } catch (e) {
    return { pushed: false, error: e.message };
  }
}

function saveReport(lane, cycle, data) {
  const reportDir = path.join(ARCHIVIST, 'improvement-reports');
  ensureDir(reportDir);
  const file = path.join(reportDir, `${lane}-cycle-${String(cycle).padStart(4, '0')}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

function runImprovementCycle(lane, cycle) {
  log(`=== ${lane} cycle ${cycle} start ===`);
  const root = LANE_REGISTRY[lane] ? LANE_REGISTRY[lane].root : LANES.find(l => l.id === lane)?.root;
  if (!root) {
    log(`${lane}: root not found, skipping`);
    return { lane, cycle, skipped: true, reason: 'root not found' };
  }

  const report = {
    lane,
    cycle,
    timestamp: new Date().toISOString(),
    research: [],
    improvements: [],
    tests: [],
    commits: [],
    errors: [],
  };

  // 1. Run executor tests to establish baseline
  let testResult = { passed: 0, failed: 0 };
  try {
    const testOutput = execSync('node scripts/test-executor-v3.js', { cwd: root, encoding: 'utf8', timeout: 60000 });
    const passMatch = testOutput.match(/(\d+) PASS/);
    const failMatch = testOutput.match(/(\d+) FAIL/);
    testResult = {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      output: testOutput.slice(-500),
    };
  } catch (e) {
    testResult.error = e.message;
    testResult.output = (e.stdout || '').slice(-500);
  }
  report.tests.push({ step: 'baseline_tests', ...testResult });
  log(`${lane}: baseline tests -> ${testResult.passed} pass, ${testResult.failed} fail`);

  // 2. Self-analysis of lane scripts
  const analyzeTarget = lane === 'archivist' ? 'scripts/generic-task-executor.js' : 'scripts';
  const analyze = runTask(lane, `analyze code ${analyzeTarget}`, 'analyze_code');
  report.research.push({ step: 'self_analysis', result: analyze.task_kind, summary: analyze.summary });
  log(`${lane}: self_analysis -> ${analyze.task_kind} ${analyze.summary}`);

  // 3. Web research for improvement patterns
  const webTarget = RESEARCH_TARGETS[cycle % RESEARCH_TARGETS.length];
  const web = runTask(lane, `web research ${webTarget}`, 'web_research');
  report.research.push({ step: 'web_research', url: webTarget, result: web.task_kind, summary: web.summary });
  log(`${lane}: web_research -> ${web.task_kind} ${web.summary}`);

  // 4. Find concrete improvement opportunities
  const patterns = runTask(lane, 'find pattern timing_instrumentation in scripts', 'find_patterns');
  report.research.push({ step: 'pattern_search', result: patterns.task_kind, summary: patterns.summary });
  log(`${lane}: pattern_search -> ${patterns.task_kind} ${patterns.summary}`);

  // 5. Generate real improvement: if tests are failing, try to fix them
  if (testResult.failed > 0) {
    log(`${lane}: attempting to fix ${testResult.failed} failing tests`);
    const fixProposal = runTask(lane, `propose improvement ${lane} fix failing tests cycle ${cycle}\n\n` +
      `## Failing Tests\n` +
      `- ${testResult.output}\n\n` +
      `## Proposed Fix\n` +
      `Analyze test failures and generate patches to fix them.\n\n` +
      `## Affected Files\n` +
      `- scripts/generic-task-executor.js\n` +
      `- scripts/test-executor-v3.js\n\n` +
      `## Testing Plan\n` +
      `- Run test-executor-v3.js after fix\n` +
      `- Verify all tests pass`, 'propose_improvement');

    if (fixProposal.results?.proposal_path) {
      const validation = runTask(lane, `validate improvement ${fixProposal.results.proposal_path}`, 'validate_improvement');
      report.tests.push({ step: 'validate_fix', result: validation.task_kind, passed: validation.results?.validation === 'PASS', summary: validation.summary });

      if (validation.results?.validation === 'PASS') {
        const implement = runTask(lane, `implement proposal ${fixProposal.results.proposal_path}`, 'implement_proposal');
        report.improvements.push({ step: 'implement_fix', result: implement.task_kind, status: implement.results?.status, path: implement.results?.implemented_copy, summary: implement.summary });

        if (implement.results?.status === 'implemented') {
          const commitResult = gitCommit(root, `fix: address failing tests in ${lane} lane cycle ${cycle}`);
          report.commits.push(commitResult);
          log(`${lane}: committed test fixes`);
        }
      }
    }
  }

  // 6. Generate real improvement: add test coverage for new features
  const newTestProposal = runTask(lane, `propose improvement ${lane} add test coverage for new features cycle ${cycle}\n\n` +
    `## Current Coverage\n` +
    `- Self-analysis: ${analyze.summary}\n` +
    `- Pattern search: ${patterns.summary}\n\n` +
    `## Proposed Changes\n` +
    `Add unit tests for:\n` +
    `1. Web research task handler\n` +
    `2. Compare files with absolute paths\n` +
    `3. Git subcommand validation\n\n` +
    `## Affected Files\n` +
    `- scripts/test-executor-v3.js\n\n` +
    `## Testing Plan\n` +
    `- Run test-executor-v3.js\n` +
    `- Verify new tests pass`, 'propose_improvement');

  if (newTestProposal.results?.proposal_path) {
    const validation = runTask(lane, `validate improvement ${newTestProposal.results.proposal_path}`, 'validate_improvement');
    report.tests.push({ step: 'validate_new_tests', result: validation.task_kind, passed: validation.results?.validation === 'PASS', summary: validation.summary });

    if (validation.results?.validation === 'PASS') {
      const implement = runTask(lane, `implement proposal ${newTestProposal.results.proposal_path}`, 'implement_proposal');
      report.improvements.push({ step: 'implement_new_tests', result: implement.task_kind, status: implement.results?.status, path: implement.results?.implemented_copy, summary: implement.summary });

      if (implement.results?.status === 'implemented') {
        const commitResult = gitCommit(root, `test: add coverage for new executor features ${lane} cycle ${cycle}`);
        report.commits.push(commitResult);
        log(`${lane}: committed new tests`);
      }
    }
  }

  // 7. Generate real improvement: code quality improvements
  const qualityProposal = runTask(lane, `propose improvement ${lane} code quality improvements cycle ${cycle}\n\n` +
    `## Research\n` +
    `- Web research: ${web.summary}\n` +
    `- Symbol trace: ${report.research.find(r => r.step === 'symbol_trace')?.summary || 'N/A'}\n\n` +
    `## Proposed Changes\n` +
    `Based on research, implement concrete code quality improvements:\n` +
    `1. Add input validation to task handlers\n` +
    `2. Improve error messages with actionable guidance\n` +
    `3. Add caching for expensive operations\n\n` +
    `## Affected Files\n` +
    `- scripts/generic-task-executor.js\n\n` +
    `## Testing Plan\n` +
    `- Run test-executor-v3.js\n` +
    `- Verify no regressions`, 'propose_improvement');

  if (qualityProposal.results?.proposal_path) {
    const validation = runTask(lane, `validate improvement ${qualityProposal.results.proposal_path}`, 'validate_improvement');
    report.tests.push({ step: 'validate_quality', result: validation.task_kind, passed: validation.results?.validation === 'PASS', summary: validation.summary });

    if (validation.results?.validation === 'PASS') {
      const implement = runTask(lane, `implement proposal ${qualityProposal.results.proposal_path}`, 'implement_proposal');
      report.improvements.push({ step: 'implement_quality', result: implement.task_kind, status: implement.results?.status, path: implement.results?.implemented_copy, summary: implement.summary });

      if (implement.results?.status === 'implemented') {
        const commitResult = gitCommit(root, `chore: code quality improvements ${lane} cycle ${cycle}`);
        report.commits.push(commitResult);
        log(`${lane}: committed quality improvements`);
      }
    }
  }

  // 8. Push commits
  for (const commit of report.commits) {
    if (commit.committed) {
      const pushResult = gitPush(root);
      commit.pushed = pushResult.pushed;
      if (!pushResult.pushed) {
        log(`${lane}: push failed: ${pushResult.error}`);
      }
    }
  }

  const saved = saveReport(lane, cycle, report);
  log(`${lane}: report saved to ${saved}`);
  log(`${lane}: cycle ${cycle} complete - ${report.commits.filter(c => c.committed).length} commits, ${report.errors.length} errors`);
  return report;
}

function runAllLanes(cycle) {
  const results = [];
  for (const lane of LANES) {
    const report = runImprovementCycle(lane.id, cycle);
    results.push(report);
  }
  const summary = {
    cycle,
    timestamp: new Date().toISOString(),
    lanes: results.length,
    commits: results.reduce((a, r) => a + (r.commits?.filter(c => c.committed).length || 0), 0),
    improvements: results.reduce((a, r) => a + (r.improvements?.length || 0), 0),
    errors: results.reduce((a, r) => a + (r.errors?.length || 0), 0),
  };
  const summaryPath = path.join(ARCHIVIST, 'improvement-reports', `summary-cycle-${String(cycle).padStart(4, '0')}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  log(`=== cycle ${cycle} summary ===`);
  log(JSON.stringify(summary, null, 2));
  return summary;
}

function main() {
  const args = process.argv.slice(2);
  const cycles = args.includes('--cycles') ? parseInt(args[args.indexOf('--cycles') + 1], 10) : 1;
  const sleep = args.includes('--sleep') ? parseInt(args[args.indexOf('--sleep') + 1], 10) : 300;

  for (let i = 0; i < cycles; i++) {
    const cycle = i + 1;
    log(`Starting improvement cycle ${cycle}/${cycles}`);
    runAllLanes(cycle);
    if (i < cycles - 1) {
      log(`Sleeping ${sleep}s before next cycle...`);
      const start = Date.now();
      while (Date.now() - start < sleep * 1000) {
        const remaining = Math.ceil((sleep * 1000 - (Date.now() - start)) / 1000);
        process.stdout.write(`\r${new Date().toISOString()} [improvement-loop] next cycle in ${remaining}s   `);
      }
      process.stdout.write('\n');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { runImprovementCycle, runAllLanes };
