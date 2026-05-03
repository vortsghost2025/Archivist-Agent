// quarantine-remediate.js - Fix 6 quarantine items to v1.3 schema compliance
const fs = require('fs');
const path = require('path');

const Q_DIR = 'S:/Archivist-Agent/lanes/archivist/inbox/quarantine';
const ARCHIVE_DIR = path.join(Q_DIR, 'archived-legacy');
const NOW = new Date().toISOString();

function defaultLease() {
  return { owner: null, acquired_at: null, expires_at: null, renew_count: 0, max_renewals: 3 };
}
function defaultRetry() {
  return { attempt: 1, max_attempts: 3, last_error: null, last_attempt_at: null };
}
function defaultEvidenceExchange(artifactPath, artifactType) {
  return {
    artifact_path: artifactPath || '',
    artifact_type: artifactType || 'report',
    delivered_at: NOW
  };
}

const fixes = {
  'archivist-final-summary-20260501T173000Z.json': (msg) => {
    msg.type = 'status';
    msg.task_kind = 'report';
    msg.lease = msg.lease || defaultLease();
    msg.retry = msg.retry || defaultRetry();
    msg._remediated_at = NOW;
    msg._remediation = { fixes: ['type:finding->status','task_kind->report','added lease','added retry'] };
    return msg;
  },
  'archivist-health-summary-20260501T172000Z.json': (msg) => {
    msg.type = 'status';
    msg.task_kind = 'report';
    msg.lease = msg.lease || defaultLease();
    msg.retry = msg.retry || defaultRetry();
    msg._remediated_at = NOW;
    msg._remediation = { fixes: ['type:finding->status','task_kind->report','added lease','added retry'] };
    return msg;
  },
  'archivist-verification-record-1777652256767.json': (msg) => {
    msg.type = 'response';
    msg.task_kind = 'report';
    msg.lease = msg.lease || defaultLease();
    msg.retry = msg.retry || defaultRetry();
    msg.evidence_exchange = msg.evidence_exchange || defaultEvidenceExchange(
      'S:/kernel-lane/evidence/graph-snapshots/', 'report'
    );
    msg._remediated_at = NOW;
    msg._remediation = { fixes: ['task_kind:verification->report','added lease','added retry','added evidence_exchange'] };
    return msg;
  },
  'site-index-verification-20260501-1430.json': (msg) => {
    msg.type = 'response';
    msg.task_kind = 'report';
    msg.lease = msg.lease || defaultLease();
    msg.retry = msg.retry || defaultRetry();
    msg.evidence_exchange = msg.evidence_exchange || defaultEvidenceExchange(
      msg.evidence.evidence_path || 'S:/SwarmMind/data/site-index.json', 'report'
    );
    msg._remediated_at = NOW;
    msg._remediation = { fixes: ['task_kind:verification->report','added lease','added retry','added evidence_exchange'] };
    return msg;
  }
};

// Items that need "to: all" fan-out
const fanoutItems = {
  'kernel-final-summary-20260501T154000.json': 'kernel',
  'swarmmind-status-update-20260501-1650.json': 'swarmmind'
};

const LANES = ['archivist', 'library', 'swarmmind', 'kernel'];
const LANE_INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
  kernel: 'S:/kernel-lane/lanes/kernel/inbox'
};

function fanOutTo(msg, sourceLane, originalFile) {
  const results = [];
  for (const lane of LANES) {
    const copy = JSON.parse(JSON.stringify(msg));
    copy.to = lane;
    copy.lease = copy.lease || defaultLease();
    copy.retry = copy.retry || defaultRetry();
    copy._remediated_at = NOW;
    copy._remediation = { 
      fixes: [`to:all->${lane} fanout from ${sourceLane}`,'added lease','added retry'],
      source_file: originalFile
    };
    copy.delivery_verification = copy.delivery_verification || { verified: false, verified_at: null, retries: 0 };
    
    // Write to quarantine as corrected copy, NOT to target lane inbox (this is just schema remediation)
    const outName = originalFile.replace('.json', `-fanout-${lane}.json`);
    const outPath = path.join(Q_DIR, outName);
    fs.writeFileSync(outPath, JSON.stringify(copy, null, 2));
    results.push({ lane, file: outName });
  }
  return results;
}

function main() {
  const report = { remediated: [], fanouts: [], archived: [], errors: [] };

  // 1. Fix simple schema issues
  for (const [file, fixFn] of Object.entries(fixes)) {
    const filePath = path.join(Q_DIR, file);
    if (!fs.existsSync(filePath)) {
      report.errors.push(`Not found: ${file}`);
      continue;
    }
    try {
      const original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Remove lane_worker routing metadata for cleanliness
      delete original._lane_worker;
      delete original.execution_verified;
      delete original.would_verify;
      
      const fixed = fixFn(original);
      
      // Write corrected version back to quarantine (in-place remediation)
      const correctedPath = path.join(Q_DIR, file.replace('.json', '-remediated.json'));
      fs.writeFileSync(correctedPath, JSON.stringify(fixed, null, 2));
      
      // Move original to archive
      const archivePath = path.join(ARCHIVE_DIR, file);
      fs.renameSync(filePath, archivePath);
      
      report.remediated.push({ file, corrected: file.replace('.json', '-remediated.json') });
    } catch (e) {
      report.errors.push(`${file}: ${e.message}`);
    }
  }

  // 2. Fan-out "to: all" items
  for (const [file, sourceLane] of Object.entries(fanoutItems)) {
    const filePath = path.join(Q_DIR, file);
    if (!fs.existsSync(filePath)) {
      report.errors.push(`Fanout not found: ${file}`);
      continue;
    }
    try {
      const original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      delete original._lane_worker;
      delete original.execution_verified;
      delete original.would_verify;
      
      const results = fanOutTo(original, sourceLane, file);
      report.fanouts.push({ file, copies: results });
      
      // Move original to archive
      const archivePath = path.join(ARCHIVE_DIR, file);
      fs.renameSync(filePath, archivePath);
    } catch (e) {
      report.errors.push(`Fanout ${file}: ${e.message}`);
    }
  }

  // 3. Archive ping test artifact
  const pingFile = path.join(Q_DIR, 'ping-swarmmind-1777737292080.json');
  if (fs.existsSync(pingFile)) {
    const pingArchive = path.join(ARCHIVE_DIR, 'ping-swarmmind-1777737292080.json');
    fs.renameSync(pingFile, pingArchive);
    report.archived.push('ping-swarmmind-1777737292080.json (test artifact)');
  }

  // 4. Write remediation report
  const reportPath = path.join(Q_DIR, 'remediation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(JSON.stringify(report, null, 2));
}

main();