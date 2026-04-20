#!/usr/bin/env node
/**
 * test-pki.js - Phase 4.3 PKI Attestation Tests
 *
 * Tests key generation, signing, and verification.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { KeyManager, KEY_SIZE } = require('./KeyManager');
const { Signer } = require('./Signer');
const { Verifier } = require('./Verifier');

const TEST_DIR = path.join(__dirname, '.test-pki');
const TEST_PASSPHRASE = 'test-passphrase-12345';

function setup() {
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true });
	}
	fs.mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true });
	}
}

console.log('=== PKI Attestation Tests ===\n');

try {
	console.log('Test 1: Generate RSA keypair');
	setup();
	const km = new KeyManager({ identityDir: TEST_DIR, laneId: 'test-lane' });
	const { publicKey, privateKey } = km.generateKeyPair(TEST_PASSPHRASE);
	assert.ok(publicKey.includes('-----BEGIN PUBLIC KEY-----'), 'Public key should be PEM format');
	assert.ok(privateKey.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----'), 'Private key should be encrypted');
	console.log('  ✓ Keypair generated (RSA-2048)\n');

	console.log('Test 2: Save and load keypair');
	km.saveKeyPair(publicKey, privateKey, TEST_PASSPHRASE);
	const loadedPublic = km.loadPublicKey();
	assert.ok(loadedPublic.includes('-----BEGIN PUBLIC KEY-----'), 'Public key loaded');
	const loadedPrivate = km.loadPrivateKey(TEST_PASSPHRASE);
	assert.ok(loadedPrivate, 'Private key decrypted');
	console.log('  ✓ Keypair saved and loaded\n');

	console.log('Test 3: Sign payload with JWS');
	const signer = new Signer();
	const payload = { id: 'TEST-123', data: 'test data' };
	const keyId = km._generateKeyId(publicKey);
	const signed = signer.sign(payload, loadedPrivate, keyId);
	assert.ok(signed.jws, 'JWS should be generated');
	assert.ok(signed.jws.split('.').length === 3, 'JWS should have 3 parts');
	assert.ok(signed.payload.iat, 'Should include issued-at');
	assert.ok(signed.payload.exp, 'Should include expiry');
	console.log('  ✓ JWS signature created\n');

	console.log('Test 4: Verify JWS signature');
	const verifier = new Verifier({ trustStorePath: path.join(TEST_DIR, '..', '..', '.trust', 'keys.json') });
	verifier.trustStore = { keys: { 'test-lane': { public_key_pem: publicKey } }, migration: {} };
	const verified = verifier.verify(signed.jws, publicKey);
	assert.ok(verified.valid, 'Signature should verify');
	assert.deepStrictEqual(verified.payload.id, 'TEST-123', 'Payload should match');
	console.log('  ✓ JWS signature verified\n');

	console.log('Test 5: Detect tampered signature');
	const parts = signed.jws.split('.');
	const tamperedSignature = parts[2].replace(/A/g, 'B').replace(/B/g, 'C');
	const tamperedJws = `${parts[0]}.${parts[1]}.${tamperedSignature}`;
	const tamperedResult = verifier.verify(tamperedJws, publicKey);
	assert.ok(!tamperedResult.valid, 'Tampered signature should fail');
	console.log('  ✓ Tampered signature detected\n');

	console.log('Test 6: Sign queue item');
	const queueItem = {
		id: 'Q-123',
		timestamp: new Date().toISOString(),
		origin_lane: 'test-lane',
		target_lane: 'archivist',
		type: 'incident_report',
		payload: { test: true }
	};
	const signedItem = signer.signQueueItem(queueItem, loadedPrivate, keyId);
	assert.ok(signedItem.signature, 'Queue item should have signature');
	assert.strictEqual(signedItem.signature_alg, 'RS256', 'Should use RS256');
	console.log('  ✓ Queue item signed\n');

	console.log('Test 7: Verify queue item');
	verifier.trustStore.keys['test-lane'] = { public_key_pem: publicKey };
	const itemResult = verifier.verifyQueueItem(signedItem);
	assert.ok(itemResult.valid, 'Queue item should verify');
	assert.strictEqual(itemResult.mode, 'JWS_VERIFIED', 'Should indicate JWS mode');
	console.log('  ✓ Queue item verified\n');

	console.log('Test 8: Handle unsigned item (dual-mode)');
	verifier.trustStore.migration = { jws_only_start: '2099-01-01T00:00:00Z' };
	const unsignedItem = { ...queueItem };
	delete unsignedItem.signature;
	const unsignedResult = verifier.verifyQueueItem(unsignedItem);
	assert.ok(unsignedResult.valid, 'Should accept unsigned in dual-mode');
	assert.strictEqual(unsignedResult.mode, 'HMAC_ACCEPTED_DUAL_MODE', 'Should indicate dual-mode');
	console.log('  ✓ Unsigned item accepted in dual-mode\n');

	console.log('Test 9: Reject unsigned item after cutoff');
	verifier.trustStore.migration = { jws_only_start: '2020-01-01T00:00:00Z' };
	const rejectedResult = verifier.verifyQueueItem(unsignedItem);
	assert.ok(!rejectedResult.valid, 'Should reject unsigned after cutoff');
	assert.strictEqual(rejectedResult.error, 'SIGNATURE_REQUIRED', 'Should require signature');
	console.log('  ✓ Unsigned item rejected after cutoff\n');

	console.log('Test 10: Key rotation');
	const rotated = km.rotateKeyPair(TEST_PASSPHRASE);
	assert.ok(rotated.oldKeyId, 'Should have old key ID');
	assert.ok(rotated.newKeyId, 'Should have new key ID');
	assert.notStrictEqual(rotated.oldKeyId, rotated.newKeyId, 'Key IDs should differ');
	console.log('  ✓ Key rotation successful\n');

	teardown();
	console.log('=== All PKI tests passed ===');
} catch (err) {
	teardown();
	console.error('\n✗ Test failed:', err.message);
	console.error(err.stack);
	process.exit(1);
}
