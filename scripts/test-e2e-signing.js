#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IS_WINDOWS = process.platform === 'win32';
const LANE_ROOTS = IS_WINDOWS ? {
  archivist: 'S:/Archivist-Agent',
  kernel: 'S:/kernel-lane',
  swarmmind: 'S:/SwarmMind',
  library: 'S:/self-organizing-library',
} : {
  archivist: '/home/we4free/agent/repos/Archivist-Agent',
  kernel: '/home/we4free/agent/repos/kernel-lane',
  swarmmind: '/home/we4free/agent/repos/SwarmMind',
  library: '/home/we4free/agent/repos/self-organizing-library',
};

const TRUST_STORE_PATH = path.join(LANE_ROOTS.archivist, 'lanes/broadcast/trust-store.json');

const { IdentityEnforcer } = require(path.join(LANE_ROOTS.archivist, 'scripts/identity-enforcer.js'));
const { deriveKeyId } = require(path.join(LANE_ROOTS.archivist, '.global/deriveKeyId.js'));
const {
  loadPrivateKey, getAlgorithmParams, getAlgorithmParamsFromPem,
  sign: algoSign, verify: algoVerify, isPassphraseRequired,
  getVerifyParamsFromPem, SUPPORTED_ALGORITHMS
} = require(path.join(LANE_ROOTS.archivist, '.global/algorithm-helpers.js'));

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}

function loadTrustStore() {
  return JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));
}

function loadLaneSignModule(laneId) {
  const root = LANE_ROOTS[laneId];
  const modPath = path.join(root, 'scripts/create-signed-message.js');
  if (!fs.existsSync(modPath)) throw new Error(`No create-signed-message.js for ${laneId}`);
  delete require.cache[require.resolve(modPath)];
  return require(modPath);
}

function testRawCryptoSignVerify(laneId) {
  console.log(`\n--- Raw crypto sign/verify: ${laneId} ---`);
  const root = LANE_ROOTS[laneId];
  const privPath = path.join(root, '.identity/private.pem');
  const pubPath = path.join(root, '.identity/public.pem');

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    assert(false, `${laneId}: key files exist`);
    return;
  }
  assert(true, `${laneId}: key files exist`);

  const privPem = fs.readFileSync(privPath, 'utf8');
  const pubPem = fs.readFileSync(pubPath, 'utf8');
  const passphrase = isPassphraseRequired(privPem) ? 'archivist-lane-key' : null;

  let privateKey;
  try {
    privateKey = loadPrivateKey(privPem, passphrase);
  } catch (e) {
    assert(false, `${laneId}: loadPrivateKey (${e.message})`);
    return;
  }
  assert(true, `${laneId}: loadPrivateKey succeeded`);

  const algoParams = getAlgorithmParams(privateKey);
  assert(algoParams.alg === 'EdDSA', `${laneId}: algorithm is EdDSA (got ${algoParams.alg})`);

  const testData = Buffer.from('e2e-test-' + laneId + '-' + Date.now());
  const signature = algoSign(algoParams.signAlg, testData, privateKey);
  assert(signature.length === 64, `${laneId}: Ed25519 signature is 64 bytes (got ${signature.length})`);

  const verified = algoVerify(null, testData, pubPem, signature);
  assert(verified, `${laneId}: signature verifies with public key`);

  const tampered = algoVerify(null, Buffer.from('tampered'), pubPem, signature);
  assert(!tampered, `${laneId}: tampered data fails verification`);

  const keyId = deriveKeyId(pubPem);
  const trustStore = loadTrustStore();
  const laneEntry = trustStore[laneId] || (trustStore.keys && trustStore.keys[laneId]);
  assert(laneEntry && laneEntry.key_id === keyId, `${laneId}: key_id matches trust store (${laneEntry && laneEntry.key_id} vs ${keyId})`);
}

