const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const SNAPSHOT_PATH = process.argv[2] || 'S:/Archivist-Agent/context-buffer/graph-snapshot-2026-04-30-16-11-43-243.json';
const DRY_RUN = process.argv.includes('--dry-run');
// =======================================

console.log('=== Archivist Graph Auto-Reclassifier (Tag-Group Artifact Cleanup) ===\n');

if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot not found: ${SNAPSHOT_PATH}`);
    process.exit(1);
}

// Load graph
const graph = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const nodes = graph.nodes || [];
const edges = graph.edges || [];

console.log(`Graph: ${nodes.length} nodes, ${edges.length} edges`);
console.log('Status:', graph.status_counts || {});

// Find CONTRADICTS edges
const contradicts = edges.filter(e => String(e.type).toUpperCase() === 'CONTRADICTS');
const contraByNode = {};
contradicts.forEach(e => {
    if (!contraByNode[e.source]) contraByNode[e.source] = 0;
    if (!contraByNode[e.target]) contraByNode[e.target] = 0;
    contraByNode[e.source] += 1;
    contraByNode[e.target] += 1;
});

// Find conflicted nodes with ZERO CONTRADICTS edges (tag-group artifacts)
const toReclassify = nodes.filter(n => {
    if (n.status !== 'CONFLICTED') return false;
    return (contraByNode[n.id] || 0) === 0; // zero CONTRADICTS edges
});

console.log(`\nFound ${toReclassify.length} conflicted nodes with ZERO CONTRADICTS edges:`);
toReclassify.forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.id} | ${(n.title || 'untitled').substring(0, 70)} | contras: ${n.contradictionCount || 0}`);
});

if (toReclassify.length === 0) {
    console.log('\n✅ No reclassification needed — all conflicted nodes have CONTRADICTS edges.');
    process.exit(0);
}

// Build patch
const patch = {
    snapshot_id: graph.snapshot_id || 'archivist-auto-patch',
    created_at: new Date().toISOString(),
    reclassify_count: toReclassify.length,
    reclassify_type: 'tag-group-artifact',
    target_snapshot: SNAPSHOT_PATH,
    changes: toReclassify.map(n => ({
        node_id: n.id,
        old_status: 'CONFLICTED',
        new_status: 'UNVERIFIED',
        reason: 'Zero CONTRADICTS edges; tag-cooccurrence artifact per Archivist cleanup; contradictionCount=' + (n.contradictionCount || 0),
        artifact_class: 'tag_group',
        tags_to_add: ['artifact_class:tag_group', 'reclassified:2026-04-30'],
        tags_to_remove: []
    }))
};

// Save patch file
const outDir = 'S:/Archivist-Agent/context-buffer/graph-patches';
fs.mkdirSync(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const patchFile = path.join(outDir, `reclassify-tag-artifacts-archivist-${timestamp}.json`);
fs.writeFileSync(patchFile, JSON.stringify(patch, null, 2));
console.log(`\n📄 Patch file written: ${patchFile}`);

// Summary table
console.log('\n=== PATCH SUMMARY ===');
console.log('Node ID'.padEnd(22) + 'Title'.padEnd(60) + 'Old→New');
patch.changes.forEach(c => {
    const node = toReclassify.find(n => n.id === c.node_id);
    console.log(c.node_id.padEnd(22) + (node?.title?.substring(0, 60) || '').padEnd(60) + 'CONFLICTED→UNVERIFIED');
});

if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no changes applied. Remove --dry-run to apply.');
} else {
    // Apply changes to graph
    toReclassify.forEach(n => {
        n.status = 'UNVERIFIED';
        if (!n.tags) n.tags = [];
        if (!n.tags.includes('artifact_class:tag_group')) n.tags.push('artifact_class:tag_group');
        if (!n.tags.includes('reclassified:2026-04-30')) n.tags.push('reclassified:2026-04-30');
        n.reclassification_note = 'Auto-reclassified by tag-group artifact detector; zero CONTRADICTS edges; spurious contradictionCount';
        n.reclassified_at = new Date().toISOString();
        n.reclassified_by = 'archivist-automation';
    });

    // Update status counts (estimate)
    graph.status_counts = graph.status_counts || {};
    graph.status_counts.conflicted = Math.max(0, (graph.status_counts.conflicted || 0) - toReclassify.length);
    graph.status_counts.unverified = (graph.status_counts.unverified || 0) + toReclassify.length;

    // Backup and write
    const backupPath = SNAPSHOT_PATH + '.backup-' + timestamp;
    fs.copyFileSync(SNAPSHOT_PATH, backupPath);
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(graph, null, 2));
    console.log(`✅ Graph updated in place (backup saved: ${backupPath})`);
    console.log(`   Conflicted: ${graph.status_counts.conflicted} → Unverified: ${graph.status_counts.unverified}`);
}

console.log('\nDone. The Archivist repo graph is now clean of tag-group artifact contradictions.');

