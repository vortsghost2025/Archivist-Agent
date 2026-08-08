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

const IMPROVEMENTS = [
  {
    name: 'add_web_research_test',
    lane: 'archivist',
    testCode: `
test('web_research: valid host returns content', () => {
  const r = executeTask(makeMsg('web research https://github.com/tauri-apps/tauri/discussions', { task_kind: 'web_research' }), LANE);
  assert.strictEqual(r.task_kind, 'report');
  assert(r.results.bytes > 0);
});
`,
    apply: (root) => {
      const testFile = path.join(root, 'scripts/test-executor-v3.js');
      let code = fs.readFileSync(testFile, 'utf8');
      if (!code.includes('web_research: valid host returns content')) {
        code = code.replace(
          "========================================",
          `test('web_research: valid host returns content', () => {
  const r = executeTask(makeMsg('web research https://github.com/tauri-apps/tauri/discussions', { task_kind: 'web_research' }), LANE);
  assert.strictEqual(r.task_kind, 'report');
  assert(r.results.bytes > 0);
});

========================================`
        );
        fs.writeFileSync(testFile, code, 'utf8');
        return true;
      }
      return false;
    },
  },
  {
    name: 'add_compare_alias_test',
    lane: 'archivist',
    testCode: null,
    apply: (root) => {
      const testFile = path.join(root, 'scripts/test-executor-v3.js');
      let code = fs.readFileSync(testFile, 'utf8');
      if (!code.includes('compare alias with absolute paths')) {
        code = code.replace(
          "========================================",
          `test('compare alias with absolute paths', () => {
  const dir = ensureTestDir();
  const f1 = path.join(dir, 'comp-alias-1.txt');
  const f2 = path.join(dir, 'comp-alias-2.txt');
  fs.writeFileSync(f1, 'same', 'utf8');
  fs.writeFileSync(f2, 'same', 'utf8');
  const r = executeTask(makeMsg(\`compare \${f1} with \${f2}\`), LANE);
  assert.strictEqual(r.task_kind, 'report');
  assert.strictEqual(r.results.identical, true);
});

========================================`
        );
        fs.writeFileSync(testFile, code, 'utf8');
        return true;
      }
      return false;
    },
  },
  {
    name: 'add_git_error_test',
    lane: 'archivist',
    testCode: null,
    apply: (root) => {
      const testFile = path.join(root, 'scripts/test-executor-v3.js');
      let code = fs.readFileSync(testFile, 'utf8');
      if (!code.includes('git: disallowed push returns error')) {
        code = code.replace(
          "test('adversarial: git push rejected',",
          `test('git: disallowed push returns error', () => {
  const r = executeTask(makeMsg('git push'), LANE);
  assert.strictEqual(r.task_kind, 'report');
  assert(r.results.error);
});

test('adversarial: git push rejected',`
        );
        fs.writeFileSync(testFile, code, 'utf8');
        return true;
      }
      return false;
    },
  },
];

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`${ts} [improvement-loop] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function runTests(repo) {
  try {
    const output = execSync('node scripts/test-executor-v3.js', { cwd: repo, encoding: 'utf8', timeout: 60000 });
    const passMatch = output.match(/(\d+) PASS/);
    const failMatch = output.match(/(\d+) FAIL/);
    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      output: output.slice(-1000),
    };
  } catch (e) {
    return {
      passed: 0,
      failed: 0,
      error: e.message,
      output: ((e.stdout || '') + (e.stderr || '')).slice(-1000),
    };
  }
}

function applyImprovement(lane, improvement) {
  const root = LANE_REGISTRY[lane]?.root;
  if (!root || improvement.lane !== lane) return { applied: false, reason: 'wrong lane' };

  try {
    const applied = improvement.apply(root);
    if (!applied) return { applied: false, reason: 'already applied' };

    const tests = runTests(root);
    if (tests.failed > 0) {
      return { applied: true, tests_passed: false, tests, reason: 'tests failed after change' };
    }

    return { applied: true, tests_passed: true, tests };
  } catch (e) {
    return { applied: false, error: e.message };
  }
}

function runImprovementCycle(lane, cycle) {
  log(`=== ${lane} cycle ${cycle} start ===`);
  const root = LANE_REGISTRY[lane]?.root;
  if (!root) {
    log(`${lane}: root not found, skipping`);
    return { lane, cycle, skipped: true };
  }

  const report = {
    lane,
    cycle,
    timestamp: new Date().toISOString(),
    baseline: runTests(root),
    improvements: [],
    commits: [],
    errors: [],
  };

  log(`${lane}: baseline ${report.baseline.passed} pass, ${report.baseline.failed} fail`);

  for (const imp of IMPROVEMENTS) {
    if (imp.lane !== lane) continue;
    log(`${lane}: applying improvement ${imp.name}`);
    const result = applyImprovement(lane, imp);
    report.improvements.push({ name: imp.name, ...result });

    if (result.applied && result.tests_passed) {
      const commitResult = gitCommit(root, `test: add ${imp.name} coverage`);
      report.commits.push(commitResult);
      if (commitResult.committed) {
        const pushResult = gitPush(root);
        commitResult.pushed = pushResult.pushed;
        log(`${lane}: committed and pushed ${imp.name}`);
      }
    } else if (result.applied && !result.tests_passed) {
      log(`${lane}: ${imp.name} broke tests, reverting`);
      try {
        execSync('git checkout -- scripts/test-executor-v3.js', { cwd: root, encoding: 'utf8' });
      } catch (_) {}
    }
  }

  log(`${lane}: cycle ${cycle} complete - ${report.commits.filter(c => c.committed).length} commits`);
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
    improvements: results.reduce((a, r) => a + (r.improvements?.filter(i => i.applied && i.tests_passed).length || 0), 0),
    errors: results.reduce((a, r) => a + (r.errors?.length || 0), 0),
  };
  log(`=== cycle ${cycle} summary ===`);
  log(JSON.stringify(summary, null, 2));
  return summary;
}

function main() {
  const args = process.argv.slice(2);
  const cycles = args.includes('--cycles') ? parseInt(args[args.indexOf('--cycles') + 1], 10) : 1;

  for (let i = 0; i < cycles; i++) {
    const cycle = i + 1;
    log(`Starting improvement cycle ${cycle}/${cycles}`);
    runAllLanes(cycle);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runImprovementCycle, runAllLanes };
