/**
 * Tests for governance-preflight.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  const fixturePath = path.join(__dirname, 'fixtures', 'valid-registry.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(fixturePath, JSON.stringify(validRegistry, null, 2));
   
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  const result = execSync(`node "${scriptPath}" --registry "${fixturePath}"`, { encoding: 'utf8' });
   
  if (!result.includes('✅ REGISTRY VALID - ROUTING ALLOWED') && 
      !result.includes('REGISTRY VALID')) {
    throw new Error('Expected success message not found. Got: ' + result);
  }
}

function testValidRegistryWithJsonReturnsProperJson() {
  const fixturePath = path.join(__dirname, 'fixtures', 'valid-registry.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(fixturePath, JSON.stringify(validRegistry, null, 2));
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  const result = execSync(`node "${scriptPath}" --registry "${fixturePath}" --json`, { encoding: 'utf8' });
  const jsonResult = JSON.parse(result);
  
  if (jsonResult.result !== 'valid') throw new Error('Expected result to be valid');
  if (jsonResult.error_count !== 0) throw new Error('Expected error_count to be 0');
  if (jsonResult.warning_count !== 0) throw new Error('Expected warning_count to be 0');
  if (jsonResult.observation_count !== 2) throw new Error('Expected observation_count to be 2 (OPTIONAL_LANE_ABSENT and PLATFORM_SPECIFIC_ROOT)');
  if (jsonResult.routing_allowed !== true) throw new Error('Expected routing_allowed to be true');
  if (!Array.isArray(jsonResult.blocking_reasons)) throw new Error('Expected blocking_reasons to be array');
}

function testRegistryWithWarningsReturnsExitCode0() {
  const fixturePath = path.join(__dirname, 'fixtures', 'warning-registry.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(fixturePath, JSON.stringify(registryWithWarnings, null, 2));
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  const result = execSync(`node "${scriptPath}" --registry "${fixturePath}"`, { encoding: 'utf8' });
  
  if (!result.includes('✅ REGISTRY VALID - ROUTING ALLOWED')) {
    throw new Error('Expected warning message not found');
  }
  if (!result.includes('WARNING')) {
    throw new Error('Expected warning text not found');
  }
}

function testRegistryWithErrorsReturnsExitCode1() {
  const fixturePath = path.join(__dirname, 'fixtures', 'error-registry.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(fixturePath, JSON.stringify(registryWithErrors, null, 2));
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  let exitCode = 0;
  let output = '';
  try {
    output = execSync(`node "${scriptPath}" --registry "${fixturePath}"`, { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = error.stdout;
  }
  
  if (exitCode !== 1) {
    throw new Error(`Expected exit code 1, got ${exitCode}`);
  }
  if (!output.includes('❌ REGISTRY INVALID - ROUTING BLOCKED DUE TO ERRORS')) {
    throw new Error('Expected error message not found');
  }
  if (!output.includes('ERROR')) {
    throw new Error('Expected error text not found');
  }
}

function testMalformedJsonReturnsExitCode2() {
  const fixturePath = path.join(__dirname, 'fixtures', 'malformed.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(fixturePath, malformedJson);
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  let exitCode = 0;
  let output = '';
  try {
    output = execSync(`node "${scriptPath}" --registry "${fixturePath}"`, { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = error.stderr || error.stdout;
  }
  
  if (exitCode !== 2) {
    throw new Error(`Expected exit code 2, got ${exitCode}`);
  }
  if (!output.includes('Error:')) {
    throw new Error('Expected error message not found');
  }
  if (!output.includes('Failed to parse registry JSON')) {
    throw new Error('Expected JSON parse error not found');
  }
}

function testMissingFileReturnsExitCode2() {
  const fixturePath = path.join(__dirname, 'fixtures', 'nonexistent.json');
  // Ensure fixtures directory exists
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'governance-preflight.js');
  let exitCode = 0;
  let output = '';
  try {
    output = execSync(`node "${scriptPath}" --registry "${fixturePath}"`, { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = error.stderr || error.stdout;
  }
  
  if (exitCode !== 2) {
    throw new Error(`Expected exit code 2, got ${exitCode}`);
  }
  if (!output.includes('Error:')) {
    throw new Error('Expected error message not found');
  }
  if (!output.includes('Registry file not found')) {
    throw new Error('Expected file not found error not found');
  }
}

function testInvalidArgumentsReturnsExitCode3() {
  let exitCode = 0;
  let output = '';
  try {
    output = execSync(`node "${path.join(__dirname, '..', 'scripts', 'governance-preflight.js')}" --invalid-arg`, { encoding: 'utf8' });
  } catch (error) {
    exitCode = error.status;
    output = error.stderr || error.stdout;
  }
  
  if (exitCode !== 3) {
    throw new Error(`Expected exit code 3, got ${exitCode}`);
  }
  if (!output.includes('Error: Unknown argument')) {
    throw new Error('Expected invalid argument error not found');
  }
}

// Run tests
console.log('Running governance preflight tests...\n');

const tests = [
  testValidRegistryReturnsExitCode0,
  testValidRegistryWithJsonReturnsProperJson,
  testRegistryWithWarningsReturnsExitCode0,
  testRegistryWithErrorsReturnsExitCode1,
  testMalformedJsonReturnsExitCode2,
  testMissingFileReturnsExitCode2,
  testInvalidArgumentsReturnsExitCode3
];

let passed = 0;
const total = tests.length;

for (const test of tests) {
  if (test()) {
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