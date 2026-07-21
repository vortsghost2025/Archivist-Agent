#!/usr/bin/env node
/**
 * LOCAL LANE DISCOVERY UTILITY
 * ORIGIN: S:/Archivist-Agent/.global/lane-discovery.js
 * LOCALIZED: Archivist (2026-05-02)
 * UPDATED: 2026-07-21 — Portable root derivation via __dirname
 * PURPOSE: Local implementation to avoid cross-boundary require() on .global/
 *
 * This is a sovereign copy that reads the lane registry directly
 * instead of importing from .global/ which is an external boundary.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const isWin32 = process.platform === 'win32';

/**
 * Derive the Archivist repository root from a directory path.
 * This file lives at <repo>/scripts/util/lane-discovery.js.
 * Going up two levels from __dirname yields <repo>.
 * @param {string} baseDir - __dirname or equivalent
 * @returns {string} Absolute path to the repository root
 */
function resolveRootFromDir(baseDir) {
  return path.resolve(baseDir, '..', '..');
}

/**
 * Derive the registry path from a base directory.
 * @param {string} baseDir - __dirname or equivalent
 * @returns {string} Absolute path to .global/lane-registry.json
 */
function resolveRegistryPath(baseDir) {
  return path.join(resolveRootFromDir(baseDir), '.global', 'lane-registry.json');
}

const ARCHIVIST_ROOT = resolveRootFromDir(__dirname);
const REGISTRY_PATH = resolveRegistryPath(__dirname);

/**
 * Determine the base path for resolving S:/ paths on non-Windows platforms.
 * Precedence: LANE_ROOT_BASE env var, then os.homedir()/agent/repos.
 * @returns {string}
 */
function _getUbuntuBase() {
  if (process.env.LANE_ROOT_BASE) return process.env.LANE_ROOT_BASE;
  return path.join(os.homedir(), 'agent', 'repos');
}

const UBUNTU_ROOT = _getUbuntuBase();

function _resolvePath(winPath) {
  if (isWin32) return winPath;
  const match = winPath.match(/^S:\/(.+)$/);
  if (!match) return winPath;
  return path.join(UBUNTU_ROOT, match[1]);
}

function _translateRegistry(registry) {
  for (const lane of Object.values(registry.lanes)) {
    lane.local_path = _resolvePath(lane.local_path);
    if (lane.mailboxes) {
      for (const [key, val] of Object.entries(lane.mailboxes)) {
        lane.mailboxes[key] = _resolvePath(val);
      }
    }
    if (lane.broadcast_access) {
      lane.broadcast_access = _resolvePath(lane.broadcast_access);
    }
    if (lane.forbidden_variants) {
      lane.forbidden_variants = lane.forbidden_variants.map(_resolvePath);
    }
  }
  if (registry.broadcast && registry.broadcast.path) {
    registry.broadcast.path = _resolvePath(registry.broadcast.path);
  }
  return registry;
}

/**
 * Resolve a sibling lane's local_path.
 * Precedence:
 *   1. Explicit override from overrides[laneId]
 *   2. LANE_ROOT_BASE environment variable (on non-Windows)
 *   3. Existing canonical platform location — only if it exists on disk
 *   4. Fail closed (throw)
 * @param {string} winPath - The S:/ path from the registry
 * @param {string} laneId - The lane identifier
 * @param {Object} [overrides] - Optional map of laneId → path
 * @returns {string} Resolved path
 * @throws {Error} If the path cannot be resolved and does not exist
 */
function _resolveLaneRoot(winPath, laneId, overrides) {
  // 1. Explicit override
  if (overrides && overrides[laneId]) {
    return overrides[laneId];
  }
  // 2 & 3. Platform resolution
  const resolved = _resolvePath(winPath);
  // Check if the resolved path exists on disk
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  // On Windows, if S:/ path doesn't exist, check LANE_ROOT_BASE override
  if (isWin32 && process.env.LANE_ROOT_BASE) {
    const match = winPath.match(/^S:\/(.+)$/);
    if (match) {
      const altPath = path.join(process.env.LANE_ROOT_BASE, match[1]);
      if (fs.existsSync(altPath)) return altPath;
    }
  }
  // 4. Fail closed
  throw new Error(`Lane '${laneId}' root '${winPath}' resolved to '${resolved}' which does not exist. Set LANE_ROOT_BASE or provide explicit override.`);
}

class LaneDiscovery {
  constructor(options) {
    this._overrides = (options && options.overrides) || {};
    this._explicitRegistryPath = (options && options.registryPath) || null;
    this.registry = this.loadRegistry();
  }

  loadRegistry() {
    const regPath = this._explicitRegistryPath || REGISTRY_PATH;
    try {
      const data = fs.readFileSync(regPath, 'utf8');
      const raw = JSON.parse(data);
      // On Windows, paths in registry are already S:/ so no translation needed.
      // On Linux, translate S:/ paths to UBUNTU_ROOT paths.
      return isWin32 ? raw : _translateRegistry(raw);
    } catch (e) {
      if (this._explicitRegistryPath) {
        throw new Error(`Failed to load lane registry from ${regPath}: ${e.message}.`);
      }
      throw new Error(`Failed to load lane registry from ${regPath}: ${e.message}. Cannot proceed without registry.`);
    }
  }

