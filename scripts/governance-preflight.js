#!/usr/bin/env node
/**
 * Governance Preflight Command
 * 
 * Validates the lane registry to determine if routing is allowed.
 * 
 * Usage:
 *   node scripts/governance-preflight.js
 *   node scripts/governance-preflight.js --json
 *   node scripts/governance-preflight.js --registry <path>
 * 
 * Exit Codes:
 *   0 = registry valid with no errors (routing allowed)
 *   1 = validation errors found (routing blocked)
 *   2 = registry could not be located, read or parsed
 *   3 = invalid command-line arguments or internal execution failure
 */

const { LaneDiscovery } = require('../.global/lane-discovery.js');
const { validateRegistry } = require('./util/lane-registry-validation.js');
const fs = require('fs');
const path = require('path');

/**
 * Parse command line arguments
 * @returns {{registryPath: string|null, json: boolean}}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    registryPath: null,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--json') {
      result.json = true;
    } else if (arg === '--registry' && i + 1 < args.length) {
      result.registryPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Error: Unknown argument '${arg}'`);
      console.error('Use --help for usage information.');
      process.exit(3);
    }
  }

  return result;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
Governance Preflight Command

Validates the lane registry to determine if routing is allowed.

Usage:
  node scripts/governance-preflight.js
  node scripts/governance-preflight.js --json
  node scripts/governance-preflight.js --registry <path>

Options:
  --json              Output machine-readable JSON instead of human-readable summary
  --registry <path>   Explicit path to lane registry fixture (for testing)
  --help, -h          Show this help message

Exit Codes:
  0 = registry valid with no errors (routing allowed)
  1 = validation errors found (routing blocked)
  2 = registry could not be located, read or parsed
  3 = invalid command-line arguments or internal execution failure

Output:
  Without --json: Human-readable summary of validation results
  With --json:    JSON object with result, error/warning/observation counts and details

Behavior:
  - Performs no repository writes by default
  - Performs no SSH operations
  - Performs no Git mutations
  - Performs no service operations
  - Inspects no secrets or credentials
  - Read-only operation only
`);
}

/**
 * Load and parse the lane registry
 * @param {string|null} registryPath - Optional explicit path to registry
 * @returns {{data: Object, error: Error|null}}
 */
function loadRegistry(registryPath) {
  let filePath;
   
  if (registryPath) {
    // Use explicit path provided via --registry
    filePath = path.resolve(registryPath);
  } else {
    // Use lane discovery to find the registry
    try {
      const discovery = new LaneDiscovery();
      filePath = discovery.getRegistryPath();
    } catch (error) {
      return { data: null, error: new Error(`Failed to discover registry path: ${error.message}`) };
    }
  }

  try {
    if (!fs.existsSync(filePath)) {
      return { data: null, error: new Error(`Registry file not found: ${filePath}`) };
    }
     
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return { data, error: null };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { data: null, error: new Error(`Registry file not found: ${filePath}`) };
    }
    if (error instanceof SyntaxError) {
      return { data: null, error: new Error(`Failed to parse registry JSON: ${error.message}`) };
    }
    return { data: null, error: new Error(`Failed to read registry: ${error.message}`) };
  }
}

/**
* Format a validation item for human-readable output
* @param {object} item - Validation result item
* @param {number} index - Zero-based index
* @returns {string} Formatted line
*/
function formatValidationItem(item, index) {
const severity = String(item.severity || 'info').toUpperCase();
const code = String(item.code || 'UNKNOWN');
const message = String(item.message || 'No message provided');

const contextParts = [];
const laneId = item.lane_id || item.lane;

if (laneId) {
contextParts.push(`lane ${laneId}`);
}

if (item.field) {
contextParts.push(`field ${item.field}`);
}

if (item.path) {
contextParts.push(`path ${item.path}`);
}

const context = contextParts.length > 0
? `${contextParts.join(', ')}: `
: '';

return ` ${index + 1}. [${severity}] ${code} — ${context}${message}\n`;
}

/**
 * Format validation results as human-readable string
 * @param {{errors: Array, warnings: Array, observations: Array}} results
 * @returns {string}
 */
