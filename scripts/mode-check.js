'use strict';

/**
 * Mode Gate Utility
 *
 * Reads lanes/broadcast/active-mode.json and enforces the current
 * operational mode (OBSERVE | BUILD | CHAOS_LAB | RECOVERY).
 *
 * Any agent or script can require('mode-check') to gate mutations
 * against the system-wide mode before performing write operations.
 *
 * @module mode-check
 */

const fs = require('fs');
const path = require('path');
const {
  OperationalMode,
  OPERATIONAL_MODES,
  OPERATIONAL_MODE_SET,
  validateEnum,
} = require('./governance-types');

const MODE_FILE_PATH = path.resolve(
  __dirname, '..', 'lanes', 'broadcast', 'active-mode.json'
);

const MODE_ALLOWED_OPERATIONS = Object.freeze({
  [OperationalMode.OBSERVE]: Object.freeze([
    'read', 'log', 'summarize', 'measure', 'report',
  ]),
  [OperationalMode.BUILD]: Object.freeze([
    'read', 'log', 'summarize', 'measure', 'report',
    'mutate_scoped', 'commit', 'test',
    'outbox_write', 'trust_store_write', 'inbox_mutation',
  ]),
  [OperationalMode.CHAOS_LAB]: Object.freeze([
    'read', 'log', 'summarize', 'measure', 'report',
    'mutate_sandbox', 'mutate_branch', 'mutate_staging',
  ]),
  [OperationalMode.RECOVERY]: Object.freeze([
    'read', 'log', 'summarize', 'measure', 'report',
    'restore', 'verify', 'compare', 'unblock',
    'outbox_write', 'trust_store_write', 'inbox_mutation',
  ]),
});

const MUTATION_OPERATIONS = Object.freeze(new Set([
  'mutate_scoped', 'commit', 'test',
  'mutate_sandbox', 'mutate_branch', 'mutate_staging',
  'restore', 'unblock',
  'outbox_write', 'trust_store_write', 'inbox_mutation',
]));

let _cachedMode = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5000;

