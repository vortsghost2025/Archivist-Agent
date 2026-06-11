"use strict";

const fs = require("fs");
const path = require("path");
const { verifyOutputProvenance } = require("./output-provenance");

function usage() {
  console.log("Usage: node scripts/pre-handoff-provenance-check.js <file1> [file2 ...]");
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    usage();
    process.exit(2);
  }

  let hasFailure = false;
  const results = [];

  for (const f of files) {
    const resolved = path.resolve(process.cwd(), f);
    if (!fs.existsSync(resolved)) {
      hasFailure = true;
      results.push({
        file: resolved,
        ok: false,
        status: "FORMAT_VIOLATION",
        reason: "File not found"
      });
      continue;
    }

    const content = fs.readFileSync(resolved, "utf8");
    const check = verifyOutputProvenance(content);
    if (!check.ok) hasFailure = true;
    results.push({
      file: resolved,
      ok: check.ok,
      status: check.status,
      missing: check.missing
    });
  }

  console.log(JSON.stringify({
    check: "pre-handoff-provenance",
    ok: !hasFailure,
    files_checked: results.length,
    results
  }, null, 2));

  process.exit(hasFailure ? 1 : 0);
}

if (require.main === module) {
  main();
}

