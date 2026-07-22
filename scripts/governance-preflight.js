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
    json: false,
    health: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--json') {
      result.json = true;
    } else if (arg === '--registry' && i + 1 < args.length) {
      result.registryPath = args[++i];
    } else if (arg === '--health') {
      result.health = true;
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
  node scripts/governance-preflight.js --health
  node scripts/governance-preflight.js --health --json
  node scripts/governance-preflight.js --health --registry <path>

Options:
  --json              Output machine-readable JSON instead of human-readable summary
  --registry <path>   Explicit path to lane registry fixture (for testing)
  --health            Read-only health check (local worktree + optional SSH headless)
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
    * Format health check results for human-readable output
    * @param {Object} healthResult - Result from runHealthCheck
    * @returns {string}
    */
function formatHealthHumanReadable(healthResult) {
     const { local, headless, observations, routing_allowed, checks, timestamp } = healthResult;
   
    let output = '';
    output += `✅ GOVERNANCE HEALTH CHECK\n\n`;
   
    // Registry
    if (checks.registry) {
      const reg = checks.registry;
      output += `📋 REGISTRY: ${reg.loaded ? 'LOADED' : 'FAILED'}\n`;
      output += `   Path: ${reg.path}\n`;
      if (reg.validation) {
        output += `   Validation: ${reg.validation.errors} errors, ${reg.validation.warnings} warnings, ${reg.validation.observations} observations\n`;
      }
      if (reg.error) {
        output += `   Error: ${reg.error}\n`;
      }
      output += '\n';
    }
 
    // Active blocker
    if (checks.active_blocker) {
      const ab = checks.active_blocker;
      if (ab.exists && ab.active) {
        output += `🚫 ACTIVE BLOCKER: YES\n`;
        output += `   Owner: ${ab.owner}\n`;
        output += `   Task: ${ab.task_id}\n`;
        output += `   Created: ${ab.created_at}\n`;
        if (ab.age_hours !== undefined) {
          output += `   Age: ${ab.age_hours}h\n`;
        }
      } else {
        output += `🚫 ACTIVE BLOCKER: NO - all lanes unblocked\n`;
      }
      output += '\n';
    }
 
    // Mailboxes
    if (checks.mailbox_totals) {
      const mb = checks.mailbox_totals;
      output += `📬 MAILBOXES: ${mb.inbox} inbox, ${mb.outbox} outbox messages\n`;
      if (checks.lanes) {
        for (const [lane, counts] of Object.entries(checks.lanes)) {
          const status = counts.inbox_exists && counts.outbox_exists ? '✅' : counts.inbox_exists || counts.outbox_exists ? '⚠️' : '❌';
          output += `   ${status} ${lane}: inbox=${counts.inbox}, outbox=${counts.outbox}\n`;
        }
      }
      output += '\n';
    }
 
    // Stale lanes
    if (checks.stale_lanes && checks.stale_lanes.length > 0) {
      output += `⏰ STALE LANES (${checks.stale_lanes.length}):\n`;
      for (const s of checks.stale_lanes) {
        output += `   ⚠️ ${s.lane}: ${s.age_hours}h inactive\n`;
      }
      output += '\n';
    }
 
    // Headless
    if (headless) {
      output += `🔗 HEADLESS: ${headless.reachable ? 'REACHABLE' : 'UNREACHABLE'}\n`;
      if (!headless.reachable && headless.error) {
        output += `   Reason: ${headless.error}\n`;
      }
      output += '\n';
    }
 
    // Worktree
    if (checks.worktree) {
      const wt = checks.worktree;
      output += `🌳 WORKTREE: ${wt.branch || 'unknown'} @ ${wt.head || 'unknown'}\n`;
      if (wt.clean !== undefined) {
        output += `   Status: ${wt.clean ? 'CLEAN' : `DIRTY (${wt.changes} changes)`}\n`;
      }
      if (wt.error) {
        output += `   Error: ${wt.error}\n`;
      }
      output += '\n';
    }
 
    // Summary
    const errorCount = (checks.registry && checks.registry.validation && checks.registry.validation.errors) || 0;
    const warningCount = (checks.registry && checks.registry.validation && checks.registry.validation.warnings) || 0;
    const observationCount = (checks.registry && checks.registry.validation && checks.registry.validation.observations) || 0;
    output += `SUMMARY: ${errorCount} errors, ${warningCount} warnings, ${observationCount} observations\n`;
    output += `ROUTING: ${routing_allowed ? 'ALLOWED (health check never blocks)' : 'BLOCKED'}\n`;
 
    // Show observations
    if (observations.length > 0) {
      output += `\nℹ️ OBSERVATIONS:\n`;
      observations.slice(0, 10).forEach((o, i) => {
        const lane = o.lane_id ? ` [${o.lane_id}]` : '';
        output += `  ${i + 1}. [${o.code}]${lane} ${o.message}\n`;
      });
      if (observations.length > 10) output += `  ... and ${observations.length - 10} more\n`;
    }
 
    return output;
}

/**
   * Health check - comprehensive read-only governance health assessment
   * Performs no writes, no SSH unless explicitly available, no process mutations.
   * All findings are observations/warnings; never blocks routing.
   * @param {{registryPath?: string}} options
   * @returns {Promise<{result: string, error_count: number, warning_count: number, observation_count: number, errors: any[], warnings: any[], observations: any[], routing_allowed: boolean, blocking_reasons: string[], checks: object}>}
   */
  async function runHealthCheck(options = {}) {
    const observations = [];
    const warnings = [];
    const errors = [];
    const checks = {};

    try {
      // 1. Registry validity (reuse preflight logic but don't block)
      const { data, error } = loadRegistry(options.registryPath);
      checks.registry = { loaded: !error, path: options.registryPath || 'auto-discovered' };
    
      if (error) {
        errors.push({ code: 'REGISTRY_LOAD_FAILED', severity: 'error', message: error.message });
        checks.registry.error = error.message;
      } else {
        const results = validateRegistry(data);
        checks.registry.validation = {
          errors: results.errors.length,
          warnings: results.warnings.length,
          observations: results.observations.length
        };
        // Add all validation findings as observations (don't block)
        results.errors.forEach(e => observations.push({ ...e, severity: 'observation' }));
        results.warnings.forEach(w => warnings.push(w));
        results.observations.forEach(o => observations.push(o));
      }

      // 2. Active blocker check
            const { LaneDiscovery } = require('../.global/lane-discovery.js');
            const laneDiscovery = new LaneDiscovery();
            const broadcastPath = laneDiscovery.getBroadcastPath();
            const blockerPath = path.join(broadcastPath, 'active-blocker.json');

            checks.active_blocker = { exists: false };

      try {
        const blockerContent = fs.readFileSync(blockerPath, 'utf8');
        const blocker = JSON.parse(blockerContent);
        
              // Only consider it an active blocker if active=true and owner is set
              const isActive = blocker.active === true && (blocker.owner || blocker.owner_lane);
        
              checks.active_blocker = { 
                exists: true, 
                valid: true,
                active: isActive,
                owner: (blocker.owner || blocker.owner_lane || 'unknown'),
                created_at: blocker.created_at || blocker.timestamp || blocker.updated_at || 'unknown',
                task_id: blocker.task_id || 'unknown'
              };

              if (isActive) {
                // Check staleness (>24h)
                const blockerTime = blocker.created_at || blocker.timestamp || blocker.updated_at;
                if (blockerTime) {
                  const ageMs = Date.now() - new Date(blockerTime).getTime();
                  const ageHours = ageMs / (1000 * 60 * 60);
                  checks.active_blocker.age_hours = Math.round(ageHours * 10) / 10;
                  if (ageHours > 24) {
                    warnings.push({ 
                      code: 'BLOCKER_STALE', 
                      severity: 'warning', 
                      message: `Active blocker is ${Math.round(ageHours)}h old (owner: ${checks.active_blocker.owner})`,
                      lane_id: checks.active_blocker.owner
                    });
                  }
                }
              } else {
                observations.push({ 
                  code: 'NO_ACTIVE_BLOCKER', 
                  severity: 'observation', 
                  message: 'No active blocker found - all lanes unblocked' 
                });
              }
            } catch (e) {
              if (e.code === 'ENOENT') {
                checks.active_blocker.exists = false;
                observations.push({ 
                  code: 'NO_ACTIVE_BLOCKER', 
                  severity: 'observation', 
                  message: 'No active blocker file found - all lanes unblocked' 
                });
              } else {
                checks.active_blocker.error = e.message;
                warnings.push({ 
                  code: 'BLOCKER_PARSE_ERROR', 
                  severity: 'warning', 
                  message: `Active blocker file exists but could not be parsed: ${e.message}` 
                });
              }
            }

      // 3. Lane mailbox counts
            const lanes = laneDiscovery.listLanes();
      checks.lanes = {};
      let totalInbox = 0;
      let totalOutbox = 0;
    
      for (const lane of lanes) {
        const inboxPath = laneDiscovery.getInbox(lane);
        const outboxPath = laneDiscovery.getOutbox(lane);
      
        let inboxCount = 0;
        let outboxCount = 0;
        let inboxExists = false;
        let outboxExists = false;
      
        try {
          const inboxFiles = fs.readdirSync(inboxPath);
          inboxCount = inboxFiles.filter(f => f.endsWith('.json')).length;
          inboxExists = true;
        } catch (e) {
          // inbox doesn't exist
        }
      
        try {
          const outboxFiles = fs.readdirSync(outboxPath);
          outboxCount = outboxFiles.filter(f => f.endsWith('.json')).length;
          outboxExists = true;
        } catch (e) {
          // outbox doesn't exist
        }
      
        checks.lanes[lane] = { inbox: inboxCount, outbox: outboxCount, inbox_exists: inboxExists, outbox_exists: outboxExists };
        totalInbox += inboxCount;
        totalOutbox += outboxCount;
      
        if (!inboxExists && !outboxExists) {
          warnings.push({ 
            code: 'LANE_MISSING_MAILBOXES', 
            severity: 'warning', 
            message: `Lane ${lane} has no inbox or outbox directories`,
            lane_id: lane
          });
        } else if (!inboxExists) {
          observations.push({ 
            code: 'LANE_MISSING_INBOX', 
            severity: 'observation', 
            message: `Lane ${lane} has no inbox directory`,
            lane_id: lane
          });
        } else if (!outboxExists) {
          observations.push({ 
            code: 'LANE_MISSING_OUTBOX', 
            severity: 'observation', 
            message: `Lane ${lane} has no outbox directory`,
            lane_id: lane
          });
        }
      }
    
      checks.mailbox_totals = { inbox: totalInbox, outbox: totalOutbox };
    
      if (totalInbox > 0) {
        observations.push({ 
          code: 'INBOX_MESSAGES_PENDING', 
          severity: 'observation', 
          message: `${totalInbox} message(s) pending across all lane inboxes` 
        });
      }

      // 4. Stale lanes check (heartbeat >24h) - look for mailbox mtime
      checks.stale_lanes = [];
      const staleThresholdMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
    
      for (const lane of lanes) {
        const inboxPath = laneDiscovery.getInbox(lane);
        const outboxPath = laneDiscovery.getOutbox(lane);
        let latestActivity = 0;
      
        try {
          const inboxStat = fs.statSync(inboxPath);
          latestActivity = Math.max(latestActivity, inboxStat.mtimeMs);
        } catch (e) {}
      
        try {
          const outboxStat = fs.statSync(outboxPath);
          latestActivity = Math.max(latestActivity, outboxStat.mtimeMs);
        } catch (e) {}
      
        if (latestActivity > 0) {
          const ageHours = (now - latestActivity) / (1000 * 60 * 60);
          if (ageHours > 24) {
            checks.stale_lanes.push({ lane, age_hours: Math.round(ageHours * 10) / 10 });
            warnings.push({ 
              code: 'LANE_STALE', 
              severity: 'warning', 
              message: `Lane ${lane} inactive for ${Math.round(ageHours)}h (no mailbox activity)`,
              lane_id: lane
            });
          }
        }
      }

      // 5. Optional SSH headless comparison (best effort, never fails health check)
      checks.headless = { attempted: false, reachable: false };
      try {
        const { execFileSync } = require('child_process');
        // Quick connectivity check with short timeout
        execFileSync('ssh', ['-o', 'ConnectTimeout=2', '-o', 'BatchMode=yes', 'headless', 'echo', 'ok'], { 
          encoding: 'utf8', 
          timeout: 5000 
        });
        checks.headless.attempted = true;
        checks.headless.reachable = true;
      
        observations.push({ 
          code: 'HEADLESS_REACHABLE', 
          severity: 'observation', 
          message: 'Headless host reachable via SSH' 
        });
      } catch (e) {
        checks.headless.attempted = true;
        checks.headless.reachable = false;
        checks.headless.error = e.message || 'SSH unavailable';
        observations.push({ 
          code: 'HEADLESS_UNREACHABLE', 
          severity: 'observation', 
          message: `Headless SSH not available: ${e.code || e.message}` 
        });
      }

      // 6. Worktree/git status (read-only)
      checks.worktree = {};
      try {
        const { execFileSync } = require('child_process');
              // Compute worktree root: registry is at worktree/.global/lane-registry.json
              // require.resolve('../.global/lane-registry.json') -> <worktree>/.global/lane-registry.json
              // path.dirname once -> <worktree>/.global
              // path.dirname twice -> <worktree> (root)
              const registryPath = path.dirname(path.dirname(require.resolve('../.global/lane-registry.json')));
              const root = registryPath;
      
        // Current branch
        const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { 
          cwd: root, encoding: 'utf8' 
        }).trim();
        checks.worktree.branch = branch;
      
        // HEAD commit
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { 
          cwd: root, encoding: 'utf8' 
        }).trim();
        checks.worktree.head = head.substring(0, 12);
      
        // Clean status
        const status = execFileSync('git', ['status', '--short'], { 
          cwd: root, encoding: 'utf8' 
        }).trim();
        checks.worktree.clean = status === '';
        checks.worktree.changes = status.split('\n').filter(l => l).length;
      
        if (!checks.worktree.clean) {
          observations.push({ 
            code: 'WORKTREE_DIRTY', 
            severity: 'observation', 
            message: `Worktree has ${checks.worktree.changes} uncommitted change(s)` 
          });
        }
      } catch (e) {
        checks.worktree.error = e.message;
      }

      // Summary
      const warningCount = warnings.length;
      const observationCount = observations.length;
      const errorCount = errors.length;

      // Health check NEVER blocks routing - always allow
      const routingAllowed = true;
    
            // Build test-compatible output format
            const missingMailboxes = [];
            if (checks.lanes) {
              for (const [lane, counts] of Object.entries(checks.lanes)) {
                if (!counts.inbox_exists || !counts.outbox_exists) {
                  missingMailboxes.push(lane);
                }
              }
            }
      
            const staleLanes = checks.stale_lanes ? checks.stale_lanes.map(s => s.lane) : [];
      
            const activeBlocker = checks.active_blocker && checks.active_blocker.exists && checks.active_blocker.active ? {
              owner: checks.active_blocker.owner,
              task_id: checks.active_blocker.task_id,
              created_at: checks.active_blocker.created_at,
              age_hours: checks.active_blocker.age_hours
            } : null;
      
            const headless = checks.headless ? {
              attempted: checks.headless.attempted,
              reachable: checks.headless.reachable,
              error: checks.headless.error
            } : { attempted: false, reachable: false };

            return {
              timestamp: new Date().toISOString(),
              local: {
                registryValid: checks.registry && checks.registry.loaded && checks.registry.valid !== false,
                missingMailboxes,
                staleLanes,
                activeBlocker
              },
              headless,
              observations: [...observations],
              routing_allowed: routingAllowed,
              checks
            };
    } catch (error) {
      // Internal error in health check itself
      return {
        result: 'error',
        error_count: 1,
        warning_count: 0,
        observation_count: 0,
        errors: [{ code: 'HEALTH_CHECK_FAILED', severity: 'error', message: error.message || 'Unknown error' }],
        warnings: [],
        observations: [],
        routing_allowed: true, // Even internal errors don't block routing in health mode
        blocking_reasons: [],
        checks: { error: error.message }
      };
    }
  }

  /**
   * Main execution function
   */
  async function main() {
    try {
      const args = parseArgs();
    
      // Health check mode - comprehensive read-only assessment
      if (args.health) {
        const healthResult = await runHealthCheck({ registryPath: args.registryPath });
      
        if (args.json) {
          console.log(JSON.stringify(healthResult, null, 2));
        } else {
          // Human-readable health output
          console.log(formatHealthHumanReadable(healthResult));
        }
      
        // Health check always exits 0 unless internal error
        process.exit(healthResult.result === 'error' ? 3 : 0);
      }
    
      // Normal governance preflight validation
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
     * @returns {Promise<{result: string, error_count: number, warning_count: number, observation_count: number, errors: string[], warnings: string[], observations: string[], routing_allowed: boolean, blocking_reasons: string[]}>}
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
    },
    /**
     * Run comprehensive governance health check (read-only)
     * @param {{registryPath?: string, headlessHost?: string}} options - Configuration options
     * @returns {Promise<{result: string, error_count: number, warning_count: number, observation_count: number, errors: any[], warnings: any[], observations: any[], routing_allowed: boolean, blocking_reasons: string[], checks: object}>}
     */
    runHealthCheck
  };
}