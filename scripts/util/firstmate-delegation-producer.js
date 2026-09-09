#!/usr/bin/env node
'use strict';

/**
 * scripts/util/firstmate-delegation-producer.js — producer-side V1.2 wiring.
 *
 * Fail-closed producer for ONE estate-signed envelope carrying a FirstMate
 * execution delegation, persisted into an Archivist-owned sidecar directory
 * the relay does NOT deliver and the Control Plane is expected to pull.
 *
 * Contract ordering (proven by scripts/test-firstmate-delegation-producer.js):
 *   1. FINALIZE: build the complete final body/payload/task_id/envelope
 *      (delegation fields, task_id = "arch-fmx-" + request_id, envelope metadata)
 *   2. VALIDATE: schema-validate the delegation against the project's existing
 *      validation (src/lane/SchemaValidator.js over schemas/inbox-message-v1.json
 *      semantics — no parallel schema is invented)
 *   3. SIGN ONCE: exactly one signature; afterwards body/payload/key_id/task_id
 *      are FROZEN — any post-sign mutation attempt throws
 *   4. PERSIST: atomic sidecar write (tmp file + fsync + rename) confined to
 *      the authorized sidecar root; never a partial write
 *
 * The JWS produced here is the ESTATE envelope JWS (binds lane/to/task_id/
 * content_hash({body,payload})/iat/exp) — it is NOT a V1.1 FirstMate request
 * JWS (which binds lane/request_id/request content_hash/iat/exp) and must never
 * be presented as one. No V1.1 claims shape is ever emitted.
 *
 * Signing path: this module is used under the Archivist identity via the
 * estate's own signer (scripts/create-signed-message.js); the private key is
 * never handled here.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const {
  normalizeMessageForSchema,
  validate,
} = require(path.join(REPO_ROOT, 'src', 'lane', 'SchemaValidator.js'));

const DELEGATION_KIND = 'firstmate.control-plane-delegation';
const TASK_ID_PREFIX = 'arch-fmx-';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const ESTATE_JWS_CLAIMS = ['lane', 'to', 'task_id', 'content_hash', 'iat', 'exp'];
// V1.1 FirstMate request JWS claims (verify-request.js REQUIRED_CLAIMS).
// The estate envelope JWS MUST NOT carry this claims shape.
const V11_REQUEST_CLAIMS = ['request_id'];

const DEFAULT_SIDECAR_DIR = path.join(
  REPO_ROOT, 'lanes', 'archivist', 'outbox', 'control-plane',
);

class ProducerError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? ': ' + detail : ''}`);
    this.code = code;
    this.name = 'ProducerError';
  }
}

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',')}}`;
}

function makeTaskId(requestId) {
  return `${TASK_ID_PREFIX}${requestId}`;
}

/**
 * Validate delegation request inputs. Fail closed on anything malformed.
 */
function validateDelegationRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object') {
    throw new ProducerError('MALFORMED_REQUEST', 'request must be an object');
  }
  for (const field of ['request_id', 'target_repo', 'objective']) {
    if (typeof request[field] !== 'string' || request[field].length === 0) {
      errors.push(`missing or empty: ${field}`);
    }
  }
  if (errors.length > 0) throw new ProducerError('MALFORMED_REQUEST', errors.join(', '));
  if (!REQUEST_ID_PATTERN.test(request.request_id)) {
    throw new ProducerError(
      'MALFORMED_REQUEST',
      `request_id must match [A-Za-z0-9._-]{8,128}: ${request.request_id}`,
    );
  }
  if (request.return_lane !== undefined && request.return_lane !== 'archivist') {
    throw new ProducerError('MALFORMED_REQUEST', 'return_lane must be "archivist"');
  }
  return true;
}

/**
 * Step 1 — FINALIZE. Construct the COMPLETE final envelope (body, payload,
 * task_id, metadata) with no later mutation intended. Nothing here signs.
 */
function buildFinalEnvelope(request, opts = {}) {
  validateDelegationRequest(request);
  const now = new Date().toISOString();
  const taskId = makeTaskId(request.request_id);
  const delegation = {
    request_id: request.request_id,
    target_repo: request.target_repo,
    objective: request.objective,
    created_at: request.created_at || now,
    return_lane: 'archivist',
  };
  const envelope = {
    schema_version: '1.3',
    task_id: taskId,
    idempotency_key: crypto.createHash('sha256').update(taskId).digest('hex'),
    from: 'archivist',
    to: 'control-plane',
    type: 'task',
    task_kind: 'proposal',
    priority: 'P2',
    subject: `FirstMate delegation ${request.request_id}`,
    body: stableStringify({ kind: DELEGATION_KIND, delegation }),
    timestamp: now,
    requires_action: true,
    payload: { mode: 'inline', compression: 'none' },
    execution: { mode: 'manual', engine: 'other', actor: 'subagent' },
    lease: { owner: null, acquired_at: null, expires_at: null, renew_count: 0, max_renewals: 3 },
    retry: { attempt: 1, max_attempts: 3, last_error: null, last_attempt_at: null },
    evidence: { required: false, verified: false },
    heartbeat: {
      status: 'pending', last_heartbeat_at: now, interval_seconds: 300, timeout_seconds: 3600,
    },
  };
  if (opts.now) envelope.timestamp = opts.now;
  return envelope;
}