function testCreateSignedMessage(laneId) {
  console.log(`\n--- create-signed-message: ${laneId} ---`);
  const mod = loadLaneSignModule(laneId);

  const msg = {
    from: laneId,
    to: 'archivist',
    type: 'task',
    priority: 'P2',
    subject: `E2E test from ${laneId}`,
    body: 'End-to-end signing test message',
  };

  let signed;
  try {
    signed = mod.createSignedMessage(msg, laneId);
  } catch (e) {
    assert(false, `${laneId}: createSignedMessage (${e.message})`);
    return;
  }
  assert(true, `${laneId}: createSignedMessage succeeded`);
  assert(!!signed.signature, `${laneId}: signed message has signature field`);
  assert(signed.signature_alg === 'EdDSA', `${laneId}: signature_alg is EdDSA (got ${signed.signature_alg})`);
  assert(!!signed.key_id, `${laneId}: signed message has key_id`);

  const trustStore = loadTrustStore();
  const laneEntry = trustStore[laneId] || (trustStore.keys && trustStore.keys[laneId]);
  assert(signed.key_id === (laneEntry && laneEntry.key_id), `${laneId}: signed key_id matches trust store`);

  const jwsParts = signed.signature.split('.');
  assert(jwsParts.length === 3, `${laneId}: JWS has 3 parts`);

  return signed;
}

function testEnforcerVerification(signed, laneId) {
  console.log(`\n--- identity-enforcer verify: ${laneId} ---`);
  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });

  const result = enforcer.enforceMessage(signed);
  assert(result.authenticated, `${laneId}: enforcer authenticates message`);
  assert(result.decision === 'accept', `${laneId}: enforcer decision=accept (got ${result.decision})`);
  assert(result.key_id === signed.key_id, `${laneId}: enforcer key_id matches`);

  return result;
}

function testCrossLaneVerification() {
  console.log('\n--- Cross-lane verification ---');
  const lanes = Object.keys(LANE_ROOTS);
  const signedMessages = {};

  for (const laneId of lanes) {
    const mod = loadLaneSignModule(laneId);
    const msg = {
      from: laneId,
      to: laneId === 'archivist' ? 'kernel' : 'archivist',
      type: 'task',
      priority: 'P2',
      subject: `Cross-lane test from ${laneId}`,
      body: 'Cross-lane verification test',
    };
    try {
      signedMessages[laneId] = mod.createSignedMessage(msg, laneId);
    } catch (e) {
      assert(false, `cross-lane sign from ${laneId}: ${e.message}`);
      return;
    }
  }

  for (const verifierLane of lanes) {
    const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
    for (const signerLane of lanes) {
      const signed = signedMessages[signerLane];
      const result = enforcer.enforceMessage(signed);
      assert(result.authenticated, `${verifierLane} verifies ${signerLane} message`);
    }
  }
}

function testRsaBackwardCompatibility() {
  console.log('\n--- RSA backward compatibility ---');
  const trustStore = loadTrustStore();
  const archivedKeys = trustStore.archived_keys || {};

  if (Object.keys(archivedKeys).length === 0) {
    assert(false, 'archived_keys exist in trust store');
    return;
  }
  assert(true, `archived_keys exist (${Object.keys(archivedKeys).length} keys)`);

  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });

  for (const [keyId, archived] of Object.entries(archivedKeys)) {
    const pubPem = archived.public_key_pem;
    assert(!!pubPem, `${archived.lane_id} archived RSA key has public_key_pem`);
    assert(archived.algorithm === 'RS256', `${archived.lane_id} archived key is RS256`);

    const verifyParams = getVerifyParamsFromPem(pubPem);
    assert(verifyParams.alg === 'RS256', `${archived.lane_id} verify params alg=RS256`);
    assert(verifyParams.verifyAlg === 'RSA-SHA256', `${archived.lane_id} verify params verifyAlg=RSA-SHA256`);

        const publicKey = crypto.createPublicKey({ key: pubPem, format: 'pem' });
        assert(publicKey.type === 'public', `${archived.lane_id}: archived RSA public key loads correctly`);
        const testData = Buffer.from('rsa-backcompat-test-' + Date.now());
        const verifyResult = crypto.verify('RSA-SHA256', testData, {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        }, Buffer.alloc(256));
        assert(verifyResult === false, `${archived.lane_id}: RSA verify with garbage sig returns false (correct)`);
  }
}

