#!/usr/bin/env node
/**
 * scripts/dispatch-firstmate-delegation.js — producer-side V1.2 wiring.
 *
 * Emits ONE estate signed envelope that carries a FirstMate execution
 * delegation, into an Archivist-owned sidecar directory the relay does NOT
 * deliver and the Control Plane is expected to pull.
 *
 * Hardened contract (implemented in scripts/util/firstmate-delegation-producer.js,
 * proven by scripts/test-firstmate-delegation-producer.js):
 *   1. FINALIZE the complete final body/payload/task_id/envelope first
 *   2. schema-validate against the project's existing validator
 *      (src/lane/SchemaValidator.js) — no parallel schema
 *   3. sign ONCE; body/payload/key_id/task_id are immutable after signing
 *   4. persist atomically (tmp + fsync + rename), confined to the authorized
 *      Archivist sidecar root (no traversal / absolute escape / symlink escape)
 *
 * The emitted JWS is the ESTATE envelope JWS binding lane/to/task_id/
 * content_hash({body,payload})/iat/exp — it is NOT a V1.1 FirstMate request
 * JWS (lane/request_id/request content_hash/iat/exp) and is never presented
 * as one. No relay/lane topology is modified: the sidecar directory is not a
 * lane, is not delivered by the relay, and ALL_LANES stays exactly
 * ['archivist','library','swarmmind','kernel'].
 *
 * Usage:
 *   node scripts/dispatch-firstmate-delegation.js \
 *     --request-id <request-id> --target-repo <path> --objective <slug> \
 *     --created-at <iso> --sidecar-dir <abs-path>
 *
 * --sidecar-dir must resolve to an authorized sidecar root: the default
 * Archivist sidecar, or a root listed in $FIRSTMATE_SIDECAR_AUTHORIZED_ROOTS
 * (path-delimiter separated; used by isolated test fixtures). Anything else
 * is refused.
 */
'use strict';

const path = require('path');

const {
  DEFAULT_SIDECAR_DIR,
  ProducerError,
  produceDelegation,
} = require(path.join(__dirname, 'util', 'firstmate-delegation-producer.js'));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      out[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function usage(msg) {
  console.error(`[dispatch-firstmate-delegation] ${msg}`);
  console.error('usage: node scripts/dispatch-firstmate-delegation.js --request-id <id> --target-repo <path> --objective <slug> [--created-at <iso>] [--sidecar-dir <path>]');
  process.exit(2);
}

function authorizedRootsFromEnv() {
  const env = process.env.FIRSTMATE_SIDECAR_AUTHORIZED_ROOTS;
  if (!env) return [];
  return env.split(path.delimiter).map((s) => s.trim()).filter((s) => s.length > 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args['request-id']) usage('missing --request-id');
  if (!args['target-repo']) usage('missing --target-repo');
  if (!args.objective) usage('missing --objective');

  const request = {
    request_id: args['request-id'],
    target_repo: args['target-repo'],
    objective: args.objective,
    created_at: args['created-at'] || new Date().toISOString(),
    return_lane: 'archivist',
  };

  const authorizedRoots = [DEFAULT_SIDECAR_DIR, ...authorizedRootsFromEnv()];
  try {
    const { signed, artifactPath } = produceDelegation(request, {
      sidecarDir: args['sidecar-dir'] || DEFAULT_SIDECAR_DIR,
      authorizedSidecarRoots: authorizedRoots,
    });
    console.log(JSON.stringify({
      emitted: true,
      task_id: signed.task_id,
      request_id: request.request_id,
      artifact: artifactPath,
      content_hash: signed.content_hash,
      key_id: signed.key_id,
      to: 'control-plane',
      jws_type: 'estate-envelope',
    }));
  } catch (err) {
    if (err instanceof ProducerError) {
      console.error(`[dispatch-firstmate-delegation]_${err.code}:`, err.message);
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) main();

module.exports = { parseArgs, authorizedRootsFromEnv };
