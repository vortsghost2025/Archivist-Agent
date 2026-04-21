// src/orchestrator/quarantineStore.ts
// ---------------------------------------------------
// Simple append‑only quarantine log.  In a real system this would be
// a proper database or log‑structured file; for the stub we write JSON.

import * as fs from 'fs';
import * as path from 'path';

const QUARANTINE_DIR = path.resolve('S:/Archivist-Agent/.quarantine');
const LOG_PATH = path.join(QUARANTINE_DIR, 'quarantine.log');

if (!fs.existsSync(QUARANTINE_DIR)) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
}

export interface QuarantineEntry {
  id: string; // uuid
  timestamp: string;
  artifact: any;
  outerLane: string;
  failureReason: string;
  debugContext?: any;
}

export function addToQuarantine(entry: QuarantineEntry): string {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(LOG_PATH, line);
  return entry.id;
}

export function listQuarantine(): QuarantineEntry[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  const content = fs.readFileSync(LOG_PATH, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as QuarantineEntry);
}
