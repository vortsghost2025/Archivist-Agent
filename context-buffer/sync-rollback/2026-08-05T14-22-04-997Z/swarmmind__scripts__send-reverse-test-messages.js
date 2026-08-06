#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { buildCanonicalMessage, createSignedMessage } = require('./create-signed-message');
const { getRoots, sToLocal, LANES: _DL } = require('./util/lane-discovery');

const archInbox = sToLocal('S:/Archivist-Agent/lanes/archivist/inbox');

const lanes = [
  { name: 'library', dir: getRoots()['library'] },
  { name: 'swarmmind', dir: getRoots()['swarmmind'] },
  { name: 'kernel', dir: getRoots()['kernel'] }
];

for (const lane of lanes) {
  const msg = buildCanonicalMessage({
    profile: 'default',
    task_id: lane.name + '-to-archivist-mail-test-20260424',
    idempotency_key: lane.name + '-archivist-test-' + Date.now(),
    from: lane.name,
    to: 'archivist',
    type: 'ack',
    task_kind: 'review',
    priority: 'P2',
    subject: 'Mail Test from ' + lane.name + ' to Archivist',
    body: 'Cross-lane mail pipeline test. Signed with new keypair. Terminal informational.',
    requires_action: false,
    payload: { content: 'mail pipeline test' },
    execution: { mode: 'manual', engine: 'opencode', actor: 'lane' },
    lease: { owner: 'archivist', acquired_at: new Date().toISOString(), expires_at: new Date(Date.now()+86400000).toISOString(), renew_count: 0, max_renewals: 0 },
    retry: { attempt: 1, max_attempts: 1 },
    evidence: { required: false },
    evidence_exchange: {},
    heartbeat: { status: 'done', last_heartbeat_at: new Date().toISOString(), interval_seconds: 300, timeout_seconds: 900 }
  });

  const signed = createSignedMessage(msg, lane.name);
  const fp = path.join(archInbox, lane.name + '-to-archivist-mail-test-20260424.json');
  fs.writeFileSync(fp, JSON.stringify(signed, null, 2));
  console.log(lane.name + ' -> archivist: signed=true | key_id:', signed.key_id);
}
