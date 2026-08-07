#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  getAlgorithmParams,
  sign: algoSign
} = require(path.join(__dirname, '..', '.global', 'algorithm-helpers.js'));

const { IdentityEnforcer } = require(path.join(__dirname, '..', 'scripts', 'identity-enforcer.js'));

const trustStorePath = path.join(__dirname, '..', 'lanes', 'broadcast', 'trust-store.json');
if (!fs.existsSync(trustStorePath)) {
  console.error(`MISSING trust-store: ${trustStorePath}`);
  process.exit(1);
}
const trustStore = JSON.parse(fs.readFileSync(trustStorePath, 'utf8'));
const archivistKey = trustStore.archivist;
if (!archivistKey || !archivistKey.key_id || !archivistKey.public_key_pem) {
  console.error('MISSING trust-store archivist entry (key_id/public_key_pem) in trust-store.json');
  process.exit(1);
}
const archivistKid = archivistKey.key_id;
const archivistPublicKeyPem = archivistKey.public_key_pem;

const privateKeyPath = path.join(__dirname, '..', '.identity', 'private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error(`MISSING identity private key: ${privateKeyPath}`);
  process.exit(1);
}
const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem' });
const algoParams = getAlgorithmParams(privateKey);

function base64Url(value) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : Buffer.from(String(value), 'utf8');

  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const now = Math.floor(Date.now() / 1000);

const header = {
  alg: algoParams.alg,
  typ: 'JWT',
  kid: archivistKid,
};

const payload = {
  id: 'proof-sig-mismatch-001',
  lane: 'archivist',
  from: 'archivist',
  to: 'archivist',
  timestamp: new Date().toISOString(),
  type: 'signature-mismatch-proof',
  iat: now,
  exp: now + 3600,
};

const headerB64 = base64Url(JSON.stringify(header));
const payloadB64 = base64Url(JSON.stringify(payload));
const signingInput = `${headerB64}.${payloadB64}`;

const validSignature = algoSign(
  algoParams.signAlg,
  Buffer.from(signingInput),
  privateKey
);

const validJws =
  `${signingInput}.${base64Url(validSignature)}`;

// Preserve the correct algorithm-specific signature length while corrupting it.
const invalidSignature = crypto.randomBytes(validSignature.length);

const invalidJws =
  `${signingInput}.${base64Url(invalidSignature)}`;

console.log('=== SIGNATURE_MISMATCH End-to-End Proof ===');
console.log(`Key ID: ${archivistKid}`);
console.log(`Algorithm: ${algoParams.alg}`);
console.log(`Valid JWS: ${validJws.substring(0, 60)}...`);
console.log(`Invalid JWS: ${invalidJws.substring(0, 60)}...`);
console.log('');

const enforcer = new IdentityEnforcer({ enforcementMode: 'enforce', trustStorePath: path.join(__dirname, '..', 'lanes', 'broadcast', 'trust-store.json') });

const validResult = enforcer.verifyJWS(validJws, 'archivist');
console.log(`Valid JWS: valid=${validResult.valid}, authenticated=${validResult.authenticated}, error=${validResult.error || 'none'}`);

const invalidResult = enforcer.verifyJWS(invalidJws, 'archivist');
console.log(`Invalid JWS: valid=${invalidResult.valid}, authenticated=${invalidResult.authenticated}, error=${invalidResult.error || 'none'}`);

const enforceResult = enforcer.enforceMessage({
  id: 'proof-sig-mismatch-001',
  from: 'archivist',
  to: 'archivist',
  signature: invalidJws,
});
console.log(`Enforce result: decision=${enforceResult.decision}, reason=${enforceResult.reason}, authenticated=${enforceResult.authenticated}`);

if (invalidResult.error === 'SIGNATURE_MISMATCH' && enforceResult.reason === 'SIGNATURE_MISMATCH') {
  console.log('');
  console.log('PROOF SUCCESSFUL: SIGNATURE_MISMATCH detected end-to-end.');
  console.log('Root cause: signature bytes do not match the canonical unsigned payload hash under the sender key.');
  process.exit(0);
} else {
  console.log('');
  console.log('PROOF FAILED: unexpected result.');
  process.exit(1);
}