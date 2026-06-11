#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { getRoots, sToLocal, LANES: _DL } = require('./util/lane-discovery');


const LANES = [
  { name: 'archivist', dir: getRoots()['archivist'] },
  { name: 'kernel', dir: getRoots()['kernel'] },
  { name: 'library', dir: getRoots()['library'] },
  { name: 'swarmmind', dir: getRoots()['swarmmind'] }
];

const SUBDIRS_TO_REMOVE = ['processed', 'expired', 'quarantine', 'invalid-schema', 'pending', 'duplicates', 'unsigned', 'unsigned-archive'];

for (const lane of LANES) {
  for (const box of ['inbox', 'outbox']) {
    const boxDir = path.join(lane.dir, 'lanes', lane.name, box);
    if (!fs.existsSync(boxDir)) continue;

    // Remove all subdirs
    for (const sub of SUBDIRS_TO_REMOVE) {
      const subDir = path.join(boxDir, sub);
      if (fs.existsSync(subDir)) {
        fs.rmSync(subDir, { recursive: true, force: true });
      }
    }

    // Remove all .json files from inbox/outbox root
    const rootFiles = fs.readdirSync(boxDir).filter(f => f.endsWith('.json'));
    for (const f of rootFiles) {
      fs.unlinkSync(path.join(boxDir, f));
    }

    // Recreate empty processed/ and quarantine/ dirs (lane-worker expects them)
    const procDir = path.join(boxDir, 'processed');
    const quarDir = path.join(boxDir, 'quarantine');
    if (!fs.existsSync(procDir)) fs.mkdirSync(procDir, { recursive: true });
    if (!fs.existsSync(quarDir)) fs.mkdirSync(quarDir, { recursive: true });

    const remaining = fs.readdirSync(boxDir);
    console.log(lane.name + '/' + box + ': cleared. remaining: ' + remaining.join(', '));
  }
}

console.log('\nAll lanes cleared. Empty inbox/outbox with processed/ and quarantine/ dirs ready.');
