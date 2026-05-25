#!/usr/bin/env node
/**
 * E2E test runner for the Archivist-Agent governance system.
 *
 * Discovers and runs *.e2e.js files in this directory.
 * Each test file exports a `run()` function that throws on failure.
 *
 * Usage:
 *   node run-tests.js              # run all
 *   node run-tests.js governance   # run only governance.e2e.js
 *   node run-tests.js cross-lane   # run only cross-lane.e2e.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';
const thisDir = __dirname;
let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

const files = fs.readdirSync(thisDir)
  .filter(f => f.endsWith('.e2e.js'))
  .filter(f => !filter || f.includes(filter.replace(/-/g, '-')))
  .sort();

if (files.length === 0) {
  console.log('No e2e test files found' + (filter ? ` matching "${filter}"` : ''));
  process.exit(0);
}

console.log(`\n=== Archivist-Agent E2E Tests ===\n`);

for (const file of files) {
  total++;
  const filePath = path.join(thisDir, file);
  try {
    const mod = require(filePath);
    if (typeof mod.run !== 'function') {
      throw new Error(`No exported run() function in ${file}`);
    }
    mod.run();
    passed++;
    console.log(`  PASS  ${file}`);
  } catch (err) {
    failed++;
    failures.push({ file, message: err.message });
    console.log(`  FAIL  ${file}`);
    console.log(`        ${err.message}`);
  }
}

console.log(`\n${passed}/${total} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  - ${f.file}: ${f.message}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
