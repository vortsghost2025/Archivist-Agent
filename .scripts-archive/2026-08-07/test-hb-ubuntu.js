'use strict';
const path = require('path');
const { Heartbeat } = require(path.join(__dirname, 'heartbeat.js'));

const lanes = ['archivist', 'authority'];
for (const lane of lanes) {
  const inbox = path.join(__dirname, '..', 'lanes', lane, 'inbox');
  const h = new Heartbeat({ laneName: lane, inboxPath: inbox });
  h.writeHeartbeat();
}

const fs = require('fs');
for (const lane of lanes) {
  const hbPath = path.join(__dirname, '..', 'lanes', lane, 'inbox', 'heartbeat-' + lane + '.json');
  try {
    const j = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
    console.log(lane + ': identity_status=' + j.identity_status + ' key_id=' + j.key_id + ' sig=' + (j.signature ? 'present' : 'null'));
  } catch (e) {
    console.log(lane + ': ERROR reading heartbeat: ' + e.message);
  }
}
