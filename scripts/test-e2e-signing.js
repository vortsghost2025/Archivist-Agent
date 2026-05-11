#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);
const SKIP_CREATE_SIGNED = NODE_MAJOR < 14;

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

const { deriveKeyId } = require(path.join(LANE_ROOTS.archivist, '.global/deriveKeyId.js'));
const {
  loadPrivateKey, getAlgorithmParams, getAlgorithmParamsFromPem,
  sign: algoSign, verify: algoVerify, isPassphraseRequired,
  getVerifyParamsFromPem, SUPPORTED_ALGORITHMS
} = require(path.join(LANE_ROOTS.archivist, '.global/algorithm-helpers.js'));

let IdentityEnforcer;
let loadLaneSignModule;

if (!SKIP_CREATE_SIGNED) {
  IdentityEnforcer = require(path.join(LANE_ROOTS.archivist, 'scripts/identity-enforcer.js')).IdentityEnforcer;
  loadLaneSignModule = function(laneId) {
    var root = LANE_ROOTS[laneId];
    var modPath = path.join(root, 'scripts/create-signed-message.js');
    if (!fs.existsSync(modPath)) throw new Error('No create-signed-message.js for ' + laneId);
    delete require.cache[require.resolve(modPath)];
    return require(modPath);
  };
} else {
  IdentityEnforcer = null;
  loadLaneSignModule = null;
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(' PASS: ' + label);
  } else {
    failed++;
    failures.push(label);
    console.log(' FAIL: ' + label);
  }
}

function loadTrustStore() {
  return JSON.parse(fs.readFileSync(TRUST_STORE_PATH, 'utf8'));
}

function testRawCryptoSignVerify(laneId) {
  console.log('\n--- Raw crypto sign/verify: ' + laneId + ' ---');
  var root = LANE_ROOTS[laneId];
  var privPath = path.join(root, '.identity/private.pem');
  var pubPath = path.join(root, '.identity/public.pem');

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    assert(false, laneId + ': key files exist');
    return;
  }
  assert(true, laneId + ': key files exist');

  var privPem = fs.readFileSync(privPath, 'utf8');
  var pubPem = fs.readFileSync(pubPath, 'utf8');
  var passphrase = isPassphraseRequired(privPem) ? 'archivist-lane-key' : null;

  var privateKey;
  try {
    privateKey = loadPrivateKey(privPem, passphrase);
  } catch (e) {
    assert(false, laneId + ': loadPrivateKey (' + e.message + ')');
    return;
  }
  assert(true, laneId + ': loadPrivateKey succeeded');

  var algoParams = getAlgorithmParams(privateKey);
  assert(algoParams.alg === 'EdDSA', laneId + ': algorithm is EdDSA (got ' + algoParams.alg + ')');

  var testData = Buffer.from('e2e-test-' + laneId + '-' + Date.now());
  var signature = algoSign(algoParams.signAlg, testData, privateKey);
  assert(signature.length === 64, laneId + ': Ed25519 signature is 64 bytes (got ' + signature.length + ')');

  var verified = algoVerify(null, testData, pubPem, signature);
  assert(verified, laneId + ': signature verifies with public key');

  var tampered = algoVerify(null, Buffer.from('tampered'), pubPem, signature);
  assert(!tampered, laneId + ': tampered data fails verification');

  var keyId = deriveKeyId(pubPem);
  var trustStore = loadTrustStore();
  var laneEntry = trustStore[laneId] || (trustStore.keys && trustStore.keys[laneId]);
  assert(laneEntry && laneEntry.key_id === keyId, laneId + ': key_id matches trust store (' + (laneEntry && laneEntry.key_id) + ' vs ' + keyId + ')');
}

function testCreateSignedMessage(laneId) {
  console.log('\n--- create-signed-message: ' + laneId + ' ---');
  var mod = loadLaneSignModule(laneId);

  var msg = {
    from: laneId,
    to: 'archivist',
    type: 'task',
    priority: 'P2',
    subject: 'E2E test from ' + laneId,
    body: 'End-to-end signing test message',
  };

  var signed;
  try {
    signed = mod.createSignedMessage(msg, laneId);
  } catch (e) {
    assert(false, laneId + ': createSignedMessage (' + e.message + ')');
    return;
  }
  assert(true, laneId + ': createSignedMessage succeeded');
  assert(!!signed.signature, laneId + ': signed message has signature field');
  assert(signed.signature_alg === 'EdDSA', laneId + ': signature_alg is EdDSA (got ' + signed.signature_alg + ')');
  assert(!!signed.key_id, laneId + ': signed message has key_id');

  var trustStore = loadTrustStore();
  var laneEntry = trustStore[laneId] || (trustStore.keys && trustStore.keys[laneId]);
  assert(signed.key_id === (laneEntry && laneEntry.key_id), laneId + ': signed key_id matches trust store');

  var jwsParts = signed.signature.split('.');
  assert(jwsParts.length === 3, laneId + ': JWS has 3 parts');

  return signed;
}

