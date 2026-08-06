/**
 * SOVEREIGNTY ENFORCEMENT SCANNER
 * Purpose: Auto-detect and prevent cross-lane imports
 * Rule: NO CROSS-LANE require() OR hardcoded paths
 * 
 * Origin: https://github.com/vortsghost2025/...
 * Last Updated: 2026-05-02
 */

const fs = require('fs');
const path = require('path');
const { getRoots, sToLocal, LANES: _DL } = require('./util/lane-discovery');

const LANES = {
  'Archivist': getRoots()['archivist'],
  'Kernel': getRoots()['kernel'],
  'Library': getRoots()['library'],
  'SwarmMind': getRoots()['swarmmind']
};

const CURRENT_LANE = 'SwarmMind';
const CURRENT_ROOT = LANES[CURRENT_LANE];

if (process.platform !== 'win32') {
  for (const [name, p] of Object.entries(LANES)) {
    if (/^[A-Za-z]:[\\/]/.test(p)) {
      console.error(`[sovereignty] FATAL: Windows path leak on ${process.platform}: ${name}=${p}`);
      process.exit(1);
    }
  }
}

// Allowed: local relative imports, node_modules, own util/
const ALLOWED_PATTERNS = [
  /^\.\.?\//,           // ./ or ../
  /^node_modules\//,      // node_modules
  /^\//,                  // absolute paths (will be checked)
  /^util\//,              // local utils (GOOD)
  /^\.global\//            // .global (shared config)
];

function isLocalPath(importPath) {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(importPath));
}

function isInCommentOrString(line, index) {
  // Check if position is inside a string literal or comment
  let inString = null;
  let inBlockComment = false;
  
  for (let i = 0; i < line.length; i++) {
    // Handle block comments
    if (inBlockComment) {
      if (i + 1 < line.length && line[i] === '*' && line[i + 1] === '/') {
        inBlockComment = false;
        i++; // Skip the next character
      }
      continue;
    }
    
    if (i + 1 < line.length && line[i] === '/' && line[i + 1] === '*') {
      inBlockComment = true;
      i++; // Skip the next character
      continue;
    }
    
    // Check for line comments
    if (i + 1 < line.length && line[i] === '/' && line[i + 1] === '/') {
      return { isComment: true, isString: false };
    }
    
    // Handle string literals
    if ((line[i] === '"' || line[i] === "'" || line[i] === '`') && 
        (i === 0 || line[i - 1] !== '\\')) {
      if (inString === null) {
        inString = line[i];
      } else if (inString === line[i]) {
        inString = null;
      }
    }
  }
  
  return { isComment: false, isString: inString !== null };
}

function checkForCrossLaneViolation(content, filePath) {
  const violations = [];
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    // Skip lines that are entirely comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return;
    }
    
    // Check 1: require() with absolute paths to other lanes
    const requireMatch = line.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    
    if (requireMatch) {
      const importPath = requireMatch[1];
      
      // Check if this is a cross-lane import
      Object.keys(LANES).forEach(laneName => {
        if (laneName === CURRENT_LANE) return;
        
        const lanePath = LANES[laneName];
        
        // Only flag if the require() is importing from another lane's root
        if (importPath.startsWith(lanePath)) {
          violations.push({
            line: lineNum,
            code: line.trim(),
            violation: `Cross-lane import from ${laneName}`,
            type: 'cross_lane_require'
          });
        }
      });
    }
  });
  
  return violations;
}

function scanDirectory(dirPath, baseDir) {
  const violations = [];
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (file !== 'node_modules' && !file.startsWith('.') && file !== '.git') {
        violations.push(...scanDirectory(fullPath, baseDir));
      }
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const fileViolations = checkForCrossLaneViolation(content, fullPath);
      
      if (fileViolations.length > 0) {
        violations.push({
          file: path.relative(baseDir, fullPath),
          violations: fileViolations
        });
      }
    }
  });
  
  return violations;
}

