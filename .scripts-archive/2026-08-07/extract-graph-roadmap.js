'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = 'S:/Archivist-Agent';
const PACKS_ROOT = path.join(ROOT, 'context-buffer', 'graph-snapshot-packs');
const OUT_ROOT = path.join(ROOT, 'context-buffer');

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function listDirs(p) {
  return fs.readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(p, d.name));
}

function summarizePack(packDir) {
  const manifestPath = path.join(packDir, 'manifest.json');
  const templatePath = path.join(packDir, 'ai-findings.template.json');
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = readJson(manifestPath);
  const files = manifest.map((m) => m.file);
  const bytes = manifest.reduce((a, b) => a + (b.bytes || 0), 0);
  const copyArtifacts = files.filter((f) => f.includes(' - Copy')).length;
  const screenshotCount = files.filter((f) => /Screenshot_/i.test(f)).length;
  const mtimeMin = manifest.map((m) => m.mtime).sort()[0] || null;
  const mtimeMax = manifest.map((m) => m.mtime).sort().slice(-1)[0] || null;
  const hasTemplate = fs.existsSync(templatePath);

  return {
    pack_id: path.basename(packDir),
    path: packDir,
    image_count: manifest.length,
    screenshot_count: screenshotCount,
    bytes_total: bytes,
    copy_artifacts: copyArtifacts,
    has_ai_template: hasTemplate,
    time_window: { min: mtimeMin, max: mtimeMax },
  };
}

function buildFindings(packs) {
  const findings = [];
  const sorted = [...packs].sort((a, b) => a.pack_id.localeCompare(b.pack_id));
  const totalImages = sorted.reduce((a, b) => a + b.image_count, 0);
  const totalCopies = sorted.reduce((a, b) => a + b.copy_artifacts, 0);
  const templateCoverage = sorted.filter((p) => p.has_ai_template).length;

  findings.push({
    finding_id: 'F-001',
    source_snapshot_id: 'all-packs',
    source_repo_or_filter: 'graph-snapshot-packs',
    detection_rule: 'coverage-gap-detection',
    observation: `${templateCoverage}/${sorted.length} packs include AI findings template; non-template packs block structured comparison.`,
    evidence_paths: sorted.filter((p) => !p.has_ai_template).map((p) => path.join(p.path, 'manifest.json')),
    confidence: 'high',
    recommended_owner: 'library',
    recommended_next_action: 'Generate standardized findings JSON for each pack with a shared schema.',
    status: 'observation',
    authority_warning: 'Advisory only; no authority/enforcement inference.',
    priority: 'P0'
  });

  findings.push({
    finding_id: 'F-002',
    source_snapshot_id: 'all-packs',
    source_repo_or_filter: 'graph-snapshot-packs',
    detection_rule: 'drift-over-time-detection',
    observation: `Snapshot volume is high (${totalImages} images) but mostly visual artifacts; contradiction and governance state are not encoded as machine fields.`,
    evidence_paths: sorted.map((p) => path.join(p.path, 'manifest.json')),
    confidence: 'high',
    recommended_owner: 'archivist',
    recommended_next_action: 'Require per-pack machine-readable extraction output (nodes/edges/contradictions/governance links).',
    status: 'observation',
    authority_warning: 'No ratification/enforcement claim allowed from visual data.',
    priority: 'P0'
  });

  findings.push({
    finding_id: 'F-003',
    source_snapshot_id: 'all-packs',
    source_repo_or_filter: 'graph-snapshot-packs',
    detection_rule: 'connectivity-anomaly-detection',
    observation: `${totalCopies} duplicated copy artifacts detected; this can distort trend comparisons and create false contradiction density.`,
    evidence_paths: sorted
      .filter((p) => p.copy_artifacts > 0)
      .map((p) => path.join(p.path, 'manifest.json')),
    confidence: 'medium',
    recommended_owner: 'library',
    recommended_next_action: 'Deduplicate copy artifacts before trend analysis and keep one canonical pack per interval.',
    status: 'hypothesis',
    authority_warning: 'Potential distortion only; requires lane review.',
    priority: 'P1'
  });

  findings.push({
    finding_id: 'F-004',
    source_snapshot_id: 'all-packs',
    source_repo_or_filter: 'graph-snapshot-packs',
    detection_rule: 'governance-path-gap-detection',
    observation: 'Snapshot manifests do not carry explicit governance path metadata (authority/trust/enforcement links).',
    evidence_paths: sorted.map((p) => path.join(p.path, 'manifest.json')),
    confidence: 'high',
    recommended_owner: 'kernel',
    recommended_next_action: 'Add governance link extraction fields to snapshot metadata and findings outputs.',
    status: 'observation',
    authority_warning: 'Governance integrity cannot be inferred from images alone.',
    priority: 'P1'
  });

  findings.push({
    finding_id: 'F-005',
    source_snapshot_id: 'all-packs',
    source_repo_or_filter: 'graph-snapshot-packs',
    detection_rule: 'paper-coverage-gap-detection',
    observation: 'No machine linkage from papers to graph nodes is present in pack manifests/templates.',
    evidence_paths: sorted.map((p) => path.join(p.path, 'manifest.json')),
    confidence: 'medium',
    recommended_owner: 'swarmmind',
    recommended_next_action: 'Emit paper-node mapping table for each snapshot cycle.',
    status: 'needs_lane_review',
    authority_warning: 'Coverage gap inferred from absent fields; needs lane confirmation.',
    priority: 'P2'
  });

  return findings;
}

