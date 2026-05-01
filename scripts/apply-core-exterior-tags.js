#!/usr/bin/env node
/**
 * APPLY_CORE_EXTERIOR_TAGS.js
 * 
 * Applies Core/Exterior classification tags to the site-index based on the approved plan.
 * 
 * Reads:
 *   - S:/self-organizing-library/data/site-index.json
 * 
 * Writes:
 *   - S:/Archivist-Agent/evidence/graph-snapshots/site-index-with-core-exterior-tags.json
 * 
 * Then sends a message to Library lane with the updated site-index for review.
 */

const fs = require('fs');
const path = require('path');

const SITE_INDEX_PATH = 'S:/self-organizing-library/data/site-index.json';
const OUTPUT_PATH = 'S:/Archivist-Agent/evidence/graph-snapshots/site-index-with-core-exterior-tags.json';
const LIBRARY_INBOX = 'S:/self-organizing-library/lanes/library/inbox/';

const CORE_REPOS = new Set([
  'Archivist-Agent',
  'self-organizing-library',
  'SwarmMind-Self-Optimizing-Multi-Agent-AI-System',
  'kernel-lane',
  'papers'
]);

const EXTERIOR_ROLE_MAP = {
  'FreeAgent': 'origin_artifact',
  'federation': 'simulation',
  'Deliberate-AI-Ensemble': 'pattern_donor',
  'storytime': 'history'
};

function readJsonFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filepath}: ${e.message}`);
    process.exit(1);
  }
}

function writeJsonFile(filepath, obj) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(obj, null, 2));
    console.log(`Written to ${filepath}`);
  } catch (e) {
    console.error(`Error writing ${filepath}: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('=== Applying Core/Exterior tags to site-index ===\n');

  const siteIndex = readJsonFile(SITE_INDEX_PATH);
  const entries = siteIndex.entries || [];

  console.log(`Total entries: ${entries.length}`);

  let coreCount = 0;
  let exteriorCount = 0;

  entries.forEach(entry => {
    const repo = entry.repo;
    const tags = new Set(entry.tags || []);

    if (CORE_REPOS.has(repo)) {
      tags.add('graph_section:core');
      tags.add('authority_weight:normal');
      coreCount++;
    } else if (EXTERIOR_ROLE_MAP.hasOwnProperty(repo)) {
      tags.add('graph_section:exterior');
      tags.add('authority_weight:0');
      tags.add(`exterior_role:${EXTERIOR_ROLE_MAP[repo]}`);
      exteriorCount++;
    } else {
      console.warn(`Unknown repo: ${repo} for entry ${entry.id}`);
    }

    // Update the tags array (sorted for consistency)
    entry.tags = Array.from(tags).sort();
  });

  console.log(`Tagged ${coreCount} core entries and ${exteriorCount} exterior entries.`);

  // Update the generated_at timestamp
  siteIndex.generated_at = new Date().toISOString();

  // Write the updated site-index
  writeJsonFile(OUTPUT_PATH, siteIndex);

  // Send a message to Library lane
  const timestamp = new Date().toISOString();
  const message = {
    schema_version: "1.3",
    task_id: `apply-core-exterior-tags-${Date.now()}`,
    idempotency_key: `apply-core-exterior-tags-${Date.now()}`,
    from: "archivist",
    to: "library",
    type: "response",
    task_kind: "amendment", // We are proposing an amendment to the site-index
    priority: "P2",
    subject: "Core/Exterior classification tags applied to site-index",
    body: `Archivist has applied Core/Exterior classification tags to the site-index as per the approved plan.\n\nSummary:\n- Core entries tagged: ${coreCount}\n- Exterior entries tagged: ${exteriorCount}\n\nThe updated site-index is attached as evidence.\n\nPlease review and, if approved, use this to regenerate the site-index in your lane.\n\nEvidence: ${OUTPUT_PATH}`,
    requires_action: true,
    payload: {
      mode: "path",
      compression: "none",
      path: OUTPUT_PATH
    },
    timestamp: timestamp,
    execution: {
      mode: "manual",
      engine: "kilo",
      actor: "lane"
    },
    evidence: {
      required: true,
      evidence_path: OUTPUT_PATH,
      verified: false,
      verified_by: null,
      verified_at: null
    }
  };

  try {
    fs.writeFileSync(
      path.join(LIBRARY_INBOX, `${message.task_id}.json`),
      JSON.stringify(message, null, 2)
    );
    console.log(`\nMessage sent to Library inbox: ${message.task_id}.json`);
  } catch (e) {
    console.error(`Error writing message file: ${e.message}`);
    process.exit(1);
  }

  console.log('\n=== Tagging complete ===');
}

main();
