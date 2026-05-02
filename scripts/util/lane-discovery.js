#!/usr/bin/env node
/**
 * LOCAL LANE DISCOVERY UTILITY
 * ORIGIN: S:/Archivist-Agent/.global/lane-discovery.js
 * LOCALIZED: Archivist (2026-05-02)
 * PURPOSE: Local implementation to avoid cross-boundary require() on .global/
 *
 * This is a sovereign copy that reads the lane registry directly
 * instead of importing from .global/ which is an external boundary.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = 'S:/Archivist-Agent/.global/lane-registry.json';

class LaneDiscovery {
  constructor() {
    this.registry = this.loadRegistry();
  }

  loadRegistry() {
    try {
      const data = fs.readFileSync(REGISTRY_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      throw new Error(`Failed to load lane registry: ${e.message}. Cannot proceed without registry.`);
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

module.exports = { LaneDiscovery };

/**
 * ORIGIN NOTE: Adapted from S:/Archivist-Agent/.global/lane-discovery.js
 * LOCAL COPY FOR ARCHIVIST LANE SOVEREIGNTY
 * Reads the same registry but avoids cross-boundary require() on .global/
 * Last sync: 2026-05-02
 */
