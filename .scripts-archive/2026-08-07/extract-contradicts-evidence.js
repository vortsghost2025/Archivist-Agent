'use strict';

const fs = require('fs');
const path = require('path');

const TARGET_NODES = [
  'e2d590843468dbe7',
  'f536c15cc2486eea',
  '3023460d99160a03',
  'fb8212e128adc1c5',
  '1bda9962fbd5ca75',
  '45d50e60309ef11c',
  '8f11fb5f4a3a5efc'
];

const DEFAULT_SNAPSHOTS = [
  'S:/self-organizing-library/docs/graph/snapshots/snapshot-Archivist-Agent-2026-04-29T20-16-18.json',
  'S:/self-organizing-library/docs/graph/snapshots/contradiction-hub-Archivist-Agent-2026-04-29T20-16-18.json'
];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function normalizeEdgeType(value) {
  return String(value || '').trim().toLowerCase();
}

function isContradictsType(type) {
  return [
    'contradicts',
    'contradiction',
    'conflicts_with',
    'conflict'
  ].includes(type);
}

function nodeExistsInDoc(doc, nodeId) {
  if (Array.isArray(doc)) {
    return doc.some((x) => String(x.id || '') === nodeId);
  }
  const nodes = (doc && doc.nodes) || [];
  return nodes.some((x) => String(x.id || '') === nodeId);
}

function collectEdgesForNode(doc, nodeId) {
  if (Array.isArray(doc)) return [];
  const edges = (doc && doc.edges) || [];
  return edges.filter((e) => String(e.source) === nodeId || String(e.target) === nodeId);
}

function summarizeEdgeTypes(edges) {
  const counts = {};
  for (const edge of edges) {
    const type = normalizeEdgeType(edge.type || edge.relationship || edge.kind || edge.label || 'unknown');
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function run(snapshots) {
  const evidence = [];
  for (const nodeId of TARGET_NODES) {
    const perSnapshot = [];
    let contradictsFound = false;

    for (const snapshotPath of snapshots) {
      const exists = fs.existsSync(snapshotPath);
      if (!exists) {
        perSnapshot.push({
          snapshot_path: snapshotPath,
          exists: false
        });
        continue;
      }

      const doc = readJson(snapshotPath);
      const nodePresent = nodeExistsInDoc(doc, nodeId);
      const edges = collectEdgesForNode(doc, nodeId);
      const edgeTypeCounts = summarizeEdgeTypes(edges);
      const contradictEdges = edges.filter((e) =>
        isContradictsType(normalizeEdgeType(e.type || e.relationship || e.kind || e.label))
      );
      if (contradictEdges.length > 0) contradictsFound = true;

      perSnapshot.push({
        snapshot_path: snapshotPath,
        exists: true,
        node_present: nodePresent,
        connected_edge_count: edges.length,
        edge_type_counts: edgeTypeCounts,
        contradicts_edge_count: contradictEdges.length,
        contradicts_edges: contradictEdges.slice(0, 25).map((e) => ({
          source: e.source,
          target: e.target,
          type: e.type || e.relationship || e.kind || e.label || 'unknown'
        }))
      });
    }

    evidence.push({
      node_id: nodeId,
      contradicts_found: contradictsFound,
      status_recommendation: contradictsFound ? 'needs_lane_review' : 'proven_spurious',
      snapshots_checked: perSnapshot
    });
  }
  return evidence;
}

function writeOutputs(evidence, snapshots) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outJson = `S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-${ts}.json`;
  const outMd = `S:/Archivist-Agent/context-buffer/contradicts-edge-evidence-20260430-${ts}.md`;

  const payload = {
    output_provenance: {
      agent: 'codex-5.3',
      lane: 'archivist',
      generated_at: new Date().toISOString(),
      session_id: 'unknown'
    },
    purpose: 'validate explicit CONTRADICTS edge artifacts for pending needs_lane_review nodes',
    snapshots_checked: snapshots,
    results: evidence
  };

  fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const lines = [];
  lines.push('# CONTRADICTS Edge Evidence Packet');
  lines.push('');
  lines.push(`Generated: ${payload.output_provenance.generated_at}`);
  lines.push('');
  lines.push('## Result Summary');
  for (const row of evidence) {
    lines.push(`- ${row.node_id}: contradicts_found=${row.contradicts_found} recommendation=${row.status_recommendation}`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('- Recommendation is evidence-driven from snapshots checked above.');
  lines.push('- If newer graph snapshots exist, rerun this script with updated paths.');

  fs.writeFileSync(outMd, lines.join('\n') + '\n', 'utf8');
  return { outJson, outMd };
}

function main() {
  const snapshots = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_SNAPSHOTS;
  const evidence = run(snapshots);
  const outputs = writeOutputs(evidence, snapshots);
  console.log(JSON.stringify(outputs, null, 2));
}

main();
