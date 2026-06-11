#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function safeUnlink(filePath, context) {
  try {
    fs.unlinkSync(filePath);
    return 'ok';
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[watcher] RACE_SKIPPED: ' + (context || 'file') + ' already removed by another process');
      return 'race_skipped';
    }
    throw e;
  }
}

// LEASE WRITE: Sovereign implementation for SwarmMind autonomy
// Previously depended on kernel-lane, now uses local copy to maintain lane sovereignty
const { atomicWriteWithLease } = require('./util/atomic-write');

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeWithLease(filePath, content, laneId, timeoutMs = 30000) {
  ensureParentDir(filePath);
  return atomicWriteWithLease(filePath, content, timeoutMs);
}

async function moveFileWithLease(sourcePath, destPath, laneId, timeoutMs = 30000) {
  if (!fs.existsSync(sourcePath)) {
    return { moved: false, reason: 'SOURCE_MISSING', sourcePath, destPath };
  }

  ensureParentDir(destPath);

  if (fs.existsSync(destPath)) {
    safeUnlink(sourcePath, path.basename(sourcePath));
    return { moved: false, reason: 'DEST_EXISTS_SOURCE_DROPPED', sourcePath, destPath };
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  await writeWithLease(destPath, content, laneId, timeoutMs);
  fs.unlinkSync(sourcePath);
  return { moved: true, sourcePath, destPath };
}

module.exports = {
  writeWithLease,
  moveFileWithLease,
};