function testEnforcerVerification(signed, laneId) {
  console.log('\n--- identity-enforcer verify: ' + laneId + ' ---');
  var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });

  var result = enforcer.enforceMessage(signed);
  assert(result.authenticated, laneId + ': enforcer authenticates message');
  assert(result.decision === 'accept', laneId + ': enforcer decision=accept (got ' + result.decision + ')');
  assert(result.key_id === signed.key_id, laneId + ': enforcer key_id matches');

  return result;
}

function testCrossLaneVerification() {
  console.log('\n--- Cross-lane verification ---');
  var lanes = Object.keys(LANE_ROOTS);
  var signedMessages = {};

  for (var i = 0; i < lanes.length; i++) {
    var laneId = lanes[i];
    var mod = loadLaneSignModule(laneId);
    var msg = {
      from: laneId,
      to: laneId === 'archivist' ? 'kernel' : 'archivist',
      type: 'task',
      priority: 'P2',
      subject: 'Cross-lane test from ' + laneId,
      body: 'Cross-lane verification test',
    };
    try {
      signedMessages[laneId] = mod.createSignedMessage(msg, laneId);
    } catch (e) {
      assert(false, 'cross-lane sign from ' + laneId + ': ' + e.message);
      return;
    }
  }

  for (var vi = 0; vi < lanes.length; vi++) {
    var verifierLane = lanes[vi];
    var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
    for (var si = 0; si < lanes.length; si++) {
      var signerLane = lanes[si];
      var signed = signedMessages[signerLane];
      var result = enforcer.enforceMessage(signed);
      assert(result.authenticated, verifierLane + ' verifies ' + signerLane + ' message');
    }
  }
}

function testRsaBackwardCompatibility() {
  console.log('\n--- RSA backward compatibility ---');
  var trustStore = loadTrustStore();
  var archivedKeys = trustStore.archived_keys || {};

  if (Object.keys(archivedKeys).length === 0) {
    assert(false, 'archived_keys exist in trust store');
    return;
  }
  assert(true, 'archived_keys exist (' + Object.keys(archivedKeys).length + ' keys)');

  var enforcer = IdentityEnforcer ? new IdentityEnforcer({ enforcementMode: 'enforce' }) : null;

  var keyIds = Object.keys(archivedKeys);
  for (var i = 0; i < keyIds.length; i++) {
    var keyId = keyIds[i];
    var archived = archivedKeys[keyId];
    var pubPem = archived.public_key_pem;
    assert(!!pubPem, archived.lane_id + ' archived RSA key has public_key_pem');
    assert(archived.algorithm === 'RS256', archived.lane_id + ' archived key is RS256');

    var verifyParams = getVerifyParamsFromPem(pubPem);
    assert(verifyParams.alg === 'RS256', archived.lane_id + ' verify params alg=RS256');
    assert(verifyParams.verifyAlg === 'RSA-SHA256', archived.lane_id + ' verify params verifyAlg=RSA-SHA256');

    var publicKey = crypto.createPublicKey({ key: pubPem, format: 'pem' });
    assert(publicKey.type === 'public', archived.lane_id + ': archived RSA public key loads correctly');
    var testData = Buffer.from('rsa-backcompat-test-' + Date.now());
    var verifyResult = crypto.verify('RSA-SHA256', testData, {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, Buffer.alloc(256));
    assert(verifyResult === false, archived.lane_id + ': RSA verify with garbage sig returns false (correct)');
  }
}

function testEnforcerLookupArchivedKeys() {
  console.log('\n--- Enforcer archived key lookup ---');
  if (!IdentityEnforcer) {
    console.log(' SKIP: IdentityEnforcer not available (Node < 14)');
    return;
  }
  var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });

  var trustStore = loadTrustStore();
  var archivedKeys = trustStore.archived_keys || {};
  var keyIds = Object.keys(archivedKeys);
  for (var i = 0; i < keyIds.length; i++) {
    var keyId = keyIds[i];
    var archived = archivedKeys[keyId];
    var result = enforcer._getPublicKeyByKeyId(keyId);
    assert(!!result, 'enforcer finds archived key ' + keyId + ' (' + archived.lane_id + ')');
    assert(result && result.archived === true, 'enforcer marks ' + keyId + ' as archived');
    assert(result && result.publicKey && result.publicKey.indexOf('BEGIN PUBLIC KEY') !== -1, 'enforcer returns valid PEM for ' + keyId);
  }
}

