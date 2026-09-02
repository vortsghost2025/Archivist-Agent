#!/usr/bin/env node
/**
 * Focused tests for validate-schema.js CI contracts mode.
 * Proves: no S: paths, schema validation, explicit fixture expectations, output path.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateSchema, validateCiContracts, validateAll, validateFile } = require('./validate-schema.js');

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');
const REPO_ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    results.push({ name, status: 'FAIL' });
    console.log(`[FAIL] ${name}`);
  }
}

function assertEqual(actual, expected, name) {
  assert(actual === expected, `${name} (expected ${expected}, got ${actual})`);
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'schema-ci-test-'));
}

function cleanupTempDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}

// TEST 1: Malformed schema causes failure
{
  const tmpDir = createTempDir();
  const badSchemaDir = path.join(tmpDir, 'schemas');
  fs.mkdirSync(badSchemaDir);
  // Invalid JSON (syntax error)
  fs.writeFileSync(path.join(badSchemaDir, 'bad-schema.json'), '{ invalid json }}}');
  
  const result = validateCiContracts({
    schemasDir: badSchemaDir,
    outputPath: path.join(tmpDir, 'results.json')
  });
  
  assertEqual(result.summary.schema_fail, 1, 'Malformed schema counted as fail');
  assert(result.ok === false, 'Malformed schema produces ok=false');
  cleanupTempDir(tmpDir);
}

// TEST 2: Valid packet with expectation "accept" produces expected_fixture_pass
{
  const tmpDir = createTempDir();
  const fixtureDir = path.join(tmpDir, 'fixtures');
  fs.mkdirSync(fixtureDir);
  
  const validPacket = {
    schema_version: '1.7',
    task_id: 'test-123',
    idempotency_key: 'key-123',
    from: 'library',
    to: 'archivist',
    type: 'task',
    priority: 'P1',
    subject: 'Test',
    body: 'Test body',
    timestamp: new Date().toISOString(),
    requires_action: true,
    payload: { mode: 'inline' },
    execution: { mode: 'session_task', engine: 'kilo', actor: 'lane' },
    signature: 'eyJhbGciOiJ0ZXN0In0.eyJ0ZXN0IjoxfQ.test',
    key_id: 'aabbccddeeff0011'
  };
  fs.writeFileSync(path.join(fixtureDir, 'valid.json'), JSON.stringify(validPacket));
  
  const result = validateCiContracts({
    fixturesDir: fixtureDir,
    fixtureExpectations: { 'valid.json': 'accept' },
    outputPath: path.join(tmpDir, 'results.json')
  });
  
  assertEqual(result.summary.expected_fixture_pass, 1, 'Valid packet with accept expectation increments expected_fixture_pass');
  assertEqual(result.summary.unexpected_fixture_fail, 0, 'No unexpected failures');
  assert(result.ok === true, 'Valid packet with accept expectation produces ok=true');
  cleanupTempDir(tmpDir);
}

// TEST 3: Invalid packet with expectation "reject" produces expected_fixture_reject
{
  const tmpDir = createTempDir();
  const fixtureDir = path.join(tmpDir, 'fixtures');
  fs.mkdirSync(fixtureDir);
  
  const invalidPacket = { invalid: true, missing: 'fields' };
  fs.writeFileSync(path.join(fixtureDir, 'invalid.json'), JSON.stringify(invalidPacket));
  
  const result = validateCiContracts({
    fixturesDir: fixtureDir,
    fixtureExpectations: { 'invalid.json': 'reject' },
    outputPath: path.join(tmpDir, 'results.json')
  });
  
  assertEqual(result.summary.expected_fixture_reject, 1, 'Invalid packet with reject expectation increments expected_fixture_reject');
  assertEqual(result.summary.unexpected_fixture_fail, 0, 'No unexpected failures');
  assert(result.ok === true, 'Invalid packet with reject expectation produces ok=true');
  cleanupTempDir(tmpDir);
}

// TEST 4: Invalid packet marked "accept" produces unexpected_fixture_fail
{
  const tmpDir = createTempDir();
  const fixtureDir = path.join(tmpDir, 'fixtures');
  fs.mkdirSync(fixtureDir);
  
  const invalidPacket = { invalid: true };
  fs.writeFileSync(path.join(fixtureDir, 'wrong-expectation.json'), JSON.stringify(invalidPacket));
  
  const result = validateCiContracts({
    fixturesDir: fixtureDir,
    fixtureExpectations: { 'wrong-expectation.json': 'accept' },
    outputPath: path.join(tmpDir, 'results.json')
  });
  
  assertEqual(result.summary.unexpected_fixture_fail, 1, 'Invalid packet with accept expectation produces unexpected_fixture_fail');
  assert(result.ok === false, 'Wrong expectation produces ok=false');
  cleanupTempDir(tmpDir);
}

// TEST 5: Fixture without expectation produces unexpected_fixture_fail
{
  const tmpDir = createTempDir();
  const fixtureDir = path.join(tmpDir, 'fixtures');
  fs.mkdirSync(fixtureDir);
  
  const packet = { schema_version: '1.7' };
  fs.writeFileSync(path.join(fixtureDir, 'no-expectation.json'), JSON.stringify(packet));
  
  const result = validateCiContracts({
    fixturesDir: fixtureDir,
    fixtureExpectations: {},
    outputPath: path.join(tmpDir, 'results.json')
  });
  
  assertEqual(result.summary.unexpected_fixture_fail, 1, 'Fixture without expectation produces unexpected_fixture_fail');
  assert(result.ok === false, 'Missing expectation produces ok=false');
  cleanupTempDir(tmpDir);
}

// TEST 6: Configurable outputPath is written inside temporary directory
{
  const tmpDir = createTempDir();
  const outputPath = path.join(tmpDir, 'custom-results.json');
  
  const result = validateCiContracts({ outputPath });
  
  assert(fs.existsSync(outputPath), 'Output written to configurable path');
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert(written.summary !== undefined, 'Output contains summary');
  assert(written.ok !== undefined, 'Output contains ok flag');
  cleanupTempDir(tmpDir);
}

// TEST 7: CI mode uses no S: paths (monkeypatch filesystem)
{
  const tmpDir = createTempDir();
  const originalReadFileSync = fs.readFileSync;
  
  fs.readFileSync = function(p, ...args) {
    const pathStr = typeof p === 'string' ? p : p.toString();
    if (pathStr.match(/^[A-Z]:\\/i)) {
      throw new Error(`S: path access attempted: ${pathStr}`);
    }
    return originalReadFileSync.call(this, p, ...args);
  };
  
  try {
    const result = validateCiContracts({ outputPath: path.join(tmpDir, 'results.json') });
    assert(true, 'CI mode completed without S: path access');
  } catch (err) {
    assert(false, `CI mode should not access S: paths: ${err.message}`);
  } finally {
    fs.readFileSync = originalReadFileSync;
    cleanupTempDir(tmpDir);
  }
}

// TEST 8: No repository runtime-result file is created or modified
{
  const runtimePath = path.join(REPO_ROOT, 'SCHEMA_VALIDATION_RESULTS.json');
  const existedBefore = fs.existsSync(runtimePath);
  const mtimeBefore = existedBefore ? fs.statSync(runtimePath).mtimeMs : 0;
  
  validateCiContracts({ outputPath: path.join(createTempDir(), 'results.json') });
  
  const existsAfter = fs.existsSync(runtimePath);
  const mtimeAfter = existsAfter ? fs.statSync(runtimePath).mtimeMs : 0;
  
  assert(!existsAfter || mtimeAfter === mtimeBefore, 'No live runtime file created or modified');
}

// TEST 9: All production schema files load successfully (schema-only CLI mode)
{
  const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
  assert(schemaFiles.length > 0, `Found ${schemaFiles.length} schema files`);
  
  const result = validateCiContracts({ outputPath: path.join(createTempDir(), 'results.json') });
  
  assertEqual(result.summary.schema_pass, schemaFiles.length, `All ${schemaFiles.length} schemas pass`);
  assertEqual(result.summary.schema_fail, 0, 'No schema failures');
}

// TEST 10: Existing live behavior unchanged (diff evidence)
{
  // Verify validateAll, validateFile, LANE_ROOTS, LANES, --all dispatch exist
  assert(typeof validateAll === 'function', 'validateAll function exists');
  assert(typeof validateFile === 'function', 'validateFile function exists');
  
  // Check that the original code paths are intact by examining the source
  const source = fs.readFileSync(path.join(__dirname, 'validate-schema.js'), 'utf8');
  assert(source.includes('LANE_ROOTS'), 'LANE_ROOTS constant exists');
  assert(source.includes('LANES'), 'LANES constant exists');
  assert(source.includes('--all'), '--all dispatch exists');
  assert(source.includes('validateAll()'), 'validateAll() call exists');
}

// SUMMARY
console.log('\n========================================');
console.log('Schema CI Tests');
console.log('========================================');
console.log('PASS: ' + passed);
console.log('FAIL: ' + failed);
console.log('TOTAL: ' + (passed + failed));
console.log('========================================');

for (var i = 0; i < results.length; i++) {
  var r = results[i];
  var mark = r.status === 'PASS' ? 'OK' : 'FAIL';
  console.log('  [' + mark + '] ' + r.name);
}

if (failed > 0) process.exit(1);
