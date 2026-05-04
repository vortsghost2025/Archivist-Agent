'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = 'S:/Archivist-Agent';
const GRAPH_JSON = 'S:/self-organizing-library/reports/graph-work-path-2026-05-01.json';
const OUTPUT_DIR = path.join(ROOT, 'context-buffer');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'archivist-node-verification-report.json');

function main() {
  console.log('Loading graph work-path data...');
  const data = JSON.parse(fs.readFileSync(GRAPH_JSON, 'utf8'));

  const archItems = [];
  for (const [bucketName, items] of Object.entries(data.buckets)) {
    items.filter(i => i.repo === 'Archivist-Agent').forEach(i => {
      archItems.push({ ...i, bucket: bucketName });
    });
  }

  const uniqueItems = new Map();
  archItems.forEach(i => {
    if (!uniqueItems.has(i.id)) {
      uniqueItems.set(i.id, i);
    }
  });

  console.log(`Found ${archItems} total, ${uniqueItems.size} unique Archivist-Agent items`);

  console.log('Building repo file index...');
  const trackedFiles = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(f => f);
  console.log(`Repo has ${trackedFiles.length} tracked files`);

  const fileBasenameMap = new Map();
  const filePathMap = new Map();
  for (const fp of trackedFiles) {
    filePathMap.set(fp.toLowerCase(), fp);
    const basename = path.basename(fp, path.extname(fp)).toLowerCase();
    if (!fileBasenameMap.has(basename)) {
      fileBasenameMap.set(basename, []);
    }
    fileBasenameMap.get(basename).push(fp);
  }

  console.log('Running verification...');
  const results = {
    verified: [],
    not_found: [],
    ambiguous: [],
    stats: { total: 0, verified_count: 0, not_found_count: 0, ambiguous_count: 0 }
  };

  const priorityOrder = ['governance', 'root-doc', 'schema', 'config', 'code', 'test', 'bridge', 'attestation', 'script', 'docs', 'paper', 'ai-ensemble-lab', 'coordination', 'evidence', 'infrastructure', 'lane-protocol', 'log', 'memory', 'monitoring', 'queue', 'tool', 'archivist', 'scratch', 'sensitive', 'ui', 'plans'];

  const sortedItems = [...uniqueItems.values()].sort((a, b) => {
    const ai = priorityOrder.indexOf(a.category);
    const bi = priorityOrder.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const item of sortedItems) {
    const match = findBestMatch(item, filePathMap, fileBasenameMap, trackedFiles);
    const result = {
      id: item.id,
      title: item.title,
      category: item.category,
      bucket: item.bucket,
      governanceLayer: item.governanceLayer,
      authorityDepth: item.authorityDepth,
      bridgeState: item.bridgeState,
      tags: item.tags,
      match_type: match.type,
      matched_path: match.path,
      match_confidence: match.confidence,
      candidate_paths: match.candidates
    };

    results.stats.total++;
    if (match.type === 'verified') {
      results.verified.push(result);
      results.stats.verified_count++;
    } else if (match.type === 'not_found') {
      results.not_found.push(result);
      results.stats.not_found_count++;
    } else {
      results.ambiguous.push(result);
      results.stats.ambiguous_count++;
    }
  }

  console.log('\n=== VERIFICATION RESULTS ===');
  console.log(`Total: ${results.stats.total}`);
  console.log(`Verified: ${results.stats.verified_count}`);
  console.log(`Not Found: ${results.stats.not_found_count}`);
  console.log(`Ambiguous: ${results.stats.ambiguous_count}`);

  console.log('\nBy Category (verified/not_found/ambiguous):');
  const catStats = {};
  for (const item of sortedItems) {
    if (!catStats[item.category]) catStats[item.category] = { v: 0, n: 0, a: 0 };
  }
  results.verified.forEach(r => catStats[r.category] && catStats[r.category].v++);
  results.not_found.forEach(r => catStats[r.category] && catStats[r.category].n++);
  results.ambiguous.forEach(r => catStats[r.category] && catStats[r.category].a++);
  for (const [cat, s] of Object.entries(catStats).sort((a, b) => priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]))) {
    console.log(`  ${cat}: ${s.v}/${s.n}/${s.a}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport written to ${OUTPUT_FILE}`);

  console.log('\n=== NOT FOUND ITEMS (first 30) ===');
  results.not_found.slice(0, 30).forEach(r => {
    console.log(`  [${r.category}] ${r.title.substring(0, 80)}`);
  });
}

