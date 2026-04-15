/**
 * Routing Logger - Async Version
 * 
 * Location: S:/Archivist-Agent/src/bridge/routing-logger.js
 * Purpose: Per-request routing observability with async file operations
 */

const { promises: fs } = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'kilo', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'routing.jsonl');

// In-memory buffer for when file writes fail
let logBuffer = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Ensure log directory exists
 */
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('[Logger] Cannot create log directory:', error.message);
    }
  }
}

/**
 * Log a routing decision (async)
 * @param {Object} entry - Routing entry to log
 */
async function logRouting(entry) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  
  try {
    await ensureLogDir();
    await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (error) {
    // Buffer in memory if file write fails
    logBuffer.push(logEntry);
    if (logBuffer.length > MAX_BUFFER_SIZE) {
      logBuffer.shift(); // Remove oldest
    }
    console.error('[Logger] File write failed, buffered:', error.message);
  }
  
  return logEntry;
}

/**
 * Log a model request
 * @param {Object} params - Request parameters
 */
async function logModelRequest(params) {
  return logRouting({
    type: 'model_request',
    agent: params.agent || 'unknown',
    model: params.model || 'unknown',
    provider: params.provider || 'unknown',
    route: params.route || 'local',
    taskId: params.taskId || generateTaskId(),
    inputTokens: params.inputTokens || 0,
    tools: params.tools || []
  });
}

/**
 * Log a model response
 * @param {Object} params - Response parameters
 */
async function logModelResponse(params) {
  return logRouting({
    type: 'model_response',
    taskId: params.taskId,
    success: params.success !== false,
    outputTokens: params.outputTokens || 0,
    latencyMs: params.latencyMs || 0,
    error: params.error || null,
    routing: params.routing || {
      intended: params.intendedModel || 'unknown',
      actual: params.actualModel || 'unknown',
      fallback: params.fallback || false
    }
  });
}

/**
 * Log a routing discrepancy
 * @param {Object} params - Discrepancy parameters
 */
async function logRoutingDiscrepancy(params) {
  return logRouting({
    type: 'routing_discrepancy',
    taskId: params.taskId,
    intended: params.intended,
    actual: params.actual,
    reason: params.reason || 'unknown',
    severity: assessSeverity(params)
  });
}

/**
 * Assess severity of routing discrepancy
 * FIX: Handle all provider prefixes
 */
function assessSeverity(params) {
  const intendedLocal = params.intended?.startsWith('ollama/');
  const actualLocal = params.actual?.startsWith('ollama/');
  const intendedCloud = params.intended?.startsWith('z-ai/') || params.intended?.startsWith('openrouter/');
  const actualCloud = params.actual?.startsWith('z-ai/') || params.actual?.startsWith('openrouter/');
  
  // Cloud route when local intended = HIGH
  if (intendedLocal && !actualLocal) {
    return 'HIGH';
  }
  
  // Local route when cloud intended = MEDIUM
  if (intendedCloud && actualLocal) {
    return 'MEDIUM';
  }
  
  // Same provider category, different model = LOW
  return 'LOW';
}

/**
 * Generate a unique task ID
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get routing summary for a time period
 * @param {number} hours - Hours to look back
 */
async function getRoutingSummary(hours = 24) {
  const entries = await readLogFile();
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  
  const recent = entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
  
  return {
    totalRequests: recent.filter(e => e.type === 'model_request').length,
    totalResponses: recent.filter(e => e.type === 'model_response').length,
    discrepancies: recent.filter(e => e.type === 'routing_discrepancy'),
    byAgent: groupBy(recent.filter(e => e.type === 'model_request'), 'agent'),
    byModel: groupBy(recent.filter(e => e.type === 'model_request'), 'model'),
    byProvider: groupBy(recent.filter(e => e.type === 'model_request'), 'provider'),
    buffered: logBuffer.length
  };
}

/**
 * Group entries by a key
 */
function groupBy(entries, key) {
  return entries.reduce((acc, entry) => {
    const value = entry[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Read and parse log file
 */
async function readLogFile() {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');
    return content.trim().split('\n')
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[Logger] Read failed:', error.message);
    }
    // Return buffered entries if file doesn't exist
    return [...logBuffer];
  }
}

/**
 * Clear old logs (keep last N days)
 * @param {number} days - Days to keep
 */
async function pruneLogs(days = 7) {
  const entries = await readLogFile();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  const kept = entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
  
  if (kept.length < entries.length) {
    try {
      await fs.writeFile(LOG_FILE, kept.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
      console.log(`[Logger] Pruned ${entries.length - kept.length} old entries`);
    } catch (error) {
      console.error('[Logger] Prune failed:', error.message);
    }
  }
}

/**
 * Flush buffer to file
 */
async function flushBuffer() {
  if (logBuffer.length === 0) return;
  
  try {
    await ensureLogDir();
    await fs.appendFile(LOG_FILE, logBuffer.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    const count = logBuffer.length;
    logBuffer = [];
    console.log(`[Logger] Flushed ${count} buffered entries`);
  } catch (error) {
    console.error('[Logger] Flush failed:', error.message);
  }
}

module.exports = {
  logRouting,
  logModelRequest,
  logModelResponse,
  logRoutingDiscrepancy,
  getRoutingSummary,
  pruneLogs,
  flushBuffer,
  LOG_FILE,
  LOG_DIR
};
