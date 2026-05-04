'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = 'S:/Archivist-Agent';
const GRAPH_JSON = 'S:/self-organizing-library/reports/graph-work-path-2026-05-01.json';
const OUTPUT_DIR = path.join(ROOT, 'context-buffer');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'archivist-node-verification-report-v3.json');

const CATEGORY_PREFIX_MAP = {
  'script': ['scripts/', 'src-tauri/', ''],
  'docs': ['docs/', 'docs/ops/', 'docs/spec/', 'docs/governance/', 'docs/graph/', 'docs/archive/', 'docs/failure-topology/', 'docs/autonomous-cycle-test/', ''],
  'schema': ['schemas/', ''],
  'bridge': ['src/bridge/', 'src/', ''],
  'config': ['config/', '.github/', '.github/workflows/', ''],
  'test': ['tests/', 'src/bridge/__tests__/', 'src/queue/__tests__/', ''],
  'evidence': ['evidence/', 'evidence/graph-snapshots/', 'evidence/productivity-reports/', ''],
  'monitoring': ['src/monitoring/', 'src/', ''],
  'queue': ['src/queue/', 'src/', ''],
  'tool': ['src/tools/', 'src/', ''],
  'lane-protocol': ['src/lane/', 'src/', ''],
  'memory': ['src/memory/', 'src/', ''],
  'ui': ['ui/', ''],
  'log': ['logs/', ''],
  'attestation': ['src/attestation/', 'src/', ''],
  'code': ['src/', 'src/core/', 'src/orchestrator/', 'src-tauri/src/', ''],
  'infrastructure': ['.github/', '.github/workflows/', ''],
  'coordination': ['docs/', 'context-buffer/', ''],
  'governance': ['docs/governance/', 'docs/', 'swarmmind-governance-extension/', ''],
  'root-doc': ['', 'docs/', 'context-buffer/'],
  'archivist': ['', 'src/', 'scripts/'],
  'scratch': ['', 'context-buffer/'],
  'sensitive': ['', 'config/', ''],
  'plans': ['', 'docs/', 'context-buffer/'],
  'paper': ['docs/', ''],
  'ai-ensemble-lab': ['', 'src/', 'docs/'],
};

const MISATTRIBUTED_SWARMMIND_FILES = new Set([
  'api.ts', 'logger.ts', 'phenotypeStore.ts', 'quarantineStore.ts',
  'recoveryEngine.ts', 'trace-schema.js', 'run-tests.js',
  'confidence.js', 'index.js', 'outcome.js', 'outcome_router.js',
  'sample-merged-trace.json', 'episode-exported.json', 'episode-trace.json',
  'live-trace-exported.json', 'live-trace-human-001.json',
  'live-trace-human-002.json', 'live-trace-human-003.json',
  'live-trace-human-004.json', 'live-trace-merged.json'
]);

const SESSION_MARKER_PATTERNS = [
  /^APR\d{2}$/i, /^MAY\d{2}$/i, /^JUN\d{2}$/i, /^JUL\d{2}$/i,
  /^codereview\d+$/i, /^new session/i,
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, /^session\s*-\s*\d{4}/i,
  /^session\s+\d+/i, /^checkpoint\s+\d+/i, /^\d{4}-\d{2}-\d{2}\s/,
];

const CONVERSATION_FRAGMENT_PATTERNS = [
  /^\p{Emoji_Presentation}/u,
  /^[\u{1F300}-\u{1F9FF}]/u,
  /^(what|how|why|when|where|should|can|is|are|do|could|would|let|the|this|that|these|those|we|you|i|it|there|here)\s/i,
  /^[A-Z][a-z].*\s+(the|a|an|is|are|was|were|has|have|had|to|of|in|for|on|with|at|by|from|and|or|but|not)\s/i,
  /^\W+/, 
];

const DELETED_FILES_MEANINGFUL = [
  'Cargo.toml', 'Cargo.lock', 'build.rs', 'src/main.rs', 'src/lib.rs',
  'src/commands/mod.rs', 'src/attestation/test-pki.js', 'PROJECT_REGISTRY.md',
  'kilo.json', '.identity/private.pem', '.identity/public.pem',
  'everytime claude.txt',
];

