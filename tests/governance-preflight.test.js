/**
 * Tests for governance-preflight.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Test fixtures
const validRegistry = {
  schema_version: '1.0',
  registry_id: 'test-registry',
  timestamp: new Date().toISOString(),
  lanes: {
    archivist: {
      lane_id: 'archivist',
      role: 'archivist',
      lane_state: 'ACTIVE',
      local_path: 'S:/Archivist-Agent',
      repo: 'github.com/vortsghost2025/Archivist-Agent',
      branch: 'master',
      inbox: 'lanes/archivist/inbox',
      outbox: 'lanes/archivist/outbox',
      mailboxes: {
        inbox: 'lanes/archivist/inbox',
        outbox: 'lanes/archivist/outbox'
      }
    }
  },
  broadcast: {},
  cross_lane_protocol: {},
  agent_instructions: {}
};

// Registry with warnings
const registryWithWarnings = {
  ...validRegistry,
  lanes: {
    ...validRegistry.lanes,
    archivist: {
      ...validRegistry.lanes.archivist,
      lane_state: 'ARCHIVED' // This should generate a warning (ARCHIVED_NO_TRANSITION)
    }
  }
};

// Registry with errors
const registryWithErrors = {
  ...validRegistry,
  lanes: {
    ...validRegistry.lanes,
    archivist: {
      ...validRegistry.lanes.archivist,
      lane_state: 'INVALID_STATE' // This should generate an error
    }
  }
};

// Malformed JSON
const malformedJson = '{ invalid json';

function runPreflight(args) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  const argArray = Array.isArray(args) ? args : args.split(' ');
  try {
    const output = execFileSync(process.execPath, [scriptPath, ...argArray], { 
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    });
    return { exitCode: 0, output };
  } catch (error) {
    return { exitCode: error.status, output: error.stdout || error.message };
  }
}

function runPreflightJson(args) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  const argArray = Array.isArray(args) ? args : args.split(' ');
  try {
    const output = execFileSync(process.execPath, [scriptPath, ...argArray], { 
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    });
    return { exitCode: 0, output: JSON.parse(output) };
  } catch (error) {
    const textOutput = error.stdout || error.message;
    let parsed = null;
    try {
      parsed = JSON.parse(textOutput);
    } catch {}
    return { exitCode: error.status, output: parsed || textOutput };
  }
}

function writeFixture(name, data) {
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  const fixturePath = path.join(fixturesDir, name);
  fs.writeFileSync(fixturePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return fixturePath;
}

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ ${testName}`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName}: ${error.message}`);
    return false;
  }
}

function testValidRegistryReturnsExitCode0() {
  const fixturePath = writeFixture('valid-registry.json', validRegistry);
  const { exitCode, output } = runPreflight(['--registry', fixturePath]);
  
  if (exitCode !== 0) throw new Error(`Expected exit code 0, got ${exitCode}`);
  if (!output.includes('REGISTRY VALID') && !output.includes('ROUTING ALLOWED')) {
    throw new Error('Expected success message not found. Got: ' + output);
  }
}

function testValidRegistryWithJsonReturnsProperJson() {
  const fixturePath = writeFixture('valid-registry.json', validRegistry);
  const { exitCode, output } = runPreflightJson(['--json', '--registry', fixturePath]);
  
  if (exitCode !== 0) throw new Error(`Expected exit code 0, got ${exitCode}`);
  if (output.result !== 'valid') throw new Error('Expected result to be valid');
  if (output.error_count !== 0) throw new Error('Expected error_count to be 0');
  if (output.warning_count !== 0) throw new Error('Expected warning_count to be 0');
  if (output.observation_count !== 2) throw new Error('Expected observation_count to be 2');
  if (output.routing_allowed !== true) throw new Error('Expected routing_allowed to be true');
  if (!Array.isArray(output.blocking_reasons)) throw new Error('Expected blocking_reasons to be array');
}

function testRegistryWithWarningsReturnsExitCode0() {
  const fixturePath = writeFixture('warning-registry.json', registryWithWarnings);
  const { exitCode, output } = runPreflight(['--registry', fixturePath]);
  
  if (exitCode !== 0) throw new Error(`Expected exit code 0, got ${exitCode}`);
  if (!output.includes('WARNING')) throw new Error('Expected warning text not found');
  if (!output.includes('ROUTING ALLOWED')) throw new Error('Expected routing allowed message not found');
}

function testRegistryWithErrorsReturnsExitCode1() {
  const fixturePath = writeFixture('error-registry.json', registryWithErrors);
  const { exitCode, output } = runPreflight(['--registry', fixturePath]);
  
  if (exitCode !== 1) throw new Error(`Expected exit code 1, got ${exitCode}`);
  if (!output.includes('ERROR')) throw new Error('Expected error text not found');
  if (!output.includes('ROUTING BLOCKED')) throw new Error('Expected routing blocked message not found');
}

function testMalformedJsonReturnsExitCode2() {
  const fixturePath = writeFixture('malformed.json', malformedJson);
  const { exitCode, output } = runPreflight(['--registry', fixturePath]);
  
  if (exitCode !== 2) throw new Error(`Expected exit code 2, got ${exitCode}`);
  if (!output.includes('Failed to parse registry JSON')) throw new Error('Expected JSON parse error not found');
}

function testMissingFileReturnsExitCode2() {
  const fixturePath = path.join(__dirname, 'fixtures', 'nonexistent.json');
  const { exitCode, output } = runPreflight(['--registry', fixturePath]);
  
  if (exitCode !== 2) throw new Error(`Expected exit code 2, got ${exitCode}`);
  if (!output.includes('Registry file not found')) throw new Error('Expected file not found error not found');
}

function testInvalidArgumentsReturnsExitCode3() {
  const { exitCode, output } = runPreflight(['--invalid-arg']);
  
  if (exitCode !== 3) throw new Error(`Expected exit code 3, got ${exitCode}`);
  if (!output.includes('Unknown argument')) throw new Error('Expected invalid argument error not found');
}

// Run tests
console.log('Running governance preflight tests...\n');

const tests = [
  { name: 'Valid registry returns exit code 0', fn: testValidRegistryReturnsExitCode0 },
  { name: 'Valid registry with JSON returns proper JSON', fn: testValidRegistryWithJsonReturnsProperJson },
  { name: 'Registry with warnings returns exit code 0', fn: testRegistryWithWarningsReturnsExitCode0 },
  { name: 'Registry with errors returns exit code 1', fn: testRegistryWithErrorsReturnsExitCode1 },
  { name: 'Malformed JSON returns exit code 2', fn: testMalformedJsonReturnsExitCode2 },
  { name: 'Missing file returns exit code 2', fn: testMissingFileReturnsExitCode2 },
  { name: 'Invalid arguments returns exit code 3', fn: testInvalidArgumentsReturnsExitCode3 }
];

let passed = 0;
const total = tests.length;

for (const test of tests) {
  if (runTest(test.name, test.fn)) {
    passed++;
  }
}

console.log(`\n${passed}/${total} tests passed`);

if (passed === total) {
  console.log('All tests passed! 🎉');
  process.exit(0);
} else {
  console.log('Some tests failed! ❌');
  process.exit(1);
}

// Cleanup fixture files
const fixturesDir = path.join(__dirname, 'fixtures');
if (fs.existsSync(fixturesDir)) {
  fs.rmSync(fixturesDir, { recursive: true, force: true });
}