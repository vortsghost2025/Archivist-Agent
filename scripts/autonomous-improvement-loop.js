#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
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
    errors: [],
  };

  // 1. Self-analysis of lane scripts
  const analyzeTarget = lane === 'archivist' ? 'scripts/generic-task-executor.js' : 'scripts';
  const analyze = runTask(lane, `analyze code ${analyzeTarget}`, 'analyze_code');
  report.research.push({ step: 'self_analysis', result: analyze.task_kind, summary: analyze.summary });
  log(`${lane}: self_analysis -> ${analyze.task_kind} ${analyze.summary}`);

  // 2. Trace key symbols for improvement opportunities
  const trace = runTask(lane, 'trace symbol executeTask in scripts', 'trace_symbol');
  report.research.push({ step: 'symbol_trace', result: trace.task_kind, summary: trace.summary });
  log(`${lane}: symbol_trace -> ${trace.task_kind} ${trace.summary}`);

  // 3. Web research for autonomous improvement patterns
  const webTarget = RESEARCH_TARGETS[cycle % RESEARCH_TARGETS.length];
  const web = runTask(lane, `web research ${webTarget}`, 'web_research');
  report.research.push({ step: 'web_research', url: webTarget, result: web.task_kind, summary: web.summary });
  log(`${lane}: web_research -> ${web.task_kind} ${web.summary}`);

  // 4. Find improvement opportunities in lane code
  const patterns = runTask(lane, 'find pattern timing_instrumentation in scripts', 'find_patterns');
  report.research.push({ step: 'pattern_search', result: patterns.task_kind, summary: patterns.summary });
  log(`${lane}: pattern_search -> ${patterns.task_kind} ${patterns.summary}`);

  // 5. Propose concrete improvement based on research
  const proposalTitle = `${lane} lane improvement: enhance executor research capabilities cycle ${cycle}`;
  const proposalBody = `propose improvement ${proposalTitle}\n\n` +
    `## Research Findings\n` +
    `- Self-analysis: ${analyze.summary}\n` +
    `- Symbol trace: ${trace.summary}\n` +
    `- Web research: ${web.summary}\n` +
    `- Pattern search: ${patterns.summary}\n\n` +
    `## Proposed Changes\n` +
    `Based on the research, enhance ${lane} lane autonomous capabilities by:\n` +
    `1. Adding web research task handler for online best-practice lookup\n` +
    `2. Improving symbol tracing with better context windows\n` +
    `3. Adding automated improvement validation and testing\n\n` +
    `## Affected Files\n` +
    `- scripts/generic-task-executor.js\n` +
    `- proposals/\n` +
    `- improvement-reports/\n\n` +
    `## Testing Plan\n` +
    `- Run executor tests before and after changes\n` +
    `- Validate proposal governance compliance\n` +
    `- Verify autonomous loop picks up improvements`;
  const proposal = runTask(lane, proposalBody, 'propose_improvement');
  report.improvements.push({ step: 'propose', result: proposal.task_kind, path: proposal.results?.proposal_path, summary: proposal.summary });
  log(`${lane}: propose_improvement -> ${proposal.task_kind} ${proposal.summary}`);

  // 6. Validate proposal
  if (proposal.results?.proposal_path) {
    const validation = runTask(lane, `validate improvement ${proposal.results.proposal_path}`, 'validate_improvement');
    report.tests.push({ step: 'validate', result: validation.task_kind, validation: validation.results?.validation, passed: validation.results?.passed, summary: validation.summary });
    log(`${lane}: validate -> ${validation.task_kind} ${validation.summary}`);

    // 7. Implement if valid
    if (validation.results?.validation === 'PASS') {
      const implement = runTask(lane, `implement proposal ${proposal.results.proposal_path}`, 'implement_proposal');
      report.improvements.push({ step: 'implement', result: implement.task_kind, status: implement.results?.status, path: implement.results?.implemented_copy, summary: implement.summary });
      log(`${lane}: implement -> ${implement.task_kind} ${implement.summary}`);
    } else {
      log(`${lane}: proposal failed validation, skipping implementation`);
      report.errors.push({ step: 'validation_failed', proposal: proposal.results.proposal_path, validation: validation.results });
    }
  } else {
    log(`${lane}: no proposal generated, skipping validation/implementation`);
    report.errors.push({ step: 'no_proposal', proposal_result: proposal.results });
  }

  // 8. Audit patches and reports
  const patches = runTask(lane, 'list dir patches', 'list dir');
  report.tests.push({ step: 'patch_inventory', result: patches.task_kind, count: patches.results?.entries?.length || 0, summary: patches.summary });
  log(`${lane}: patch_inventory -> ${patches.task_kind} ${patches.summary}`);

  const saved = saveReport(lane, cycle, report);
  log(`${lane}: report saved to ${saved}`);
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