function splitConcatenatedWords(title) {
  const stem = title.replace(/\.[a-z]+$/i, '');
  if (/^[A-Z0-9_]+$/.test(stem) && stem.length > 10 && stem.includes('_')) {
    return [stem.toLowerCase(), stem.replace(/_/g, '-').toLowerCase()];
  }
  if (/^[A-Z][a-z]+[A-Z]/.test(stem) || /^[A-Z]{2,}[a-z]/.test(stem)) {
    const split = stem.replace(/([a-z])([A-Z])/g, '$1_$2')
                      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                      .toLowerCase();
    return [split, split.replace(/_/g, '-')];
  }
  const allCapsSplit = stem.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                           .replace(/([a-z])([A-Z])/g, '$1_$2');
  if (allCapsSplit !== stem && /_/.test(allCapsSplit)) {
    return [allCapsSplit.toLowerCase(), allCapsSplit.replace(/_/g, '-').toLowerCase()];
  }
  return [];
}

function isConversationFragment(title, category) {
  if (category === 'scratch') return true;
  if (CONVERSATION_FRAGMENT_PATTERNS.some(p => p.test(title))) {
    if (title.length > 40 && /\s/.test(title)) return true;
    if (title.split(/\s+/).length >= 5) return true;
  }
  if (/^[A-Z][a-z]/.test(title) && title.length > 50 && /\s{2,}/.test(title)) return true;
  if (/^\p{Emoji_Presentation}/u.test(title)) return true;
  const words = title.split(/\s+/);
  if (words.length >= 8 && !/\.(rs|js|ts|json|md|yaml|yml|toml|html|css|py|txt|sh|jsx|tsx|lock)$/i.test(title)) {
    return true;
  }
  return false;
}