  getLane(laneId) {
    const lane = this.registry.lanes[laneId.toLowerCase()];
    if (!lane) {
      throw new Error(`Lane '${laneId}' not found in registry. Available: ${Object.keys(this.registry.lanes).join(', ')}`);
    }
    return lane;
  }

  getInbox(laneId) {
    const lane = this.getLane(laneId);
    return lane.mailboxes.inbox;
  }

  getOutbox(laneId) {
    const lane = this.getLane(laneId);
    return lane.mailboxes.outbox;
  }

  getProcessed(laneId) {
    const lane = this.getLane(laneId);
    return lane.mailboxes.processed;
  }

  getLocalPath(laneId) {
    const lane = this.getLane(laneId);
    return lane.local_path;
  }

  getRepo(laneId) {
    const lane = this.getLane(laneId);
    return lane.repo;
  }

  validatePath(laneId, testPath) {
    const lane = this.getLane(laneId);

    if (lane.forbidden_variants) {
      for (const variant of lane.forbidden_variants) {
        if (testPath.toLowerCase().includes(variant.toLowerCase())) {
          throw new Error(
            `PATH ERROR: '${testPath}' is a forbidden variant. ` +
            `Use canonical path: ${lane.local_path}`
          );
        }
      }
    }

    if (!testPath.startsWith(lane.local_path)) {
      throw new Error(
        `PATH MISMATCH: '${testPath}' does not match registered path for ${laneId}. ` +
        `Expected: ${lane.local_path}`
      );
    }

    return lane.local_path;
  }

  sendToLane(fromLane, toLane, message, filename) {
    const inboxPath = this.getInbox(toLane);
    const outboxPath = this.getOutbox(fromLane);

    if (!fs.existsSync(inboxPath)) {
      fs.mkdirSync(inboxPath, { recursive: true });
    }
    if (!fs.existsSync(outboxPath)) {
      fs.mkdirSync(outboxPath, { recursive: true });
    }

    const targetPath = path.join(inboxPath, filename);
    fs.writeFileSync(targetPath, JSON.stringify(message, null, 2));

    const receipt = {
      type: 'delivery_receipt',
      to: toLane,
      message_path: targetPath,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    };
    const receiptPath = path.join(outboxPath, `receipt-${filename}`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

    console.log(`[LANE-DISCOVERY] Sent to ${toLane}: ${targetPath}`);
    return targetPath;
  }

  listLanes() {
    return Object.keys(this.registry.lanes);
  }

  getBroadcastPath() {
    return this.registry.broadcast.path;
  }
}

if (require.main === module) {
  const discovery = new LaneDiscovery();

  const command = process.argv[2];
  const lane = process.argv[3];

  switch (command) {
    case 'inbox':
      console.log(discovery.getInbox(lane));
      break;
    case 'outbox':
      console.log(discovery.getOutbox(lane));
      break;
    case 'local':
      console.log(discovery.getLocalPath(lane));
      break;
    case 'repo':
      console.log(discovery.getRepo(lane));
      break;
    case 'list':
      console.log(discovery.listLanes().join('\n'));
      break;
    case 'validate':
      try {
        discovery.validatePath(lane, process.argv[4]);
        console.log('VALID');
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
      break;
    default:
      console.log('Usage: node lane-discovery.js <command> [lane] [path]');
      console.log('Commands: inbox, outbox, local, repo, list, validate');
  }
}

// Module-level singleton for backward compatibility with 16 existing importers.
// This reads the real registry on import. Tests that need a temporary registry
// should construct `new LaneDiscovery({ registryPath: tmpPath })` instead.
const _discovery = new LaneDiscovery();

function getRoots() {
  const lanes = _discovery.registry.lanes;
  const roots = {};
  for (const [id, lane] of Object.entries(lanes)) {
    roots[id] = lane.local_path;
  }
  return roots;
}

function sToLocal(winPath) {
  if (!isWin32 && winPath) {
    return winPath.replace(/^S:/, UBUNTU_ROOT).replace(/\\/g, '/');
  }
  return winPath;
}

function getAllLanes() {
  return _discovery.registry.lanes;
}

function getLane(laneId) {
  return _discovery.getLane(laneId);
}

function getLaneNames() {
  return Object.keys(_discovery.registry.lanes);
}

const LANES_RAW = _discovery.registry.lanes;

const LANES = {};
for (const [id, lane] of Object.entries(LANES_RAW)) {
  LANES[id] = {
    ...lane,
    root: lane.local_path,
    inbox: lane.mailboxes ? lane.mailboxes.inbox : undefined,
    outbox: lane.mailboxes ? lane.mailboxes.outbox : undefined,
    processed: lane.mailboxes ? lane.mailboxes.processed : undefined
  };
}

const ROOTS = getRoots();

module.exports = {
  LaneDiscovery,
  getRoots,
  sToLocal,
  getAllLanes,
  getLane,
  getLaneNames,
  LANES,
  ROOTS,
  resolveRootFromDir,
  resolveRegistryPath
};

/**
 * ORIGIN NOTE: Adapted from S:/Archivist-Agent/.global/lane-discovery.js
 * LOCAL COPY FOR ARCHIVIST LANE SOVEREIGNTY
 * Reads the same registry but avoids cross-boundary require() on .global/
 * Last sync: 2026-05-02
 */
