#!/usr/bin/env node
/**
 * Load Context — Archivist Lane (Mythos-class extended)
 *
 * Builds a single consolidated context block for long-horizon sessions:
 *   1. Recent session memory from SessionMemory
 *   2. Full AGENTS.md + BOOTSTRAP.md (canonical governance anchors)
 *   3. Memory-bank + current state snapshots
 *   4. Archivist inbox summary (filenames + subject only, not full JSON)
 *   5. Running notes from mythos-session.md (self-updating, bounded)
 *
 * Designed for 1M-token context windows. Output is a single string ready
 * to paste into a prompt or pipe to stdout.
 */

const fs = require('fs');
const path = require('path');

const ARCHIVIST_ROOT = 'S:/Archivist-Agent';
const CONTEXT_BUFFER = path.join(ARCHIVIST_ROOT, 'context-buffer');
const MYTHOS_SESSION = path.join(CONTEXT_BUFFER, 'mythos-session.md');
const INBOX_DIR = path.join(ARCHIVIST_ROOT, 'lanes/archivist/inbox');
const MAX_RUNNING_NOTES_LINES = 200;

let outputParts = [];

// ─── Helper: read file or note missing ───────────────────────────────────────
function readOrWarn(filePath, label) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
        return `[${label} not found at ${filePath}]`;
    } catch (err) {
        return `[${label} read error: ${err.message}]`;
    }
}

// ─── 1. Session memory (recent sessions + active session) ────────────────────
try {
    const { getSessionMemory } = require('./src/memory/SessionMemory.js');
    const memory = getSessionMemory();
    const sessionContext = memory.generateContext();
    outputParts.push('## Session Memory (SessionMemory.js)\n');
    outputParts.push(sessionContext);
    outputParts.push('\n---\n');
} catch (err) {
    outputParts.push(`## Session Memory\n[SessionMemory unavailable: ${err.message}]\n---\n`);
}

// ─── 2. Canonical governance files (full content) ────────────────────────────
const agentsPath = path.join(ARCHIVIST_ROOT, 'AGENTS.md');
const bootstrapPath = path.join(ARCHIVIST_ROOT, 'BOOTSTRAP.md');

outputParts.push('\n## AGENTS.md (full)\n');
outputParts.push(readOrWarn(agentsPath, 'AGENTS.md'));

outputParts.push('\n---\n\n## BOOTSTRAP.md (full)\n');
outputParts.push(readOrWarn(bootstrapPath, 'BOOTSTRAP.md'));

// ─── 3. Memory bank + current state ─────────────────────────────────────────
const memoryBankPath = path.join(CONTEXT_BUFFER, 'memory-bank.md');
const currentStatePath = path.join(CONTEXT_BUFFER, 'CURRENT_STATE.md');

outputParts.push('\n---\n\n## Memory Bank (context-buffer/memory-bank.md)\n');
outputParts.push(readOrWarn(memoryBankPath, 'memory-bank.md'));

outputParts.push('\n---\n\n## Current State (context-buffer/CURRENT_STATE.md)\n');
outputParts.push(readOrWarn(currentStatePath, 'CURRENT_STATE.md'));

// ─── 4. Archivist inbox summary (filenames + subject only) ───────────────────
outputParts.push('\n---\n\n## Archivist Inbox Summary\n');

try {
    if (fs.existsSync(INBOX_DIR)) {
        const entries = fs.readdirSync(INBOX_DIR);
        const files = entries.filter(e => {
            const full = path.join(INBOX_DIR, e);
            return fs.statSync(full).isFile();
        });

        if (files.length === 0) {
            outputParts.push('[Inbox is empty]\n');
        } else {
            outputParts.push(`Total files: ${files.length}\n\n`);
            for (const file of files) {
                const fullPath = path.join(INBOX_DIR, file);
                let subject = '(binary or unreadable)';
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    // Try to extract a subject line from JSON or first heading
                    const trimmed = content.trim().slice(0, 400);
                    const subjectMatch = trimmed.match(/"subject"\s*:\s*"([^"]+)"/);
                    if (subjectMatch) {
                        subject = subjectMatch[1];
                    } else {
                        const headingMatch = trimmed.match(/^#\s+(.+)$/m);
                        if (headingMatch) subject = headingMatch[1];
                        else subject = trimmed.split('\n')[0].slice(0, 120);
                    }
                } catch (_e) {
                    // binary — leave default
                }
                outputParts.push(`- \`${file}\` — ${subject}\n`);
            }
        }
    } else {
        outputParts.push(`[Inbox directory not found: ${INBOX_DIR}]\n`);
    }
} catch (err) {
    outputParts.push(`[Inbox scan error: ${err.message}]\n`);
}

// ─── 5. Running notes (mythos-session.md) — bounded tail ────────────────────
outputParts.push('\n---\n\n## Running Notes (mythos-session.md)\n');

try {
    if (fs.existsSync(MYTHOS_SESSION)) {
        const content = fs.readFileSync(MYTHOS_SESSION, 'utf8');
        const lines = content.split('\n');
        if (lines.length > MAX_RUNNING_NOTES_LINES) {
            const tail = lines.slice(-MAX_RUNNING_NOTES_LINES).join('\n');
            outputParts.push(`[ Showing last ${MAX_RUNNING_NOTES_LINES} of ${lines.length} lines ]\n\n`);
            outputParts.push(tail);
        } else {
            outputParts.push(content);
        }
    } else {
        outputParts.push(
            '[ mythos-session.md not yet created — this is the running-notes file. ' +
            'Append dated entries here during the session. ]\n'
        );
    }
} catch (err) {
    outputParts.push(`[ mythos-session.md read error: ${err.message} ]\n`);
}

outputParts.push('\n---\n');

// ─── Emit ───────────────────────────────────────────────────────────────────
const fullContext = outputParts.join('\n');
console.log(fullContext);

// Also return via module for programmatic use
module.exports = { buildContext: () => fullContext };
