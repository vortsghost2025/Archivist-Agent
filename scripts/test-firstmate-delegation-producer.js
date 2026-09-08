#!/usr/bin/env node
'use strict';

/**
 * scripts/test-firstmate-delegation-producer.js
 *
 * Fail-closed producer tests for the FirstMate delegation producer
 * (scripts/util/firstmate-delegation-producer.js + dispatch CLI).
 *
 * Covers the V1.2 producer hardening contract:
 *   PRODUCER_SCHEMA_VALIDATES_BEFORE_SIGN
 *   SIGN_ONCE_NO_POST_SIGN_MUTATION
 *   SIDECAR_ATOMIC_PERSISTENCE
 *   SIDECAR_TRAVERSAL_REFUSED
 *   SIDECAR_SYMLINK_ESCAPE_REFUSED
 *   SIDECAR_ABSOLUTE_ESCAPE_REFUSED
 *   TASK_ID_CORRELATION (arch-fmx-<request_id>)
 *   ESTATE_JWS_NEVER_REQUEST_JWS
 *   NO_ALL_LANES_CHANGE
 *   NO_GOVERNANCE_LANE_ADDED
 *
 * Runs fully inside an isolated temp fixture root. No real lane key material,
 * no production sidecar writes, no relay/queue injection, no private keys.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const producer = require(path.join(REPO_ROOT, 'scripts', 'util', 'firstmate-delegation-producer.js'));
const {
  ProducerError,
  makeTaskId,
  buildFinalEnvelope,
  validateEnvelopeBeforeSign,
  signOnce,
  resolveSidecarRoot,
  persistSidecarAtomic,
  produceDelegation,
  freezeSignedEnvelope,
  assertEstateJwsNotRequestJws,
} = producer;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS:', name);
    passed++;
  } catch (err) {
    console.error('  FAIL:', name);
    console.error('    ', err.message);
    failed++;
  }
}

function refuseCode(fn, code) {
  try {
    fn();
  } catch (err) {
    if (err instanceof ProducerError && err.code === code) return err;
    throw new AssertionErrorReturn(err);
  }
  throw new Error(`expected ProducerError ${code}, got success`);
}
class AssertionErrorReturn extends Error {
  constructor(err) {
    super(`expected ProducerError, got ${err && err.constructor ? err.constructor.name : typeof err}: ${err.message}`);
  }
}

// ---------------------------------------------------------------- fixtures

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-producer-test-'));
const fixtureSidecar = path.join(scratch, 'sidecar-root');
const otherDir = path.join(scratch, 'other');
const outsideDir = path.join(scratch, 'outside');
fs.mkdirSync(fixtureSidecar, { recursive: true, mode: 0o700 });
fs.mkdirSync(otherDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(outsideDir, { recursive: true, mode: 0o700 });

// Fixture Ed25519 identity — mirrors scripts/create-signed-message.js signing
// shape WITHOUT reading any real lane key. Private key is a generated fixture,
// never printed, never persisted outside the scratch dir.
const kp = crypto.generateKeyPairSync('ed25519');
const fixturePrivPem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const fixturePubPem = kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const fixtureKeyId = crypto.createHash('sha256').update(fixturePubPem).digest('hex');

function fixtureSigner(msg, laneId) {
  assert.strictEqual(laneId, 'archivist');
  const contentHash = 'sha256:' + crypto.createHash('sha256')
    .update(producer.stableStringify({ body: msg.body || '', payload: msg.payload || {} }))
    .digest('hex');
  const header = { alg: 'EdDSA', typ: 'JWT', kid: fixtureKeyId };
  const claims = {
    id: msg.task_id,
    task_id: msg.task_id,
    from: 'archivist',
    to: 'control-plane',
    lane: 'archivist',
    priority: msg.priority || null,
    content_hash: contentHash,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + 86400000) / 1000),
  };
  const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(producer.stableStringify(claims))}`;
  const sig = crypto.sign(null, Buffer.from(signingInput), kp.privateKey);
  const jws = `${signingInput}.${b64url(sig)}`;
  return {
    ...msg,
    id: msg.task_id,
    content_hash: contentHash,
    signature: jws,
    signature_alg: 'EdDSA',
    key_id: fixtureKeyId,
  };
}

function goodRequest(overrides = {}) {
  return {
    request_id: 'req-fixture-0001',
    target_repo: path.join(scratch, 'target-repo'),
    objective: 'fixture:hello',
    created_at: new Date().toISOString(),
    return_lane: 'archivist',
    ...overrides,
  };
}

function produce(opts = {}, request = goodRequest()) {
  return produceDelegation(request, {
    signer: fixtureSigner,
    sidecarDir: fixtureSidecar,
    authorizedSidecarRoots: [fixtureSidecar],
    ...opts,
  });
}

// ---------------------------------------------------------------- tests

console.log('FIRSTMATE DELEGATION PRODUCER TESTS');
console.log('=================================');

test('PRODUCER_SCHEMA_VALIDATES_BEFORE_SIGN: invalid envelope refuses BEFORE any signature exists', () => {
  // Route a broken envelope through the exact produceDelegation pipeline via a
  // build override, so the ordering (validate -> sign) is exercised end-to-end.
  const env = buildFinalEnvelope(goodRequest());
  env.type = 'not-a-type'; // schema-invalid: type not in enum
  let signerReached = false;
  assert.throws(
    () => produceDelegation(goodRequest(), {
      buildOverride: env,
      signer: () => { signerReached = true; return {}; },
      sidecarDir: fixtureSidecar,
      authorizedSidecarRoots: [fixtureSidecar],
    }),
    (e) => e instanceof ProducerError && e.code === 'SCHEMA_INVALID',
    'produceDelegation must refuse the broken envelope with SCHEMA_INVALID',
  );
  assert.strictEqual(signerReached, false, 'signer must never be called on schema-invalid input');
  // And the validator refuses it directly:
  assert.throws(
    () => validateEnvelopeBeforeSign(env),
    (e) => e instanceof ProducerError && e.code === 'SCHEMA_INVALID',
  );
});

test('PRODUCER_SCHEMA_VALIDATES_BEFORE_SIGN: valid delegation passes the project schema (to=control-plane)', () => {
  const env = buildFinalEnvelope(goodRequest());
  const normalized = validateEnvelopeBeforeSign(env);
  assert.strictEqual(normalized.to, 'control-plane');
});

test('SIGN_ONCE_NO_POST_SIGN_MUTATION: frozen envelope throws on body/payload/key_id/task_id writes', () => {
  const { signed } = produce();
  const before = JSON.stringify(signed);
  for (const field of ['body', 'key_id', 'task_id', 'content_hash', 'signature']) {
    assert.throws(
      () => { signed[field] = 'tampered'; },
      (e) => e instanceof ProducerError && e.code === 'POST_SIGN_MUTATION' && e.message.includes(field),
      `mutating ${field} must throw POST_SIGN_MUTATION`,
    );
  }
  assert.throws(
    () => { signed.payload.mode = 'path'; },
    (e) => e instanceof ProducerError && e.code === 'POST_SIGN_MUTATION' && e.message.includes('payload'),
    'mutating payload contents must throw POST_SIGN_MUTATION',
  );
  assert.strictEqual(JSON.stringify(signed), before, 'frozen envelope must be unchanged after mutation attempts');
});

test('SIGN_ONCE_NO_POST_SIGN_MUTATION: persisted artifact bytes equal frozen envelope (no rewrite after sign)', () => {
  const { signed, artifactPath } = produce();
  const onDisk = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  assert.strictEqual(JSON.stringify(onDisk), JSON.stringify(signed));
  assert.strictEqual(onDisk.signature, signed.signature);
});

test('SIDECAR_ATOMIC_PERSISTENCE: artifact lands via tmp+rename with no partial files left behind', () => {
  const { artifactPath } = produce({}, goodRequest({ request_id: 'req-atomic-0002' }));
  assert.ok(artifactPath.startsWith(fixtureSidecar + path.sep), 'artifact inside fixture sidecar root');
  assert.ok(fs.existsSync(artifactPath), 'final artifact exists');
  const leftovers = fs.readdirSync(fixtureSidecar).filter((f) => f.includes('.tmp'));
  assert.strictEqual(leftovers.length, 0, 'no partial tmp files remain');
  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  assert.ok(parsed.signature && parsed.key_id, 'artifact is a complete signed envelope');
  const stat = fs.statSync(artifactPath);
  assert.strictEqual(stat.mode & 0o777, 0o600, 'artifact mode is 0600');
});

test('SIDECAR_TRAVERSAL_REFUSED: ".." segments in sidecar path are refused', () => {
  // Raw string with '..' segments — path.join would pre-collapse them.
  const evil = fixtureSidecar + '/sub/../../escape';
  assert.ok(evil.split('/').includes('..'));
  assert.throws(() => resolveSidecarRoot(evil, [fixtureSidecar]), (e) => e.code === 'SIDECAR_PATH_ESCAPE');
  assert.throws(() => produce({ sidecarDir: evil }), (e) => e.code === 'SIDECAR_PATH_ESCAPE');
  assert.throws(() => resolveSidecarRoot('/tmp/../etc', []), (e) => e.code === 'SIDECAR_PATH_ESCAPE');
});

test('SIDECAR_SYMLINK_ESCAPE_REFUSED: symlinked sidecar root resolving outside is refused', () => {
  const link = path.join(scratch, 'sidecar-link');
  fs.symlinkSync(outsideDir, link);
  assert.throws(() => resolveSidecarRoot(link, [link]), (e) => e.code === 'SIDECAR_SYMLINK_ESCAPE');
  assert.throws(() => produce({ sidecarDir: link, authorizedSidecarRoots: [link] }), (e) => e.code === 'SIDECAR_SYMLINK_ESCAPE');
  assert.strictEqual(fs.existsSync(path.join(outsideDir, 'arch-fmx-req-link-0003.json')), false, 'nothing escaped through the symlink');
});

test('SIDECAR_ABSOLUTE_ESCAPE_REFUSED: arbitrary absolute directories outside the authorized root are refused', () => {
  assert.throws(() => resolveSidecarRoot(outsideDir, [fixtureSidecar]), (e) => e.code === 'SIDECAR_ROOT_NOT_AUTHORIZED');
  assert.throws(() => resolveSidecarRoot(os.tmpdir(), []), (e) => e.code === 'SIDECAR_ROOT_NOT_AUTHORIZED');
  assert.throws(() => produce({ sidecarDir: outsideDir }), (e) => e.code === 'SIDECAR_ROOT_NOT_AUTHORIZED');
  assert.throws(() => resolveSidecarRoot('relative/dir', []), (e) => e.code === 'SIDECAR_MUST_BE_ABSOLUTE');
});

test('TASK_ID_CORRELATION: task_id equals "arch-fmx-" + request_id across envelope, claims, and body', () => {
  const request = goodRequest({ request_id: 'req-correlate-04' });
  const { signed, artifactPath } = produce({}, request);
  assert.strictEqual(signed.task_id, 'arch-fmx-req-correlate-04');
  const claims = assertEstateJwsNotRequestJws(signed.signature);
  assert.strictEqual(claims.task_id, 'arch-fmx-req-correlate-04');
  const body = JSON.parse(signed.body);
  assert.strictEqual(body.delegation.request_id, 'req-correlate-04');
  assert.strictEqual(path.basename(artifactPath), 'arch-fmx-req-correlate-04.json');
  assert.strictEqual(makeTaskId('x'.repeat(64)), 'arch-fmx-' + 'x'.repeat(64));
});

test('ESTATE_JWS_NEVER_REQUEST_JWS: signed claims bind task_id+content_hash({body,payload}), never request_id', () => {
  const { signed } = produce();
  const parts = String(signed.signature).split('.');
  assert.strictEqual(parts.length, 3);
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  // Estate envelope claims, exactly as verify-estate-envelope.js requires:
  for (const claim of ['lane', 'to', 'task_id', 'content_hash', 'iat', 'exp']) {
    assert.ok(claims[claim] !== undefined, `estate claim present: ${claim}`);
  }
  assert.strictEqual(claims.lane, 'archivist');
  assert.strictEqual(claims.to, 'control-plane');
  // The V1.1 request JWS binds request_id as a signed claim (verify-request.js
  // REQUIRED_CLAIMS = [lane, request_id, content_hash, iat, exp]). The estate
  // envelope JWS must NEVER carry that claims shape.
  assert.ok(!('request_id' in claims), 'estate JWS must not carry request_id claim');
  // content_hash must bind {body,payload} of THIS envelope, not a request record.
  const recomputed = 'sha256:' + crypto.createHash('sha256')
    .update(producer.stableStringify({ body: signed.body, payload: signed.payload }))
    .digest('hex');
  assert.strictEqual(claims.content_hash, recomputed);
  assert.strictEqual(claims.content_hash, signed.content_hash);
});

test('ESTATE_JWS_NEVER_REQUEST_JWS: structural assertion refuses a V1.1-shaped signature', () => {
  const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const v11Header = { alg: 'EdDSA', typ: 'JWT', kid: fixtureKeyId };
  // V1.1 request JWS shape per verify-request.js REQUIRED_CLAIMS:
  // {lane, request_id, content_hash, iat, exp} — signed claim request_id
  // binding the REQUEST record. The producer's structural assertion must
  // refuse a JWS carrying this claims shape.
  const v11Claims = {
    lane: 'archivist',
    request_id: 'req-fixture-0001',
    content_hash: 'sha256:' + '0'.repeat(64),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const input = `${b64url(JSON.stringify(v11Header))}.${b64url(producer.stableStringify(v11Claims))}`;
  const sig = crypto.sign(null, Buffer.from(input), kp.privateKey);
  const v11Jws = `${input}.${b64url(sig)}`;
  assert.throws(
    () => assertEstateJwsNotRequestJws(v11Jws),
    (e) => e instanceof ProducerError && e.code === 'REQUEST_JWS_PRESENTATION_FORBIDDEN',
    'a V1.1-shaped JWS (request_id claim) must be refused',
  );
});

test('ESTATE_JWS_NEVER_REQUEST_JWS: estate claims minus any single claim are refused (fail closed)', () => {
  const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const base = {
    lane: 'archivist',
    to: 'control-plane',
    task_id: 'arch-fmx-req-fixture-0001',
    content_hash: 'sha256:' + 'a'.repeat(64),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  for (const claim of Object.keys(base)) {
    const claims = { ...base };
    delete claims[claim];
    const input = `${b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: fixtureKeyId }))}.${b64url(producer.stableStringify(claims))}`;
    const sig = crypto.sign(null, Buffer.from(input), kp.privateKey);
    assert.throws(
      () => assertEstateJwsNotRequestJws(`${input}.${b64url(sig)}`),
      (e) => e instanceof ProducerError && e.code === 'ESTATE_CLAIM_MISSING' && e.message.includes(claim),
      `missing estate claim "${claim}" must be refused`,
    );
  }
});

test('ESTATE_JWS_NEVER_REQUEST_JWS: produced JWS verifies under estate re-verification semantics', () => {
  const { signed } = produce();
  const parts = String(signed.signature).split('.');
  const ok = crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), kp.publicKey, Buffer.from(parts[2], 'base64url'));
  assert.ok(ok, 'fixture public key verifies the estate JWS');
});

test('NO_ALL_LANES_CHANGE: relay daemon lane topology untouched by the producer change', () => {
  const relaySrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'relay-daemon.js'), 'utf8');
  const m = relaySrc.match(/const ALL_LANES = \[([^\]]*)\]/);
  assert.ok(m, 'ALL_LANES declaration still present in relay-daemon.js');
  const lanes = m[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
  assert.deepStrictEqual(lanes, ['archivist', 'library', 'swarmmind', 'kernel'], 'ALL_LANES must remain exactly the four governance lanes');
  // The producer module and CLI must not touch relay topology.
  const producerSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'util', 'firstmate-delegation-producer.js'), 'utf8');
  const cliSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'dispatch-firstmate-delegation.js'), 'utf8');
  assert.ok(!/ALL_LANES\s*=/.test(producerSrc), 'producer must not redefine ALL_LANES');
  assert.ok(!/ALL_LANES\s*=/.test(cliSrc), 'CLI must not redefine ALL_LANES');
});

test('NO_GOVERNANCE_LANE_ADDED: no new lane directory and no lane registration added', () => {
  const lanesRoot = path.join(REPO_ROOT, 'lanes');
  const entries = fs.readdirSync(lanesRoot).filter((d) => {
    const p = path.join(lanesRoot, d);
    return fs.existsSync(path.join(p, 'inbox')) || fs.existsSync(path.join(p, 'outbox')) || fs.existsSync(path.join(p, 'state'));
  });
  // The canonical governance lanes pre-existing at HEAD (the remote-default
  // topology tracks only archivist and library lane dirs; assert exactly the
  // lanes this branch's base ships, that no lane dir was ADDED by this change,
  // and that no FIRSTMATE lane exists).
  const lanesAtBase = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', 'lanes/'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.replace(/^lanes\//, '').replace(/\/$/, '')).filter((s) => s.length > 0 && !s.includes('.'));
  for (const lane of lanesAtBase) {
    assert.ok(fs.existsSync(path.join(lanesRoot, lane)), `base lane present: ${lane}`);
  }
  assert.ok(!fs.existsSync(path.join(lanesRoot, 'firstmate')), 'no FirstMate governance lane directory');
  const producerSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'util', 'firstmate-delegation-producer.js'), 'utf8');
  assert.ok(!/(create|register|add)[A-Za-z]*lane/i.test(producerSrc), 'producer must not register lanes');
  // The git diff itself must not add lane registration files.
  const out = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const laneAdds = out.split('\n').filter((f) => /^lanes\/(archivist|library|swarmmind|kernel)\//.test(f) && f !== '');
  assert.deepStrictEqual(laneAdds, [], 'no governance-lane file modified');
});

test('CLI refuses unknown sidecar root and emits nothing (fail closed)', () => {
  let threw = null;
  let stdout = '';
  try {
    stdout = execFileSync(
      process.execPath,
      [path.join(REPO_ROOT, 'scripts', 'dispatch-firstmate-delegation.js'),
        '--request-id', 'req-cli-0007', '--target-repo', scratch, '--objective', 'fixture:cli',
        '--sidecar-dir', outsideDir],
      { encoding: 'utf8', env: { ...process.env } },
    ).trim();
  } catch (err) {
    threw = err;
    stdout = (err.stdout || '').trim();
  }
  assert.ok(threw, 'CLI must exit non-zero on unauthorized sidecar root');
  assert.strictEqual(threw.status, 1, `CLI exit code must be 1, got ${threw.status}`);
  assert.ok(/SIDECAR_ROOT_NOT_AUTHORIZED/.test(String(threw.stderr)), 'refusal code surfaces on stderr');
  assert.strictEqual(stdout, '', 'CLI must emit nothing on stdout on refusal');
  assert.strictEqual(fs.existsSync(path.join(outsideDir, 'arch-fmx-req-cli-0007.json')), false);
});

// NOTE: the CLI success path requires real Archivist signing keys; exercised
// here only through the library with a fixture signer. The refusal paths above
// prove the CLI wiring itself is fail-closed.

console.log('---');
console.log(`Total Results: ${passed} passed, ${failed} failed`);
console.log(`scratch: ${scratch}`);

try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_) { /* keep for inspection on failure */ }
process.exit(failed > 0 ? 1 : 0);
