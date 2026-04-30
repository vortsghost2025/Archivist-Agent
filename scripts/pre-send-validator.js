#!/usr/bin/env node
/**
 * Pre‑send validator for outbound lane messages.
 * Ensures the message complies with the v1.3 schema, that
 * `evidence_exchange.artifact_path` is present (or set to "inline"),
 * and that the message type is a terminal type before it is written.
 */

const fs = require('fs');
const path = require('path');
const { validateSchema } = require('./validate-schema'); // existing validator

// Allowed terminal types – any non‑task type that can be consumed directly.
const TERMINAL_TYPES = ['response', 'notification', 'status', 'ack', 'heartbeat', 'alert', 'escalation', 'handoff'];

function loadMessage(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function ensureEvidence(message) {
  if (!message.evidence_exchange) {
    message.evidence_exchange = {};
  }
  if (!message.evidence_exchange.artifact_path) {
    // Default to inline artifact when none is provided.
    message.evidence_exchange.artifact_path = 'inline';
  }
  return message;
}

function enforceTerminalType(message) {
  if (!TERMINAL_TYPES.includes(message.type)) {
    throw new Error(`NON_TERMINAL_TYPE: ${message.type} – outbound messages must be a terminal type`);
  }
  return message;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node pre-send-validator.js <message.json>');
    process.exit(1);
  }
  const msgPath = args[0];
  const msg = loadMessage(msgPath);

  // 1. Validate against schema (runtime-state.json is generic; we use the appropriate schema name)
  const schemaName = 'sync-response.json'; // most outbound messages use this schema
  const validation = validateSchema(msg, require(path.join('S:', 'Archivist-Agent', 'schemas', schemaName)));
  if (validation.length) {
    console.error('SCHEMA_INVALID:', validation.join('; '));
    process.exit(1);
  }

  // 2. Ensure evidence path exists
  ensureEvidence(msg);

  // 3. Enforce terminal type
  enforceTerminalType(msg);

  // Output the validated message to stdout (or overwrite file)
  console.log(JSON.stringify(msg, null, 2));
}

if (require.main === module) {
  main();
}
