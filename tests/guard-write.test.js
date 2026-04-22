#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { guardWrite, validateOutboxMessage } = require('../scripts/outbox-write-guard');

function expectThrows(fn, code) {
  let thrown = false;
  try {
    fn();
  } catch (err) {
    thrown = true;
    if (code) assert.strictEqual(err.code, code);
  }
  assert.strictEqual(thrown, true, 'expected function to throw');
}

function validMessage() {
  return {
    id: 'guard-test-001',
    from: 'archivist',
    signature: 'header.payload.signature0123456789',
    key_id: '1234567890abcdef',
    lease: {
      owner: 'archivist',
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString()
    }
  };
}

function run() {
  const good = validMessage();
  const check = validateOutboxMessage(good);
  assert.strictEqual(check.valid, true, 'baseline message must validate');

  expectThrows(() => guardWrite({ ...good, signature: '' }, 'S:/Archivist-Agent/lanes/archivist/outbox', 'bad-signature.json'), 'OUTBOX_GUARD_REJECTED');
  expectThrows(() => guardWrite({ ...good, lease: null }, 'S:/Archivist-Agent/lanes/archivist/outbox', 'missing-lease.json'), 'OUTBOX_GUARD_REJECTED');

  console.log('PASS guard-write.test.js');
}

if (require.main === module) {
  run();
}

module.exports = { run };

