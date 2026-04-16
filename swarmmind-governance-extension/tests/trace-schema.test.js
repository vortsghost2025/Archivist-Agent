const {
  createHumanEntry,
  createAgentEntry,
  validateTraceEntry,
  mergeTraces,
  exportForExternalReview,
  GOVERNANCE_FIELDS
} = require('../lib/trace-schema');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.log(`✗ ${message}`);
  }
}

function testCreateHumanEntry() {
  console.log('\n--- testCreateHumanEntry ---');
  
  const entry = createHumanEntry('challenge', {
    claim: 'Test claim',
    drift_signal: 'warning'
  });

  assert(entry.source === 'human', 'source is human');
  assert(entry.action === 'challenge', 'action is challenge');
  assert(entry.claim === 'Test claim', 'claim preserved');
  assert(entry.drift_signal === 'warning', 'drift_signal preserved');
  assert(entry.timestamp, 'timestamp generated');
}

function testCreateAgentEntry() {
  console.log('\n--- testCreateAgentEntry ---');
  
  const entry = createAgentEntry('agent-001', 'Planner', 'analyze', {
    governance_check: 'passed',
    drift_signal: 'none'
  });

  assert(entry.source === 'agent', 'source is agent');
  assert(entry.agentId === 'agent-001', 'agentId preserved');
  assert(entry.agentName === 'Planner', 'agentName preserved');
  assert(entry.action === 'analyze', 'action preserved');
  assert(entry.governance_check === 'passed', 'governance_check preserved');
}

function testValidateTraceEntry() {
  console.log('\n--- testValidateTraceEntry ---');
  
  const validEntry = createHumanEntry('test');
  const validation = validateTraceEntry(validEntry);
  assert(validation.valid, 'valid entry passes');
  assert(validation.errors.length === 0, 'no errors for valid entry');

  const invalidEntry = { timestamp: '2026-04-15T00:00:00Z' };
  const invalidValidation = validateTraceEntry(invalidEntry);
  assert(!invalidValidation.valid, 'invalid entry fails');
  assert(invalidValidation.errors.length > 0, 'errors present for invalid entry');
}

function testMergeTraces() {
  console.log('\n--- testMergeTraces ---');
  
  const agentTraces = [
    { ...createAgentEntry('a1', 'Agent1', 'start'), timestamp: '2026-04-15T10:00:00Z' },
    { ...createAgentEntry('a1', 'Agent1', 'end'), timestamp: '2026-04-15T10:05:00Z' }
  ];

  const humanTraces = [
    { ...createHumanEntry('propose'), timestamp: '2026-04-15T09:55:00Z' },
    { ...createHumanEntry('challenge'), timestamp: '2026-04-15T10:02:00Z' }
  ];

  const merged = mergeTraces(agentTraces, humanTraces);

  assert(merged.length === 4, 'merged has 4 entries');
  assert(merged[0].action === 'propose', 'first is propose (09:55)');
  assert(merged[1].action === 'start', 'second is start (10:00)');
  assert(merged[2].action === 'challenge', 'third is challenge (10:02)');
  assert(merged[3].action === 'end', 'fourth is end (10:05)');
}

function testExportForExternalReview() {
  console.log('\n--- testExportForExternalReview ---');
  
  const traces = [
    createHumanEntry('test', { governance_check: 'passed', drift_signal: 'none' }),
    createAgentEntry('a1', 'Agent', 'work', { governance_check: 'failed', drift_signal: 'warning' })
  ];

  const exported = exportForExternalReview(traces, { purpose: 'test' });

  assert(exported.traceCount === 2, 'traceCount is 2');
  assert(exported.summary.agentEntries === 1, 'agentEntries count');
  assert(exported.summary.humanEntries === 1, 'humanEntries count');
  assert(exported.summary.governanceChecksPassed === 1, 'passed count');
  assert(exported.summary.governanceChecksFailed === 1, 'failed count');
  assert(exported.tree, 'tree generated');
}

function testGovernanceFields() {
  console.log('\n--- testGovernanceFields ---');
  
  assert(Array.isArray(GOVERNANCE_FIELDS.source), 'source is array');
  assert(GOVERNANCE_FIELDS.source.includes('agent'), 'source includes agent');
  assert(GOVERNANCE_FIELDS.source.includes('human'), 'source includes human');
  
  assert(GOVERNANCE_FIELDS.governance_check.includes('passed'), 'governance_check includes passed');
  assert(GOVERNANCE_FIELDS.governance_check.includes('failed'), 'governance_check includes failed');
  
  assert(GOVERNANCE_FIELDS.drift_signal.includes('warning'), 'drift_signal includes warning');
  assert(GOVERNANCE_FIELDS.drift_signal.includes('critical'), 'drift_signal includes critical');
}

function runTests() {
  console.log('Running trace-schema tests...');
  
  testCreateHumanEntry();
  testCreateAgentEntry();
  testValidateTraceEntry();
  testMergeTraces();
  testExportForExternalReview();
  testGovernanceFields();
  
  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