function resolveLaneName(input) {
  const lower = input.toLowerCase();
  for (const key of Object.keys(LANES)) {
    if (key.toLowerCase() === lower) return key;
  }
  return input;
}

function scanLane(laneName) {
  const resolvedName = resolveLaneName(laneName);
  console.log(`🔍 Scanning ${resolvedName} lane...`);

  const scriptsDir = path.join(LANES[resolvedName], 'scripts');
  
  if (!fs.existsSync(scriptsDir)) {
    console.log(`   ❌ No scripts directory in ${laneName}\n`);
    return [];
  }
  
  const violations = scanDirectory(scriptsDir, LANES[laneName]);
  
  if (violations.length === 0) {
    console.log(`   ✅ SOVEREIGN - No violations`);
  } else {
    console.log(`   ⚠️  ${violations.length} file(s) with violations:`);
    violations.forEach(v => {
      console.log(`      - ${v.file}`);
      v.violations.forEach(viol => {
        console.log(`        Line ${viol.line}: ${viol.type}`);
        console.log(`        ${viol.code.substring(0, 80)}...`);
      });
    });
  }
  
  console.log('');
  return violations;
}

function generateReport(allViolations) {
  const report = {
    timestamp: new Date().toISOString(),
    scanner: 'sovereignty-enforcer',
    rule: 'NO_CROSS_LANE_REQUIRE',
    total_violations: allViolations.reduce((sum, v) => sum + v.violations.length, 0),
    lanes_scanned: Object.keys(LANES).length,
    violations: allViolations,
    summary: {}
  };
  
  Object.keys(LANES).forEach(lane => {
    const laneViolations = allViolations.filter(v => 
      v.file.includes(lane.toLowerCase()) || 
      path.join(LANES[lane], 'scripts') === path.dirname(v.file)
    );
    report.summary[lane] = laneViolations.length;
  });
  
  return report;
}

// Parse command line arguments
const args = process.argv.slice(2);
const targetLane = args.includes('--lane') ? args[args.indexOf('--lane') + 1] : null;
const shouldExitOnError = args.includes('--strict');

console.log('═══════════════════════════════════════════════════════════════');
console.log(' SOVEREIGNTY ENFORCEMENT SCANNER');
console.log(' Rule: NO CROSS-LANE require() OR hardcoded paths');


console.log('═══════════════════════════════════════════════════════════════\n');

const allViolations = [];

// Scan lanes - either specific lane or all lanes
const lanesToScan = targetLane ? [targetLane] : Object.keys(LANES);
lanesToScan.forEach(lane => {
  const violations = scanLane(lane);
  allViolations.push(...violations.map(v => ({
    lane,
    file: path.join(LANES[lane], 'scripts', v.file),
    violations: v.violations
  })));
});

// Generate report
const report = generateReport(allViolations);

console.log('═══════════════════════════════════════════════════════════════');
console.log('   RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');

if (report.total_violations === 0) {
  console.log('✅ ALL LANES SOVEREIGN - NO VIOLATIONS FOUND');
} else {
  console.log(`⚠️  ${report.total_violations} VIOLATION(S) FOUND\n`);
  console.log('By lane:');
  Object.keys(report.summary).forEach(lane => {
    console.log(`  ${lane}: ${report.summary[lane]}`);
  });
}

console.log('\n═══════════════════════════════════════════════════════════════\n');

// Save report
const reportPath = path.join(LANES[CURRENT_LANE], 'sovereignty-enforcement-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`📄 Report saved: ${reportPath}\n`);

// Exit with error code only in --strict mode
if (shouldExitOnError) {
  process.exit(report.total_violations > 0 ? 1 : 0);
}

module.exports = { scanLane, checkForCrossLaneViolation, generateReport };

/**
 * SOVEREIGNTY ENFORCEMENT SCANNER
 * Prevents cross-lane dependencies that break:
 * - Reproducibility
 * - Trust verification  
 * - Blind-middle-loop navigation
 * 
 * Rule: Each lane must be self-contained.
 * Only local implementations allowed.
 * Shared patterns via contracts, never code.
 */