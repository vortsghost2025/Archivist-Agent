#!/usr/bin/env node
/**
 * VERIFY_KERNEL_SWARMMIND_NODES.js
 * 
 * Verifies file existence for UNVERIFIED nodes in Kernel and SwarmMind lanes.
 * 
 * Reads:
 *   - S:/self-organizing-library/data/site-index.json (for repo roots and entries)
 *   - S:/kernel-lane/evidence/graph-snapshots/graph-snapshot-2026-04-30T16-08-47-reduced.json
 * 
 * Outputs:
 *   - Console logs of verification results
 *   - Sends messages to Kernel and SwarmMind inboxes with the list of verified and missing nodes.
 */

const fs = require('fs');
const path = require('path');

const SITE_INDEX_PATH = 'S:/self-organizing-library/data/site-index.json';
const SNAPSHOT_PATH = 'S:/kernel-lane/evidence/graph-snapshots/graph-snapshot-2026-04-30T16-08-47-reduced.json';
const KERNEL_INBOX = 'S:/kernel-lane/lanes/kernel/inbox/';
const SWARMMIND_INBOX = 'S:/SwarmMind/lanes/swarmmind/inbox/';
const ARCHIVIST_INBOX = 'S:/Archivist-Agent/lanes/archivist/inbox/';

function readJsonFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filepath}: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('=== Verifying Kernel and SwarmMind UNVERIFIED nodes ===\n');

  // Load site-index for repo roots and entries
  const siteIndex = readJsonFile(SITE_INDEX_PATH);
  const entries = siteIndex.entries || [];
  const repoRoots = siteIndex.repo_roots;
  if (!repoRoots) {
    console.error('Failed to get repo_roots from site-index');
    process.exit(1);
  }

  // Load the reduced graph snapshot to get UNVERIFIED status
  const snapshot = readJsonFile(SNAPSHOT_PATH);
  const snapshotNodes = snapshot.nodes || [];

  // Build a set of unverified node IDs for kernel-lane and SwarmMind
  const unverifiedIds = new Set();
  snapshotNodes.forEach(node => {
    if (node.status === 'UNVERIFIED' && 
        ['kernel-lane', 'SwarmMind-Self-Optimizing-Multi-Agent-AI-System'].includes(node.repo)) {
      unverifiedIds.add(node.id);
    }
  });

  console.log(`Found ${unverifiedIds.size} UNVERIFIED nodes in target repos (from snapshot):`);

  // Check each entry in site-index that is in the unverified set
  const results = {
    kernel: { verified: [], missing: [] },
    swarmmind: { verified: [], missing: [] }
  };

  entries.forEach(entry => {
    if (!unverifiedIds.has(entry.id)) {
      return; // Skip if not unverified in snapshot
    }
    const repo = entry.repo;
    if (!['kernel-lane', 'SwarmMind-Self-Optimizing-Multi-Agent-AI-System'].includes(repo)) {
      return; // Skip if not in target repos
    }
    const repoRoot = repoRoots[repo];
    if (!repoRoot) {
      console.warn(`No repo root found for ${repo}, skipping entry ${entry.id}`);
      return;
    }
    const filePath = path.join(repoRoot, entry.path);
    const exists = fs.existsSync(filePath);
    const repoKey = repo === 'kernel-lane' ? 'kernel' : 'swarmmind';
    if (exists) {
      results[repoKey].verified.push({
        id: entry.id,
        path: entry.path,
        title: entry.title || '(no title)'
      });
    } else {
      results[repoKey].missing.push({
        id: entry.id,
        path: entry.path,
        title: entry.title || '(no title)'
      });
    }
  });

  // Print summary
  console.log('=== Verification Results ===');
  console.log(`Kernel - Verified: ${results.kernel.verified.length}, Missing: ${results.kernel.missing.length}`);
  console.log(`SwarmMind - Verified: ${results.swarmmind.verified.length}, Missing: ${results.swarmmind.missing.length}\n`);

  if (results.kernel.verified.length > 0) {
    console.log('Kernel Verified Nodes (first 5):');
    results.kernel.verified.slice(0, 5).forEach(n => {
      console.log(`  - ${n.id}: ${n.title}`);
    });
  }
  if (results.kernel.missing.length > 0) {
    console.log('Kernel Missing Nodes (first 5):');
    results.kernel.missing.slice(0, 5).forEach(n => {
      console.log(`  - ${n.id}: ${n.path}`);
    });
  }

  if (results.swarmmind.verified.length > 0) {
    console.log('SwarmMind Verified Nodes (first 5):');
    results.swarmmind.verified.slice(0, 5).forEach(n => {
      console.log(`  - ${n.id}: ${n.title}`);
    });
  }
  if (results.swarmmind.missing.length > 0) {
    console.log('SwarmMind Missing Nodes (first 5):');
    results.swarmmind.missing.slice(0, 5).forEach(n => {
      console.log(`  - ${n.id}: ${n.path}`);
    });
  }

  // Send messages to Kernel and SwarmMind inboxes
  const timestamp = new Date().toISOString();
  const kernelMessage = {
    schema_version: "1.3",
    task_id: `kernel-unverified-verification-${Date.now()}`,
    idempotency_key: `kernel-unverified-verification-${Date.now()}`,
    from: "archivist",
    to: "kernel",
    type: "response",
    task_kind: "verification",
    priority: "P2",
    subject: "Verification of Kernel UNVERIFIED nodes - file existence check",
    body: `Archivist has verified file existence for Kernel UNVERIFIED nodes.\n\nVerified: ${results.kernel.verified.length}\nMissing: ${results.kernel.missing.length}\n\nDetails:\n- Verified nodes: ${results.kernel.verified.map(n => n.id).join(', ')}\n- Missing nodes: ${results.kernel.missing.map(n => n.id).join(', ')}\n\nThese nodes can be considered verified if the file exists. Please update your graph snapshot accordingly.`,
    requires_action: true,
    payload: {
      mode: "inline",
      compression: "none"
    },
    timestamp: timestamp,
    execution: {
      mode: "manual",
      engine: "kilo",
      actor: "lane"
    },
    evidence: {
      required: true,
      evidence_path: null,
      verified: false,
      verified_by: null,
      verified_at: null
    }
  };

  const swarmmindMessage = {
    ...kernelMessage,
    task_id: `swarmmind-unverified-verification-${Date.now()}`,
    idempotency_key: `swarmmind-unverified-verification-${Date.now()}`,
    to: "swarmmind",
    subject: "Verification of SwarmMind UNVERIFIED nodes - file existence check",
    body: `Archivist has verified file existence for SwarmMind UNVERIFIED nodes.\n\nVerified: ${results.swarmmind.verified.length}\nMissing: ${results.swarmmind.missing.length}\n\nDetails:\n- Verified nodes: ${results.swarmmind.verified.map(n => n.id).join(', ')}\n- Missing nodes: ${results.swarmmind.missing.map(n => n.id).join(', ')}\n\nThese nodes can be considered verified if the file exists. Please update your graph snapshot accordingly.`,
  };

  // Write messages to inboxes
  try {
    fs.writeFileSync(
      path.join(KERNEL_INBOX, `${kernelMessage.task_id}.json`),
      JSON.stringify(kernelMessage, null, 2)
    );
    console.log(`\nMessage sent to Kernel inbox: ${kernelMessage.task_id}.json`);

    fs.writeFileSync(
      path.join(SWARMMIND_INBOX, `${swarmmindMessage.task_id}.json`),
      JSON.stringify(swarmmindMessage, null, 2)
    );
    console.log(`Message sent to SwarmMind inbox: ${swarmmindMessage.task_id}.json`);

    // Also send a copy to Archivist inbox for record
    const archivistMessage = {
      ...kernelMessage,
      task_id: `archivist-verification-record-${Date.now()}`,
      idempotency_key: `archivist-verification-record-${Date.now()}`,
      to: "archivist",
      subject: "Verification record: Kernel and SwarmMind UNVERIFIED nodes",
      body: `Verification completed at ${timestamp}.\n\nKernel: ${results.kernel.verified.length} verified, ${results.kernel.missing.length} missing\nSwarmMind: ${results.swarmmind.verified.length} verified, ${results.swarmmind.missing.length} missing\n\nMessages sent to Kernel and SwarmMind inboxes.`
    };
    fs.writeFileSync(
      path.join(ARCHIVIST_INBOX, `${archivistMessage.task_id}.json`),
      JSON.stringify(archivistMessage, null, 2)
    );
    console.log(`Record sent to Archivist inbox: ${archivistMessage.task_id}.json`);
  } catch (e) {
    console.error(`Error writing message files: ${e.message}`);
    process.exit(1);
  }

  console.log('\n=== Verification complete ===');
}

main();
