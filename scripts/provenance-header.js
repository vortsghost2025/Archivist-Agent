#!/usr/bin/env node
'use strict';

/**
 * Build a mandatory output provenance header.
 *
 * Usage:
 *   node scripts/provenance-header.js --agent "kilo-auto/free" --lane "kernel" --session "sess-123"
 *
 * Or prepend to stdin body:
 *   node scripts/provenance-header.js --agent "kilo-auto/free" --lane "kernel" --session "sess-123" --stdin
 */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function sanitizeAscii(input) {
  return String(input || '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function buildHeader({ agent, lane, sessionId, generatedAt }) {
  return [
    'OUTPUT_PROVENANCE:',
    `agent: ${sanitizeAscii(agent) || 'unknown-agent'}`,
    `lane: ${sanitizeAscii(lane) || 'unknown-lane'}`,
    `generated_at: ${generatedAt || new Date().toISOString()}`,
    `session_id: ${sanitizeAscii(sessionId) || 'unknown'}`
  ].join('\n');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const header = buildHeader({
    agent: args.agent || process.env.AGENT_RUNTIME || process.env.MODEL || 'unknown-agent',
    lane: args.lane || process.env.LANE_ID || 'unknown-lane',
    sessionId: args.session || process.env.SESSION_ID || 'unknown',
    generatedAt: new Date().toISOString()
  });

  if (args.stdin) {
    const body = await readStdin();
    process.stdout.write(`${header}\n\n${body}`);
    return;
  }

  process.stdout.write(`${header}\n`);
}

main().catch((err) => {
  console.error(`[provenance-header] ERROR: ${err.message}`);
  process.exit(1);
});