/**
 * Step 2 — VALIDATE before signing. Uses the project's existing validator
 * (src/lane/SchemaValidator.js). No parallel schema.
 */
function validateEnvelopeBeforeSign(envelope) {
  const normalized = normalizeMessageForSchema(envelope);
  const check = validate(normalized);
  if (!check.valid) {
    throw new ProducerError('SCHEMA_INVALID', check.errors.join(' | '));
  }
  return normalized;
}

/**
 * Freeze the signed envelope: after the single signature exists, the fields
 * bound by it (body/payload/key_id/task_id) are immutable. Returns a frozen
 * view; ANY post-sign mutation of those fields throws POST_SIGN_MUTATION.
 */
function freezeSignedEnvelope(signed) {
  const frozenFields = ['body', 'payload', 'key_id', 'task_id', 'content_hash', 'signature'];
  // Payload is bound by the signature too: wrap it in a set-trapping proxy so
  // mutation of its contents (payload.mode = ...) throws instead of silently
  // diverging from the signed content_hash.
  const payloadGuard = new Proxy({ ...signed.payload }, {
    set() { throw new ProducerError('POST_SIGN_MUTATION', 'field "payload" is immutable after signing'); },
    deleteProperty() { throw new ProducerError('POST_SIGN_MUTATION', 'field "payload" is immutable after signing'); },
    defineProperty() { throw new ProducerError('POST_SIGN_MUTATION', 'field "payload" is immutable after signing'); },
  });
  const frozen = { ...signed, payload: payloadGuard };
  for (const field of frozenFields) {
    Object.defineProperty(frozen, field, {
      configurable: false,
      enumerable: true,
      get: () => (field === 'payload' ? payloadGuard : signed[field]),
      set: () => {
        throw new ProducerError(
          'POST_SIGN_MUTATION',
          `field "${field}" is immutable after signing`,
        );
      },
    });
  }
  return Object.freeze(frozen);
}

/**
 * Assert the signed JWS carries the ESTATE claims shape and never the V1.1
 * request-JWS shape (request_id claim). Structure assertion, fail closed.
 */
function assertEstateJwsNotRequestJws(signature) {
  const parts = String(signature).split('.');
  if (parts.length !== 3) throw new ProducerError('JWS_MALFORMED');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    throw new ProducerError('JWS_UNPARSEABLE', e.message);
  }
  // The V1.1 request-JWS prohibition is evaluated FIRST: a JWS carrying the
  // request claims shape must be refused as a request-JWS presentation no
  // matter what else it does or does not carry.
  for (const claim of V11_REQUEST_CLAIMS) {
    if (claims[claim] !== undefined) {
      throw new ProducerError(
        'REQUEST_JWS_PRESENTATION_FORBIDDEN',
        `estate JWS must never carry V1.1 request claim "${claim}"`,
      );
    }
  }
  for (const claim of ESTATE_JWS_CLAIMS) {
    if (claims[claim] === undefined) {
      throw new ProducerError('ESTATE_CLAIM_MISSING', claim);
    }
  }
  return claims;
}

/**
 * Sign ONCE via the estate's own signer. Returns the frozen signed envelope.
 * The signer injects signature/key_id/content_hash; this function then freezes
 * and structurally asserts the estate claims shape.
 */
function signOnce(normalizedEnvelope, signer) {
  if (typeof signer !== 'function') {
    throw new ProducerError('SIGNER_MISSING', 'signer function is required');
  }
  const signed = signer(normalizedEnvelope, 'archivist');
  assertEstateJwsNotRequestJws(signed.signature);
  // Correlation invariants, fail closed:
  const claims = JSON.parse(
    Buffer.from(String(signed.signature).split('.')[1], 'base64url').toString('utf8'),
  );
  if (claims.lane !== 'archivist') throw new ProducerError('LANE_MISMATCH', String(claims.lane));
  if (claims.to !== 'control-plane') throw new ProducerError('DESTINATION_MISMATCH', String(claims.to));
  if (claims.task_id !== signed.task_id) throw new ProducerError('TASK_ID_MISMATCH');
  if (claims.content_hash !== signed.content_hash) throw new ProducerError('CONTENT_HASH_MISMATCH');
  return freezeSignedEnvelope(signed);
}

/**
 * Sidecar confinement. The producer may only write inside its authorized
 * sidecar root. Rejects:
 *   - non-absolute paths
 *   - '..' traversal segments
 *   - arbitrary absolute escape (must be inside the authorized root unless it
 *     IS the root itself — i.e. the default Archivist sidecar or a test root)
 *   - symlink escape (realpath containment)
 */