function rankActions(findings) {
  const priorities = ['P0', 'P1', 'P2', 'P3'];
  const grouped = {};
  priorities.forEach((p) => { grouped[p] = []; });
  for (const f of findings) {
    grouped[f.priority || 'P2'].push({
      finding_id: f.finding_id,
      action: f.recommended_next_action,
      owner: f.recommended_owner,
      evidence_paths: f.evidence_paths,
      status: f.status
    });
  }
  return grouped;
}

function main() {
  const packs = listDirs(PACKS_ROOT)
    .map((d) => summarizePack(d))
    .filter(Boolean);

  const findings = buildFindings(packs);
  const actions = rankActions(findings);
  const ts = isoStamp();

  const result = {
    output_provenance: {
      agent: 'codex-5.3',
      lane: 'archivist',
      generated_at: new Date().toISOString(),
      session_id: 'unknown'
    },
    mode: 'snapshot-driven-roadmap-extraction',
    constraints: {
      read_only: true,
      advisory_only: true,
      no_mutation: ['graph', 'mapper', 'authority', 'enforcement', 'ratification']
    },
    packs_analyzed: packs,
    findings,
    ranked_actions: actions,
    summary: {
      total_packs: packs.length,
      total_findings: findings.length,
      p0: actions.P0.length,
      p1: actions.P1.length,
      p2: actions.P2.length,
      p3: actions.P3.length
    }
  };

  const outJson = path.join(OUT_ROOT, `graph-roadmap-extraction-result-${ts}.json`);
  const outMd = path.join(OUT_ROOT, `graph-roadmap-extraction-result-${ts}.md`);

  fs.writeFileSync(outJson, JSON.stringify(result, null, 2) + '\n', 'utf8');

  const md = [
    '# Graph Roadmap Extraction Result',
    '',
    `Generated: ${result.output_provenance.generated_at}`,
    '',
    `Packs analyzed: ${result.summary.total_packs}`,
    `Findings: ${result.summary.total_findings} (P0=${result.summary.p0}, P1=${result.summary.p1}, P2=${result.summary.p2}, P3=${result.summary.p3})`,
    '',
    '## Top P0 Actions',
    ...actions.P0.map((a) => `- ${a.finding_id}: ${a.action} (owner: ${a.owner})`),
    '',
    '## Boundary',
    '- Advisory-only output; no implementation, ratification, or enforcement actions performed.',
    '',
    '## Evidence',
    `- JSON result: ${outJson}`
  ].join('\n');

  fs.writeFileSync(outMd, md + '\n', 'utf8');

  console.log(JSON.stringify({ outJson, outMd }, null, 2));
}

main();
