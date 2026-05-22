'use strict';

const RECENT_PATHS_KEY = 'archivist.recentPaths.v1';
const MAX_RECENT_PATHS = 6;
const TAB_NAMES = ['overview', 'retrieve', 'tree', 'output'];
const TREE_LINE_LIMIT = 420;

const BUCKET_ORDER = ['Runtime', 'Interface', 'Memory', 'Verification', 'Research', 'Unknown'];
const BUCKET_META = Object.freeze({
    Runtime: { icon: '⚙️', tone: 'runtime', description: 'Executable code, scripts, and app logic.' },
    Interface: { icon: '🪟', tone: 'interface', description: 'Frontend, UI, or presentation surfaces.' },
    Memory: { icon: '🧠', tone: 'memory', description: 'Docs, config, notes, and durable context.' },
    Verification: { icon: '🧪', tone: 'verification', description: 'Tests, checks, and proof artifacts.' },
    Research: { icon: '🔎', tone: 'research', description: 'Papers, decks, experiments, and source material.' },
    Unknown: { icon: '❓', tone: 'unknown', description: 'Needs a better rule or a human pass.' }
});

function joinMockPath(root, relativePath) {
    const cleanRoot = String(root || 'C:\\Demo\\Archivist').replace(/[\\/]+$/, '');
    const separator = cleanRoot.includes('/') && !cleanRoot.includes('\\') ? '/' : '\\';
    const normalizedRelative = relativePath.replace(/[\\/]+/g, separator);
    return `${cleanRoot}${separator}${normalizedRelative}`;
}

function createMockFile(root, relativePath, bucket, confidence, reason, sizeBytes) {
    const path = joinMockPath(root, relativePath);
    const name = relativePath.split(/[\\/]/).pop() || relativePath;
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return {
        path,
        name,
        bucket,
        confidence,
        reason,
        size_bytes: sizeBytes,
        extension
    };
}

function createMockScanResult(root) {
    return {
        root,
        total_files: 14,
        total_dirs: 6,
        errors: [],
        tree: {
            name: root.split(/[\\/]/).pop() || root,
            path: root,
            is_dir: true,
            size_bytes: 0,
            extension: null,
            children: [
                {
                    name: 'src-tauri',
                    path: joinMockPath(root, 'src-tauri'),
                    is_dir: true,
                    size_bytes: 0,
                    extension: null,
                    children: [
                        { name: 'main.rs', path: joinMockPath(root, 'src-tauri/main.rs'), is_dir: false, children: [], size_bytes: 1843, extension: 'rs' },
                        { name: 'lib.rs', path: joinMockPath(root, 'src-tauri/lib.rs'), is_dir: false, children: [], size_bytes: 2210, extension: 'rs' }
                    ]
                },
                {
                    name: 'ui',
                    path: joinMockPath(root, 'ui'),
                    is_dir: true,
                    size_bytes: 0,
                    extension: null,
                    children: [
                        { name: 'index.html', path: joinMockPath(root, 'ui/index.html'), is_dir: false, children: [], size_bytes: 4130, extension: 'html' },
                        { name: 'styles.css', path: joinMockPath(root, 'ui/styles.css'), is_dir: false, children: [], size_bytes: 5982, extension: 'css' }
                    ]
                },
                {
                    name: 'docs',
                    path: joinMockPath(root, 'docs'),
                    is_dir: true,
                    size_bytes: 0,
                    extension: null,
                    children: [
                        { name: 'README.md', path: joinMockPath(root, 'docs/README.md'), is_dir: false, children: [], size_bytes: 1244, extension: 'md' }
                    ]
                },
                {
                    name: 'tests',
                    path: joinMockPath(root, 'tests'),
                    is_dir: true,
                    size_bytes: 0,
                    extension: null,
                    children: [
                        { name: 'scan_tree.test.js', path: joinMockPath(root, 'tests/scan_tree.test.js'), is_dir: false, children: [], size_bytes: 2144, extension: 'js' }
                    ]
                }
            ]
        }
    };
}

