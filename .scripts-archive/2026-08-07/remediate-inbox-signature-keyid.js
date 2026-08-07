#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createSignedMessage } = require('./create-signed-message');
const { validateMessage } = require('./send-message');

const LANE_INBOX = {
  archivist: 'S:/Archivist-Agent/lanes/archivist/inbox',
  library: 'S:/self-organizing-library/lanes/library/inbox',
  swarmmind: 'S:/SwarmMind/lanes/swarmmind/inbox',
  kernel: 'S:/kernel-lane/lanes/kernel/inbox'
};

const LANE_SET = new Set(Object.keys(LANE_INBOX));
const SIG_PATTERN = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const KEY_ID_PATTERN = /^[a-f0-9]{16}$/;

function parseArgs(argv) {
  const out = {
    lane: 'kernel',
    pattern: '^summary-.*\\.json$',
    apply: false,
    backup: true,
    summaryOnly: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lane' && argv[i + 1]) out.lane = argv[++i];
    else if (a === '--pattern' && argv[i + 1]) out.pattern = argv[++i];
    else if (a === '--apply') out.apply = true;
    else if (a === '--no-backup') out.backup = false;
    else if (a === '--summary-only') out.summaryOnly = true;
  }
  return out;
}

function hasValidSigKey(msg) {
  return typeof msg.signature === 'string'
    && SIG_PATTERN.test(msg.signature)
    && typeof msg.key_id === 'string'
    && KEY_ID_PATTERN.test(msg.key_id);
}

function chooseSignerLane(msg, fallbackLane) {
  const from = typeof msg.from === 'string' ? msg.from.toLowerCase() : '';
  if (LANE_SET.has(from)) return from;
  return fallbackLane;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inboxPath = LANE_INBOX[args.lane];
  if (!inboxPath) {
    console.error(`Unknown lane "${args.lane}". Allowed: ${Object.keys(LANE_INBOX).join(', ')}`);
    process.exit(1);
  }

  const matcher = new RegExp(args.pattern);
  const files = fs.readdirSync(inboxPath)
    .filter((f) => matcher.test(f))
    .map((f) => path.join(inboxPath, f));

  const summary = {
    lane: args.lane,
    inbox: inboxPath,
    apply: args.apply,
    scanned: files.length,
    already_valid: 0,
    fixed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  for (const fullPath of files) {
    const filename = path.basename(fullPath);
    try {
      const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
      const msg = JSON.parse(raw);

      if (hasValidSigKey(msg)) {
        summary.already_valid += 1;
        summary.details.push({ file: filename, status: 'already_valid' });
        continue;
      }

      const signerLane = chooseSignerLane(msg, args.lane);
      const signed = createSignedMessage(msg, signerLane);
      const validated = validateMessage(signed);
      if (!validated.valid) {
        summary.failed += 1;
        summary.details.push({
          file: filename,
          status: 'validation_failed',
          signer_lane: signerLane,
          errors: validated.errors
        });
        continue;
      }

      if (args.apply) {
        if (args.backup) {
          const backupPath = `${fullPath}.bak-${Date.now()}`;
          fs.writeFileSync(backupPath, raw, 'utf8');
        }
        fs.writeFileSync(fullPath, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');
      }

      summary.fixed += 1;
      summary.details.push({
        file: filename,
        status: args.apply ? 'fixed' : 'would_fix',
        signer_lane: signerLane,
        key_id: signed.key_id
      });
    } catch (err) {
      summary.failed += 1;
      summary.details.push({ file: filename, status: 'error', error: err.message });
    }
  }

  if (args.summaryOnly) {
    const { details, ...compact } = summary;
    console.log(JSON.stringify(compact, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
  if (summary.failed > 0) process.exit(2);
}

main();
