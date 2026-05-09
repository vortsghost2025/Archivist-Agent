#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkSharedScriptModification() {
  var repoRoot = path.resolve(__dirname, '..');
  var registryPath = path.join(repoRoot, 'scripts', 'CANONICAL_SCRIPT_REGISTRY.json');

  if (!fs.existsSync(registryPath)) {
    return { ok: true, reason: 'no_registry' };
  }

  var registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  var sharedScripts = registry.shared_scripts || [];
  var sharedSchemas = registry.shared_schemas || [];
  var restriction = registry.autonomous_executor_restriction || {};

  if (!(restriction.shared_scripts_readonly)) {
    return { ok: true, reason: 'no_restriction' };
  }

  var allShared = sharedScripts.map(function(s) { return 'scripts/' + s; })
    .concat(sharedSchemas);

  var stagedFiles;
  try {
    stagedFiles = execSync('git diff --cached --name-only', { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch (_) {
    return { ok: true, reason: 'no_staged_files' };
  }

  var modified = [];
  for (var i = 0; i < stagedFiles.length; i++) {
    var staged = stagedFiles[i].replace(/\\/g, '/');
    for (var j = 0; j < allShared.length; j++) {
      if (staged === allShared[j] || staged.endsWith('/' + allShared[j])) {
        modified.push(staged);
      }
    }
  }

  if (modified.length === 0) {
    return { ok: true, reason: 'no_shared_modified' };
  }

  var gitAuthor = '';
  try { gitAuthor = execSync('git config user.email', { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch (_) {}

  var isAutonomous = gitAuthor.indexOf('@lanes.local') !== -1 ||
    gitAuthor.indexOf('executor') !== -1 ||
    gitAuthor.indexOf('worker') !== -1 ||
    (process.env.AUTONOMOUS_EXECUTOR === '1');

  if (!isAutonomous) {
    console.log('[CANONICAL-GUARD] Human/operator session modifying shared scripts — allowed');
    console.log('[CANONICAL-GUARD] Modified: ' + modified.join(', '));
    console.log('[CANONICAL-GUARD] Remember to run sync-canonical-scripts.js after push');
    return { ok: true, reason: 'human_session', modified: modified };
  }

  console.error('[CANONICAL-GUARD] BLOCKED: Autonomous executor attempted to modify shared scripts');
  console.error('[CANONICAL-GUARD] Modified: ' + modified.join(', '));
  console.error('[CANONICAL-GUARD] Shared scripts are readonly for autonomous executors.');
  console.error('[CANONICAL-GUARD] Changes require a coordinated cross-lane session or governance ratification.');
  return { ok: false, reason: 'autonomous_blocked', modified: modified };
}

if (require.main === module) {
  var result = checkSharedScriptModification();
  if (!result.ok) {
    process.exit(1);
  }
}

module.exports = { checkSharedScriptModification };
