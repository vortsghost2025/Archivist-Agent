const fs = require('fs');
const path = require('path');

const testDirs = ['tests', 'src'];
let exitCode = 0;
let total = 0;
let passed = 0;

var skipDirs = { 'node_modules': true, '.git': true, 'ui': true };
function walk(dir) {
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs[entry.name] && !entry.name.startsWith('__')) walk(full);
    } else if (entry.name.endsWith('.test.js')) {
      runFile(full);
    }
  }
}

function runFile(file) {
  total++;
  try {
    require(path.resolve(file));
    passed++;
    console.log('PASS  ' + path.relative(process.cwd(), file));
  } catch (ex) {
    exitCode = 1;
    console.log('FAIL  ' + path.relative(process.cwd(), file));
    console.log('       ' + ex.message);
  }
}

for (const dir of testDirs) {
  if (fs.existsSync(dir)) walk(dir);
}

console.log('\n' + passed + '/' + total + ' tests passed');
process.exit(exitCode);