function resolveSidecarRoot(sidecarDir, authorizedRoots) {
  const roots = authorizedRoots || [DEFAULT_SIDECAR_DIR];
  const requested = sidecarDir || DEFAULT_SIDECAR_DIR;
  if (typeof requested !== 'string' || requested.length === 0) {
    throw new ProducerError('SIDECAR_MUST_BE_ABSOLUTE', String(requested));
  }
  if (!path.isAbsolute(requested)) {
    throw new ProducerError('SIDECAR_MUST_BE_ABSOLUTE', String(requested));
  }
  // '..' traversal is refused on the RAW string BEFORE any normalization —
  // normalize() would silently resolve '..' away and hide the escape attempt.
  if (requested.split(path.sep).includes('..')) {
    throw new ProducerError('SIDECAR_PATH_ESCAPE', requested);
  }
  const normalized = path.normalize(requested);
  if (normalized.split(path.sep).includes('..')) {
    throw new ProducerError('SIDECAR_PATH_ESCAPE', normalized);
  }
  // Post-normalization containment: even a '..'-free raw string that
  // normalizes onto an authorized root but carries an escaped intermediate
  // (e.g. /root/sub/../../other) has already been refused above; here we also
  // refuse any path that is not exactly an authorized root, so the only
  // writable destination is the authorized sidecar root itself.
  // The requested sidecar dir must BE an authorized root (the Archivist
  // sidecar root or an explicitly authorized test fixture root), never an
  // arbitrary absolute path.
  const authorized = roots.some((root) => path.resolve(root) === normalized);
  if (!authorized) {
    throw new ProducerError('SIDECAR_ROOT_NOT_AUTHORIZED', normalized);
  }
  if (!fs.existsSync(normalized)) {
    // Only create when the authorized root itself is missing; mode 0700 owner-only.
    fs.mkdirSync(normalized, { recursive: true, mode: 0o700 });
  }
  // Symlink containment: the sidecar dir must resolve to exactly the
  // authorized root path — a symlinked dir would land artifacts elsewhere.
  const real = fs.realpathSync(normalized);
  if (real !== normalized) {
    throw new ProducerError('SIDECAR_SYMLINK_ESCAPE', `${normalized} -> ${real}`);
  }
  return normalized;
}

function artifactPathFor(sidecarRoot, taskId) {
  const finalName = `${taskId}.json`;
  if (finalName.includes('/') || finalName.includes('..') || finalName.includes('\0')) {
    throw new ProducerError('ARTIFACT_NAME_ESCAPE', finalName);
  }
  const finalPath = path.join(sidecarRoot, finalName);
  const resolvedParent = path.resolve(finalPath, '..');
  if (resolvedParent !== sidecarRoot) {
    throw new ProducerError('ARTIFACT_PATH_ESCAPE', finalPath);
  }
  return finalPath;
}

/**
 * Step 3 — PERSIST atomically: tmp file + fsync + rename inside the sidecar
 * root. Never a partial write. Body/payload untouched after signing.
 */
function persistSidecarAtomic(frozenSigned, sidecarRoot) {
  const taskId = frozenSigned.task_id;
  const finalPath = artifactPathFor(sidecarRoot, taskId);
  const tmpPath = path.join(
    sidecarRoot,
    `.${taskId}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  );
  const content = JSON.stringify(frozenSigned, null, 2);

  const fd = fs.openSync(tmpPath, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, content, 'utf8');
    try { fs.fsyncSync(fd); } catch (_) { /* fsync unavailable on exotic fs — rename still atomic */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmpPath, finalPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* best effort */ }
    throw new ProducerError('SIDECAR_RENAME_FAILED', e.message);
  }
  try { fs.chmodSync(finalPath, 0o600); } catch (_) { /* noop on odd platforms */ }
  return finalPath;
}

/**
 * Full produce pipeline: FINALIZE -> VALIDATE -> SIGN ONCE -> FREEZE -> PERSIST.
 * Returns { signed, artifactPath } where signed is frozen (post-sign mutation throws).
 * opts.buildOverride (test seam): use this prebuilt envelope instead of
 * building from request; it still passes through VALIDATE before signing.
 */
function produceDelegation(request, opts = {}) {
  const signer = opts.signer
    || ((msg) => require(path.join(REPO_ROOT, 'scripts', 'create-signed-message.js'))
      .createSignedMessage(msg, 'archivist'));
  const envelope = opts.buildOverride || buildFinalEnvelope(request, opts);
  const normalized = validateEnvelopeBeforeSign(envelope);
  const frozen = signOnce(normalized, signer);
  const sidecarRoot = resolveSidecarRoot(opts.sidecarDir, opts.authorizedSidecarRoots);
  const artifactPath = persistSidecarAtomic(frozen, sidecarRoot);
  return { signed: frozen, artifactPath };
}

module.exports = {
  DELEGATION_KIND,
  TASK_ID_PREFIX,
  REQUEST_ID_PATTERN,
  DEFAULT_SIDECAR_DIR,
  ESTATE_JWS_CLAIMS,
  V11_REQUEST_CLAIMS,
  ProducerError,
  stableStringify,
  makeTaskId,
  validateDelegationRequest,
  buildFinalEnvelope,
  validateEnvelopeBeforeSign,
  freezeSignedEnvelope,
  assertEstateJwsNotRequestJws,
  signOnce,
  resolveSidecarRoot,
  artifactPathFor,
  persistSidecarAtomic,
  produceDelegation,
};
