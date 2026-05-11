#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LANE_DIRS = {
  archivist: 'S:/Archivist-Agent',
  kernel: 'S:/kernel-lane',
  swarmmind: 'S:/SwarmMind',
  library: 'S:/self-organizing-library'
};

const TRUST_STORE_PATH = 'S:/Archivist-Agent/lanes/broadcast/trust-store.json';

const ALGO_MAP = {
  rsa: { algorithm: 'RS256', genType: 'rsa' },
  ed25519: { algorithm: 'EdDSA', genType: 'ed25519' }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { lane: null, algorithm: 'ed25519', dryRun: false, force: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lane' && args[i + 1]) { parsed.lane = args[++i]; }
    else if (args[i] === '--algorithm' && args[i + 1]) { parsed.algorithm = args[++i]; }
    else if (args[i] === '--dry-run') { parsed.dryRun = true; }
    else if (args[i] === '--force') { parsed.force = true; }
    else if (args[i] === '--help') { parsed.help = true; }
  }
  return parsed;
}

function printHelp() {
  console.log('generate-lane-keypair.js - Generate key pairs for lanes');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/generate-lane-keypair.js --lane <lane> [--algorithm <algo>] [--dry-run] [--force]');
  console.log('');
  console.log('Options:');
  console.log('  --lane <lane>        Lane ID: archivist, kernel, swarmmind, library');
  console.log('  --algorithm <algo>   Algorithm: rsa (default: ed25519)');
  console.log('  --dry-run            Show what would happen without writing files');
  console.log('  --force              Overwrite existing keys without archiving');
  console.log('  --help               Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/generate-lane-keypair.js --lane archivist --algorithm ed25519');
  console.log('  node scripts/generate-lane-keypair.js --lane kernel --dry-run');
}

function archiveExistingKeys(identityDir, laneId, dryRun) {
  const archiveDir = path.join(identityDir, 'archive');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const stampDir = path.join(archiveDir, `rsa-to-ed25519-${timestamp}`);

  const filesToArchive = ['private.pem', 'public.pem', 'snapshot.json'];
  const archived = [];

  for (const file of filesToArchive) {
    const filePath = path.join(identityDir, file);
    if (fs.existsSync(filePath)) {
      archived.push({ file, src: filePath });
    }
  }

  if (archived.length === 0) {
    console.log('  No existing keys to archive');
    return { archiveDir: stampDir, files: [] };
  }

  console.log(`  Archiving ${archived.length} file(s) to ${stampDir}`);
  if (!dryRun) {
    fs.mkdirSync(stampDir, { recursive: true });
    for (const { file, src } of archived) {
      const dest = path.join(stampDir, file);
      fs.copyFileSync(src, dest);
      console.log(`    Archived: ${file}`);
    }
  }

  return { archiveDir: stampDir, files: archived };
}

function removeOldKeys(identityDir, dryRun) {
  const filesToRemove = ['private.pem', 'public.pem'];
  for (const file of filesToRemove) {
    const filePath = path.join(identityDir, file);
    if (fs.existsSync(filePath)) {
      if (!dryRun) {
        fs.unlinkSync(filePath);
      }
      console.log(`  Removed old: ${file}`);
    }
  }
}

function writeNewKeys(identityDir, publicKeyPem, privateKeyPem, dryRun) {
  const privPath = path.join(identityDir, 'private.pem');
  const pubPath = path.join(identityDir, 'public.pem');

  if (!dryRun) {
    fs.writeFileSync(privPath, privateKeyPem, 'utf8');
    fs.writeFileSync(pubPath, publicKeyPem, 'utf8');
  }
  console.log(`  Written: private.pem`);
  console.log(`  Written: public.pem`);
}

function updateSnapshot(identityDir, laneId, publicKeyPem, keyId, algorithm, dryRun) {
  const snapshotPath = path.join(identityDir, 'snapshot.json');
  const now = new Date().toISOString();

  const snapshot = {
    lane: laneId,
    public_key_pem: publicKeyPem + '\n',
    key_id: keyId,
    created_at: now,
    expires_at: null,
    metadata: {
      version: '4.0',
      reason: 'ed25519-migration-option-d',
      previous_algorithm: 'RS256',
      algorithm: algorithm,
      derivation_method: 'DER-SPKI-SHA256'
    },
    last_heartbeat_at: now,
    status: 'alive'
  };

  if (!dryRun) {
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  }
  console.log(`  Updated: snapshot.json (key_id: ${keyId})`);
}

