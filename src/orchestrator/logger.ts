/**
 * Simple audit logger for the Archivist orchestrator.
 * Writes a JSON line per event to `logs/quarantine.log` (under the project root).
 * The function is async and deliberately uses the non‑blocking fs API so
 * that the HTTP handler does not stall the event loop.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const LOG_FILE = path.resolve('logs', 'quarantine.log');

/**
 * Append a structured log entry.
 * The entry will be stringified as a single line (no pretty‑print) to keep the file
 * parsable by tools such as `jq` or Logstash.
 */
export async function auditLog(entry: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n";
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, line, { encoding: 'utf8' });
  } catch (e) {
    // Logging must never crash the orchestrator – fallback to console.error.
    console.error('[Orchestrator] Failed to write audit log:', e);
  }
}