function contentPeek(filePath, maxLines) {
  try {
    const fullPath = path.join(ROOT, filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').slice(0, maxLines || 10);
    const header = lines.find(l => /^#\s+/.test(l.trim()));
    if (header) return header.trim().replace(/^#+\s*/, '');
    const jsDocTitle = lines.find(l => /^\s*\*\s*@title\s+/i.test(l) || /^\s*\*\s*@file\s+/i.test(l));
    if (jsDocTitle) return jsDocTitle.trim().replace(/^\s*\*\s*@(title|file)\s+/i, '');
    const firstMeaningful = lines.find(l => l.trim().length > 5 && !/^\s*(\/\/|#\s*!|\/\*|\*)/.test(l.trim()));
    if (firstMeaningful) return firstMeaningful.trim().substring(0, 80);
    return null;
  } catch (_) {
    return null;
  }
}

function titleMatchesContentHeader(title, header) {
  if (!header) return false;
  const tLow = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hLow = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (tLow === hLow) return true;
  if (tLow.length > 5 && hLow.includes(tLow)) return true;
  if (hLow.length > 5 && tLow.includes(hLow)) return true;
  const tWords = tLow.split(/(?=[a-z]{3,})/).filter(w => w.length >= 3);
  const hWords = hLow.split(/(?=[a-z]{3,})/).filter(w => w.length >= 3);
  if (tWords.length >= 2 && hWords.length >= 2) {
    const overlap = tWords.filter(w => hWords.some(hw => hw.includes(w) || w.includes(hw)));
    if (overlap.length / Math.max(tWords.length, 1) >= 0.6) return true;
  }
  return false;
}

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

  console.log(`Found ${archItems.length} total, ${uniqueItems.size} unique Archivist-Agent items`);

  console.log('Building repo file index...');
  const trackedFiles = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(f => f);
  console.log(`Repo has ${trackedFiles.length} tracked files`);

  const allRepoFiles = new Set(trackedFiles);
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

  console.log('Building untracked file index...');
  let untrackedFiles = [];
  try {
    untrackedFiles = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter(f => f && !f.startsWith('lanes/'));
  } catch (_) {}
  for (const uf of untrackedFiles) {
    allRepoFiles.add(uf);
    filePathMap.set(uf.toLowerCase(), uf);
    const basename = path.basename(uf, path.extname(uf)).toLowerCase();
    if (!fileBasenameMap.has(basename)) {
      fileBasenameMap.set(basename, []);
    }
    fileBasenameMap.get(basename).push(uf);
  }
  console.log(`Plus ${untrackedFiles.length} untracked files`);

  console.log('Building .artifacts/ index...');
  const artifactsDir = path.join(ROOT, '.artifacts');
  const artifactsFiles = fs.existsSync(artifactsDir)
    ? fs.readdirSync(artifactsDir).filter(f => f.endsWith('.md'))
    : [];
  const artifactsMap = new Map();
  for (const af of artifactsFiles) {
    const stem = af.replace(/\.md$/i, '').toLowerCase();
    artifactsMap.set(stem, `.artifacts/${af}`);
    const words = stem.split(/[_-]+/).filter(w => w.length > 2);
    if (!artifactsMap.has(words.join('_'))) {
      artifactsMap.set(words.join('_'), `.artifacts/${af}`);
    }
  }
  console.log(`Found ${artifactsFiles.length} .artifacts/ files`);

  const deletedSet = new Set(DELETED_FILES_MEANINGFUL.map(f => f.toLowerCase()));
  const deletedBasenameMap = new Map();
  for (const df of DELETED_FILES_MEANINGFUL) {
    const bn = path.basename(df, path.extname(df)).toLowerCase();
    if (!deletedBasenameMap.has(bn)) {
      deletedBasenameMap.set(bn, []);
    }
    deletedBasenameMap.get(bn).push(df);
  }

  console.log('Running v3 verification...');
  const classifications = {
    VERIFIED: [],
    MISATTRIBUTED: [],
    DELETED: [],
    SESSION_ARTIFACT: [],
    ARTIFACTS_MATCH: [],
    STALE: [],
    CONVERSATION_FRAGMENT: [],
    NEEDS_VERIFICATION: [],
  };

  const priorityOrder = ['governance', 'root-doc', 'schema', 'config', 'code', 'test', 'bridge', 'attestation', 'script', 'docs', 'paper', 'ai-ensemble-lab', 'coordination', 'evidence', 'infrastructure', 'lane-protocol', 'log', 'memory', 'monitoring', 'queue', 'tool', 'archivist', 'scratch', 'sensitive', 'ui', 'plans'];

  const sortedItems = [...uniqueItems.values()].sort((a, b) => {
    const ai = priorityOrder.indexOf(a.category);
    const bi = priorityOrder.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let contentPeekCount = 0;
  for (const item of sortedItems) {
    const result = classifyNode(item, filePathMap, fileBasenameMap, allRepoFiles, artifactsMap, deletedSet, deletedBasenameMap);
    result.id = item.id;
    result.title = item.title;
    result.category = item.category;
    result.bucket = item.bucket;
    result.governanceLayer = item.governanceLayer;
    result.authorityDepth = item.authorityDepth;
    result.bridgeState = item.bridgeState;
    result.tags = item.tags;

    if (result.classification === 'NEEDS_VERIFICATION' && result.candidate_paths && result.candidate_paths.length === 1) {
      const candidate = result.candidate_paths[0];
      const header = contentPeek(candidate, 10);
      if (header && titleMatchesContentHeader(item.title, header)) {
        result.classification = 'VERIFIED';
        result.confidence = 'medium';
        result.evidence = `Content-peek match: file header "${header}" matches title. Path: ${candidate}`;
        result.matched_path = candidate;
        contentPeekCount++;
      }
    }

    if (result.classification === 'NEEDS_VERIFICATION' && result.candidate_paths && result.candidate_paths.length > 1 && result.candidate_paths.length <= 3) {
      for (const candidate of result.candidate_paths) {
        const header = contentPeek(candidate, 10);
        if (header && titleMatchesContentHeader(item.title, header)) {
          result.classification = 'VERIFIED';
          result.confidence = 'medium';
          result.evidence = `Content-peek match (multi-candidate): file header "${header}" matches title. Path: ${candidate}`;
          result.matched_path = candidate;
          contentPeekCount++;
          break;
        }
      }
    }

    classifications[result.classification].push(result);
  }

  const stats = {};
  for (const [cls, items] of Object.entries(classifications)) {
    stats[cls] = items.length;
  }
  stats.total = Object.values(stats).reduce((s, v) => s + v, 0);

  console.log('\n=== V3 VERIFICATION RESULTS ===');
  for (const [cls, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(` ${cls}: ${count}`);
  }
  console.log(` Content-peek promotions: ${contentPeekCount}`);

  console.log('\nBy Category + Classification:');
  const catCls = {};
  for (const [cls, items] of Object.entries(classifications)) {
    for (const item of items) {
      if (!catCls[item.category]) catCls[item.category] = {};
      catCls[item.category][cls] = (catCls[item.category][cls] || 0) + 1;
    }
  }
  for (const cat of priorityOrder) {
    if (catCls[cat]) {
      const parts = Object.entries(catCls[cat]).map(([c, n]) => `${c}=${n}`).join(', ');
      console.log(` ${cat}: ${parts}`);
    }
  }

  const report = {
    version: 3,
    generated_at: new Date().toISOString(),
    stats,
    content_peek_promotions: contentPeekCount,
    classifications,
    category_breakdown: catCls,
    recommendations: generateRecommendations(classifications),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${OUTPUT_FILE}`);

  console.log('\n=== MISATTRIBUTED ITEMS ===');
  classifications.MISATTRIBUTED.forEach(r => {
    console.log(` [${r.category}] ${r.title} → ${r.evidence}`);
  });

  console.log('\n=== DELETED ITEMS ===');
  classifications.DELETED.forEach(r => {
    console.log(` [${r.category}] ${r.title} → was: ${r.matched_path}`);
  });

  console.log('\n=== SESSION ARTIFACTS ===');
  classifications.SESSION_ARTIFACT.forEach(r => {
    console.log(` ${r.title}`);
  });

  console.log('\n=== CONVERSATION FRAGMENTS ===');
  classifications.CONVERSATION_FRAGMENT.forEach(r => {
    console.log(` [${r.category}] "${r.title.substring(0, 80)}"`);
  });

  console.log('\n=== NEEDS VERIFICATION (first 30) ===');
  classifications.NEEDS_VERIFICATION.slice(0, 30).forEach(r => {
    console.log(` [${r.category}] ${r.title.substring(0, 80)}`);
    if (r.candidate_paths && r.candidate_paths.length) {
      console.log(`   candidates: ${r.candidate_paths.slice(0, 3).join(', ')}`);
    }
  });
}

function classifyNode(item, filePathMap, fileBasenameMap, allRepoFiles, artifactsMap, deletedSet, deletedBasenameMap) {
  const title = item.title;
  const titleLower = title.toLowerCase();

  if (MISATTRIBUTED_SWARMMIND_FILES.has(title) || MISATTRIBUTED_SWARMMIND_FILES.has(path.basename(title))) {
    return {
      classification: 'MISATTRIBUTED',
      confidence: 'high',
      evidence: 'SwarmMind source file incorrectly tagged repo=Archivist-Agent',
      matched_path: null,
      candidate_paths: [],
    };
  }

  if (MISATTRIBUTED_SWARMMIND_FILES.has(titleLower) || MISATTRIBUTED_SWARMMIND_FILES.has(path.basename(titleLower))) {
    return {
      classification: 'MISATTRIBUTED',
      confidence: 'high',
      evidence: 'SwarmMind source file incorrectly tagged repo=Archivist-Agent',
      matched_path: null,
      candidate_paths: [],
    };
  }

  for (const pattern of SESSION_MARKER_PATTERNS) {
    if (pattern.test(title)) {
      return {
        classification: 'SESSION_ARTIFACT',
        confidence: 'high',
        evidence: `Title matches session marker pattern: ${pattern}`,
        matched_path: null,
        candidate_paths: [],
      };
    }
  }

  const exactResult = findInRepo(title, titleLower, filePathMap, fileBasenameMap, allRepoFiles, item.category);
  if (exactResult.type === 'verified') {
    return {
      classification: 'VERIFIED',
      confidence: exactResult.confidence,
      evidence: `Matched repo file: ${exactResult.path}`,
      matched_path: exactResult.path,
      candidate_paths: exactResult.candidates || [],
    };
  }

  const artifactResult = findInArtifacts(title, titleLower, artifactsMap);
  if (artifactResult) {
    return {
      classification: 'ARTIFACTS_MATCH',
      confidence: artifactResult.confidence,
      evidence: `Matched .artifacts/ file: ${artifactResult.path}`,
      matched_path: artifactResult.path,
      candidate_paths: [],
    };
  }

  const deletedResult = findInDeleted(title, titleLower, deletedSet, deletedBasenameMap);
  if (deletedResult) {
    return {
      classification: 'DELETED',
      confidence: deletedResult.confidence,
      evidence: 'File existed but was deleted from repo',
      matched_path: deletedResult.path,
      candidate_paths: [],
    };
  }

  if (isConversationFragment(title, item.category)) {
    return {
      classification: 'CONVERSATION_FRAGMENT',
      confidence: 'medium',
      evidence: 'Title appears to be a conversation/scratch fragment, not a file reference',
      matched_path: null,
      candidate_paths: [],
    };
  }

  const prefixResult = findWithCategoryPrefix(title, titleLower, filePathMap, fileBasenameMap, item.category);
  if (prefixResult) {
    if (prefixResult.type === 'verified') {
      return {
        classification: 'VERIFIED',
        confidence: prefixResult.confidence,
        evidence: `Category-prefix match: ${prefixResult.path}`,
        matched_path: prefixResult.path,
        candidate_paths: [],
      };
    }
  }

  const splitNames = splitConcatenatedWords(title);
  for (const splitName of splitNames) {
    if (filePathMap.has(splitName)) {
      return {
        classification: 'VERIFIED',
        confidence: 'medium',
        evidence: `Concatenated-word split match: ${filePathMap.get(splitName)}`,
        matched_path: filePathMap.get(splitName),
        candidate_paths: [],
      };
    }
    const prefixes = CATEGORY_PREFIX_MAP[item.category] || [''];
    for (const prefix of prefixes) {
      const candidate = prefix + splitName;
      if (filePathMap.has(candidate.toLowerCase())) {
        return {
          classification: 'VERIFIED',
          confidence: 'medium',
          evidence: `Split + prefix match: ${filePathMap.get(candidate.toLowerCase())}`,
          matched_path: filePathMap.get(candidate.toLowerCase()),
          candidate_paths: [],
        };
      }
    }
  }

  const ambiguousResult = exactResult.type === 'ambiguous' ? exactResult : null;
  if (ambiguousResult && ambiguousResult.candidates && ambiguousResult.candidates.length > 0) {
    if (ambiguousResult.candidates.length === 1) {
      const candidate = ambiguousResult.candidates[0];
      const candidateBasename = path.basename(candidate, path.extname(candidate)).toLowerCase();
      const titleBasename = titleLower.replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]/g, '');
      const cleanCandidateBasename = candidateBasename.replace(/[^a-z0-9]/g, '');
      if (titleBasename === cleanCandidateBasename) {
        return {
          classification: 'VERIFIED',
          confidence: 'medium',
          evidence: `Single candidate exact basename match: ${candidate}`,
          matched_path: candidate,
          candidate_paths: [],
        };
      }
    }
    return {
      classification: 'NEEDS_VERIFICATION',
      confidence: 'low',
      evidence: 'Multiple candidate matches, none confident enough',
      matched_path: null,
      candidate_paths: ambiguousResult.candidates.slice(0, 5),
    };
  }

  if (item.category === 'root-doc' || item.category === 'docs' || item.category === 'scratch') {
    const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
    if (titleWords.length <= 2 && titleWords.length > 0) {
      const shortMatches = [];
      for (const fp of allRepoFiles) {
        const bn = path.basename(fp, path.extname(fp)).toLowerCase();
        if (bn === titleLower || bn === titleLower.replace(/\s+/g, '_') || bn === titleLower.replace(/\s+/g, '-')) {
          shortMatches.push(fp);
        }
      }
      if (shortMatches.length === 1) {
        return {
          classification: 'VERIFIED',
          confidence: 'medium',
          evidence: `Short-title exact basename match: ${shortMatches[0]}`,
          matched_path: shortMatches[0],
          candidate_paths: [],
        };
      }
    }
  }

  const scoredMatches = fuzzyMatch(title, titleLower, allRepoFiles);
  if (scoredMatches.length === 1 && scoredMatches[0].score >= 6) {
    return {
      classification: 'VERIFIED',
      confidence: 'medium',
      evidence: `Fuzzy match (score=${scoredMatches[0].score}): ${scoredMatches[0].path}`,
      matched_path: scoredMatches[0].path,
      candidate_paths: [],
    };
  }
  if (scoredMatches.length > 1 && scoredMatches[0].score >= 8 && scoredMatches[0].score > scoredMatches[1].score * 1.5) {
    return {
      classification: 'VERIFIED',
      confidence: 'medium',
      evidence: `Fuzzy match (score=${scoredMatches[0].score}): ${scoredMatches[0].path}`,
      matched_path: scoredMatches[0].path,
      candidate_paths: scoredMatches.slice(0, 3).map(m => m.path),
    };
  }

  if (item.category === 'governance' && titleLower.includes('swarmmind')) {
    return {
      classification: 'STALE',
      confidence: 'medium',
      evidence: 'Governance item referencing SwarmMind — likely cross-lane artifact, not an Archivist file',
      matched_path: null,
      candidate_paths: [],
    };
  }

  if (item.category === 'attestation') {
    return {
      classification: 'STALE',
      confidence: 'medium',
      evidence: 'Attestation category — ephemeral verification artifacts, not persistent files',
      matched_path: null,
      candidate_paths: [],
    };
  }

  const prefixCandidates = findWithCategoryPrefix(title, titleLower, filePathMap, fileBasenameMap, item.category);
  const prefixCands = [];
  if (prefixCandidates && prefixCandidates.type === 'ambiguous' && prefixCandidates.candidates) {
    prefixCands.push(...prefixCandidates.candidates);
  }

  return {
    classification: 'NEEDS_VERIFICATION',
    confidence: 'none',
    evidence: 'No match found in repo, artifacts, git history, or session markers',
    matched_path: null,
    candidate_paths: [...new Set([...scoredMatches.slice(0, 5).map(m => m.path), ...prefixCands.slice(0, 5)])],
  };
}

function findInRepo(title, titleLower, filePathMap, fileBasenameMap, allRepoFiles, category) {
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

  const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
  for (const prefix of prefixes) {
    const candidate = prefix + titleLower;
    if (filePathMap.has(candidate)) {
      return { type: 'verified', path: filePathMap.get(candidate), confidence: 'high', candidates: [] };
    }
    const candidateStem = prefix + stemFromTitle;
    if (filePathMap.has(candidateStem)) {
      return { type: 'verified', path: filePathMap.get(candidateStem), confidence: 'high', candidates: [] };
    }
  }

  const basenameMatches = fileBasenameMap.get(stemFromTitle) || [];
  if (basenameMatches.length === 1) {
    return { type: 'verified', path: basenameMatches[0], confidence: 'high', candidates: [] };
  }
  if (basenameMatches.length > 1) {
    const categoryFiltered = basenameMatches.filter(fp => {
      const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
      return prefixes.some(p => fp.toLowerCase().startsWith(p));
    });
    if (categoryFiltered.length === 1) {
      return { type: 'verified', path: categoryFiltered[0], confidence: 'high', candidates: [] };
    }
    return { type: 'ambiguous', path: null, confidence: 'medium', candidates: basenameMatches };
  }

  const titleBasename = path.basename(titleLower, path.extname(titleLower));
  const bnMatches = fileBasenameMap.get(titleBasename) || [];
  if (bnMatches.length === 1) {
    return { type: 'verified', path: bnMatches[0], confidence: 'high', candidates: [] };
  }
  if (bnMatches.length > 1) {
    const categoryFiltered = bnMatches.filter(fp => {
      const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
      return prefixes.some(p => fp.toLowerCase().startsWith(p));
    });
    if (categoryFiltered.length === 1) {
      return { type: 'verified', path: categoryFiltered[0], confidence: 'high', candidates: [] };
    }
    return { type: 'ambiguous', path: null, confidence: 'medium', candidates: bnMatches };
  }

  if (title.startsWith('scripts/') || title.startsWith('config/') || title.startsWith('docs/')) {
    if (filePathMap.has(titleLower)) {
      return { type: 'verified', path: filePathMap.get(titleLower), confidence: 'exact', candidates: [] };
    }
  }

  return { type: 'not_found', path: null, confidence: 'none', candidates: [] };
}

function findWithCategoryPrefix(title, titleLower, filePathMap, fileBasenameMap, category) {
  const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
  const basenameFromTitle = path.basename(titleLower, path.extname(titleLower));
  const extFromTitle = path.extname(titleLower);
  const results = [];

  for (const prefix of prefixes) {
    const candidatePath = prefix + titleLower;
    if (filePathMap.has(candidatePath)) {
      return { type: 'verified', path: filePathMap.get(candidatePath), confidence: 'high' };
    }

    const candidatePathStem = prefix + basenameFromTitle + extFromTitle;
    if (filePathMap.has(candidatePathStem)) {
      return { type: 'verified', path: filePathMap.get(candidatePathStem), confidence: 'high' };
    }

    const dashTitle = titleLower.replace(/\s+/g, '-');
    const candidateDash = prefix + dashTitle;
    if (filePathMap.has(candidateDash)) {
      return { type: 'verified', path: filePathMap.get(candidateDash), confidence: 'high' };
    }

    const underscoreTitle = titleLower.replace(/\s+/g, '_');
    const candidateUnderscore = prefix + underscoreTitle;
    if (filePathMap.has(candidateUnderscore)) {
      return { type: 'verified', path: filePathMap.get(candidateUnderscore), confidence: 'high' };
    }
  }

  const bnMatches = fileBasenameMap.get(basenameFromTitle) || [];
  if (bnMatches.length > 0) {
    const prefixedMatches = bnMatches.filter(fp => {
      return prefixes.some(p => fp.toLowerCase().startsWith(p));
    });
    if (prefixedMatches.length === 1) {
      return { type: 'verified', path: prefixedMatches[0], confidence: 'medium' };
    }
    if (prefixedMatches.length > 1) {
      return { type: 'ambiguous', candidates: prefixedMatches };
    }
  }

  return null;
}

function findInArtifacts(title, titleLower, artifactsMap) {
  const stemFromTitle = titleLower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (artifactsMap.has(stemFromTitle)) {
    return { path: artifactsMap.get(stemFromTitle), confidence: 'high' };
  }

  const titleNoSpaces = titleLower.replace(/\s+/g, '_');
  if (artifactsMap.has(titleNoSpaces)) {
    return { path: artifactsMap.get(titleNoSpaces), confidence: 'high' };
  }

  const titleNoSpacesDash = titleLower.replace(/\s+/g, '-');
  const dashStem = titleNoSpacesDash
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const underscoreVer = dashStem.replace(/-/g, '_');
  if (artifactsMap.has(underscoreVer)) {
    return { path: artifactsMap.get(underscoreVer), confidence: 'high' };
  }

  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
  if (titleWords.length >= 2) {
    const bestMatches = [];
    for (const [artifactStem, artifactPath] of artifactsMap.entries()) {
      let matchCount = 0;
      for (const word of titleWords) {
        if (artifactStem.includes(word)) matchCount++;
      }
      const score = matchCount / titleWords.length;
      if (score >= 0.6) {
        bestMatches.push({ path: artifactPath, score });
      }
    }
    bestMatches.sort((a, b) => b.score - a.score);
    if (bestMatches.length === 1 && bestMatches[0].score >= 0.8) {
      return { path: bestMatches[0].path, confidence: 'medium' };
    }
    if (bestMatches.length > 1 && bestMatches[0].score >= 0.8 && bestMatches[0].score > bestMatches[1].score * 1.2) {
      return { path: bestMatches[0].path, confidence: 'medium' };
    }
  }

  return null;
}

function findInDeleted(title, titleLower, deletedSet, deletedBasenameMap) {
  if (deletedSet.has(titleLower)) {
    return { path: title, confidence: 'high' };
  }

  const basename = path.basename(titleLower, path.extname(titleLower));
  const deletedMatches = deletedBasenameMap.get(basename) || [];
  if (deletedMatches.length === 1) {
    return { path: deletedMatches[0], confidence: 'high' };
  }

  const cargoNames = ['cargo.toml', 'cargo.lock', 'build.rs'];
  for (const cn of cargoNames) {
    if (titleLower.includes(cn.replace(/\./g, '')) || titleLower === cn) {
      return { path: cn, confidence: 'medium' };
    }
  }

  return null;
}

function fuzzyMatch(title, titleLower, allRepoFiles) {
  const stopWords = new Set(['with', 'from', 'that', 'this', 'what', 'when', 'where', 'which', 'their', 'about', 'could', 'would', 'should', 'these', 'those', 'for', 'the', 'and', 'not', 'but', 'are', 'has', 'was', 'had', 'been', 'have', 'does', 'will', 'can', 'all']);
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const scoredMatches = [];
  for (const fp of allRepoFiles) {
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
  return scoredMatches;
}

function generateRecommendations(classifications) {
  const recs = [];

  if (classifications.MISATTRIBUTED.length > 0) {
    recs.push({
      priority: 'P0',
      action: 'FIX_MISATTRIBUTED_NODES',
      count: classifications.MISATTRIBUTED.length,
      detail: `${classifications.MISATTRIBUTED.length} nodes are SwarmMind source files incorrectly tagged as repo=Archivist-Agent. Re-tag to repo=SwarmMind.`,
      node_ids: classifications.MISATTRIBUTED.map(r => r.id),
    });
  }

  if (classifications.CONVERSATION_FRAGMENT.length > 0) {
    recs.push({
      priority: 'P1',
      action: 'REMOVE_CONVERSATION_FRAGMENTS',
      count: classifications.CONVERSATION_FRAGMENT.length,
      detail: `${classifications.CONVERSATION_FRAGMENT.length} nodes are conversation/scratch fragments that were never actual files. Mark as EPHEMERAL or remove from graph.`,
    });
  }

  if (classifications.SESSION_ARTIFACT.length > 0) {
    recs.push({
      priority: 'P1',
      action: 'REMOVE_SESSION_ARTIFACTS',
      count: classifications.SESSION_ARTIFACT.length,
      detail: `${classifications.SESSION_ARTIFACT.length} nodes are session markers/conversation titles that were never actual files. Mark as ephemeral or remove from graph.`,
    });
  }

  if (classifications.DELETED.length > 0) {
    recs.push({
      priority: 'P1',
      action: 'MARK_DELETED_NODES',
      count: classifications.DELETED.length,
      detail: `${classifications.DELETED.length} nodes correspond to files that were deleted from the repo. Mark as DELETED or ARCHIVED.`,
      items: classifications.DELETED.map(r => ({ title: r.title, was: r.matched_path })),
    });
  }

  if (classifications.STALE.length > 0) {
    recs.push({
      priority: 'P2',
      action: 'REVIEW_STALE_NODES',
      count: classifications.STALE.length,
      detail: `${classifications.STALE.length} nodes are stale/ephemeral artifacts. Mark as EPHEMERAL or remove.`,
    });
  }

  if (classifications.NEEDS_VERIFICATION.length > 0) {
    recs.push({
      priority: 'P2',
      action: 'MANUAL_VERIFICATION_NEEDED',
      count: classifications.NEEDS_VERIFICATION.length,
      detail: `${classifications.NEEDS_VERIFICATION.length} nodes could not be automatically classified. Require manual review.`,
    });
  }

  if (classifications.ARTIFACTS_MATCH.length > 0) {
    recs.push({
      priority: 'P2',
      action: 'UPDATE_NODE_PATHS',
      count: classifications.ARTIFACTS_MATCH.length,
      detail: `${classifications.ARTIFACTS_MATCH.length} nodes match .artifacts/ files. Update graph node paths to point to .artifacts/ directory.`,
    });
  }

  return recs;
}

main();