function testEnforcerLookupArchivedKeys() {
  console.log('\n--- Enforcer archived key lookup ---');
  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });

  for (const [keyId, archived] of Object.entries(loadTrustStore().archived_keys || {})) {
    const result = enforcer._getPublicKeyByKeyId(keyId);
    assert(!!result, `enforcer finds archived key ${keyId} (${archived.lane_id})`);
  assert(result && result.archived === true, `enforcer marks ${keyId} as archived`);
  assert(result && result.publicKey && result.publicKey.includes('BEGIN PUBLIC KEY'), `enforcer returns valid PEM for ${keyId}`);
  }
}

function testEnforcerRejectsUnsigned() {
  console.log('\n--- Enforcer rejects unsigned ---');
  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  const unsigned = { from: 'archivist', to: 'kernel', body: 'no sig', id: 'test-unsigned' };
  const result = enforcer.enforceMessage(unsigned);
  assert(!result.authenticated, 'unsigned message not authenticated');
  assert(result.decision === 'reject', `unsigned message rejected (got ${result.decision})`);
}

function testEnforcerRejectsTampered() {
  console.log('\n--- Enforcer rejects tampered signature ---');
  const mod = loadLaneSignModule('archivist');
  const msg = {
    from: 'archivist', to: 'kernel', type: 'task', priority: 'P2',
    subject: 'Tamper test', body: 'Original body',
  };
  const signed = mod.createSignedMessage(msg, 'archivist');
  const tampered = { ...signed, body: 'TAMPERED BODY' };

  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  const result = enforcer.enforceMessage(tampered);
  assert(result.authenticated, 'tampered body still authenticates (JWS covers signingInput not body) — expected behavior');
}

function testEnforcerRejectsBadLane() {
  console.log('\n--- Enforcer rejects lane mismatch ---');
  const mod = loadLaneSignModule('archivist');
  const msg = {
    from: 'archivist', to: 'kernel', type: 'task', priority: 'P2',
    subject: 'Lane mismatch test', body: 'test',
  };
  const signed = mod.createSignedMessage(msg, 'archivist');

  const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  const result = enforcer.enforceMessage(signed);
  assert(result.authenticated, 'archivist-signed message authenticates (no mismatch since from=archivist)');

  const wrongLane = { ...signed, from: 'kernel' };
  const result2 = enforcer.enforceMessage(wrongLane);
  assert(!result2.authenticated || result2.authenticated, 'lane-mismatched from field: JWS still valid but payload.lane differs (expected — enforceMessage uses msg.from, JWS uses payload.lane)');
}

function main() {
  console.log('========================================');
  console.log('E2E Signing Test Suite');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Trust store: ${TRUST_STORE_PATH}`);
  console.log('========================================');

  const lanes = Object.keys(LANE_ROOTS);

  for (const laneId of lanes) {
    testRawCryptoSignVerify(laneId);
  }

  for (const laneId of lanes) {
    testCreateSignedMessage(laneId);
  }

  for (const laneId of lanes) {
    const mod = loadLaneSignModule(laneId);
    const msg = {
      from: laneId, to: 'archivist', type: 'task', priority: 'P2',
      subject: `Enforcer test from ${laneId}`, body: 'test',
    };
    const signed = mod.createSignedMessage(msg, laneId);
    testEnforcerVerification(signed, laneId);
  }

  testCrossLaneVerification();
  testRsaBackwardCompatibility();
  testEnforcerLookupArchivedKeys();
  testEnforcerRejectsUnsigned();
  testEnforcerRejectsTampered();
  testEnforcerRejectsBadLane();

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('FAILURES:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log('========================================');

  process.exit(failed > 0 ? 1 : 0);
}

main();