function findBestMatch(item, filePathMap, fileBasenameMap, trackedFiles) {
  const title = item.title;
  const titleLower = title.toLowerCase();

  if (filePathMap.has(titleLower)) {
    return { type: 'verified', path: filePathMap.get(titleLower), confidence: 'exact', candidates: [] };
  }

  if (filePathMap.has(titleLower.replace(/ /g, '-'))) {
    return { type: 'verified', path: filePathMap.get(titleLower.replace(/ /g, '-')), confidence: 'high', candidates: [] };
  }

  const stemFromTitle = titleLower
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (filePathMap.has(stemFromTitle)) {
    return { type: 'verified', path: filePathMap.get(stemFromTitle), confidence: 'high', candidates: [] };
  }

  const basenameMatches = fileBasenameMap.get(stemFromTitle) || [];

  if (basenameMatches.length === 1) {
    return { type: 'verified', path: basenameMatches[0], confidence: 'high', candidates: [] };
  }
  if (basenameMatches.length > 1) {
    return { type: 'ambiguous', path: null, confidence: 'medium', candidates: basenameMatches };
  }

  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'what', 'when', 'where', 'which', 'their', 'about', 'could', 'would', 'should', 'these', 'those'].includes(w));
  const scoredMatches = [];
  for (const fp of trackedFiles) {
    const fpLower = fp.toLowerCase();
    const basename = path.basename(fp, path.extname(fp)).toLowerCase();
    let score = 0;
    for (const word of titleWords.slice(0, 8)) {
      if (basename.includes(word)) score += 2;
      else if (fpLower.includes(word)) score += 1;
    }
    if (score >= Math.min(titleWords.length, 4)) {
      scoredMatches.push({ path: fp, score });
    }
  }
  scoredMatches.sort((a, b) => b.score - a.score);

  if (scoredMatches.length === 1 && scoredMatches[0].score >= 6) {
    return { type: 'verified', path: scoredMatches[0].path, confidence: 'medium', candidates: [] };
  }
  if (scoredMatches.length > 1 && scoredMatches[0].score >= 8 && scoredMatches[0].score > scoredMatches[1].score * 1.5) {
    return { type: 'verified', path: scoredMatches[0].path, confidence: 'medium', candidates: scoredMatches.slice(0, 3).map(m => m.path) };
  }
  if (scoredMatches.length >= 1 && scoredMatches[0].score >= 4) {
    return { type: 'ambiguous', path: null, confidence: 'low', candidates: scoredMatches.slice(0, 5).map(m => m.path) };
  }

  if (item.category === 'script') {
    const scriptName = titleLower.endsWith('.js') ? titleLower : titleLower + '.js';
    const scriptPath = 'scripts/' + scriptName;
    if (filePathMap.has(scriptPath)) {
      return { type: 'verified', path: scriptPath, confidence: 'high', candidates: [] };
    }
  }

  if (item.category === 'governance' || item.category === 'root-doc') {
    for (const fp of trackedFiles) {
      const fpLower = fp.toLowerCase();
      if ((fpLower.includes('governance') || fpLower.includes('covenant') || fpLower.includes('bootstrap') || fpLower.includes('agents.md') || fpLower.includes('cps') || fpLower.includes('verification')) && fpLower.includes('.md')) {
        const basename = path.basename(fp, '.md').toLowerCase();
        const shortTitle = titleLower.substring(0, 30);
        if (basename.includes(shortTitle.substring(0, 15)) || shortTitle.includes(basename)) {
          return { type: 'verified', path: fp, confidence: 'medium', candidates: [] };
        }
      }
    }
  }

  return { type: 'not_found', path: null, confidence: 'none', candidates: scoredMatches.slice(0, 3).map(m => m.path) };
}

main();
