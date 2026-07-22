const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '.global', 'lane-registry.json');
const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// Fix branch names based on headless verification
// Verified via: ssh headless git branch --show-current
data.lanes.archivist.branch = 'master';
data.lanes.authority.branch = 'master';
data.lanes.kernel.branch = 'main';
data.lanes.swarmmind.branch = 'main'; // HEAD is on main, not master
data.lanes.library.branch = 'main';
data.lanes.control_plane.branch = 'main';
data.lanes.kucoin.branch = 'main';
data.lanes['solana-launch'].branch = 'main';

// Clarify authority lane_state - it's integrated, not archived
data.lanes.authority.lane_state = 'INTEGRATED';
data.lanes.authority.notes = 'Authority is a governance role WITHIN Archivist, not a separate operational lane. Functions continue as archivist sub-role. Lane state changed from ARCHIVED to INTEGRATED to reflect current operational reality.';

// Fix control_plane path: headless uses 'control-plane' (hyphen), not 'control_plane' (underscore)
// Verified via: ls /home/we4free/agent/repos/WE4FREE-Control-Plane/lanes/
data.lanes.control_plane.mailboxes.inbox = 'S:/WE4FREE-Control-Plane/lanes/control-plane/inbox';
data.lanes.control_plane.mailboxes.outbox = 'S:/WE4FREE-Control-Plane/lanes/control-plane/outbox';
data.lanes.control_plane.mailboxes.processed = 'S:/WE4FREE-Control-Plane/lanes/control-plane/inbox/processed';

// Add lane_state to lanes missing it (consistent with kucoin and solana-launch which already had it)
data.lanes.archivist.lane_state = 'ACTIVE';
data.lanes.kernel.lane_state = 'ACTIVE';
data.lanes.swarmmind.lane_state = 'ACTIVE';
data.lanes.library.lane_state = 'ACTIVE';
data.lanes.control_plane.lane_state = 'ACTIVE';

// Update timestamp
data.timestamp = new Date().toISOString();

fs.writeFileSync(registryPath, JSON.stringify(data, null, 2));
console.log('Registry updated successfully');