function updateTrustStore(trustStorePath, laneId, newKeyId, publicKeyPem, algorithm, oldEntry, dryRun) {
  if (!fs.existsSync(trustStorePath)) {
    console.log(`  WARN: Trust store not found at ${trustStorePath}, skipping update`);
    return;
  }

  const trustStore = JSON.parse(fs.readFileSync(trustStorePath, 'utf8'));

  if (!trustStore.archived_keys) {
    trustStore.archived_keys = {};
  }

  if (oldEntry) {
    trustStore.archived_keys[oldEntry.key_id] = {
      lane_id: laneId,
      key_id: oldEntry.key_id,
      public_key_pem: oldEntry.public_key_pem,
      algorithm: oldEntry.algorithm,
      registered_at: oldEntry.registered_at,
      archived_at: new Date().toISOString(),
      archived_reason: 'ed25519-migration',
      superseded_by: newKeyId
    };
    console.log(`  Archived old key ${oldEntry.key_id} in trust store`);
  }

  trustStore[laneId] = {
    lane_id: laneId,
    key_id: newKeyId,
    public_key_pem: publicKeyPem.replace(/\n$/, ''),
    algorithm: algorithm,
    registered_at: new Date().toISOString(),
    expires_at: null,
    revoked_at: null
  };
  console.log(`  Updated active entry for ${laneId} (key_id: ${newKeyId}, algorithm: ${algorithm})`);

  if (!trustStore.rotation_policy) {
    trustStore.rotation_policy = {
      rotation_days: 90,
      warning_days: 14,
      grace_days: 7,
      last_rotated: new Date().toISOString().substring(0, 10)
    };
    console.log(`  Added rotation_policy`);
  } else {
    trustStore.rotation_policy.last_rotated = new Date().toISOString().substring(0, 10);
    console.log(`  Updated rotation_policy.last_rotated`);
  }

  if (trustStore.key_lineage?.rotations?.[laneId]) {
    const rot = trustStore.key_lineage.rotations[laneId];
    rot.previous_key_id = rot.current_key_id;
    rot.current_key_id = newKeyId;
    rot.reason = `Ed25519 migration (Option D). Previous RSA key archived.`;
    rot.rotated_at = new Date().toISOString().substring(0, 10);
    console.log(`  Updated key_lineage for ${laneId}`);
  }

  if (!dryRun) {
    fs.writeFileSync(trustStorePath, JSON.stringify(trustStore, null, 2) + '\n', 'utf8');
  }
}

