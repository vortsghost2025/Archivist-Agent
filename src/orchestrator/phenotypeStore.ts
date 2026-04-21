// src/orchestrator/phenotypeStore.ts
// ---------------------------------------------------
// Stores the last known good system phenotype (trust‑store snapshot,
// migration mode, etc.).  For the stub we keep a single JSON file.

import * as fs from 'fs';
import * as path from 'path';

const PHENOTYPE_PATH = path.resolve('S:/Archivist-Agent/.phenotype/latest.json');

export interface Phenotype {
  trustStoreVersion: string;
  trustStore: any; // raw trust‑store JSON
  migrationMode: string;
  updatedAt: string;
}

export function loadPhenotype(): Phenotype | null {
  if (!fs.existsSync(PHENOTYPE_PATH)) return null;
  const raw = fs.readFileSync(PHENOTYPE_PATH, 'utf8');
  return JSON.parse(raw) as Phenotype;
}

export function savePhenotype(phenotype: Phenotype): void {
  const dir = path.dirname(PHENOTYPE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PHENOTYPE_PATH, JSON.stringify(phenotype, null, 2), 'utf8');
}
