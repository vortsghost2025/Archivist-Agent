#!/usr/bin/env node
/**
 * Phase 2 readiness — inbox / quarantine sweep for unresolved P0 lane JSON.
 *
 * Scans each lane inbox recursively, skipping processed/expired/resolved archives.
 * Counts a file as actionable P0 when ANY of:
 *   - root JSON field priority === "P0"
 *   - basename starts with urgent_
 */

"use strict";

const fs = require("fs");
const path = require("path");

const SKIP_DIR_NAMES = new Set(["processed", "expired", "resolved", "stale-pre-v3"]);

const LANES = {
  archivist: "S:/Archivist-Agent/lanes/archivist/inbox",
  kernel: "S:/kernel-lane/lanes/kernel/inbox",
  swarmmind: "S:/SwarmMind/lanes/swarmmind/inbox",
  library: "S:/self-organizing-library/lanes/library/inbox",
};

function walkJsonFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      if (ent.name.startsWith("resolved-")) continue;
      walkJsonFiles(full, acc);
    } else if (ent.isFile() && ent.name.endsWith(".json")) {
      acc.push(full);
    }
  }
  return acc;
}

function isActionableP0(filePath) {
  const base = path.basename(filePath);
  if (base.startsWith("urgent_")) return { hit: true, reason: "urgent_filename" };
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && data.priority === "P0") {
      return { hit: true, reason: "root_priority" };
    }
  } catch (_) {
    // ignore parse errors
  }
  return { hit: false, reason: null };
}

function laneReport(inboxRoot) {
  const files = walkJsonFiles(inboxRoot);
  const p0Files = [];
  for (const f of files) {
    const { hit, reason } = isActionableP0(f);
    if (hit) p0Files.push({ path: f, reason });
  }
  return {
    inbox_root: inboxRoot,
    json_files_scanned: files.length,
    actionable_p0_count: p0Files.length,
    actionable_p0_files: p0Files,
  };
}

function main() {
  const includeLibrary = process.argv.includes("--include-library");
  const lanes = { ...LANES };
  if (!includeLibrary) delete lanes.library;

  const report = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    include_library: includeLibrary,
    lanes: {},
    phase2_ready: true,
  };

  for (const [laneId, inboxRoot] of Object.entries(lanes)) {
    const r = laneReport(inboxRoot);
    report.lanes[laneId] = r;
    if (r.actionable_p0_count > 0) report.phase2_ready = false;
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(report.phase2_ready ? 0 : 1);
}

main();
