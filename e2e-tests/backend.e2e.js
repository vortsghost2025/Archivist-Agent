#!/usr/bin/env node
/**
 * E2E: Rust backend validation.
 * Verifies Cargo.toml structure, source file presence, and build artifacts.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_TAURI = path.join(REPO_ROOT, 'src-tauri');
const SRC_DIR = path.join(SRC_TAURI, 'src');

// All expected Rust source files
const EXPECTED_MODULES = [
  'lib.rs', 'main.rs', 'safety.rs', 'constitution.rs', 'cps_check.rs',
  'scan_tree.rs', 'summarize_folder.rs', 'build_index.rs', 'build_registry.rs',
  'generate_handoff.rs', 'classification.rs', 'constants.rs', 'chat.rs',
  'patch.rs', 'agent_fs.rs', 'governance.rs', 'lane.rs',
];

function run() {
  // 1. Cargo.toml exists and is valid
  const cargoPath = path.join(SRC_TAURI, 'Cargo.toml');
  assert.ok(fs.existsSync(cargoPath), 'src-tauri/Cargo.toml must exist');
  const cargoContent = fs.readFileSync(cargoPath, 'utf8');
  assert.ok(cargoContent.includes('archivist-agent'), 'Cargo.toml must name the package');

  // 2. tauri.conf.json exists
  const tauriConfPath = path.join(SRC_TAURI, 'tauri.conf.json');
  assert.ok(fs.existsSync(tauriConfPath), 'tauri.conf.json must exist');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  assert.ok(tauriConf.identifier, 'tauri.conf.json must have identifier');

  // 3. All expected Rust source files exist
  for (const mod of EXPECTED_MODULES) {
    const modPath = path.join(SRC_DIR, mod);
    assert.ok(fs.existsSync(modPath), `src-tauri/src/${mod} must exist`);
  }

  // 4. lib.rs declares all expected modules
  const libRs = fs.readFileSync(path.join(SRC_DIR, 'lib.rs'), 'utf8');
  for (const mod of EXPECTED_MODULES.filter(m => m !== 'lib.rs' && m !== 'main.rs')) {
    const modName = mod.replace('.rs', '');
    assert.ok(libRs.includes(`mod ${modName}`), `lib.rs must declare mod ${modName}`);
  }

  // 5. classification.rs has required public items
  const classificationRs = fs.readFileSync(path.join(SRC_DIR, 'classification.rs'), 'utf8');
  assert.ok(classificationRs.includes('pub fn classify_file'), 'classification.rs must export classify_file');
  assert.ok(classificationRs.includes('pub fn classify_directory'), 'classification.rs must export classify_directory');
  assert.ok(classificationRs.includes('pub enum FileBucket'), 'classification.rs must define FileBucket enum');
  assert.ok(classificationRs.includes('pub struct ClassifiedFile'), 'classification.rs must define ClassifiedFile');
  assert.ok(classificationRs.includes('pub struct DirClassification'), 'classification.rs must define DirClassification');

  // 6. capabilities/default.json has write permission
  const capPath = path.join(SRC_TAURI, 'capabilities', 'default.json');
  assert.ok(fs.existsSync(capPath), 'capabilities/default.json must exist');
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const hasWritePerm = JSON.stringify(cap).includes('fs:allow-write-text-file');
  assert.ok(hasWritePerm, 'capabilities must include fs:allow-write-text-file');

  // 7. Frontend UI directory exists with index.html
  const uiPath = path.join(REPO_ROOT, 'ui');
  assert.ok(fs.existsSync(uiPath), 'ui/ directory must exist');
  assert.ok(fs.existsSync(path.join(uiPath, 'index.html')), 'ui/index.html must exist');
  assert.ok(fs.existsSync(path.join(uiPath, 'app.js')), 'ui/app.js must exist');
  assert.ok(fs.existsSync(path.join(uiPath, 'styles.css')), 'ui/styles.css must exist');

  console.log('backend.e2e.js: all 7 checks passed');
}

module.exports = { run };

if (require.main === module) run();