function formatHumanReadable(results) {
  const { errors, warnings, observations } = results;
  const errorCount = errors.length;
  const warningCount = warnings.length;
  const observationCount = observations.length;
   
  let output = '';
   
  // Header
  output += '=== GOVERNANCE PREFLIGHT RESULTS ===\n\n';
   
  // Errors
  if (errorCount > 0) {
    output += `❌ ${errorCount} ERROR${errorCount !== 1 ? 'S' : ''} (ROUTING BLOCKED):\n`;
    errors.forEach((error, index) => {
      output += formatValidationItem(error, index);
    });
    output += '\n';
  }
   
  // Warnings
  if (warningCount > 0) {
    output += `⚠️  ${warningCount} WARNING${warningCount !== 1 ? 'S' : ''} (ROUTING ALLOWED WITH NOTIFICATION):\n`;
    warnings.forEach((warning, index) => {
      output += formatValidationItem(warning, index);
    });
    output += '\n';
  }
   
  // Observations
  if (observationCount > 0) {
    output += `ℹ️  ${observationCount} OBSERVATION${observationCount !== 1 ? 'S' : ''} (INFORMATIONAL):\n`;
    observations.forEach((observation, index) => {
      output += formatValidationItem(observation, index);
    });
    output += '\n';
  }
   
  // Summary
  if (errorCount === 0 && warningCount === 0 && observationCount === 0) {
    output += '✅ REGISTRY VALID - NO ISSUES FOUND\n';
  } else if (errorCount === 0) {
    output += '✅ REGISTRY VALID - ROUTING ALLOWED\n';
  } else {
    output += '❌ REGISTRY INVALID - ROUTING BLOCKED DUE TO ERRORS\n';
  }
   
  output += `\nSUMMARY: ${errorCount} errors, ${warningCount} warnings, ${observationCount} observations`;
   
  return output;
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = parseArgs();
    
    // Load registry
    const { data, error } = loadRegistry(args.registryPath);
    if (error) {
      if (args.json) {
        console.error(JSON.stringify({
          result: 'error',
          error_count: 1,
          warning_count: 0,
          observation_count: 0,
          errors: [error.message],
          warnings: [],
          observations: []
        }, null, 2));
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exit(2);
    }
    
    // Validate registry
    const results = validateRegistry(data);
    
    // Output results
    if (args.json) {
      console.log(JSON.stringify({
        result: results.errors.length === 0 ? 'valid' : 'invalid',
        error_count: results.errors.length,
            warning_count: results.warnings.length,
        observation_count: results.observations.length,
        errors: results.errors,
        warnings: results.warnings,
            observations: results.observations,
            routing_allowed: results.errors.length === 0,
            blocking_reasons: results.errors
          }, null, 2));
        } else {
          console.log(formatHumanReadable(results));
        }
    
    // Set exit code
    if (results.errors.length > 0) {
      process.exit(1); // Validation errors block routing
    } else {
      process.exit(0); // No errors - routing allowed
    }
  } catch (error) {
    // Handle unexpected errors
    if (typeof process.argv.find(arg => arg === '--json') !== 'undefined') {
      console.error(JSON.stringify({
        result: 'error',
        error_count: 1,
        warning_count: 0,
        observation_count: 0,
        errors: [error.message || 'Unknown error'],
        warnings: [],
        observations: []
      }, null, 2));
    } else {
      console.error(`Error: ${error.message || 'Unknown error'}`);
    }
    process.exit(3);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for programmatic use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadRegistry,
    validateRegistry,
    formatHumanReadable,
    parseArgs,
    /**
     * Run governance preflight programmatically
     * @param {{registryPath?: string}} options - Configuration options
     * @returns {Promise<{result: string, error_count: number, warning_count: number, observation_count: number, errors: string[], warnings: string[], observations: string[], routing_allowed: boolean: routing_allowed, blocking_reasons: string[]}>}
     */
    async runGovernancePreflight(options = {}) {
      // Perform no validation automatically, print nothing, modify nothing
      // Return structured results without terminating the process
      
      const registryPath = options.registryPath || null;
      
      // Load registry
      const { data, error } = loadRegistry(registryPath);
      if (error) {
        return {
          result: 'error',
          error_count: 1,
          warning_count: 0,
          observation_count: 0,
          errors: [error.message],
          warnings: [],
          observations: [],
          routing_allowed: false,
          blocking_reasons: [error.message]
        };
      }
      
      // Validate registry
      const results = validateRegistry(data);
      
      // Determine routing eligibility
      const routingAllowed = results.errors.length === 0;
      const blockingReasons = [...results.errors]; // Only errors block routing
      
      return {
        result: results.errors.length === 0 ? 'valid' : 'invalid',
        error_count: results.errors.length,
        warning_count: results.warnings.length,
        observation_count: results.observations.length,
        errors: [...results.errors],
        warnings: [...results.warnings],
        observations: [...results.observations],
              routing_allowed: routingAllowed,
              blocking_reasons: blockingReasons
      };
    }
  };
}