function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (!opts.lane) {
    console.error('ERROR: --lane is required. Use --help for usage.');
    process.exit(1);
  }

  const laneId = opts.lane.toLowerCase();
  if (!LANE_DIRS[laneId]) {
    console.error(`ERROR: Unknown lane '${laneId}'. Valid: ${Object.keys(LANE_DIRS).join(', ')}`);
    process.exit(1);
  }

  const algoLower = opts.algorithm.toLowerCase();
  if (!ALGO_MAP[algoLower]) {
    console.error(`ERROR: Unknown algorithm '${algoLower}'. Valid: rsa, ed25519`);
    process.exit(1);
  }

  const algoInfo = ALGO_MAP[algoLower];
  const laneDir = LANE_DIRS[laneId];
  const identityDir = path.join(laneDir, '.identity');

  if (!fs.existsSync(identityDir)) {
    console.error(`ERROR: Identity directory not found: ${identityDir}`);
    process.exit(1);
  }

  console.log(`=== Generating ${algoLower} keypair for lane: ${laneId} ===`);
  console.log(`  Identity dir: ${identityDir}`);
  console.log(`  Algorithm: ${algoInfo.algorithm}`);
  if (opts.dryRun) console.log(`  DRY RUN - no files will be written`);
  console.log('');

  const helpersPath = path.join(laneDir, '.global', 'algorithm-helpers.js');
  let generateKeyPair;
  if (fs.existsSync(helpersPath)) {
    const helpers = require(helpersPath);
    generateKeyPair = helpers.generateKeyPair;
  } else {
    const archivistHelpers = path.join('S:/Archivist-Agent/.global/algorithm-helpers.js');
    if (fs.existsSync(archivistHelpers)) {
      const helpers = require(archivistHelpers);
      generateKeyPair = helpers.generateKeyPair;
    } else {
      console.error('ERROR: algorithm-helpers.js not found. Run from Archivist-Agent or ensure .global/ is synced.');
      process.exit(1);
    }
  }

  const deriveKeyIdPath = path.join(laneDir, '.global', 'deriveKeyId.js');
  let deriveKeyId;
  const archivistDeriveKeyPath = path.join('S:/Archivist-Agent/.global/deriveKeyId.js');
  if (fs.existsSync(deriveKeyIdPath)) {
    deriveKeyId = require(deriveKeyIdPath).deriveKeyId;
  } else if (fs.existsSync(archivistDeriveKeyPath)) {
    deriveKeyId = require(archivistDeriveKeyPath).deriveKeyId;
  } else {
    console.error('ERROR: deriveKeyId.js not found.');
    process.exit(1);
  }

  const oldEntry = JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'))[laneId] || null;
  if (oldEntry) {
    console.log(`  Current trust store key: ${oldEntry.key_id} (${oldEntry.algorithm})`);
  }

  console.log('');
  console.log('Step 1: Archive existing keys');
  const { archiveDir } = archiveExistingKeys(identityDir, laneId, opts.dryRun);

  console.log('');
  console.log('Step 2: Remove old key files');
  removeOldKeys(identityDir, opts.dryRun);

  console.log('');
  console.log('Step 3: Generate new key pair');
  const { publicKey, privateKey } = generateKeyPair(algoLower);
  console.log(`  Generated ${algoLower} key pair`);

  const publicKeyPem = publicKey;
  const privateKeyPem = privateKey;

  console.log('');
  console.log('Step 4: Derive key_id');
  const keyId = deriveKeyId(publicKeyPem);
  console.log(`  New key_id: ${keyId}`);

  console.log('');
  console.log('Step 5: Write new key files');
  writeNewKeys(identityDir, publicKeyPem, privateKeyPem, opts.dryRun);

  console.log('');
  console.log('Step 6: Update snapshot.json');
  updateSnapshot(identityDir, laneId, publicKeyPem, keyId, algoInfo.algorithm, opts.dryRun);

  console.log('');
  console.log('Step 7: Update trust-store.json');
  updateTrustStore(TRUST_STORE_PATH, laneId, keyId, publicKeyPem, algoInfo.algorithm, oldEntry, opts.dryRun);

  console.log('');
  console.log('Step 8: Verify new keys can be loaded');
  if (!opts.dryRun) {
    const crypto = require('crypto');
    try {
      const privKey = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem' });
      const pubKey = crypto.createPublicKey({ key: publicKeyPem, format: 'pem' });
      console.log(`  Private key type: ${privKey.asymmetricKeyType}`);
      console.log(`  Public key type: ${pubKey.asymmetricKeyType}`);

      const testData = Buffer.from('ed25519-migration-test');
      const signAlg = privKey.asymmetricKeyType === 'ed25519' ? null : 'RSA-SHA256';
      const sig = signAlg ? crypto.sign(signAlg, testData, privKey) : crypto.sign(null, testData, privKey);
      console.log(`  Signature created: ${sig.length} bytes`);

      const verified = signAlg
        ? crypto.verify(signAlg, testData, pubKey, sig)
        : crypto.verify(null, testData, pubKey, sig);
      console.log(`  Signature verified: ${verified}`);

      if (!verified) {
        console.error('ERROR: Signature verification failed!');
        process.exit(1);
      }
    } catch (err) {
      console.error(`  ERROR: Key verification failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log('  (skipped in dry-run)');
  }

  console.log('');
  console.log(`=== ${opts.dryRun ? 'DRY RUN COMPLETE' : 'DONE'} ===`);
  console.log(`  Lane: ${laneId}`);
  console.log(`  Algorithm: ${algoInfo.algorithm}`);
  console.log(`  New key_id: ${keyId}`);
  if (!opts.dryRun && oldEntry) {
    console.log(`  Old key_id: ${oldEntry.key_id} (archived)`);
  }
  console.log(`  Archive: ${archiveDir}`);
}

main();
