#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { deliverMessage } = require("../src/lane/SchemaValidator");
const { Signer } = require("../src/attestation/Signer");
const { KeyManager } = require("../src/attestation/KeyManager");

function usage() {
  console.log(
    "Usage: node scripts/send-signed.js --to <lane> --inbox <target-inbox-dir> --subject <text> [--body <text>] [--priority P1]"
  );
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const to = arg("--to");
const inboxDir = arg("--inbox");
const subject = arg("--subject", "Signed message");
const bodyText = arg("--body", "Signed delivery test");
const priority = arg("--priority", "P1");

if (!to || !inboxDir) {
  usage();
  process.exit(2);
}

if (!process.env.LANE_KEY_PASSPHRASE) {
  console.error("FAIL: LANE_KEY_PASSPHRASE is not set");
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, "..");
const repoName = path.basename(repoRoot).toLowerCase();
const from = repoName.includes("archivist") ? "archivist" : "library";
const laneId = from;

if (!fs.existsSync(inboxDir) || !fs.statSync(inboxDir).isDirectory()) {
  console.error(`FAIL: --inbox must be an existing directory: ${inboxDir}`);
  process.exit(2);
}

const identityDir = path.join(repoRoot, ".identity");
const identityPath = path.join(identityDir, "keys.json");
let keyId = null;
let identity = null;

if (fs.existsSync(identityPath)) {
  identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
  keyId =
    identity?.key_id ||
    identity?.public_key?.key_id ||
    identity?.identity?.key_id ||
    identity?.identity?.key_fingerprint;
} else {
  const pubPath = path.join(identityDir, "public.pem");
  const privPath = path.join(identityDir, "private.pem");
  if (!fs.existsSync(pubPath) || !fs.existsSync(privPath)) {
    console.error(`FAIL: no keys.json and no .pem pair in ${identityDir}`);
    process.exit(2);
  }
  keyId = crypto.createHash("sha256").update(fs.readFileSync(pubPath)).digest("hex").slice(0, 16);
}

const km = new KeyManager({ laneId, identityDir });
const signer = new Signer();
const privateKey = km.loadPrivateKey(process.env.LANE_KEY_PASSPHRASE);

if (!keyId) {
  keyId = (km.getPublicKeyInfo && km.getPublicKeyInfo() && km.getPublicKeyInfo().key_id) || null;
}

if (!keyId) {
  console.error("FAIL: no key_id/key_fingerprint found in .identity/");
  process.exit(2);
}

const now = new Date().toISOString();
const shortId = `msg-${Date.now()}`;
const idempotency = crypto
  .createHash("sha256")
  .update(`${shortId}:${from}:${to}:${subject}`)
  .digest("hex");

const body = `OUTPUT_PROVENANCE:
agent: opencode
lane: ${from}
generated_at: ${now}
session_id: manual-send-signed

target_lane: ${to}
message: ${bodyText}`;

const msg = {
  schema_version: "1.0",
  task_id: shortId,
  idempotency_key: idempotency,
  from,
  to,
  type: "task",
  task_kind: "proposal",
  priority,
  subject,
  body,
  timestamp: now,
  requires_action: true,
  payload: { mode: "inline", path: null, chunk: null },
  execution: { mode: "manual", engine: "opencode", actor: "lane", session_id: "manual-send-signed" },
  lease: { owner: null, acquired_at: null, expires_at: null, renew_count: 0, max_renewals: 3 },
  retry: { attempt: 1, max_attempts: 3, last_error: null, last_attempt_at: null },
  evidence: { required: false, evidence_path: null, verified: false, verified_by: null, verified_at: null },
  heartbeat: { interval_seconds: 300, last_heartbeat_at: null, timeout_seconds: 900, status: "pending" },
  signature: "",
  key_id: ""
};

const result = deliverMessage(msg, inboxDir, { signer, privateKey, keyId });

console.log(JSON.stringify({
  ok: result?.delivered === true,
  delivered: result?.delivered,
  schema_valid: result?.schema_valid,
  verified: result?.verified,
  path: result?.path,
  error: result?.error || null
}, null, 2));

if (!result?.delivered) {
  process.exit(1);
}
