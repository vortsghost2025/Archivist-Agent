const { execSync } = require('child_process');
const path = require('path');

console.log('Running all tests...\n');

try {
  execSync('node tests/trace-schema.test.js', {
    cwd: __dirname + '/..',
    stdio: 'inherit'
  });
  
  console.log('\n✓ All tests passed');
} catch (error) {
  console.log('\n✗ Tests failed');
  process.exit(1);
}