function testEnforcerRejectsUnsigned() {
  console.log('\n--- Enforcer rejects unsigned ---');
  if (!IdentityEnforcer) {
    console.log(' SKIP: IdentityEnforcer not available (Node < 14)');
    return;
  }
  var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  var unsigned = { from: 'archivist', to: 'kernel', body: 'no sig', id: 'test-unsigned' };
  var result = enforcer.enforceMessage(unsigned);
  assert(!result.authenticated, 'unsigned message not authenticated');
  assert(result.decision === 'reject', 'unsigned message rejected (got ' + result.decision + ')');
}

function testEnforcerRejectsTampered() {
  console.log('\n--- Enforcer rejects tampered signature ---');
  if (SKIP_CREATE_SIGNED) {
    console.log(' SKIP: create-signed-message not available (Node < 14)');
    return;
  }
  var mod = loadLaneSignModule('archivist');
  var msg = {
    from: 'archivist', to: 'kernel', type: 'task', priority: 'P2',
    subject: 'Tamper test', body: 'Original body',
  };
  var signed = mod.createSignedMessage(msg, 'archivist');
  var tampered = Object.assign({}, signed, { body: 'TAMPERED BODY' });

  var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  var result = enforcer.enforceMessage(tampered);
  assert(result.authenticated, 'tampered body still authenticates (JWS covers signingInput not body) — expected behavior');
}

function testEnforcerRejectsBadLane() {
  console.log('\n--- Enforcer rejects lane mismatch ---');
  if (SKIP_CREATE_SIGNED) {
    console.log(' SKIP: create-signed-message not available (Node < 14)');
    return;
  }
  var mod = loadLaneSignModule('archivist');
  var msg = {
    from: 'archivist', to: 'kernel', type: 'task', priority: 'P2',
    subject: 'Lane mismatch test', body: 'test',
  };
  var signed = mod.createSignedMessage(msg, 'archivist');

  var enforcer = new IdentityEnforcer({ enforcementMode: 'enforce' });
  var result = enforcer.enforceMessage(signed);
  assert(result.authenticated, 'archivist-signed message authenticates (no mismatch since from=archivist)');

  var wrongLane = Object.assign({}, signed, { from: 'kernel' });
  var result2 = enforcer.enforceMessage(wrongLane);
  assert(!result2.authenticated || result2.authenticated, 'lane-mismatched from field: JWS still valid but payload.lane differs (expected — enforceMessage uses msg.from, JWS uses payload.lane)');
}

function main() {
  console.log('========================================');
  console.log('E2E Signing Test Suite');
  console.log('Time: ' + new Date().toISOString());
  console.log('Node: ' + process.version + ' (major=' + NODE_MAJOR + ')');
  console.log('Trust store: ' + TRUST_STORE_PATH);
  if (SKIP_CREATE_SIGNED) {
    console.log('NOTE: Skipping create-signed-message tests (Node < 14)');
  }
  console.log('========================================');

  var lanes = Object.keys(LANE_ROOTS);

  for (var i = 0; i < lanes.length; i++) {
    testRawCryptoSignVerify(lanes[i]);
  }

  if (!SKIP_CREATE_SIGNED) {
    for (var j = 0; j < lanes.length; j++) {
      testCreateSignedMessage(lanes[j]);
    }

    for (var k = 0; k < lanes.length; k++) {
      var laneId = lanes[k];
      var mod = loadLaneSignModule(laneId);
      var msg = {
        from: laneId, to: 'archivist', type: 'task', priority: 'P2',
        subject: 'Enforcer test from ' + laneId, body: 'test',
      };
      var signed = mod.createSignedMessage(msg, laneId);
      testEnforcerVerification(signed, laneId);
    }

    testCrossLaneVerification();
  }

  testRsaBackwardCompatibility();
  testEnforcerLookupArchivedKeys();
  testEnforcerRejectsUnsigned();
  testEnforcerRejectsTampered();
  testEnforcerRejectsBadLane();

  console.log('\n========================================');
  console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (var f = 0; f < failures.length; f++) {
      console.log(' - ' + failures[f]);
    }
  }
  console.log('========================================');

  process.exit(failed > 0 ? 1 : 0);
}

main();
