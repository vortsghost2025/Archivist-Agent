#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const SYS_STATE_PATH = path.join(__dirname, '..', 'lanes', 'broadcast', 'system_state.json');
const CONTRA_PATH = path.join(__dirname, '..', 'lanes', 'broadcast', 'contradictions.json');

function load(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

const state = load(SYS_STATE_PATH);
const contradictions = load(CONTRA_PATH);

if (!state || !contradictions) {
  console.error('[invariant] Cannot load state/contradictions — blocking consistent/aligned');
  process.exit(1);
}

const active = contradictions.filter(c => c.status === 'active');

// Hard invariant: block claims of consistent/aligned while active contradictions exist
if ((state.system_status === 'consistent' || state.system_status === 'aligned') && active.length > 0) {
  console.error('[invariant] CONSISTENCY/ALIGNMENT VIOLATION – active contradictions present:', active.map(a => a.id));
  console.error('[invariant] INVARIANT: Only heartbeat.js may write system_state.json. No auto-fix applied. Heartbeat will correct on next cycle.');
  process.exit(1);
}

console.log('[invariant] OK – no violations');
process.exit(0);
