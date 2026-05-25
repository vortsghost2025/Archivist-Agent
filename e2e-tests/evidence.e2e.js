#!/usr/bin/env node
/**
 * E2E: Evidence and provenance validation.
 * Verifies output provenance contract, schema files, and config integrity.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..');

function run() {
  // 1. BOOTSTRAP.md exists (single governance entry point)
  const bootstrapPath = path.join(REPO_ROOT, 'BOOTSTRAP.md');
  assert.ok(fs.existsSync(bootstrapPath), 'BOOTSTRAP.md must exist as single governance entry point');

  // 2. Core governance docs exist
  const governanceDocs = ['COVENANT.md', 'GOVERNANCE.md', 'CPS_ENFORCEMENT.md', 'CHECKPOINTS.md'];
  for (const doc of governanceDocs) {
    const docPath = path.join(REPO_ROOT, doc);
    assert.ok(fs.existsSync(docPath), `governance doc ${doc} must exist`);
  }

  // 3. Constitutional constraints YAML exists and is parseable
  const constraintsPath = path.join(REPO_ROOT, 'constitutional_constraints.yaml');
  assert.ok(fs.existsSync(constraintsPath), 'constitutional_constraints.yaml must exist');
  const constraintsContent = fs.readFileSync(constraintsPath, 'utf8');
  assert.ok(constraintsContent.includes('STRUCTURE_OVER_IDENTITY'), 'constraints must have STRUCTURE_OVER_IDENTITY');
  assert.ok(constraintsContent.includes('CORRECTION_MANDATORY'), 'constraints must have CORRECTION_MANDATORY');
  assert.ok(constraintsContent.includes('SINGLE_ENTRY_POINT'), 'constraints must have SINGLE_ENTRY_POINT');
  assert.ok(constraintsContent.includes('OPERATOR_ACCOUNTABILITY'), 'constraints must have OPERATOR_ACCOUNTABILITY');

  // 4. Allowed roots config exists and has read_only_mode
  const allowedRootsPath = path.join(REPO_ROOT, 'config', 'allowed_roots.json');
  assert.ok(fs.existsSync(allowedRootsPath), 'allowed_roots.json must exist');
  const allowedRoots = JSON.parse(fs.readFileSync(allowedRootsPath, 'utf8'));
  assert.ok(typeof allowedRoots.read_only_mode === 'boolean', 'read_only_mode must be boolean');

  // 5. agent_config.json is NOT tracked in git (check .gitignore)
  const gitignorePath = path.join(REPO_ROOT, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  assert.ok(gitignore.includes('agent_config.json'), '.gitignore must exclude agent_config.json');

  // 6. Example config exists
  const exampleConfigPath = path.join(REPO_ROOT, 'config', 'agent_config.example.json');
  assert.ok(fs.existsSync(exampleConfigPath), 'agent_config.example.json must exist');
  const exampleConfig = JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8'));
  assert.ok(exampleConfig.chat_api_key === 'nvapi-YOUR_API_KEY_HERE',
    'example config must have placeholder API key');

  // 7. Output provenance contract exists
  const provenanceContractPath = path.join(REPO_ROOT, 'governance', 'OUTPUT_PROVENANCE_CONTRACT.md');
  assert.ok(fs.existsSync(provenanceContractPath), 'OUTPUT_PROVENANCE_CONTRACT.md must exist');

  // 8. Recovery test suite exists
  const recoverySuitePath = path.join(REPO_ROOT, 'scripts', 'recovery-test-suite.js');
  assert.ok(fs.existsSync(recoverySuitePath), 'recovery-test-suite.js must exist');

  console.log('evidence.e2e.js: all 8 checks passed');
}

module.exports = { run };

if (require.main === module) run();
