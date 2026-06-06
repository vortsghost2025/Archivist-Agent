// fix-toolmap-casing.js — Fix snake_case → camelCase in TOOL_MAP execute_command entry
// Run: node fix-toolmap-casing.js
//
// Tauri 2 defaults to rename_all = "camelCase" for #[tauri::command] params.
// The TOOL_MAP in app.js was sending snake_case keys for execute_command,
// which Tauri 2 couldn't deserialize.
//
// Changes:
//   r.working_dir = a.workingDir  →  r.workingDir = a.workingDir
//   r.timeout_secs = a.timeout    →  r.timeoutSecs = a.timeout

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ui', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

let changes = 0;

// Fix 1: working_dir → workingDir in TOOL_MAP
const fix1 = content.replace(
  /r\.working_dir = a\.workingDir/g,
  'r.workingDir = a.workingDir'
);
if (fix1 !== content) {
  console.log('Fixed: r.working_dir → r.workingDir in TOOL_MAP');
  changes++;
  content = fix1;
}

// Fix 2: timeout_secs → timeoutSecs in TOOL_MAP
const fix2 = content.replace(
  /r\.timeout_secs = a\.timeout/g,
  'r.timeoutSecs = a.timeout'
);
if (fix2 !== content) {
  console.log('Fixed: r.timeout_secs → r.timeoutSecs in TOOL_MAP');
  changes++;
  content = fix2;
}

if (changes > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Applied ${changes} fix(es) to ${filePath}`);
} else {
  console.log('No changes needed — already correct or pattern not found');
}