#!/usr/bin/env node
/**
 * Load Context - Archivist lane
 * 
 * Run at session start to load previous session memory.
 */

const { getSessionMemory } = require('./src/memory/SessionMemory.js');

const memory = getSessionMemory();
const context = memory.generateContext();

console.log(context);
console.log('\n---\n');
console.log('Current session:', memory.getCurrentSession().id);
console.log('Started:', memory.getCurrentSession().started);
