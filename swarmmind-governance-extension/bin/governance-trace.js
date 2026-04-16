#!/usr/bin/env node

/**
 * CLI for capturing human input into governance traces.
 * 
 * Usage:
 *   node governance-trace.js human --action challenge --claim "..." --drift-signal warning
 *   node governance-trace.js merge --agent traces/agent.json --human traces/human.json
 *   node governance-trace.js export --input traces/merged.json --output review.json
 */

const fs = require('fs');
const path = require('path');
const {
  createHumanEntry,
  mergeTraces,
  exportForExternalReview,
  validateTraceEntry
} = require('../lib/trace-schema');

function parseArgs(args) {
  const result = { command: args[0], params: {} };
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result.params[key] = value;
      if (value !== true) i++;
    }
  }
  
  return result;
}

function handleHuman(params) {
  const entry = createHumanEntry(params.action || 'unknown', {
    claim: params.claim,
    drift_signal: params['drift-signal'] || 'none',
    governance_check: params['governance-check'] || 'unknown',
    branch: params.branch || 'main'
  });

  const validation = validateTraceEntry(entry);
  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
    process.exit(1);
  }

  if (params.output) {
    fs.writeFileSync(params.output, JSON.stringify(entry, null, 2));
    console.log(`Written: ${params.output}`);
  } else {
    console.log(JSON.stringify(entry, null, 2));
  }
}

function handleMerge(params) {
  if (!params.agent || !params.human) {
    console.error('Error: --agent and --human required');
    process.exit(1);
  }

  const agentTraces = JSON.parse(fs.readFileSync(params.agent, 'utf8'));
  const humanTraces = JSON.parse(fs.readFileSync(params.human, 'utf8'));
  
  let agentArray = Array.isArray(agentTraces) ? agentTraces : [agentTraces];
  let humanArray = Array.isArray(humanTraces) ? humanTraces : [humanTraces];

  const merged = mergeTraces(agentArray, humanArray);

  if (params.output) {
    fs.writeFileSync(params.output, JSON.stringify(merged, null, 2));
    console.log(`Merged ${agentArray.length} agent + ${humanArray.length} human = ${merged.length} total`);
    console.log(`Written: ${params.output}`);
  } else {
    console.log(JSON.stringify(merged, null, 2));
  }
}

function handleExport(params) {
  if (!params.input) {
    console.error('Error: --input required');
    process.exit(1);
  }

  const traces = JSON.parse(fs.readFileSync(params.input, 'utf8'));
  const traceArray = Array.isArray(traces) ? traces : [traces];

  const exported = exportForExternalReview(traceArray, {
    source: params.input,
    purpose: 'external-lane-review'
  });

  if (params.output) {
    fs.writeFileSync(params.output, JSON.stringify(exported, null, 2));
    console.log(`Exported ${traceArray.length} traces for external review`);
    console.log(`Written: ${params.output}`);
  } else {
    console.log(JSON.stringify(exported, null, 2));
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
SwarmMind Governance Extension CLI

Commands:
  human      Create a human trace entry
  merge      Merge agent and human traces
  export     Export traces for external review

Examples:
  governance-trace human --action challenge --claim "..." --drift-signal warning
  governance-trace merge --agent agent.json --human human.json --output merged.json
  governance-trace export --input merged.json --output review.json
`);
    process.exit(0);
  }

  const { command, params } = parseArgs(args);

  switch (command) {
    case 'human':
      handleHuman(params);
      break;
    case 'merge':
      handleMerge(params);
      break;
    case 'export':
      handleExport(params);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();
