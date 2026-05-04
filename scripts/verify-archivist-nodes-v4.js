'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = 'S:/Archivist-Agent';
const GRAPH_JSON = 'S:/self-organizing-library/reports/graph-work-path-2026-05-01.json';
const OUTPUT_DIR = path.join(ROOT, 'context-buffer');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'archivist-node-verification-report-v4.json');

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

const MISATTRIBUTED_SWARMMIND_TITLES = new Set([
  'Partnership Strategy: AI Ensemble Intelligence',
  'AI Ensemble Intelligence Lab',
  'AI Ensemble Intelligence Lab - Dependencies',
  'Executive Summary: AI Ensemble Intelligence System',
  'Sample Ensemble Outputs',
  'config.py',
  'critic.py',
  'solver.py',
  'synthesizer.py',
  'test_ensemble.py',
  'Theory: AI Ensemble Intelligence',
  'Architecture Documentation',
  'Technical Brief: AI Ensemble Intelligence System',
  'DELIBERATE-AI-ENSEMBLE COMPREHENSIVE PROJECT LIBRARY',
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

function normalize(s) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function splitConcatenatedWords(title) {
  const stem = title.replace(/\.[a-z]+$/i, '');
  if (/^[A-Z0-9_]+$/.test(stem) && stem.length > 10 && stem.includes('_')) {
    return [stem.toLowerCase(), stem.replace(/_/g, '-').toLowerCase()];
  }
  if (/^[A-Z][a-z]+[A-Z]/.test(stem) || /^[A-Z]{2,}[a-z]/.test(stem)) {
    const split = stem.replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
    return [split, split.replace(/_/g, '-').toLowerCase()];
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
  const filePathMap = new Map();
  const fileBasenameMap = new Map();
  const normalizedFileMap = new Map();

  for (const fp of trackedFiles) {
    filePathMap.set(fp.toLowerCase(), fp);
    const basename = path.basename(fp, path.extname(fp)).toLowerCase();
    if (!fileBasenameMap.has(basename)) {
      fileBasenameMap.set(basename, []);
    }
    fileBasenameMap.get(basename).push(fp);
    const nFull = normalize(fp);
    const nBase = normalize(path.basename(fp));
    if (!normalizedFileMap.has(nFull)) normalizedFileMap.set(nFull, fp);
    if (!normalizedFileMap.has(nBase)) normalizedFileMap.set(nBase, fp);
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
    const nFull = normalize(uf);
    const nBase = normalize(path.basename(uf));
    if (!normalizedFileMap.has(nFull)) normalizedFileMap.set(nFull, uf);
    if (!normalizedFileMap.has(nBase)) normalizedFileMap.set(nBase, uf);
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

  console.log('Running v4 verification...');
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
  let normalizedMatchCount = 0;
  let aiEnsembleReclassCount = 0;

  for (const item of sortedItems) {
    const result = classifyNodeV4(item, filePathMap, fileBasenameMap, allRepoFiles, artifactsMap, deletedSet, deletedBasenameMap, normalizedFileMap);
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

  console.log('\n=== V4 VERIFICATION RESULTS ===');
  for (const [cls, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls}: ${count}`);
  }
  console.log(`  Content-peek promotions: ${contentPeekCount}`);
  console.log(`  Normalized-match promotions: ${normalizedMatchCount}`);
  console.log(`  AI-ensemble-lab reclassifications: ${aiEnsembleReclassCount}`);

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
      console.log(`  ${cat}: ${parts}`);
    }
  }

  const report = {
    version: 4,
    generated_at: new Date().toISOString(),
    stats,
    content_peek_promotions: contentPeekCount,
    normalized_match_promotions: normalizedMatchCount,
    ai_ensemble_reclassifications: aiEnsembleReclassCount,
    classifications,
    category_breakdown: catCls,
    recommendations: generateRecommendations(classifications),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${OUTPUT_FILE}`);

  console.log('\n=== REMAINING NEEDS VERIFICATION ===');
  classifications.NEEDS_VERIFICATION.forEach(r => {
    console.log(`  [${r.category}] ${r.title.substring(0, 80)}`);
    if (r.candidate_paths && r.candidate_paths.length) {
      console.log(`    candidates: ${r.candidate_paths.slice(0, 3).join(', ')}`);
    }
  });
}

function classifyNodeV4(item, filePathMap, fileBasenameMap, allRepoFiles, artifactsMap, deletedSet, deletedBasenameMap, normalizedFileMap) {
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

  if (MISATTRIBUTED_SWARMMIND_TITLES.has(title)) {
    return {
      classification: 'MISATTRIBUTED',
      confidence: 'high',
      evidence: 'AI Ensemble Intelligence Lab content — belongs to SwarmMind repo, not Archivist-Agent',
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

  const normTitle = normalize(title);
  const normTitleStem = normalize(title.replace(/\.[a-z]+$/i, ''));
  if (normalizedFileMap.has(normTitle)) {
    return {
      classification: 'VERIFIED',
      confidence: 'high',
      evidence: `Normalized exact match: ${normalizedFileMap.get(normTitle)}`,
      matched_path: normalizedFileMap.get(normTitle),
      candidate_paths: [],
    };
  }
  if (normalizedFileMap.has(normTitleStem)) {
    const matched = normalizedFileMap.get(normTitleStem);
    const ext = path.extname(matched);
    const titleExt = path.extname(title);
    if (ext === titleExt || !titleExt || !ext || ext === '.md') {
      return {
        classification: 'VERIFIED',
        confidence: 'medium',
        evidence: `Normalized stem match (underscores/hyphens differ): ${matched}`,
        matched_path: matched,
        candidate_paths: [],
      };
    }
  }

  for (const [nKey, nPath] of normalizedFileMap.entries()) {
    if (nKey.length > 8 && (normTitleStem.includes(nKey) || nKey.includes(normTitleStem))) {
      const ext = path.extname(nPath);
      const titleExt = path.extname(title);
      if (ext === titleExt || !titleExt || ext === '.md') {
        return {
          classification: 'VERIFIED',
          confidence: 'low',
          evidence: `Normalized substring match: ${nPath} (normKey=${nKey}, normTitle=${normTitleStem})`,
          matched_path: nPath,
          candidate_paths: [],
        };
      }
    }
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
    const normSplit = normalize(splitName);
    if (normalizedFileMap.has(normSplit)) {
      return {
        classification: 'VERIFIED',
        confidence: 'medium',
        evidence: `Split + normalized match: ${normalizedFileMap.get(normSplit)}`,
        matched_path: normalizedFileMap.get(normSplit),
        candidate_paths: [],
      };
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
        if (titleWords.every(w => bn.includes(w))) {
          shortMatches.push(fp);
        }
      }
      if (shortMatches.length === 1) {
        return {
          classification: 'VERIFIED',
          confidence: 'low',
          evidence: `Short-title word match: ${shortMatches[0]}`,
          matched_path: shortMatches[0],
          candidate_paths: [],
        };
      }
      if (shortMatches.length > 1 && shortMatches.length <= 4) {
        return {
          classification: 'NEEDS_VERIFICATION',
          confidence: 'low',
          evidence: `Multiple short-title word matches`,
          matched_path: null,
          candidate_paths: shortMatches.slice(0, 5),
        };
      }
    }
  }

  return {
    classification: 'NEEDS_VERIFICATION',
    confidence: 'none',
    evidence: 'No match found in repo, artifacts, git history, normalized index, or session markers',
    matched_path: null,
    candidate_paths: [],
  };
}

function findInRepo(title, titleLower, filePathMap, fileBasenameMap, allRepoFiles, category) {
  if (filePathMap.has(titleLower)) {
    return { type: 'verified', path: filePathMap.get(titleLower), confidence: 'high' };
  }

  const titleBasename = path.basename(titleLower);
  const titleStem = titleBasename.replace(/\.[a-z]+$/i, '');
  const titleExt = path.extname(titleLower);

  if (fileBasenameMap.has(titleStem)) {
    const matches = fileBasenameMap.get(titleStem);
    const sameExt = matches.filter(m => path.extname(m).toLowerCase() === titleExt);
    if (sameExt.length === 1) {
      return { type: 'verified', path: sameExt[0], confidence: 'high' };
    }
    if (sameExt.length > 1) {
      const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
      for (const prefix of prefixes) {
        const prefMatch = sameExt.find(m => m.toLowerCase().startsWith(prefix));
        if (prefMatch) {
          return { type: 'verified', path: prefMatch, confidence: 'medium' };
        }
      }
      return { type: 'ambiguous', candidates: sameExt };
    }
    if (matches.length === 1 && (!titleExt || path.extname(matches[0]).toLowerCase() === '.md')) {
      return { type: 'verified', path: matches[0], confidence: 'medium' };
    }
  }

  const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
  for (const prefix of prefixes) {
    const candidate = prefix + titleLower;
    if (filePathMap.has(candidate)) {
      return { type: 'verified', path: filePathMap.get(candidate), confidence: 'medium' };
    }
  }

  if (titleStem.length > 5) {
    const partialMatches = [];
    for (const fp of allRepoFiles) {
      const bn = path.basename(fp, path.extname(fp)).toLowerCase();
      const fpNorm = bn.replace(/[^a-z0-9]/g, '');
      const titleNorm = titleStem.replace(/[^a-z0-9]/g, '');
      if (fpNorm === titleNorm) {
        partialMatches.push(fp);
      }
    }
    if (partialMatches.length === 1) {
      return { type: 'verified', path: partialMatches[0], confidence: 'medium' };
    }
    if (partialMatches.length > 1) {
      return { type: 'ambiguous', candidates: partialMatches };
    }
  }

  return { type: 'none' };
}

function findInArtifacts(title, titleLower, artifactsMap) {
  const stem = titleLower.replace(/\.[a-z]+$/i, '').replace(/\.md$/i, '');
  if (artifactsMap.has(stem)) {
    return { path: artifactsMap.get(stem), confidence: 'medium' };
  }
  const cleanStem = stem.replace(/[^a-z0-9_\-]/g, '');
  if (artifactsMap.has(cleanStem)) {
    return { path: artifactsMap.get(cleanStem), confidence: 'low' };
  }
  const words = stem.split(/[_\-\s]+/).filter(w => w.length > 2);
  const joined = words.join('_');
  if (artifactsMap.has(joined)) {
    return { path: artifactsMap.get(joined), confidence: 'low' };
  }
  return null;
}

function findInDeleted(title, titleLower, deletedSet, deletedBasenameMap) {
  if (deletedSet.has(titleLower)) {
    return { path: title, confidence: 'medium' };
  }
  const titleStem = titleLower.replace(/\.[a-z]+$/i, '');
  if (deletedBasenameMap.has(titleStem)) {
    return { path: deletedBasenameMap.get(titleStem)[0], confidence: 'medium' };
  }
  return null;
}

function findWithCategoryPrefix(title, titleLower, filePathMap, fileBasenameMap, category) {
  const prefixes = CATEGORY_PREFIX_MAP[category] || [''];
  const titleBasename = path.basename(titleLower);
  const titleStem = titleBasename.replace(/\.[a-z]+$/i, '');

  if (fileBasenameMap.has(titleStem)) {
    const matches = fileBasenameMap.get(titleStem);
    for (const prefix of prefixes) {
      const match = matches.find(m => m.toLowerCase().startsWith(prefix));
      if (match) {
        return { type: 'verified', path: match, confidence: 'medium' };
      }
    }
  }
  return null;
}

function generateRecommendations(classifications) {
  const recs = [];

  const nv = classifications.NEEDS_VERIFICATION;
  if (nv.length > 0) {
    const byCat = {};
    nv.forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + 1; });
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    recs.push({
      priority: 'P1',
      action: `Resolve remaining ${nv.length} NEEDS_VERIFICATION items`,
      detail: `Top categories: ${topCats.map(([c, n]) => `${c}(${n})`).join(', ')}`,
    });
  }

  const mis = classifications.MISATTRIBUTED;
  if (mis.length > 0) {
    recs.push({
      priority: 'P1',
      action: `Re-attribute ${mis.length} MISATTRIBUTED items to correct repo (SwarmMind)`,
      detail: 'These nodes have repo=Archivist-Agent but are SwarmMind source files',
    });
  }

  const cf = classifications.CONVERSATION_FRAGMENT;
  if (cf.length > 0) {
    recs.push({
      priority: 'P2',
      action: `Review ${cf.length} CONVERSATION_FRAGMENT items for graph cleanup`,
      detail: 'These are conversation scraps, not file references — consider removing from graph',
    });
  }

  return recs;
}

main();
