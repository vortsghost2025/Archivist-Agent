/**
 * test-phase4-enforcement-proof.js
 *
 * Behavioral enforcement proof:
 * - Runtime call path is exercised
 * - Real outcomes are asserted
 * - Failure paths are blocked
 * - Basic bypass surfaces are checked via live objects
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Verifier } = require('../../src/attestation/Verifier');
const { VerifierWrapper } = require('../../src/attestation/VerifierWrapper');
const { QuarantineManager } = require('../../src/attestation/QuarantineManager');
const { VERIFY_REASON } = require('../../src/attestation/constants');

let passed = 0;
let failed = 0;

function createJWS(payload, privateKeyPem, kid = 'test-key') {
  const header = { alg: 'RS256', kid };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${h}.${p}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), privateKeyPem).toString('base64url');
  return `${h}.${p}.${sig}`;
}

function createTempTrustStore(keysByLane) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archivist-proof-'));
  const trustStorePath = path.join(dir, 'keys.json');
  const keys = {};
  for (const [lane, keyInfo] of Object.entries(keysByLane)) {
    keys[lane] = {
      public_key_pem: keyInfo.publicKey,
      key_id: `${lane}-kid`,
      registered_at: new Date().toISOString(),
      revoked_at: keyInfo.revoked ? new Date().toISOString() : null
    };
  }
  fs.writeFileSync(trustStorePath, JSON.stringify({ version: '1.0', keys, migration: {} }, null, 2));
  return { dir, trustStorePath };
}

async function run(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n=== ENFORCEMENT PROOF (BEHAVIORAL) ===\n');

  await run('Missing signature returns QUARANTINE (runtime)', async () => {
    const qm = new QuarantineManager({ maxRetries: 3 });
    const wrapper = new VerifierWrapper({ quarantineManager: qm });
    const result = await wrapper.verify({ id: 'missing-sig-1', lane: 'library' });
    assert.strictEqual(result.status, 'QUARANTINE');
    assert.strictEqual(result.reason, VERIFY_REASON.MISSING_SIGNATURE);
  });

  await run('Valid signed artifact returns SUCCESS and verified mode', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const { dir, trustStorePath } = createTempTrustStore({
      library: { publicKey, revoked: false }
    });
    try {
      const verifier = new Verifier({ trustStorePath });
      const wrapper = new VerifierWrapper({ verifier });
      const signature = createJWS({ lane: 'library', data: 'ok' }, privateKey, 'library-kid');
      const result = await wrapper.verify({
        id: 'good-1',
        lane: 'library',
        signature
      });
      assert.strictEqual(result.status, 'SUCCESS');
      assert.strictEqual(result.result.mode, 'JWS_VERIFIED');
      assert.strictEqual(result.result.payload.lane, 'library');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await run('Lane mismatch is blocked deterministically as QUARANTINE', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const { dir, trustStorePath } = createTempTrustStore({
      swarmmind: { publicKey, revoked: false },
      library: { publicKey, revoked: false }
    });
    try {
      const verifier = new Verifier({ trustStorePath });
      const wrapper = new VerifierWrapper({ verifier });
      const signature = createJWS({ lane: 'library', data: 'mismatch' }, privateKey, 'library-kid');
      const result = await wrapper.verify({
        id: 'lane-mismatch-1',
        lane: 'swarmmind',
        signature
      });
      assert.strictEqual(result.status, 'QUARANTINE');
      assert.strictEqual(result.reason, VERIFY_REASON.LANE_MISMATCH);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await run('Malformed JWS yields structured non-success outcome', async () => {
    const wrapper = new VerifierWrapper();
    const result = await wrapper.verify({
      id: 'malformed-1',
      lane: 'library',
      signature: 'not-a-jws'
    });
    assert.ok(['DEFER', 'QUARANTINE', 'FAILURE'].includes(result.status));
  });

  await run('Retry boundary enforces 1-3 defer, 4 quarantine handoff', async () => {
    const qm = new QuarantineManager({ maxRetries: 3 });
    const wrapper = new VerifierWrapper({ quarantineManager: qm });
    const item = { id: 'retry-boundary-1', lane: 'library', signature: 'not-a-jws' };

    const r1 = await wrapper.verify(item);
    const r2 = await wrapper.verify(item);
    const r3 = await wrapper.verify(item);
    const r4 = await wrapper.verify(item);

    assert.strictEqual(r1.status, 'DEFER');
    assert.strictEqual(r2.status, 'DEFER');
    assert.strictEqual(r3.status, 'DEFER');
    assert.strictEqual(r4.status, 'QUARANTINE');
    assert.strictEqual(r4.reason, VERIFY_REASON.QUARANTINE_MAX_RETRIES);
  });

  await run('Legacy verifier helper surfaces are absent on live object', async () => {
    const verifier = new Verifier();
    assert.strictEqual(typeof verifier.isHMACAccepted, 'undefined');
    assert.strictEqual(typeof verifier.getMigrationStatus, 'undefined');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(verifier, 'hmacCutoffDate'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(verifier, 'allowLegacy'), false);
  });

  await run('Cross-lane conflict files are absent in Library lane', async () => {
    const libraryOutcomeProtocol = 'S:/self-organizing-library/src/attestation/OutcomeProtocol.js';
    const libraryOutcomeRouter = 'S:/self-organizing-library/src/attestation/OutcomeRouter.js';
    assert.strictEqual(fs.existsSync(libraryOutcomeProtocol), false);
    assert.strictEqual(fs.existsSync(libraryOutcomeRouter), false);
  });

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