function createMockSummary(root) {
    const buckets = {
        Runtime: [
            createMockFile(root, 'src-tauri/main.rs', 'Runtime', 0.92, '.rs is a runtime/executable file type', 1843),
            createMockFile(root, 'scripts/build_index.js', 'Runtime', 0.81, '.js is a runtime/executable file type', 2930),
            createMockFile(root, 'src/classifier.py', 'Runtime', 0.78, '.py is a runtime/executable file type', 4012)
        ],
        Interface: [
            createMockFile(root, 'ui/index.html', 'Interface', 0.96, '.html is a UI/frontend file type', 4130),
            createMockFile(root, 'ui/styles.css', 'Interface', 0.95, '.css is a UI/frontend file type', 5982)
        ],
        Memory: [
            createMockFile(root, 'README.md', 'Memory', 0.72, 'README.md is a project memory/config file', 1244),
            createMockFile(root, 'config/app.json', 'Memory', 0.63, 'app.json is a project memory/config file', 648)
        ],
        Verification: [
            createMockFile(root, 'tests/scan_tree.test.js', 'Verification', 0.88, 'Filename or path contains test/spec indicators', 2144),
            createMockFile(root, 'tests/summarize_folder.spec.ts', 'Verification', 0.9, 'Filename or path contains test/spec indicators', 1976)
        ],
        Research: [
            createMockFile(root, 'research/inventory-study.pdf', 'Research', 0.71, '.pdf is a research/document file type', 240122),
            createMockFile(root, 'research/notes.ipynb', 'Research', 0.66, '.ipynb is a research/document file type', 8814)
        ],
        Unknown: [
            createMockFile(root, 'data/model.onnx', 'Unknown', 0.35, 'No classification rule matched .onnx', 322144),
            createMockFile(root, 'assets/logo.ai', 'Unknown', 0.27, 'No classification rule matched .ai', 14082)
        ]
    };

    const bucket_counts = {};
    let total_files = 0;
    Object.entries(buckets).forEach(([bucket, files]) => {
        bucket_counts[bucket] = files.length;
        total_files += files.length;
    });

    return {
        root,
        total_files,
        buckets,
        bucket_counts,
        unclassified_count: buckets.Unknown.length,
        errors: []
    };
}

// Tauri invoke helper with explicit safety-mode fallback for browser mode.
const invoke = (() => {
    if (window.__TAURI__?.core?.invoke) {
        return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI__?.invoke) {
        return window.__TAURI__.invoke;
    }

    console.error('[SECURITY] No Tauri API found - running in browser mode');
    console.error('[SECURITY] All mutating operations are BLOCKED');
    console.error('[SECURITY] Safety validation layer is NOT active');

    return async (cmd, args = {}) => {
        const root = args.root_path || args.root || args.path || 'C:\\Demo\\Archivist';
        const readOnlyCommands = ['ping', 'scan_tree', 'summarize_folder'];

        if (readOnlyCommands.includes(cmd)) {
            console.warn(`[BROWSER] ${cmd} - returning mock data (no safety validation)`);
            if (cmd === 'ping') return 'pong';
            if (cmd === 'scan_tree') return createMockScanResult(root);
            if (cmd === 'summarize_folder') return createMockSummary(root);
            return null;
        }

        const mutatingCommands = ['build_index', 'generate_handoff', 'build_registry'];
        if (mutatingCommands.includes(cmd)) {
            const msg = `[BLOCKED] ${cmd} requires Tauri runtime. Safety validation is NOT available in browser mode.`;
            console.error(msg);
            throw new Error(msg);
        }

        throw new Error(`[BLOCKED] Unknown command '${cmd}' blocked in browser mode`);
    };
})();

const state = {
    currentPath: '',
    scanResult: null,
    summaryResult: null,
    activeTab: 'overview',
    logEntries: [],
    isWorking: false,
    searchQuery: '',
    bucketFilter: 'all',
    recentPaths: loadRecentPaths(),
    lastAnalyzedAt: null
};

const $ = id => document.getElementById(id);

function loadRecentPaths() {
    try {
        const raw = window.localStorage.getItem(RECENT_PATHS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, MAX_RECENT_PATHS) : [];
    } catch (_) {
        return [];
    }
}

function saveRecentPaths() {
    try {
        window.localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(state.recentPaths.slice(0, MAX_RECENT_PATHS)));
    } catch (_) {
        // Ignore persistence errors in restricted environments.
    }
}

function rememberPath(path) {
    if (!path) return;
    state.recentPaths = [path, ...state.recentPaths.filter(item => item !== path)].slice(0, MAX_RECENT_PATHS);
    saveRecentPaths();
    renderRecentPaths();
}

function renderRecentPaths() {
    const container = $('recent-folders');
    container.innerHTML = '';

    if (!state.recentPaths.length) {
        container.innerHTML = '<div class="recent-empty">Your recent folders will show up here after the first analysis.</div>';
        return;
    }

    state.recentPaths.forEach(path => {
        const button = document.createElement('button');
        button.className = 'recent-button';
        button.type = 'button';
        button.dataset.path = path;
        button.innerHTML = `
            <span class="recent-label">${escapeHtml(getPathLabel(path))}</span>
            <span class="recent-path">${escapeHtml(path)}</span>
        `;
        container.appendChild(button);
    });
}