function _readModeFile() {
  try {
    const raw = fs.readFileSync(MODE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const r = validateEnum(parsed.mode, OPERATIONAL_MODES, 'OperationalMode');
    if ('error' in r) {
      throw new Error(r.error);
    }
    return parsed;
  } catch (err) {
    if (_cachedMode) return _cachedMode;
    throw new Error(
      `MODE_GATE_UNAVAILABLE: Cannot read ${MODE_FILE_PATH}: ${err.message}`
    );
  }
}

function readMode() {
  const now = Date.now();
  if (_cachedMode && (now - _cachedAt) < CACHE_TTL_MS) {
    return _cachedMode;
  }
  const modeData = _readModeFile();
  _cachedMode = modeData;
  _cachedAt = now;
  return modeData;
}

function getCurrentMode() {
  return readMode().mode;
}

function getAllowedOperations() {
  const mode = getCurrentMode();
  return MODE_ALLOWED_OPERATIONS[mode] || [];
}

function checkMutation(operation, targetPath) {
  const modeData = readMode();
  const mode = modeData.mode;
  const allowed = MODE_ALLOWED_OPERATIONS[mode] || [];

  if (!allowed.includes(operation)) {
    if (MUTATION_OPERATIONS.has(operation)) {
      return {
        allowed: false,
        reason: `MODE_GATE_BLOCKED: Operation "${operation}" is not allowed in ${mode} mode. ` +
        `Allowed: ${allowed.join(', ')}. ` +
        `Mode set by ${modeData.set_by || 'unknown'} at ${modeData.set_at || 'unknown'}. ` +
        `Reason: ${modeData.reason || 'none'}.`,
      };
    }
    return {
      allowed: false,
      reason: `MODE_GATE_BLOCKED: Operation "${operation}" not recognized for mode ${mode}. ` +
      `Allowed: ${allowed.join(', ')}.`,
    };
  }

  if (mode === OperationalMode.BUILD && operation === 'mutate_scoped') {
    const stablePatterns = [
      '/governance-types.js',
      '/schema-validator.js',
      '\\governance-types.js',
      '\\schema-validator.js',
    ];
    for (const pat of stablePatterns) {
      if (targetPath && targetPath.includes(pat)) {
        return {
          allowed: false,
          reason: `MODE_GATE_BLOCKED: Cannot mutate stable governance file in BUILD mode. ` +
          `Path: ${targetPath}. Switch to CHAOS_LAB or get operator approval.`,
        };
      }
    }
  }

  if (mode === OperationalMode.CHAOS_LAB) {
    const blockedPatterns = ['main', 'master'];
    for (const pat of blockedPatterns) {
      if (targetPath && targetPath.includes(pat)) {
        return {
          allowed: false,
          reason: `MODE_GATE_BLOCKED: Cannot write to main/master paths in CHAOS_LAB mode. ` +
          `Path: ${targetPath}. Use a branch or staging path.`,
        };
      }
    }
  }

  return { allowed: true, reason: `Operation "${operation}" permitted in ${mode} mode.` };
}

function transitionMode(newMode, setBy, reason, expiresAt) {
  const r = validateEnum(newMode, OPERATIONAL_MODES, 'OperationalMode');
  if ('error' in r) {
    throw new Error(r.error);
  }

  const current = readMode();
  const newModeData = {
    mode: newMode,
    set_by: setBy || 'unknown',
    set_at: new Date().toISOString(),
    reason: reason || '',
    expires_at: expiresAt || null,
    allowed_operations: [...(MODE_ALLOWED_OPERATIONS[newMode] || [])],
    previous_mode: current.mode,
    version: (current.version || 0) + 1,
  };

  const dir = path.dirname(MODE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(MODE_FILE_PATH, JSON.stringify(newModeData, null, 2), 'utf8');

  _cachedMode = newModeData;
  _cachedAt = Date.now();

  return newModeData;
}

function enforceMutation(operation, targetPath) {
  const result = checkMutation(operation, targetPath);
  if (!result.allowed) {
    const err = /** @type {Error & {code: string}} */ (new Error(result.reason));
    err.code = 'MODE_GATE_BLOCKED';
    throw err;
  }
  return true;
}

function invalidateCache() {
  _cachedMode = null;
  _cachedAt = 0;
}

module.exports = {
  MODE_FILE_PATH,
  MODE_ALLOWED_OPERATIONS,
  MUTATION_OPERATIONS,
  readMode,
  getCurrentMode,
  getAllowedOperations,
  checkMutation,
  transitionMode,
  enforceMutation,
  invalidateCache,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'status';

  if (cmd === 'status') {
    const modeData = readMode();
    console.log(`Mode: ${modeData.mode}`);
    console.log(`Set by: ${modeData.set_by}`);
    console.log(`Set at: ${modeData.set_at}`);
    console.log(`Reason: ${modeData.reason}`);
    console.log(`Allowed: ${modeData.allowed_operations.join(', ')}`);
    console.log(`Previous: ${modeData.previous_mode || 'none'}`);
    console.log(`Version: ${modeData.version}`);
  } else if (cmd === 'check' && args[1]) {
    const result = checkMutation(args[1], args[2]);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.allowed ? 0 : 1);
  } else if (cmd === 'transition' && args[1]) {
    const newMode = args[1];
    const setBy = args[2] || 'cli';
    const reason = args.slice(3).join(' ') || '';
    const result = transitionMode(newMode, setBy, reason);
    console.log(`Transitioned to ${result.mode} (v${result.version})`);
    console.log(`Allowed: ${result.allowed_operations.join(', ')}`);
  } else {
    console.log('Usage:');
    console.log('  node mode-check.js status');
    console.log('  node mode-check.js check <operation> [targetPath]');
    console.log('  node mode-check.js transition <mode> [setBy] [reason...]');
    console.log(`  Modes: ${OPERATIONAL_MODES.join(', ')}`);
  }
}
