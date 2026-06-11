#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');
const { getRoots, sToLocal, LANES: _DL } = require('./util/lane-discovery');


const targets = [
  { name: 'library', inbox: sToLocal('S:/self-organizing-library/lanes/library/inbox') },
  { name: 'swarmmind', inbox: sToLocal('S:/SwarmMind/lanes/swarmmind/inbox') },
  { name: 'kernel', inbox: sToLocal('S:/kernel-lane/lanes/kernel/inbox') }
];

function makeMsg(toLane) {
  return buildCanonicalMessage({
    profile: 'default',
    task_id: 'cross-lane-mail-test-' + toLane + '-20260424',
    idempotency_key: 'test-' + toLane + '-' + Date.now(),
    from: 'archivist',
    to: toLane,
    type: 'ack',
    task_kind: 'review',
    priority: 'P2',
    subject: 'Cross-Lane Mail Test from Archivist',
    body: 'Terminal informational test message. If your lane-worker processes this to processed/, the mail pipeline is verified.',
    requires_action: false,
    payload: { content: 'mail pipeline test' },
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    lease: { owner: toLane, acquired_at: new Date().toISOString(), expires_at: new Date(Date.now()+86400000).toISOString(), renew_count: 0, max_renewals: 0 },
    retry: { attempt: 1, max_attempts: 1 },
    evidence: { required: false },
    evidence_exchange: {},
    heartbeat: { status: 'done', last_heartbeat_at: new Date().toISOString(), interval_seconds: 300, timeout_seconds: 900 },
  });
}

for (const t of targets) {
  const msg = makeMsg(t.name);
  const signed = createSignedMessage(msg, 'archivist');
  const fp = path.join(t.inbox, 'archivist-mail-test-' + t.name + '-20260424.json');
  fs.writeFileSync(fp, JSON.stringify(signed, null, 2));
  console.log(t.name + ': signed=true | key_id:', signed.key_id);
}