function getPathLabel(path) {
    const parts = String(path).split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || path;
}

function log(message, level = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    state.logEntries.push({ time, message, level });
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${escapeHtml(time)}</span><span class="log-${level}">${escapeHtml(message)}</span>`;
    $('log-output').appendChild(div);
    $('log-output').scrollTop = $('log-output').scrollHeight;
}

function setStatus(text, type = 'idle') {
    $('status-text').textContent = text;
    $('status-dot').className = `status-dot ${type}`;
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  TAB_NAMES.forEach(name => {
    $(`tab-${name}`).classList.toggle('hidden', name !== tabName);
  });
  if (state.scanResult || state.summaryResult) {
    $('welcome').classList.add('hidden');
  }
  if (tabName === 'tree') renderTreePanel();
  if (tabName === 'overview') renderOverview();
  if (tabName === 'retrieve') renderRetrieve();
}

function getValidPath() {
    const raw = $('folder-path').value.trim();
    if (!raw) {
        log('No path entered.', 'warn');
        return null;
    }
    if (raw.length > 4096) {
        log('Path too long (max 4096 characters).', 'err');
        return null;
    }
    return raw;
}

async function callCommand(command, args = {}) {
    if (state.isWorking) {
        log('Already running. Please wait.', 'warn');
        return null;
    }
    state.isWorking = true;
    const startTime = Date.now();
    try {
        log(`→ ${command}(${JSON.stringify(args)})`, 'info');
        setStatus(`Running ${command}…`, 'working');
        const result = await invoke(command, args);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`✓ ${command} completed in ${duration}s`, 'ok');
        setStatus('Ready', 'success');
        return result;
    } catch (error) {
        const msg = error?.message || error?.toString() || 'Unknown error';
        log(`✗ ${command} failed: ${msg}`, 'err');
        setStatus(`Error: ${msg.slice(0, 40)}`, 'error');
        return null;
    } finally {
        state.isWorking = false;
    }
}

async function runAnalyzeFolder() {
    const path = getValidPath();
    if (!path) return;
    if (state.isWorking) {
        log('Already running. Please wait.', 'warn');
        return;
    }

    state.isWorking = true;
    const started = Date.now();
    rememberPath(path);
    state.currentPath = path;
    try {
        log(`→ analyze_folder("${path}")`, 'info');
        setStatus('Analyzing folder…', 'working');
        const [scanResult, summaryResult] = await Promise.all([
            invoke('scan_tree', { root_path: path }),
            invoke('summarize_folder', { root_path: path })
        ]);
        state.lastAnalyzedAt = new Date().toISOString();
        state.scanResult = scanResult;
        state.summaryResult = summaryResult;
        hydrateViews();
        const seconds = ((Date.now() - started) / 1000).toFixed(2);
        log(`✓ Analysis ready in ${seconds}s`, 'ok');
        setStatus('Analysis ready', 'success');
        switchTab('overview');
    } catch (error) {
        const msg = error?.message || error?.toString() || 'Unknown error';
        log(`✗ analyze_folder failed: ${msg}`, 'err');
        setStatus(`Error: ${msg.slice(0, 40)}`, 'error');
    } finally {
        state.isWorking = false;
    }
}

function handleWelcomeAnalyze() {
    const hasPath = $('folder-path').value.trim();
    if (!hasPath) {
        $('folder-path').focus();
        log('Enter a folder path to start the first analysis.', 'info');
        return;
    }
    runAnalyzeFolder();
}

async function runScanTree() {
    const path = getValidPath();
    if (!path) return;
    state.currentPath = path;
    rememberPath(path);
    const result = await callCommand('scan_tree', { root_path: path });
    if (!result) return;
    state.scanResult = result;
    state.lastAnalyzedAt = new Date().toISOString();
    hydrateViews();
    switchTab('tree');
}

async function runClassify() {
    const path = getValidPath();
    if (!path) return;
    state.currentPath = path;
    rememberPath(path);
    const result = await callCommand('summarize_folder', { root_path: path });
    if (!result) return;
    state.summaryResult = result;
    state.lastAnalyzedAt = new Date().toISOString();
    hydrateViews();
    switchTab('retrieve');
}

async function runBuildIndex() {
    const path = getValidPath();
    if (!path) return;
    const result = await callCommand('build_index', { root: path });
    if (!result) return;
    log(`INDEX.md written to: ${result.index_path}`, 'ok');
    if (result.by_classification) {
        log(`Index buckets: ${JSON.stringify(result.by_classification)}`, 'info');
    }
    switchTab('output');
}

async function runBuildRegistry() {
    const result = await callCommand('build_registry');
    if (!result) return;
    log(`Registry written: ${result}`, 'ok');
    switchTab('output');
}

async function runGenerateHandoff() {
    const path = getValidPath();
    if (!path) return;
    const result = await callCommand('generate_handoff', { path });
    if (!result) return;
    log(`Handoff generated: ${result}`, 'ok');
    switchTab('output');
}

function hydrateViews() {
    if (state.scanResult || state.summaryResult) {
        $('welcome').classList.add('hidden');
    }
    renderOverview();
    renderRetrieve();
    renderTreePanel();
    updateFooterInfo();
}

function getSummaryCounts() {
    const counts = {};
    BUCKET_ORDER.forEach(bucket => {
        counts[bucket] = state.summaryResult?.bucket_counts?.[bucket] || 0;
    });
    return counts;
}

function getTopBucket(counts) {
    return BUCKET_ORDER
        .filter(bucket => counts[bucket] > 0)
        .sort((a, b) => counts[b] - counts[a])[0] || 'Unknown';
}

function getAllFiles() {
    if (!state.summaryResult?.buckets) return [];
    const files = [];
    BUCKET_ORDER.forEach(bucket => {
        const bucketFiles = state.summaryResult.buckets[bucket] || [];
        bucketFiles.forEach(file => {
            files.push({
                ...file,
                bucket,
                confidence: Number(file.confidence || 0),
                size_bytes: Number(file.size_bytes || 0)
            });
        });
    });
    return files;
}

function pickFeaturedFiles(files) {
    const preferredBuckets = ['Unknown', 'Verification', 'Interface', 'Runtime'];
    const selected = [];
    preferredBuckets.forEach(bucket => {
        const hit = files.find(file => file.bucket === bucket);
        if (hit) selected.push(hit);
    });
    files.forEach(file => {
        if (selected.length >= 6) return;
        if (!selected.some(existing => existing.path === file.path)) {
            selected.push(file);
        }
    });
    return selected.slice(0, 6);
}

function renderOverview() {
    const container = $('overview-content');
    if (!state.scanResult && !state.summaryResult) {
        container.innerHTML = `
            <div class="empty-panel">
                <h3>No folder analyzed yet</h3>
                <p>Run Analyze Folder to get counts, buckets, quick retrieval, and a readable tree in one place.</p>
            </div>
        `;
        return;
    }

    const totalFiles = state.summaryResult?.total_files ?? state.scanResult?.total_files ?? 0;
    const totalDirs = state.scanResult?.total_dirs ?? 0;
    const scanErrors = state.scanResult?.errors?.length || 0;
    const summaryErrors = state.summaryResult?.errors?.length || 0;
    const counts = getSummaryCounts();
    const unknownCount = counts.Unknown || 0;
    const topBucket = getTopBucket(counts);
    const topBucketMeta = BUCKET_META[topBucket] || BUCKET_META.Unknown;
    const allFiles = getAllFiles();
    const featuredFiles = pickFeaturedFiles(allFiles);
    const confidenceAverage = allFiles.length
        ? `${Math.round((allFiles.reduce((sum, file) => sum + (file.confidence || 0), 0) / allFiles.length) * 100)}%`
        : 'n/a';

    const bucketCards = BUCKET_ORDER.map(bucket => {
        const meta = BUCKET_META[bucket];
        const count = counts[bucket] || 0;
        const share = totalFiles ? `${Math.round((count / totalFiles) * 100)}% of files` : '0% of files';
        return `
            <button class="bucket-card" type="button" data-overview-bucket="${escapeHtml(bucket)}">
                <div class="bucket-card-head">
                    <span class="bucket-icon">${meta.icon}</span>
                    <span class="bucket-count">${count}</span>
                </div>
                <span class="bucket-name">${escapeHtml(bucket)}</span>
                <span class="bucket-description">${escapeHtml(meta.description)}</span>
                <span class="bucket-meta">${escapeHtml(share)}</span>
            </button>
        `;
    }).join('');

    const spotlightMarkup = featuredFiles.length
        ? featuredFiles.map(file => {
            const meta = BUCKET_META[file.bucket] || BUCKET_META.Unknown;
            return `
                <div class="result-card">
                    <div class="result-head">
                        <div>
                            <div class="result-title">
                                <span class="bucket-badge bucket-${meta.tone}">${meta.icon} ${escapeHtml(file.bucket)}</span>
                                <h3>${escapeHtml(file.name)}</h3>
                            </div>
                            <div class="result-meta">${formatBytes(file.size_bytes)} · ${Math.round((file.confidence || 0) * 100)}% confidence</div>
                        </div>
                        <div class="result-actions">
                            <button class="mini-button" type="button" data-copy-path="${escapeHtml(file.path)}">Copy path</button>
                        </div>
                    </div>
                    <p class="result-path">${escapeHtml(file.path)}</p>
                    <p class="result-reason">${escapeHtml(file.reason || 'No reason available.')}</p>
                </div>
            `;
        }).join('')
        : '<div class="empty-panel"><h3>No featured files yet</h3><p>Run classification to surface useful files here.</p></div>';

    container.innerHTML = `
        <section class="hero-card">
            <div class="hero-topline">
                <div>
                    <div class="eyebrow">Current Readout</div>
                    <h2>${escapeHtml(getPathLabel(state.currentPath || state.summaryResult?.root || state.scanResult?.root || 'Current folder'))}</h2>
                    <p>${escapeHtml(
                        unknownCount > 0
                            ? `${unknownCount} files still need a stronger rule. Start in Retrieve to review the unknown bucket and close the gaps.`
                            : `Most of this folder lands in ${topBucket}. You can retrieve files by name, bucket, or reason without leaving the desktop app.`
                    )}</p>
                </div>
                <div class="path-pill">📍 ${escapeHtml(state.currentPath || state.summaryResult?.root || state.scanResult?.root || '')}</div>
            </div>

            <div class="summary-grid">
                <div class="stat-card">
                    <span class="stat-label">Files</span>
                    <span class="stat-value">${totalFiles}</span>
                    <span class="stat-detail">Classified files in scope</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Folders</span>
                    <span class="stat-value">${totalDirs}</span>
                    <span class="stat-detail">Tree nodes above file level</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Top Bucket</span>
                    <span class="stat-value">${escapeHtml(topBucket)}</span>
                    <span class="stat-detail">${escapeHtml(topBucketMeta.description)}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Needs Review</span>
                    <span class="stat-value">${unknownCount}</span>
                    <span class="stat-detail">Unknown classification count</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Average Confidence</span>
                    <span class="stat-value">${escapeHtml(confidenceAverage)}</span>
                    <span class="stat-detail">Across currently classified files</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Last Refresh</span>
                    <span class="stat-value">${escapeHtml(formatTimestamp(state.lastAnalyzedAt))}</span>
                    <span class="stat-detail">${scanErrors + summaryErrors} surfaced warnings</span>
                </div>
            </div>
        </section>

        <section class="insight-strip">
            <div class="insight-card">
                <h3>Retrieve faster</h3>
                <p>Search by file name, path fragment, bucket, or classification reason in the Retrieve tab.</p>
            </div>
            <div class="insight-card">
                <h3>What changed the most</h3>
                <p>${escapeHtml(topBucket)} is the largest slice right now, which is usually where the best shortcuts and cleanup wins hide.</p>
            </div>
            <div class="insight-card">
                <h3>What needs judgment</h3>
                <p>${unknownCount > 0 ? `${unknownCount} files are still Unknown.` : 'Nothing is sitting in Unknown right now.'}</p>
            </div>
        </section>

        <section class="bucket-board">
            <div class="section-heading">
                <div>
                    <h3>Bucket Map</h3>
                    <p>Click a bucket to jump into filtered retrieval results.</p>
                </div>
            </div>
            <div class="bucket-grid">${bucketCards}</div>
        </section>

        <section class="bucket-board">
            <div class="section-heading">
                <div>
                    <h3>Useful Starting Points</h3>
                    <p>Quick entries chosen to help you orient, verify, or clean up faster.</p>
                </div>
            </div>
            <div class="results-grid">${spotlightMarkup}</div>
        </section>
    `;
}

function buildSearchIndex(file) {
    return [
        file.name,
        file.path,
        file.bucket,
        file.reason,
        file.extension
    ].filter(Boolean).join(' ').toLowerCase();
}

function scoreFile(file, query) {
    if (!query) return 0;
    const lowerName = file.name.toLowerCase();
    const lowerPath = file.path.toLowerCase();
    let score = 0;
    if (lowerName === query) score += 120;
    if (lowerName.includes(query)) score += 70;
    if (lowerPath.includes(query)) score += 45;
    if (file.bucket.toLowerCase().includes(query)) score += 25;
    if ((file.reason || '').toLowerCase().includes(query)) score += 12;
    return score;
}

function getFilteredFiles() {
    const files = getAllFiles();
    const query = state.searchQuery.trim().toLowerCase();
    const bucketFilter = state.bucketFilter;

    return files
        .filter(file => bucketFilter === 'all' || file.bucket === bucketFilter)
        .filter(file => !query || buildSearchIndex(file).includes(query))
        .sort((a, b) => {
            const scoreDiff = scoreFile(b, query) - scoreFile(a, query);
            if (scoreDiff !== 0) return scoreDiff;
            const bucketDiff = BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket);
            if (bucketDiff !== 0) return bucketDiff;
            return a.name.localeCompare(b.name);
        });
}

function renderBucketFilters() {
    const container = $('bucket-filters');
    if (!state.summaryResult) {
        container.innerHTML = '';
        return;
    }

    const counts = getSummaryCounts();
    const buttons = [
        { name: 'all', label: `All files (${state.summaryResult.total_files || 0})` },
        ...BUCKET_ORDER.map(bucket => ({ name: bucket, label: `${bucket} (${counts[bucket] || 0})` }))
    ];

    container.innerHTML = buttons.map(item => `
        <button
            type="button"
            class="bucket-chip ${state.bucketFilter === item.name ? 'active' : ''}"
            data-bucket-filter="${escapeHtml(item.name)}"
        >${escapeHtml(item.label)}</button>
    `).join('');
}

function renderRetrieve() {
    renderBucketFilters();

    $('search-query').value = state.searchQuery;

    if (!state.summaryResult) {
        $('results-snapshot').textContent = 'Analyze a folder first to unlock search and retrieval.';
        $('search-results').innerHTML = `
            <div class="empty-panel">
                <h3>No classified files yet</h3>
                <p>Run Analyze Folder or Refresh Classification to populate this view.</p>
            </div>
        `;
        return;
    }

    const files = getFilteredFiles();
    const visibleFiles = files.slice(0, 200);
    const hiddenCount = Math.max(files.length - visibleFiles.length, 0);

    $('results-snapshot').textContent = state.searchQuery
        ? `Showing ${visibleFiles.length} matching files${hiddenCount ? `, plus ${hiddenCount} more hidden for speed` : ''}.`
        : `Showing ${visibleFiles.length} files${hiddenCount ? `, plus ${hiddenCount} more hidden for speed` : ''}.`;

    if (!files.length) {
        $('search-results').innerHTML = `
            <div class="empty-panel">
                <h3>No matches</h3>
                <p>Try a different search term or switch the bucket filter back to All files.</p>
            </div>
        `;
        return;
    }

    $('search-results').innerHTML = visibleFiles.map(file => {
        const meta = BUCKET_META[file.bucket] || BUCKET_META.Unknown;
        return `
            <article class="result-card">
                <div class="result-head">
                    <div>
                        <div class="result-title">
                            <span class="bucket-badge bucket-${meta.tone}">${meta.icon} ${escapeHtml(file.bucket)}</span>
                            <h3>${escapeHtml(file.name)}</h3>
                        </div>
                        <div class="result-meta">${formatBytes(file.size_bytes)} · ${Math.round((file.confidence || 0) * 100)}% confidence</div>
                    </div>
                    <div class="result-actions">
                        <button class="mini-button" type="button" data-copy-path="${escapeHtml(file.path)}">Copy path</button>
                    </div>
                </div>
                <p class="result-path">${escapeHtml(file.path)}</p>
                <p class="result-reason">${escapeHtml(file.reason || 'No reason available.')}</p>
                <div class="result-foot">
                    <button class="mini-button" type="button" data-filter-bucket="${escapeHtml(file.bucket)}">Only ${escapeHtml(file.bucket)}</button>
                    <button class="mini-button" type="button" data-copy-text="${escapeHtml(file.reason || '')}">Copy reason</button>
                </div>
            </article>
        `;
    }).join('');
}

function buildTreeLines(node, depth, lines) {
    if (lines.length >= TREE_LINE_LIMIT) return false;

    const prefix = '  '.repeat(depth);
    const icon = node.is_dir ? '📁' : getFileIcon(node.extension);
    const sizeLabel = node.is_dir ? '' : ` (${formatBytes(node.size_bytes || 0)})`;
    lines.push(`${prefix}${icon} ${node.name}${sizeLabel}`);

    if (node.is_dir && Array.isArray(node.children)) {
        for (const child of node.children) {
            const completed = buildTreeLines(child, depth + 1, lines);
            if (!completed) return false;
        }
    }
    return true;
}

function renderTreePanel() {
    if (!state.scanResult?.tree) {
        $('tree-summary').innerHTML = '<div class="empty-panel"><h3>No tree available</h3><p>Run Analyze Folder or Tree Only to build a directory map.</p></div>';
        $('tree-output').textContent = '';
        return;
    }

    const lines = [];
    const finished = buildTreeLines(state.scanResult.tree, 0, lines);
    const errorCount = state.scanResult.errors?.length || 0;

    $('tree-summary').innerHTML = `
        <strong>${escapeHtml(state.scanResult.root)}</strong><br>
        ${state.scanResult.total_files} files · ${state.scanResult.total_dirs} folders · ${errorCount} warnings
        ${finished ? '' : ' · tree preview truncated for readability'}
    `;

    $('tree-output').textContent = `${lines.join('\n')}${finished ? '' : '\n… tree truncated for readability …'}`;
}

function updateFooterInfo() {
    if (state.summaryResult || state.scanResult) {
        const totalFiles = state.summaryResult?.total_files ?? state.scanResult?.total_files ?? 0;
        const unknownCount = state.summaryResult?.bucket_counts?.Unknown || 0;
        const pathLabel = getPathLabel(state.currentPath || state.summaryResult?.root || state.scanResult?.root || 'Current folder');
        $('footer-info').textContent = `${pathLabel} · ${totalFiles} files · Unknown ${unknownCount}`;
        return;
    }
    $('footer-info').textContent = 'No scan performed yet';
}

async function copyText(text, successMessage) {
    if (!text) {
        log('Nothing to copy.', 'warn');
        return;
    }
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        log(successMessage || 'Copied to clipboard.', 'ok');
    } catch (error) {
        log(`Copy failed: ${error?.message || error}`, 'err');
    }
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTimestamp(isoString) {
    if (!isoString) return 'Not yet';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Not yet';
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getFileIcon(ext) {
    const icons = {
        rs: '🦀',
        js: '📜',
        ts: '📜',
        py: '🐍',
        html: '🌐',
        css: '🎨',
        md: '📝',
        json: '📋',
        pdf: '📄',
        exe: '⚡'
    };
    return icons[String(ext || '').toLowerCase()] || '📄';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function handleTabKeyboard(event) {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const currentIndex = tabs.findIndex(tab => tab === document.activeElement);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        tabs[(currentIndex + 1) % tabs.length].focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        tabs[(currentIndex - 1 + tabs.length) % tabs.length].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (document.activeElement.classList.contains('tab')) {
            switchTab(document.activeElement.dataset.tab);
        }
    }
}

async function runDiagnostics() {
    log('═══ Running diagnostics ═══', 'info');
    $('diag-panel').classList.remove('hidden');
    switchTab('overview');
    $('welcome').classList.add('hidden');

    const hasTauri = !!window.__TAURI__;
    setDiagStatus('diag-tauri', hasTauri ? 'ok' : 'fail');
    log(`Tauri API: ${hasTauri ? '✓' : '✗'}`, hasTauri ? 'ok' : 'warn');

    const hasInvoke = !!(window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke);
    setDiagStatus('diag-invoke', hasInvoke ? 'ok' : 'fail');
    log(`invoke(): ${hasInvoke ? '✓' : '✗'}`, hasInvoke ? 'ok' : 'warn');

    setDiagStatus('diag-ping', 'check');
    try {
        const pong = await invoke('ping');
        setDiagStatus('diag-ping', pong === 'pong' ? 'ok' : 'fail');
        log(`ping → ${pong}`, pong === 'pong' ? 'ok' : 'warn');
    } catch (error) {
        setDiagStatus('diag-ping', 'fail');
        log(`ping failed: ${error}`, 'err');
    }

    setDiagStatus('diag-scan', 'check');
    try {
        await invoke('scan_tree', { root_path: 'DIAGNOSTIC_CHECK' });
        setDiagStatus('diag-scan', 'ok');
        log('scan_tree: registered', 'ok');
    } catch (error) {
        const msg = error?.message || '';
        const isRegistered = msg.includes('validation') || msg.includes('not exist') || msg.includes('allowed') || msg.includes('DIAGNOSTIC');
        setDiagStatus('diag-scan', isRegistered ? 'ok' : 'fail');
        log(`scan_tree: ${isRegistered ? '✓ registered' : '✗ not found'}`, isRegistered ? 'ok' : 'err');
    }
}

function setDiagStatus(id, status) {
    const el = $(id);
    if (el) {
        el.className = `diag-status ${status}`;
    }
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_DEFAULT = 1.0;

function getZoomLevel() {
	const saved = localStorage.getItem('archivist-zoom');
	return saved ? parseFloat(saved) : ZOOM_DEFAULT;
}

function applyZoom(level) {
	const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level));
	const app = $('app');
	if (app) app.style.transform = `scale(${clamped})`;
	const display = $('zoom-level');
	if (display) display.textContent = `${Math.round(clamped * 100)}%`;
	localStorage.setItem('archivist-zoom', clamped.toString());
}

function zoomIn() { applyZoom(getZoomLevel() + ZOOM_STEP); }
function zoomOut() { applyZoom(getZoomLevel() - ZOOM_STEP); }
function zoomReset() { applyZoom(ZOOM_DEFAULT); }

document.addEventListener('keydown', (e) => {
	if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
	if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
	if (e.ctrlKey && e.key === '0') { e.preventDefault(); zoomReset(); }
});

document.addEventListener('DOMContentLoaded', () => {
    renderRecentPaths();

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        tab.addEventListener('keydown', handleTabKeyboard);
    });

    $('btn-analyze').addEventListener('click', runAnalyzeFolder);
    $('btn-analyze-welcome').addEventListener('click', handleWelcomeAnalyze);
    $('btn-scan').addEventListener('click', runScanTree);
    $('btn-classify').addEventListener('click', runClassify);
    $('btn-index').addEventListener('click', runBuildIndex);
    $('btn-registry').addEventListener('click', runBuildRegistry);
    $('btn-handoff').addEventListener('click', runGenerateHandoff);
    $('btn-diag').addEventListener('click', runDiagnostics);
    $('btn-clear-log').addEventListener('click', () => {
        state.logEntries = [];
        $('log-output').innerHTML = '';
    });
    $('btn-clear-search').addEventListener('click', () => {
        state.searchQuery = '';
        $('search-query').value = '';
        renderRetrieve();
    });

    $('search-query').addEventListener('input', event => {
        state.searchQuery = event.target.value;
        renderRetrieve();
    });

$('btn-zoom-in').addEventListener('click', zoomIn);
$('btn-zoom-out').addEventListener('click', zoomOut);
$('btn-zoom-reset').addEventListener('click', zoomReset);
applyZoom(getZoomLevel());

$('folder-path').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        runAnalyzeFolder();
    }
});

    $('recent-folders').addEventListener('click', event => {
        const button = event.target.closest('[data-path]');
        if (!button) return;
        $('folder-path').value = button.dataset.path;
        state.currentPath = button.dataset.path;
        log(`Loaded recent folder: ${button.dataset.path}`, 'info');
    });

    $('bucket-filters').addEventListener('click', event => {
        const button = event.target.closest('[data-bucket-filter]');
        if (!button) return;
        state.bucketFilter = button.dataset.bucketFilter;
        renderRetrieve();
    });

    $('overview-content').addEventListener('click', event => {
        const bucketButton = event.target.closest('[data-overview-bucket]');
        if (bucketButton) {
            state.bucketFilter = bucketButton.dataset.overviewBucket;
            switchTab('retrieve');
            renderRetrieve();
            return;
        }

        const copyButton = event.target.closest('[data-copy-path]');
        if (copyButton) {
            copyText(copyButton.dataset.copyPath, 'Copied file path.');
        }
    });

    $('search-results').addEventListener('click', event => {
        const copyPathButton = event.target.closest('[data-copy-path]');
        if (copyPathButton) {
            copyText(copyPathButton.dataset.copyPath, 'Copied file path.');
            return;
        }

        const copyTextButton = event.target.closest('[data-copy-text]');
        if (copyTextButton) {
            copyText(copyTextButton.dataset.copyText, 'Copied explanation.');
            return;
        }

        const bucketButton = event.target.closest('[data-filter-bucket]');
        if (bucketButton) {
            state.bucketFilter = bucketButton.dataset.filterBucket;
            renderRetrieve();
        }
    });

    if (state.recentPaths[0]) {
        $('folder-path').value = state.recentPaths[0];
        state.currentPath = state.recentPaths[0];
    }

    renderOverview();
    renderRetrieve();
    renderTreePanel();
    updateFooterInfo();

    setTimeout(() => {
        const inTauri = !!window.__TAURI__;
        log(inTauri ? '✓ Running inside Tauri' : '⚠ Running in browser mode with mock read-only data', inTauri ? 'ok' : 'warn');
    }, 100);

    log('UI ready. Analyze a folder to build a working map.', 'info');
    setStatus('Ready', 'idle');
});
