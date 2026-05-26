'use strict';

const RECENT_PATHS_KEY = 'archivist.recentPaths.v1';
const MAX_RECENT_PATHS = 6;
const TAB_NAMES = ['overview', 'retrieve', 'tree', 'output', 'governance'];
const LANE_IDS = ['archivist', 'kernel', 'swarmmind', 'library', 'kucoin'];
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

function resolveTauriInvoke() {
    if (typeof window.__TAURI__?.core?.invoke === 'function') {
        return window.__TAURI__.core.invoke.bind(window.__TAURI__.core);
    }
    if (typeof window.__TAURI__?.invoke === 'function') {
        return window.__TAURI__.invoke.bind(window.__TAURI__);
    }
    if (typeof window.__TAURI_INTERNALS__?.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
    }
    return null;
}

function hasTauriRuntime() {
    return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__ || resolveTauriInvoke());
}

// Tauri invoke helper with explicit safety-mode fallback for browser mode.
const invoke = (() => {
    const tauriInvoke = resolveTauriInvoke();
    if (tauriInvoke) {
        return tauriInvoke;
    }

    console.error('[SECURITY] No Tauri API found - running in browser mode');
    console.error('[SECURITY] All mutating operations are BLOCKED');
    console.error('[SECURITY] Safety validation layer is NOT active');

    return async (cmd, args = {}) => {
        const root = args.rootPath || args.root || args.path || 'C:\\Demo\\Archivist';
  const readOnlyCommands = ['ping', 'scan_tree', 'summarize_folder', 'read_governance_file', 'run_script', 'git_status', 'check_read_only', 'get_cps_score', 'cps_guard', 'chat_send', 'save_agent_config', 'load_agent_config_cmd', 'fetch_models', 'agent_read_file', 'agent_list_directory', 'agent_search_files', 'get_read_audit_log', 'clear_read_audit_log', 'propose_patch', 'apply_patch', 'reject_patch', 'get_patch_audit_log', 'clear_patch_audit_log', 'get_lane_status', 'switch_lane'];

  if (readOnlyCommands.includes(cmd)) {
    console.warn(`[BROWSER] ${cmd} - returning mock data (no safety validation)`);
    if (cmd === 'ping') return 'pong';
    if (cmd === 'scan_tree') return createMockScanResult(root);
    if (cmd === 'summarize_folder') return createMockSummary(root);
    if (cmd === 'get_cps_score') return { score: 19, threshold: 10, passing: true };
    if (cmd === 'cps_guard') return true;
    if (cmd === 'read_governance_file') {
      const fileMap = {
        'active-mode': { mode: 'OBSERVE', version: 5, set_at: '2026-05-22T10:00:00Z', set_by: 'archivist' },
        'active-blocker': null,
        'system-state': { status: 'consistent', last_check: '2026-05-22T12:00:00Z' },
        'trust-store': { archivist: { key_id: 'archivist-001' }, kernel: { key_id: 'kernel-001' } },
        'last-recovery': { verdict: 'PASSED', tests_passed: 12, tests_total: 12, timestamp: '2026-05-22T09:00:00Z' },
        'allowed-roots': { allowed_roots: ['S:/Archivist-Agent', 'S:/kernel-lane', 'S:/SwarmMind', 'S:/self-organizing-library'], blocked_roots: [], read_only_mode: true },
        'constitutional-constraints': { constraints: [{ name: 'STRUCTURE_OVER_IDENTITY', weight: 5 }, { name: 'CORRECTION_MANDATORY', weight: 4 }, { name: 'SINGLE_ENTRY_POINT', weight: 5 }, { name: 'OPERATOR_ACCOUNTABILITY', weight: 5 }] },
        'now-md': '# NOW.md\n\nMode: OBSERVE\nSession: browser-mock\n\n## Active Focus\n- None (mock data)\n\n## Blockers\n- None\n'
      };
      return fileMap[args.fileName] || null;
    }
    if (cmd === 'run_script') {
      return { stdout: '[MOCK] Script executed successfully.\nAll checks passed.', stderr: '', exit_code: 0 };
    }
    if (cmd === 'git_status') {
      return { raw: 'M src-tauri/src/governance.rs\n?? ui/governance-mock.txt', modified: 1, untracked: 1, clean: false };
    }
    if (cmd === 'check_read_only') {
      return { read_only: true, allowed_roots: ['S:/Archivist-Agent', 'S:/kernel-lane', 'S:/SwarmMind', 'S:/self-organizing-library'], blocked_roots: [] };
    }
  if (cmd === 'chat_send') {
    const userMsg = args.request?.messages?.filter(m => m.role === 'user').pop();
    const question = userMsg?.content || '(empty)';
    return {
      reply: `[Browser Mock] You said: "${question}"\n\nThis is a mock response. The real backend requires Tauri + an API key to call the AI model.`,
      model: args.request?.model || 'mock-model',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      toolCalls: null,
      finishReason: 'stop',
      governance: {
        cps_passing: true,
        mode: 'OBSERVE',
        chat_allowed: true,
        warnings: ['Running in browser mock mode — no governance enforcement.']
      }
    };
  }
            if (cmd === 'save_agent_config') {
                try {
                    window.localStorage.setItem('archivist.chatConfig.mock', JSON.stringify(args));
                } catch (_) { /* ignore */ }
                return { filePath: 'config/agent_config.json', content: JSON.stringify(args), parentDir: 'config', needsMkdir: false };
            }
          if (cmd === 'load_agent_config_cmd') {
            let mockConfig = { chat_endpoint: null, chat_model: null, temperature: 0.7, max_tokens: 2048, has_api_key: false };
            try {
              const saved = window.localStorage.getItem('archivist.chatConfig.mock');
              if (saved) {
                const parsed = JSON.parse(saved);
                mockConfig.chat_endpoint = parsed.endpoint || null;
                mockConfig.chat_model = parsed.model || null;
                mockConfig.temperature = parsed.temperature || 0.7;
                mockConfig.max_tokens = parsed.maxTokens || 2048;
                mockConfig.has_api_key = !!parsed.apiKey;
              }
            } catch (_) { /* ignore */ }
            return mockConfig;
          }
    if (cmd === 'fetch_models') {
    return [
    { id: 'meta/llama-3.3-70b-instruct', owned_by: 'meta' },
    { id: 'meta/llama-3.1-8b-instruct', owned_by: 'meta' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', owned_by: 'nvidia' },
    { id: 'mistralai/mixtral-8x7b-instruct-v0.1', owned_by: 'mistralai' },
    { id: 'google/gemma-2-9b-it', owned_by: 'google' },
    ];
    }
  if (cmd === 'agent_read_file') {
    const p = args.path || '';
    if (p.includes('.env') || p.includes('.git') || p.includes('.pem') || p.includes('.key')) {
      throw new Error('Secret/sensitive path blocked: ' + p);
    }
    return { path: p, content: '[Browser Mock] File content would appear here.', size_bytes: 42, truncated: false, total_lines: 1, offset: 0, lines_returned: 1 };
  }
    if (cmd === 'agent_list_directory') {
    const p = args.path || 'S:/Archivist-Agent';
    return [
    { name: 'src-tauri', path: p + '/src-tauri', is_dir: true, size_bytes: 0, extension: null },
    { name: 'ui', path: p + '/ui', is_dir: true, size_bytes: 0, extension: null },
    { name: 'README.md', path: p + '/README.md', is_dir: false, size_bytes: 1244, extension: 'md' },
    { name: 'BOOTSTRAP.md', path: p + '/BOOTSTRAP.md', is_dir: false, size_bytes: 2800, extension: 'md' },
    ];
    }
    if (cmd === 'agent_search_files') {
    const q = args.query || '';
    const p = args.path || 'S:/Archivist-Agent';
    return [
    { name: q + '_match.rs', path: p + '/src-tauri/src/' + q + '_match.rs', is_dir: false, size_bytes: 512, extension: 'rs' },
    ];
    }
if (cmd === 'get_read_audit_log') {
            return state.readAuditLog || [];
          }
          if (cmd === 'clear_read_audit_log') {
            state.readAuditLog = [];
            return true;
          }
          if (cmd === 'propose_patch') {
            const fp = args.filePath || 'unknown.txt';
            const fakeId = 'mock-' + Date.now().toString(36);
            return {
              proposalId: fakeId,
              filePath: fp,
              diff: '--- a/' + fp.split(/[\\/]/).pop() + '\n+++ b/' + fp.split(/[\\/]/).pop() + '\n@@ -1,1 +1,1 @@\n-old line\n+new line',
              linesAdded: 1,
              linesRemoved: 1,
              originalHash: 'deadbeef'
            };
          }
          if (cmd === 'apply_patch') {
            return { filePath: 'mock.txt', success: true, detail: 'Patch applied (browser mock).', readOnlyOverridden: false };
          }
          if (cmd === 'reject_patch') {
            return true;
          }
          if (cmd === 'get_patch_audit_log') {
            return state.patchAuditLog || [];
          }
      if (cmd === 'clear_patch_audit_log') {
        state.patchAuditLog = [];
        return true;
      }
if (cmd === 'get_lane_status') {
    const laneId = args.laneId || 'archivist';
    const mockLanes = {
    archivist: { laneId: 'archivist', healthy: true, inboxCount: 3, outboxCount: 8, quarantineCount: 0, actionRequiredCount: 0, lastHeartbeat: '2026-05-24T22:00:00Z' },
    kernel: { laneId: 'kernel', healthy: true, inboxCount: 1, outboxCount: 4, quarantineCount: 0, actionRequiredCount: 0, lastHeartbeat: '2026-05-24T21:45:00Z' },
    swarmmind: { laneId: 'swarmmind', healthy: true, inboxCount: 0, outboxCount: 2, quarantineCount: 0, actionRequiredCount: 0, lastHeartbeat: '2026-05-24T21:30:00Z' },
    library: { laneId: 'library', healthy: true, inboxCount: 0, outboxCount: 1, quarantineCount: 0, actionRequiredCount: 0, lastHeartbeat: '2026-05-24T21:00:00Z' },
    kucoin: { laneId: 'kucoin', healthy: false, inboxCount: 0, outboxCount: 0, quarantineCount: 0, actionRequiredCount: 0, lastHeartbeat: null }
    };
    return mockLanes[laneId] || { laneId, healthy: false, inboxCount: 0, outboxCount: 0, quarantineCount: 0, actionRequiredCount: 0 };
}
if (cmd === 'switch_lane') {
    const laneId = args.laneId || 'archivist';
    return {
    laneId, repoRoot: laneId === 'archivist' ? 'S:/Archivist-Agent' : `S:/${laneId}-lane`, repoExists: true,
    gitBranch: 'main', gitHead: 'abc1234', gitClean: true, gitModified: 0, gitUntracked: 0, gitStaged: 0,
    inboxMessages: [{ name: '20260525_task_from_kernel.json', timestamp: '2026-05-25T10:00:00Z' }],
    outboxMessages: [], quarantineMessages: [], actionRequiredMessages: [],
    journalEntries: [{ fileName: '2026-05-25.jsonl', preview: '{"event":"test"}' }],
    trustStoreEntry: { lane_id: laneId, lane_state: 'ACTIVE', key_id: 'abc123', algorithm: 'EdDSA', registered_at: '2026-05-11T04:00:00Z' },
    laneState: 'ACTIVE'
    };
}
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
  activeTab: 'chat',
  logEntries: [],
  isWorking: false,
  searchQuery: '',
  bucketFilter: 'all',
  recentPaths: loadRecentPaths(),
  lastAnalyzedAt: null,
  governanceLoaded: false,
  chatMessages: [],
  chatConfig: null,
  chatLoading: false,
  chatSettingsOpen: false,
  readAuditOpen: false,
  readAuditLog: [],
  patchAuditLog: [],
    laneStatuses: {},
    activeLane: null,
    laneDetail: null,
    evidencePanelOpen: true
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
  // Mirror into evidence panel activity section
  renderEvidenceActivity();
}

function setStatus(text, type = 'idle') {
    $('status-text').textContent = text;
    $('status-dot').className = `status-dot ${type}`;
}

function switchTab(tabName) {
  state.activeTab = tabName;

  const toolsPanel = $('tools-panel');
  const chatPanel = $('chat-panel');

  if (tabName === 'chat') {
    // Chat is the primary view — hide the tools overlay
    if (toolsPanel) toolsPanel.classList.add('hidden');
    renderChat();
    return;
  }

  // Show tools overlay for non-chat tabs
  if (toolsPanel) toolsPanel.classList.remove('hidden');

  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  TAB_NAMES.forEach(name => {
    const el = $(`tab-${name}`);
    if (el) el.classList.toggle('hidden', name !== tabName);
  });
  $('welcome').classList.add('hidden');
  if (tabName === 'tree') renderTreePanel();
  if (tabName === 'overview') renderOverview();
  if (tabName === 'retrieve') renderRetrieve();
  if (tabName === 'governance') renderGovernance();
}

function closeToolsPanel() {
  switchTab('chat');
}

function toggleSidebar() {
  const main = document.querySelector('main');
  if (main) {
    main.classList.toggle('sidebar-collapsed');
    const isCollapsed = main.classList.contains('sidebar-collapsed');
    const btn = $('btn-sidebar-toggle');
    if (btn) {
      btn.textContent = isCollapsed ? '☰ Sidebar' : '☰ Hide';
    }
    localStorage.setItem('archivist-sidebar-collapsed', isCollapsed ? '1' : '0');
    // Restore saved width when un-collapsing
    if (!isCollapsed) {
      const saved = localStorage.getItem('archivist-sidebar-width');
      if (saved) {
        const cols = main.style.gridTemplateColumns.split(/\s+/).map(c => parseFloat(c));
        const ew = cols[4] || 380;
        main.style.gridTemplateColumns = `${parseFloat(saved)}px 5px ${Math.max(200, main.clientWidth - parseFloat(saved) - ew - 10)}px 5px ${ew}px`;
      }
    }
  }
}

async function renderGovernance() {
  if (state.governanceLoaded && state.activeTab === 'governance') return;
  try {
    const [cps, modeData, systemState, blocker, recovery, readonlyReport, gitData, nowMd] = await Promise.all([
      invoke('get_cps_score').catch(() => ({ score: 0, threshold: 10, passing: false })),
      invoke('read_governance_file', { fileName: 'active-mode' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'system-state' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'active-blocker' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'last-recovery' }).catch(() => null),
      invoke('check_read_only').catch(() => ({ read_only: false, allowed_roots: [], blocked_roots: [] })),
      invoke('git_status').catch(() => ({ raw: 'unavailable', modified: 0, untracked: 0, clean: true })),
      invoke('read_governance_file', { fileName: 'now-md' }).catch(() => null)
    ]);

    renderGovSystemState(systemState, blocker, recovery);
    renderGovMode(modeData);
    renderGovCps(cps);
    renderGovReadonly(readonlyReport);
    renderGovGit(gitData);
    renderGovNowMd(nowMd);
    state.governanceLoaded = true;
  } catch (e) {
    log('Governance load failed: ' + e.message, 'err');
  }
}

function renderGovSystemState(systemState, blocker, recovery) {
  const el = $('gov-system-state');
  const items = [];
  items.push(govStatusItem('System', systemState?.status === 'consistent' ? 'ok' : 'warn', systemState?.status || 'unknown'));
  items.push(govStatusItem('Blocker', blocker ? 'err' : 'ok', blocker ? blocker.subject || 'Active' : 'None'));
  const rv = recovery?.verdict || 'unknown';
  items.push(govStatusItem('Recovery', rv === 'PASSED' ? 'ok' : rv === 'CONFLICTED' ? 'err' : 'warn', rv));
  items.push(govStatusItem('Tests', recovery ? 'ok' : 'idle', recovery ? `${recovery.tests_passed}/${recovery.tests_total}` : 'N/A'));
  el.innerHTML = items.join('');
}

function govStatusItem(label, status, value) {
  return `<div class="gov-status-item"><div class="gov-status-dot ${status}"></div><span>${escapeHtml(label)}: ${escapeHtml(String(value))}</span></div>`;
}

function renderGovMode(modeData) {
  const el = $('gov-mode-display');
  if (!modeData) {
    el.innerHTML = '<span style="color:var(--muted)">Unavailable</span>';
    return;
  }
  const mode = (modeData.mode || 'unknown').toUpperCase();
  const modeClass = { OBSERVE: 'observe', BUILD: 'build', 'CHAOS-LAB': 'chaos', RECOVERY: 'recovery' }[mode] || 'observe';
  el.innerHTML = `<span class="gov-mode-${modeClass}">${escapeHtml(mode)}</span><div style="font-size:11px;color:var(--muted);margin-top:6px">v${modeData.version || '?'} &middot; ${escapeHtml(modeData.set_by || '?')}</div>`;
}

function renderGovCps(cps) {
  const el = $('gov-cps-display');
  const score = cps?.score ?? 0;
  const threshold = cps?.threshold ?? 10;
  const cls = score >= threshold ? 'healthy' : score >= threshold - 2 ? 'warning' : 'critical';
  el.innerHTML = `<div class="gov-cps-value ${cls}">${score}</div><div class="gov-cps-label">threshold: ${threshold} &middot; ${score >= threshold ? 'PASSING' : 'BLOCKED'}</div>`;
}

function renderGovReadonly(report) {
  const el = $('gov-readonly-report');
  if (!report) { el.innerHTML = '<span style="color:var(--muted)">Unavailable</span>'; return; }
  const flagCls = report.read_only ? 'active' : 'inactive';
  const flagText = report.read_only ? 'READ-ONLY ENFORCED' : 'READ-ONLY OFF';
  let html = `<div class="gov-readonly-flag ${flagCls}">${flagText}</div>`;
  if (report.allowed_roots?.length) {
    html += '<div><strong>Allowed:</strong></div>';
    report.allowed_roots.forEach(r => { html += `<div style="padding-left:12px">${escapeHtml(r)}</div>`; });
  }
  if (report.blocked_roots?.length) {
    html += '<div style="margin-top:6px"><strong>Blocked:</strong></div>';
    report.blocked_roots.forEach(r => { html += `<div style="padding-left:12px;color:#f44336">${escapeHtml(r)}</div>`; });
  }
  el.innerHTML = html;
}

function renderGovGit(gitData) {
  const el = $('gov-git-status');
  if (!gitData) { el.innerHTML = '<span style="color:var(--muted)">Unavailable</span>'; return; }
  const modCls = gitData.modified > 0 ? 'dirty' : 'clean';
  const untCls = gitData.untracked > 0 ? 'dirty' : 'clean';
  let html = `<div class="gov-git-summary"><div class="gov-git-stat"><span class="num ${modCls}">${gitData.modified}</span><span>modified</span></div><div class="gov-git-stat"><span class="num ${untCls}">${gitData.untracked}</span><span>untracked</span></div></div>`;
  if (gitData.raw) {
    html += `<div class="gov-git-raw">${escapeHtml(gitData.raw)}</div>`;
  }
  el.innerHTML = html;
}

function renderGovNowMd(content) {
  const el = $('gov-now-md');
  if (!content) { el.textContent = 'NOW.md not available.'; return; }
  if (typeof content === 'string') { el.textContent = content; return; }
  if (typeof content === 'object' && content.content) { el.textContent = content.content; return; }
  el.textContent = JSON.stringify(content, null, 2);
}

// ─── Lane-Aware Sidebar ───────────────────────────────────────────

async function loadLaneStatuses() {
  try {
    const results = await Promise.all(
      LANE_IDS.map(id => invoke('get_lane_status', { laneId: id }).catch(() => null))
    );
    LANE_IDS.forEach((id, i) => {
      state.laneStatuses[id] = results[i] || { laneId: id, healthy: false, inboxCount: 0, outboxCount: 0, quarantineCount: 0, actionRequiredCount: 0 };
    });
  } catch (_) {
    // Fallback: build from broadcast data
    LANE_IDS.forEach(id => {
      state.laneStatuses[id] = { laneId: id, healthy: false, inboxCount: 0, outboxCount: 0, quarantineCount: 0, actionRequiredCount: 0 };
    });
  }
  renderLaneList();
}

function renderLaneList() {
  const container = $('lane-list');
  if (!container) return;

  const entries = LANE_IDS.map(id => {
    const s = state.laneStatuses[id] || {};
    const healthy = s.healthy !== false;
    const dotCls = healthy ? 'healthy' : 'offline';
    const inboxCount = s.inboxCount || 0;
    const quarantineCount = s.quarantineCount || 0;
    const actionRequiredCount = s.actionRequiredCount || 0;

    let badgeHtml = '';
    if (actionRequiredCount > 0) {
      badgeHtml = `<span class="lane-badge action-required">${actionRequiredCount} action</span>`;
    } else if (quarantineCount > 0) {
      badgeHtml = `<span class="lane-badge quarantine">${quarantineCount} quar</span>`;
    } else if (inboxCount > 0) {
      badgeHtml = `<span class="lane-badge">${inboxCount}</span>`;
    }

    const displayName = id.replace(/_/g, ' ');
        const isActive = state.activeLane === id;
        const activeCls = isActive ? ' lane-item-active' : '';
        return `<div class="lane-item${activeCls}" data-lane="${escapeHtml(id)}">
<div class="lane-health-dot ${dotCls}"></div>
<span class="lane-name">${escapeHtml(displayName)}</span>
${badgeHtml}
</div>`;
  });

    container.innerHTML = entries.join('');
}

/// Handle clicking a lane in the sidebar — loads lane detail and shows it.
async function handleLaneClick(laneId) {
    if (state.activeLane === laneId && state.laneDetail) {
        // Toggle off — return to chat.
        state.activeLane = null;
        state.laneDetail = null;
        renderLaneList();
        showChatPanel();
        return;
    }

    state.activeLane = laneId;
    renderLaneList();
    setStatus(`Loading lane: ${laneId}…`, 'busy');

    try {
        const detail = await invoke('switch_lane', { laneId });
        state.laneDetail = detail;
        renderLaneDetail(detail);
        showLaneDetailPanel();
        setStatus(`Viewing lane: ${laneId}`, 'idle');
    } catch (e) {
        const msg = (typeof e === 'string') ? e : (e?.message || String(e));
        log(`Failed to load lane ${laneId}: ${msg}`, 'error');
        setStatus(`Lane ${laneId} load failed`, 'error');
    }
}

/// Show the lane detail panel (hides chat/tools).
function showLaneDetailPanel() {
    const chatPanel = $('chat-panel');
    const toolsPanel = $('tools-panel');
    const lanePanel = $('lane-detail-panel');
    if (chatPanel) chatPanel.classList.add('hidden');
    if (toolsPanel) toolsPanel.classList.add('hidden');
    if (lanePanel) lanePanel.classList.remove('hidden');
}

/// Show the chat panel (hides lane detail/tools).
function showChatPanel() {
    const chatPanel = $('chat-panel');
    const toolsPanel = $('tools-panel');
    const lanePanel = $('lane-detail-panel');
    if (chatPanel) chatPanel.classList.remove('hidden');
    if (toolsPanel) toolsPanel.classList.add('hidden');
    if (lanePanel) lanePanel.classList.add('hidden');
}

/// Render the lane detail view in the center panel.
function renderLaneDetail(detail) {
    const container = $('lane-detail-panel');
    if (!container) return;

    const laneId = detail.laneId || 'unknown';
    const displayName = laneId.replace(/_/g, ' ');
    const laneState = detail.laneState || 'UNKNOWN';
    const stateCls = laneState === 'ACTIVE' ? 'active' : (laneState === 'DORMANT' ? 'dormant' : 'offline');

    // Git section
    const gitBranch = detail.gitBranch || '—';
    const gitHead = detail.gitHead || '—';
    const gitClean = detail.gitClean !== null && detail.gitClean !== undefined
        ? (detail.gitClean ? '✓ clean' : '⚠ dirty')
        : '—';
    const gitModified = detail.gitModified || 0;
    const gitUntracked = detail.gitUntracked || 0;
    const gitStaged = detail.gitStaged || 0;

    // Message counts
    const inboxCount = (detail.inboxMessages || []).length;
    const outboxCount = (detail.outboxMessages || []).length;
    const quarantineCount = (detail.quarantineMessages || []).length;
    const actionCount = (detail.actionRequiredMessages || []).length;

    // Render message file list (compact)
    const renderFileList = (files, emptyMsg) => {
        if (!files || files.length === 0) return `<p class="lane-detail-empty">${emptyMsg}</p>`;
        return '<ul class="lane-detail-msg-list">' + files.map(f =>
            `<li><span class="lane-msg-name">${escapeHtml(f.name)}</span>${f.timestamp ? ` <span class="lane-msg-ts">${escapeHtml(f.timestamp)}</span>` : ''}</li>`
        ).join('') + '</ul>';
    };

    // Render journal entries
    const renderJournalList = (entries) => {
        if (!entries || entries.length === 0) return '<p class="lane-detail-empty">No journal entries.</p>';
        return '<ul class="lane-detail-journal-list">' + entries.map(e =>
            `<li><span class="lane-journal-name">${escapeHtml(e.fileName)}</span><pre class="lane-journal-preview">${escapeHtml(e.preview)}</pre></li>`
        ).join('') + '</ul>';
    };

    container.innerHTML = `
<div class="lane-detail-header">
    <div class="lane-detail-title-row">
        <h2>${escapeHtml(displayName)}</h2>
        <span class="lane-detail-state-badge ${stateCls}">${escapeHtml(laneState)}</span>
    </div>
    <p class="lane-detail-repo-root">${detail.repoRoot ? escapeHtml(detail.repoRoot) : 'Repo root unknown'}</p>
    <button class="btn btn-ghost" id="btn-lane-detail-close" title="Return to chat">✕ Back to Chat</button>
</div>

<div class="lane-detail-grid">
    <section class="lane-detail-card">
        <h3>Git Status</h3>
        <div class="lane-detail-kv">
            <span class="lk">Branch</span><span class="lv">${escapeHtml(gitBranch)}</span>
            <span class="lk">HEAD</span><span class="lv">${escapeHtml(gitHead)}</span>
            <span class="lk">Tree</span><span class="lv">${escapeHtml(gitClean)}</span>
            ${gitModified > 0 ? `<span class="lk">Modified</span><span class="lv">${gitModified}</span>` : ''}
            ${gitUntracked > 0 ? `<span class="lk">Untracked</span><span class="lv">${gitUntracked}</span>` : ''}
            ${gitStaged > 0 ? `<span class="lk">Staged</span><span class="lv">${gitStaged}</span>` : ''}
        </div>
    </section>

    <section class="lane-detail-card">
        <h3>Messages</h3>
        <div class="lane-detail-msg-stats">
            <span class="lms inbox"><strong>${inboxCount}</strong> inbox</span>
            <span class="lms outbox"><strong>${outboxCount}</strong> outbox</span>
            <span class="lms quarantine"><strong>${quarantineCount}</strong> quarantine</span>
            <span class="lms action"><strong>${actionCount}</strong> action-required</span>
        </div>
    </section>

    <section class="lane-detail-card lane-detail-card-wide">
        <h3>Inbox Messages</h3>
        ${renderFileList(detail.inboxMessages, 'Inbox is empty.')}
    </section>

    <section class="lane-detail-card lane-detail-card-wide">
        <h3>Action Required</h3>
        ${renderFileList(detail.actionRequiredMessages, 'No action-required messages.')}
    </section>

    <section class="lane-detail-card lane-detail-card-wide">
        <h3>Journal</h3>
        ${renderJournalList(detail.journalEntries)}
    </section>

    <section class="lane-detail-card">
        <h3>Trust Store</h3>
        ${detail.trustStoreEntry ? `
            <div class="lane-detail-kv">
                <span class="lk">Key ID</span><span class="lv">${escapeHtml(detail.trustStoreEntry.key_id || '—')}</span>
                <span class="lk">Algorithm</span><span class="lv">${escapeHtml(detail.trustStoreEntry.algorithm || '—')}</span>
                <span class="lk">Registered</span><span class="lv">${escapeHtml(detail.trustStoreEntry.registered_at || '—')}</span>
            </div>
        ` : '<p class="lane-detail-empty">No trust store entry.</p>'}
    </section>
</div>`;

    // Wire up the close button.
    const closeBtn = $('btn-lane-detail-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            state.activeLane = null;
            state.laneDetail = null;
            renderLaneList();
            showChatPanel();
        });
    }
}

// ─── Evidence Panel ────────────────────────────────────────────────

function toggleEvidencePanel() {
  const main = document.querySelector('main');
  if (!main) return;
  main.classList.toggle('evidence-collapsed');
  state.evidencePanelOpen = !main.classList.contains('evidence-collapsed');
  localStorage.setItem('archivist-evidence-collapsed', state.evidencePanelOpen ? '0' : '1');
  // Restore saved width when un-collapsing
  if (state.evidencePanelOpen) {
    const saved = localStorage.getItem('archivist-evidence-width');
    if (saved) {
      const cols = main.style.gridTemplateColumns.split(/\s+/).map(c => parseFloat(c));
      const sw = cols[0] || 328;
      main.style.gridTemplateColumns = `${sw}px 5px ${Math.max(200, main.clientWidth - sw - parseFloat(saved) - 10)}px 5px ${parseFloat(saved)}px`;
    }
  }
}

async function loadEvidencePanel() {
  try {
    const [cps, modeData, systemState, blocker, recovery, readonlyReport, gitData, nowMd, patchLog, readLog] = await Promise.all([
      invoke('get_cps_score').catch(() => ({ score: 0, threshold: 10, passing: false })),
      invoke('read_governance_file', { fileName: 'active-mode' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'system-state' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'active-blocker' }).catch(() => null),
      invoke('read_governance_file', { fileName: 'last-recovery' }).catch(() => null),
      invoke('check_read_only').catch(() => ({ read_only: false, allowed_roots: [], blocked_roots: [] })),
      invoke('git_status').catch(() => ({ raw: 'unavailable', modified: 0, untracked: 0, clean: true })),
      invoke('read_governance_file', { fileName: 'now-md' }).catch(() => null),
      invoke('get_patch_audit_log').catch(() => []),
      invoke('get_read_audit_log').catch(() => [])
    ]);

    renderEvidenceGovernance(systemState, blocker, recovery, modeData, cps, readonlyReport);
    renderEvidencePatches(patchLog);
    renderEvidenceReads(readLog);
    renderEvidenceGit(gitData);
    renderEvidenceNowMd(nowMd);
    updateFooterMode(modeData);
  } catch (e) {
    log('Evidence panel load failed: ' + (typeof e === 'string' ? e : e?.message || String(e)), 'err');
  }
}

function renderEvidenceGovernance(systemState, blocker, recovery, modeData, cps, readonlyReport) {
  // System state
  const ssEl = $('ev-system-state');
  if (ssEl) {
    const status = systemState?.status === 'consistent' ? 'ok' : 'warn';
    ssEl.innerHTML = `<div class="ev-status-dot ${status}"></div><span class="ev-label">System</span><span class="ev-value">${escapeHtml(systemState?.status || 'unknown')}</span>`;
  }

  // Mode
  const modeEl = $('ev-mode-display');
  if (modeEl) {
    const mode = (modeData?.mode || 'unknown').toUpperCase();
    const modeClass = { OBSERVE: 'observe', BUILD: 'build', 'CHAOS-LAB': 'chaos', RECOVERY: 'recovery' }[mode] || 'observe';
    modeEl.innerHTML = `<span class="ev-mode-badge ${modeClass}">${escapeHtml(mode)}</span>`;
  }

  // CPS
  const cpsEl = $('ev-cps-display');
  const cpsBadge = $('ev-cps-badge');
  const score = cps?.score ?? 0;
  const threshold = cps?.threshold ?? 10;
  const cls = score >= threshold ? 'healthy' : score >= threshold - 2 ? 'warning' : 'critical';
  if (cpsEl) {
    cpsEl.innerHTML = `<span class="ev-cps-value ${cls}">${score}</span><span class="ev-cps-label">/ ${threshold} ${score >= threshold ? 'PASS' : 'BLOCK'}</span>`;
  }
  if (cpsBadge) {
    cpsBadge.textContent = String(score);
    cpsBadge.className = 'evidence-section-badge ' + cls;
  }

  // Read-only
  const roEl = $('ev-readonly-display');
  if (roEl && readonlyReport) {
    const flagCls = readonlyReport.read_only ? 'active' : 'inactive';
    const flagText = readonlyReport.read_only ? 'RO' : 'RW';
    roEl.innerHTML = `<span class="ev-readonly-flag ${flagCls}">${flagText}</span>`;
  }
}

function renderEvidencePatches(patchLog) {
  const container = $('ev-patch-log');
  const badge = $('ev-patch-count');
  const entries = Array.isArray(patchLog) ? patchLog : [];
  if (badge) badge.textContent = String(entries.length);

  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<p class="ev-empty">No patches proposed yet.</p>';
    return;
  }

  container.innerHTML = entries.slice(-20).reverse().map(e => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '?';
    const path = e.file_path || e.filePath || 'unknown';
    const status = (e.status || 'proposed').toLowerCase();
    return `<div class="ev-patch-entry">
      <span class="ev-patch-time">${escapeHtml(time)}</span>
      <span class="ev-patch-path">${escapeHtml(path)}</span>
      <span class="ev-patch-status ${status}">${escapeHtml(status)}</span>
    </div>`;
  }).join('');
}

function renderEvidenceReads(readLog) {
  const container = $('ev-read-log');
  const badge = $('ev-read-count');
  const entries = Array.isArray(readLog) ? readLog : [];
  if (badge) badge.textContent = String(entries.length);

  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<p class="ev-empty">No file reads recorded yet.</p>';
    return;
  }

  container.innerHTML = entries.slice(-20).reverse().map(e => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '?';
    const path = e.file_path || e.filePath || e.path || 'unknown';
    return `<div class="ev-read-entry">
      <span class="ev-read-time">${escapeHtml(time)}</span>
      <span class="ev-read-path">${escapeHtml(path)}</span>
    </div>`;
  }).join('');
}

function renderEvidenceGit(gitData) {
  const container = $('ev-git-status');
  const badge = $('ev-git-badge');
  if (!container) return;

  const modified = gitData?.modified || 0;
  const untracked = gitData?.untracked || 0;
  const modCls = modified > 0 ? 'dirty' : 'clean';
  const untCls = untracked > 0 ? 'dirty' : 'clean';

  if (badge) {
    badge.textContent = modified + untracked > 0 ? `${modified + untracked}` : 'clean';
    badge.className = 'evidence-section-badge ' + (modified + untracked > 0 ? 'warning' : 'healthy');
  }

  container.innerHTML = `<div class="ev-git-row">
    <div class="ev-git-stat"><span class="num ${modCls}">${modified}</span><span>modified</span></div>
    <div class="ev-git-stat"><span class="num ${untCls}">${untracked}</span><span>untracked</span></div>
  </div>`;
}

function renderEvidenceNowMd(content) {
  const container = $('ev-now-md-content');
  if (!container) return;
  if (!content) { container.innerHTML = '<p class="ev-empty">Not loaded.</p>'; return; }
  if (typeof content === 'string') { container.textContent = content; return; }
  if (typeof content === 'object' && content.content) { container.textContent = content.content; return; }
  container.textContent = JSON.stringify(content, null, 2);
}

function renderEvidenceActivity() {
  const container = $('ev-activity-log');
  const badge = $('ev-activity-count');
  const entries = state.logEntries || [];
  if (badge) badge.textContent = String(entries.length);
  if (!container) return;

  container.innerHTML = entries.slice(-30).reverse().map(e => {
    return `<div class="ev-activity-entry">
      <span class="ev-activity-time">${escapeHtml(e.time || '')}</span>
      <span class="ev-activity-msg ${e.level || 'info'}">${escapeHtml(e.message || '')}</span>
    </div>`;
  }).join('');
}

function updateFooterMode(modeData) {
  const el = $('footer-mode');
  if (!el || !modeData) return;
  const mode = (modeData.mode || 'unknown').toUpperCase();
  el.textContent = mode;
  const cls = { OBSERVE: 'observe', BUILD: 'build', 'CHAOS-LAB': 'chaos', RECOVERY: 'recovery' }[mode] || 'observe';
  el.className = 'footer-mode ev-mode-badge ' + cls;
}

function setupEvidenceSectionToggles() {
  document.querySelectorAll('.evidence-section-header[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.toggle;
      const body = document.getElementById(targetId);
      if (body) body.classList.toggle('open');
    });
  });
}

// ─── Chat UI ──────────────────────────────────────────────────────

function renderChat() {
  const messagesEl = $('chat-messages');
  if (!messagesEl) return;

  // Load config if not yet loaded
  if (!state.chatConfig) {
    loadChatConfig();
  }

  // Settings panel visibility
  const settingsEl = $('chat-settings');
  if (settingsEl) {
    settingsEl.classList.toggle('visible', state.chatSettingsOpen);
  }

  // Model label in toolbar
  const modelLabel = $('chat-model-label');
  if (modelLabel && state.chatConfig) {
    modelLabel.textContent = state.chatConfig.chat_model || 'No model configured';
  }

  // Render messages
  if (!state.chatMessages.length) {
    // Show welcome if no messages, but only show it if we're not loading
    if (!state.chatLoading) {
      messagesEl.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">💬</div>
          <h3>Agent Chat</h3>
          <p>Configure your API key in Settings, then send a message to start a conversation with the AI agent.</p>
          <p class="chat-welcome-hint">This runs through the Rust backend with CPS governance enforcement.</p>
        </div>
      `;
    }
    return;
  }

  let html = '';
  for (const msg of state.chatMessages) {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    const isTool = msg.role === 'tool';
    const timeStr = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';

    if (isSystem) {
      html += `<div class="chat-msg-system">${escapeHtml(msg.content || '')}</div>`;
 } else if (isTool) {
      // Tool result message — collapsible block
      const id = msg.toolCallId || 'unknown';
      const preview = escapeHtml(msg.content || '').substring(0, 200);
      const fullContent = escapeHtml(msg.content || '');

        // Check if this is a propose_patch result with a proposalId
        // Defensive: only render patch card if proposalId is a non-empty string
        let patchUI = '';
        try {
            if (msg.proposalId && typeof msg.proposalId === 'string' && msg.proposalId.length > 0) {
                const diffHtml = escapeHtml(msg.diff || msg.content || '(no diff available)');
                const safeProposalId = escapeHtml(msg.proposalId);
                const safeFilePath = escapeHtml(msg.patchFilePath || 'unknown');
                const linesInfo = (typeof msg.linesAdded === 'number' && typeof msg.linesRemoved === 'number')
                    ? `+${msg.linesAdded} -${msg.linesRemoved} lines`
                    : '';
                patchUI = `
                <div class="patch-review" role="region" aria-label="Patch review - apply or reject">
                    <div class="patch-review-header">
                        <span class="patch-icon">📝</span>
                        <strong class="patch-label">PATCH PROPOSAL</strong>
                        <span class="patch-file-path">${safeFilePath}</span>
                        <span class="patch-lines-info">${escapeHtml(linesInfo)}</span>
                    </div>
                    <div class="patch-diff-view"><pre>${diffHtml}</pre></div>
                    <div class="patch-actions">
                        <button class="patch-btn patch-btn-apply" type="button" onclick="applyPatch('${safeProposalId}')">✓ Apply Patch</button>
                        <button class="patch-btn patch-btn-reject" type="button" onclick="rejectPatch('${safeProposalId}')">✗ Reject</button>
                        <span class="patch-proposal-id">ID: ${safeProposalId}</span>
                    </div>
                </div>
                `;
            }
        } catch (patchRenderErr) {
            log('Patch review card render error — falling back to generic tool result: ' + patchRenderErr, 'err');
            patchUI = '';
        }

        html += `
<div class="chat-msg chat-msg-tool">
  <div class="chat-msg-avatar">⚙️</div>
  <div class="chat-msg-body">
    ${patchUI ? patchUI : `
    <div class="chat-tool-header" onclick="this.parentElement.querySelector('.chat-tool-detail').classList.toggle('collapsed')">
      <span class="chat-tool-label">Tool result</span>
      <span class="chat-tool-id">${escapeHtml(id.substring(0, 16))}</span>
      <span class="chat-tool-toggle">▶ click to expand</span>
    </div>
    <div class="chat-tool-detail collapsed"><pre>${fullContent}</pre></div>
    <div class="chat-tool-preview"><code>${preview}${(msg.content || '').length > 200 ? '…' : ''}</code></div>
    `}
    <div class="chat-msg-time">${escapeHtml(timeStr)}</div>
  </div>
</div>
`;
    } else if (msg.toolCalls && msg.toolCalls.length > 0) {
      // Assistant message with tool invocations
      const textContent = msg.content || '';
      const callSummaries = msg.toolCalls.map(tc => {
        const name = tc.function?.name || 'unknown';
        const args = tc.function?.arguments || '{}';
        let shortArgs = args;
        try { shortArgs = Object.keys(JSON.parse(args)).join(', '); } catch(_) {}
        return `<div class="chat-tool-call">▸ <strong>${escapeHtml(name)}</strong>(${escapeHtml(shortArgs)})</div>`;
      }).join('');
      html += `
      <div class="chat-msg chat-msg-assistant">
        <div class="chat-msg-avatar">🤖</div>
        <div class="chat-msg-body">
          ${textContent ? `<div class="chat-msg-content">${escapeHtml(textContent)}</div>` : ''}
          <div class="chat-tool-calls">${callSummaries}</div>
          <div class="chat-msg-time">${escapeHtml(timeStr)}</div>
        </div>
      </div>
      `;
    } else {
      html += `
      <div class="chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-assistant'}">
        <div class="chat-msg-avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="chat-msg-body">
          <div class="chat-msg-content">${escapeHtml(msg.content || '')}</div>
          <div class="chat-msg-time">${escapeHtml(timeStr)}</div>
        </div>
      </div>
      `;
    }
  }

  if (state.chatLoading) {
    html += `
      <div class="chat-msg chat-msg-assistant">
        <div class="chat-msg-avatar">🤖</div>
        <div class="chat-msg-body">
          <div class="chat-msg-thinking">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
        </div>
      </div>
    `;
  }

  messagesEl.innerHTML = html;

  // Only auto-scroll if user is near the bottom (within 120px)
  const isNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  if (isNearBottom) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Auto-scroll to any patch review card so the Apply/Reject buttons are visible
  const patchCard = messagesEl.querySelector('.patch-review');
  if (patchCard) {
    patchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function loadChatConfig() {
  try {
    const config = await invoke('load_agent_config_cmd');
    state.chatConfig = config;
    // Populate settings fields
    if ($('chat-endpoint')) $('chat-endpoint').value = config.chat_endpoint || '';
    if ($('chat-model')) {
      const selectEl = $('chat-model');
      // Clear existing options
      selectEl.innerHTML = '';
      if (config.chat_model) {
        // Add saved model as selected option
        const opt = document.createElement('option');
        opt.value = config.chat_model;
        opt.textContent = config.chat_model;
        opt.selected = true;
        selectEl.appendChild(opt);
      }
      // Add placeholder
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— click Fetch Models to list available models —';
      if (!config.chat_model) placeholder.selected = true;
      selectEl.insertBefore(placeholder, selectEl.firstChild);
    }
    if ($('chat-temperature')) $('chat-temperature').value = config.temperature ?? 0.7;
    if ($('chat-max-tokens')) $('chat-max-tokens').value = config.max_tokens ?? 2048;
     // Populate API key field: use remembered key from localStorage if present, else mask stored key.
     const savedKey = localStorage.getItem('savedApiKey');
     const apiKeyField = $('chat-api-key');
     const endpointInput = $('chat-endpoint');
     const statusElem = $('chat-endpoint-status');
     const rememberChk = $('remember-api-key');
     if (apiKeyField) {
       if (savedKey) {
         apiKeyField.value = savedKey;
         // Auto‑fill endpoint based on saved key
         if (savedKey.startsWith('sk-')) {
           if (endpointInput) endpointInput.value = 'https://api.openai.com/v1';
           if (statusElem) { statusElem.textContent = 'OpenAI endpoint auto‑filled.'; statusElem.style.display = 'block'; }
         } else if (savedKey.startsWith('sk-ant-') || savedKey.startsWith('claude-')) {
           if (endpointInput) endpointInput.value = 'https://api.anthropic.com/v1';
           if (statusElem) { statusElem.textContent = 'Anthropic endpoint auto‑filled.'; statusElem.style.display = 'block'; }
         } else {
           // Assume NVIDIA or other provider
           if (endpointInput) endpointInput.value = 'https://integrate.api.nvidia.com/v1';
           if (statusElem) { statusElem.textContent = 'NVIDIA endpoint auto‑filled.'; statusElem.style.display = 'block'; }
         }
         // When loading a saved key, check the remember box to indicate persistence
         if (rememberChk) rememberChk.checked = true;
       } else {
         // No saved key in localStorage, fallback to backend config
         if (config.has_api_key) {
           apiKeyField.value = '••••••••';
         } else {
           apiKeyField.value = '';
         }
         // Cannot auto-fill endpoint because we don't know the key type
         if (statusElem) statusElem.style.display = 'none';
         // Remember box should be unchecked when no key is saved
         if (rememberChk) rememberChk.checked = false;
       }
     }
       } else {
         // No saved key in localStorage, fallback to backend config
         if (config.has_api_key) {
           apiKeyField.value = '••••••••';
       } else {
         apiKeyField.value = config.has_api_key ? '••••••••' : '';
         if (rememberChk) rememberChk.checked = false;
       }
         // Cannot auto-fill endpoint because we don't know the key type
         if (statusElem) statusElem.style.display = 'none';
       }
     }
    // Update model label
    const modelLabel = $('chat-model-label');
    if (modelLabel) {
      modelLabel.textContent = config.chat_model || 'No model configured';
    }
    log('Chat config loaded.', 'info');
  } catch (e) {
    log('Failed to load chat config: ' + e.message, 'warn');
  }
}

// Auto‑fill endpoint and remember‑key handling
const apiKeyElem = $('chat-api-key');
if (apiKeyElem) {
  apiKeyElem.addEventListener('input', (e) => {
    const key = e.target.value.trim();
    const endpointInput = $('chat-endpoint');
    const statusElem = $('chat-endpoint-status');
    if (key.startsWith('sk-')) {
       endpointInput.value = 'https://api.openai.com/v1';
       statusElem.textContent = 'OpenAI endpoint auto‑filled.';
       statusElem.style.display = 'block';
     } else if (key.startsWith('sk-ant-') || key.startsWith('claude-')) {
       endpointInput.value = 'https://api.anthropic.com/v1';
       statusElem.textContent = 'Anthropic endpoint auto‑filled.';
       statusElem.style.display = 'block';
     } else if (key) { // Assume NVIDIA or other provider
       endpointInput.value = 'https://integrate.api.nvidia.com/v1';
       statusElem.textContent = 'NVIDIA endpoint auto‑filled.';
       statusElem.style.display = 'block';
     } else {
       statusElem.style.display = 'none';
     }
  });
}

async function fetchModels() {
  const statusEl = $('model-fetch-status');
  const btnEl = $('btn-fetch-models');
  const selectEl = $('chat-model');
  if (!selectEl) return;

  const endpoint = $('chat-endpoint')?.value.trim() || null;
  const apiKeyRaw = $('chat-api-key')?.value.trim() || null;
  const apiKey = (apiKeyRaw && apiKeyRaw !== '••••••••') ? apiKeyRaw : null;

    // Guard: endpoint is required to fetch models.
    if (!endpoint) {
      if (statusEl) { statusEl.textContent = '⚠ Endpoint not configured.'; statusEl.className = 'helper-text error'; }
      log('Attempted to fetch models without endpoint.', 'warn');
      return;
    }
    // Guard: API key is required for authenticated endpoints.
    if (!apiKey) {
      if (statusEl) { statusEl.textContent = '⚠ API key not configured.'; statusEl.className = 'helper-text error'; }
      log('Attempted to fetch models without API key.', 'warn');
      return;
    }


  if (statusEl) { statusEl.textContent = 'Fetching models…'; statusEl.className = 'helper-text'; }
  if (btnEl) btnEl.disabled = true;

  try {
    const models = await invoke('fetch_models', { endpoint, apiKey });
    if (!Array.isArray(models) || models.length === 0) {
      if (statusEl) { statusEl.textContent = 'No models found at this endpoint.'; statusEl.className = 'helper-text error'; }
      return;
    }

    // Remember current selection
    const currentModel = selectEl.value;

    // Clear and rebuild
    selectEl.innerHTML = '';

    // Placeholder
    const placeholder = document.createElement('option');
    placeholder.value = '';
        placeholder.textContent = `— ${models.length} chat-ready models —`;
    selectEl.appendChild(placeholder);

    // Add each model
    let matched = false;
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id + (m.owned_by ? ` (${m.owned_by})` : '');
      if (m.id === currentModel) { opt.selected = true; matched = true; }
      selectEl.appendChild(opt);
    }

    // If no match, select first real model
    if (!matched && models.length > 0) {
      selectEl.selectedIndex = 1;
    }

        if (statusEl) { statusEl.textContent = `✓ ${models.length} chat-ready models loaded (filtered from full list).`; statusEl.className = 'helper-text success'; }
        log(`Fetched ${models.length} chat-ready models from endpoint.`, 'ok');
  } catch (e) {
    if (statusEl) { statusEl.textContent = '✗ ' + e.message; statusEl.className = 'helper-text error'; }
    log('Failed to fetch models: ' + e.message, 'err');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

async function saveChatConfig() {
   const endpoint = $('chat-endpoint')?.value.trim() || null;
   const apiKeyRaw = $('chat-api-key')?.value.trim() || null;
   const model = $('chat-model')?.value || null;
   const rememberChk = $('remember-api-key');
   // Always store API key in localStorage if provided (not masked)
   const apiKeyToStore = (apiKeyRaw && apiKeyRaw !== '••••••••') ? apiKeyRaw : null;
   if (apiKeyToStore) {
     localStorage.setItem('savedApiKey', apiKeyToStore);
   } else {
     // If the field is empty or masked, remove from localStorage
     localStorage.removeItem('savedApiKey');
   }
   // Respect remember checkbox for clearing: if unchecked, ensure we don't persist
   if (rememberChk && !rememberChk.checked) {
     localStorage.removeItem('savedApiKey');
   }
   const temperature = parseFloat($('chat-temperature')?.value) || null;
   const maxTokens = parseInt($('chat-max-tokens')?.value, 10) || null;

   // Only send API key if it was actually typed (not the placeholder dots)
   const apiKey = (apiKeyRaw && apiKeyRaw !== '••••••••') ? apiKeyRaw : null;

   const statusEl = $('chat-settings-status');
   if (statusEl) statusEl.textContent = 'Saving…';

     try {
         const result = await invoke('save_agent_config', {
             endpoint: endpoint || null,
             apiKey: apiKey || null,
             model: model || null,
             temperature: temperature,
             maxTokens: maxTokens
         });
         // save_agent_config now returns {filePath, content, needsMkdir, parentDir}
         // instead of writing directly — we use Tauri's scope-checked writeTextFile,
         // same pattern as apply_patch to avoid std::fs::write() process aborts.
         try {
             if (result.needsMkdir && result.parentDir) {
                 const { mkdir } = window.__TAURI__.fs;
                 await mkdir(result.parentDir, { recursive: true });
             }
             const { writeTextFile } = window.__TAURI__.fs;
             await writeTextFile(result.filePath, result.content);
         } catch (writeErr) {
             const writeErrMsg = (typeof writeErr === 'string') ? writeErr : (writeErr?.message || String(writeErr));
             log('Config write failed: ' + writeErrMsg, 'err');
             if (statusEl) statusEl.textContent = '✗ Write failed: ' + writeErrMsg;
             return;
         }
         // Reload config from backend to get clean state
         state.chatConfig = null;
         await loadChatConfig();
         if (statusEl) {
             statusEl.textContent = '✓ Saved';
             setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
         }
         log('Agent settings saved.', 'ok');
     } catch (e) {
         const errMsg = (typeof e === 'string') ? e : (e?.message || String(e));
         if (statusEl) statusEl.textContent = '✗ ' + errMsg;
         log('Failed to save settings: ' + errMsg, 'err');
     }
 }

async function sendChatMessage() {
  const inputEl = $('chat-input');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  if (state.chatLoading) {
    log('Already waiting for a response.', 'warn');
    return;
  }

  // Add user message
  addChatMessage('user', text);
  inputEl.value = '';
  state.chatLoading = true;

  // Validate configuration before proceeding.
  const endpoint = $('chat-endpoint')?.value.trim() || null;
  const apiKeyRaw = $('chat-api-key')?.value.trim() || null;
  const apiKey = (apiKeyRaw && apiKeyRaw !== '••••••••') ? apiKeyRaw : null;
  const model = $('chat-model')?.value || null;

  // Guard: endpoint is required.
  if (!endpoint) {
    addChatMessage('system', '⚠ No chat endpoint configured. Please set an endpoint in Settings before sending messages.');
    log('Chat aborted: missing endpoint configuration.', 'warn');
    state.chatLoading = false;
    renderChat();
    return;
  }

  // Guard: API key is required for most backends.
  if (!apiKey) {
    addChatMessage('system', '⚠ No API key configured. Please provide a valid API key in Settings before sending messages.');
    log('Chat aborted: missing API key configuration.', 'warn');
    state.chatLoading = false;
    renderChat();
    return;
  }

  try {
    const apiKeyValue = (apiKey && apiKey !== '••••••••') ? apiKey : null;

    // ── Agentic tool-call loop ──────────────────────────────────
    // The model may return tool_calls in its response. When it does,
    // we execute each tool via Tauri invoke(), add the results as
    // tool-role messages, and call the API again. This repeats until
    // the model returns a plain text response (finish_reason = "stop")
    // or we hit the max iteration guard.
    const MAX_TOOL_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Build messages array from current conversation state.
      // The system prompt is prepended by the Rust backend.
      const messages = state.chatMessages.map(m => {
        // For assistant messages with tool_calls, use null content
        // (not empty string) to match OpenAI API format.
        // The Rust side serializes content: null explicitly in the API request.
        let content = m.content || null;
        if (m.role === 'assistant' && m.toolCalls && !content) {
          content = null;
        }
        const msg = { role: m.role, content };
        // Forward toolCalls for assistant messages that had tool calls.
        // The Rust ChatMessage.tool_calls is Option<String> (JSON-encoded),
        // so we serialize the array to a string.
        if (m.role === 'assistant' && m.toolCalls) {
          msg.toolCalls = JSON.stringify(m.toolCalls);
        }
        // Forward toolCallId for tool-result messages
        if (m.role === 'tool' && m.toolCallId) {
          msg.toolCallId = m.toolCallId;
        }
        return msg;
      });

      log(`Chat loop iteration ${iteration + 1}: sending ${messages.length} messages to model`, 'info');

      const result = await invoke('chat_send', {
        request: {
          messages: messages,
          model: model || null,
          apiKey: apiKeyValue,
          endpoint: endpoint || null
        }
      });

      const reply = result.reply || '';
      const toolCalls = result.toolCalls || [];
      const finishReason = result.finishReason || result.finish_reason || '';
      const modelUsed = result.model || 'unknown';
      const governance = result.governance || {};

      log(`API response: reply=${reply.length} chars, toolCalls=${toolCalls.length}, finishReason=${finishReason}, model=${modelUsed}`, 'info');

      // Show governance warnings if any
      const warnings = governance.warnings;
      if (Array.isArray(warnings) && warnings.length > 0) {
        warnings.forEach(w => log('Governance: ' + w, 'info'));
      }

      // ── No tool calls → final text reply, display and done ──
      if (!toolCalls || toolCalls.length === 0) {
        if (reply) {
          addChatMessage('assistant', reply);
        } else {
          // Empty response from model — this can happen if the API
          // rejects the message format or returns a malformed response.
          // Show a diagnostic message so the user knows something went wrong.
          addChatMessage('system', `⚠ Agent returned an empty response (iteration ${iteration + 1}, model: ${modelUsed}). This usually means the message format was rejected by the API. Check the log for details.`);
          log(`Empty model response on iteration ${iteration + 1} — possible API format error`, 'warn');
        }
        log(`Chat response received (model: ${modelUsed}, iterations: ${iteration + 1})`, 'ok');
        return; // loop exit
      }

      // ── Model requested tool calls → execute them ──
      // Add the assistant message with tool_calls to conversation
      addChatMessage('assistant', reply, { toolCalls: toolCalls });

      // Execute each tool call and add results as tool messages
      for (const tc of toolCalls) {
        const callId = tc.id || ('tc_' + Date.now());
        const funcName = tc.function?.name || '';
        let funcArgs = {};
        try {
          funcArgs = JSON.parse(tc.function?.arguments || '{}');
        } catch (parseErr) {
          // If arguments aren't valid JSON, report the error back as a tool result
          addChatMessage('tool', `Error: failed to parse tool arguments: ${parseErr.message}`, { toolCallId: callId });
          log(`Tool parse error for ${funcName}: ${parseErr.message}`, 'err');
          continue;
        }

        log(`Tool call: ${funcName}(${Object.keys(funcArgs).join(', ')})`, 'info');

        try {
          const toolResult = await executeToolCall(funcName, funcArgs);
          let resultStr = typeof toolResult === 'string'
            ? toolResult
            : JSON.stringify(toolResult, null, 2);
          // Truncate large tool results to avoid exceeding model context limits.
          // The full result is still shown in the UI (collapsed), but only the
          // truncated version is sent back to the model in subsequent turns.
          const MAX_TOOL_RESULT_CHARS = 8000;
          const wasTruncated = resultStr.length > MAX_TOOL_RESULT_CHARS;
          if (wasTruncated) {
            resultStr = resultStr.substring(0, MAX_TOOL_RESULT_CHARS)
              + `\n\n... [truncated ${resultStr.length - MAX_TOOL_RESULT_CHARS} chars — result too large for context window]`;
          }

          // Special handling for propose_patch: extract patch metadata for UI
          const patchOpts = {};
          if (funcName === 'propose_patch' && typeof toolResult === 'object' && toolResult !== null) {
            // Defensive: only extract if all expected fields are present and valid
            if (toolResult.proposalId && typeof toolResult.proposalId === 'string') {
              patchOpts.proposalId = toolResult.proposalId;
              patchOpts.patchFilePath = toolResult.filePath || '';
              patchOpts.diff = toolResult.diff || '';
              patchOpts.linesAdded = (typeof toolResult.linesAdded === 'number') ? toolResult.linesAdded : 0;
              patchOpts.linesRemoved = (typeof toolResult.linesRemoved === 'number') ? toolResult.linesRemoved : 0;
            } else {
              log('propose_patch returned object without valid proposalId — treating as generic result', 'warn');
            }
          }

          addChatMessage('tool', resultStr, { toolCallId: callId, ...patchOpts });
          log(`Tool result: ${funcName} → ${resultStr.length} chars${wasTruncated ? ' (truncated)' : ''}`, 'ok');
        } catch (toolErr) {
          const errMsg = (typeof toolErr === 'string') ? toolErr : (toolErr?.message || String(toolErr));
          addChatMessage('tool', `Error: ${errMsg}`, { toolCallId: callId });
          log(`Tool error: ${funcName} → ${errMsg}`, 'err');
        }
      }

      // Re-render to show tool calls and results before next iteration
      renderChat();

      // Loop continues — the next iteration will send the full conversation
      // including tool results back to the model
    }

    // If we hit the max iteration guard, add a warning
    addChatMessage('system', `Agent loop reached maximum ${MAX_TOOL_ITERATIONS} iterations. The agent may still have work to do.`);
    log('Tool-call loop hit iteration limit.', 'warn');
  } catch (e) {
    const errMsg = (typeof e === 'string') ? e : (e?.message || e?.toString?.() || 'Unknown error');
    addChatMessage('system', '⚠ Chat error: ' + errMsg);
    log('Chat failed: ' + errMsg, 'err');
    log('Chat failed: ' + errMsg, 'err');
  } finally {
    state.chatLoading = false;
    renderChat();
  }
}


/**
 * Execute a single tool call by mapping the function name to a Tauri invoke().
 * Tool arguments come from the model as camelCase (matching tools.json).
 * Tauri 2.x with rename_all = "camelCase" expects camelCase JS args.
 */
async function executeToolCall(funcName, funcArgs) {
  // Map of tool function names to their Tauri command names and arg mappings.
  // Most tools.json names match the Tauri command name directly.
  const TOOL_MAP = {
    scan_tree:           { cmd: 'scan_tree',           args: a => ({ rootPath: a.rootPath }) },
    summarize_folder:    { cmd: 'summarize_folder',    args: a => ({ rootPath: a.rootPath }) },
    agent_list_directory:{ cmd: 'agent_list_directory', args: a => ({ path: a.path }) },
  agent_read_file: { cmd: 'agent_read_file', args: a => {
    const result = { path: a.path };
    if (a.offset !== undefined && a.offset !== null) result.offset = a.offset;
    if (a.limit !== undefined && a.limit !== null) result.limit = a.limit;
    return result;
  }},
    agent_search_files:  { cmd: 'agent_search_files',   args: a => ({ path: a.path, query: a.query }) },
    read_governance_file:{ cmd: 'read_governance_file',  args: a => ({ fileName: a.fileName }) },
    get_cps_score:       { cmd: 'get_cps_score',         args: () => ({}) },
    ping:                { cmd: 'ping',                  args: () => ({}) },
    git_status:          { cmd: 'git_status',            args: () => ({}) },
    check_read_only: { cmd: 'check_read_only', args: () => ({}) },
    propose_patch: { cmd: 'propose_patch', args: a => ({ filePath: a.filePath, patchContent: a.patchContent }) },
  };

  const mapping = TOOL_MAP[funcName];
  if (!mapping) {
    throw new Error(`Unknown tool function: ${funcName}`);
  }

  const tauriArgs = mapping.args(funcArgs);
  return await invoke(mapping.cmd, tauriArgs);
}

function addChatMessage(role, content, opts = {}) {
  const msg = {
    role,
    content,
    timestamp: new Date().toISOString(),
  };
  // Tool-call support: assistant messages may carry tool_calls,
  // and tool-result messages carry tool_call_id
  if (opts.toolCalls) msg.toolCalls = opts.toolCalls;
  if (opts.toolCallId) msg.toolCallId = opts.toolCallId;
  // Patch review support: tool messages from propose_patch carry extra metadata
  if (opts.proposalId) msg.proposalId = opts.proposalId;
  if (opts.patchFilePath) msg.patchFilePath = opts.patchFilePath;
  if (opts.diff) msg.diff = opts.diff;
  if (opts.linesAdded !== undefined) msg.linesAdded = opts.linesAdded;
  if (opts.linesRemoved !== undefined) msg.linesRemoved = opts.linesRemoved;
  state.chatMessages.push(msg);
  renderChat();
  return msg;
}

function clearChat() {
  state.chatMessages = [];
  renderChat();
  log('Conversation cleared.', 'info');
}

// ── Patch Review Actions ──────────────────────────────────────────────

async function applyPatch(proposalId) {
    if (!proposalId) {
        log('No proposal ID provided for apply.', 'err');
        return;
    }
    try {
        // Step 1: Rust validates the proposal, checks hashes, and returns the content to write.
        // The Rust side does NOT write the file — it returns {filePath, content, success, ...}.
        const result = await invoke('apply_patch', { proposalId });
        if (!result.success) {
            log(`Patch apply validation failed: ${result.detail}`, 'err');
            addChatMessage('system', `✗ Patch apply failed: ${result.detail}`);
            renderChat();
            return;
        }

        // Step 2: Create parent directory if needed (via Tauri's scope-checked mkdir).
        // Rust no longer calls fs::create_dir_all — that bypasses scope checking
        // and can cause process aborts (same class of bug as the original fs::write crash).
        if (result.needsMkdir && result.parentDir) {
            try {
                const { mkdir } = window.__TAURI__.fs;
                await mkdir(result.parentDir, { recursive: true });
                log(`Created parent directory: ${result.parentDir}`, 'info');
            } catch (mkdirErr) {
                const mkdirErrMsg = (typeof mkdirErr === 'string') ? mkdirErr : (mkdirErr?.message || String(mkdirErr));
                log(`Patch mkdir failed: ${mkdirErrMsg}`, 'err');
                addChatMessage('system', `✗ Patch validated but directory creation failed: ${mkdirErrMsg}. The file was not modified.`);
                renderChat();
                return;
            }
        }

        // Step 3: Write the file via Tauri's fs plugin from JS.
        // This goes through Tauri's scope-checking command layer, which returns
        // errors gracefully (never aborts the process).
        try {
            const { writeTextFile } = window.__TAURI__.fs;
            await writeTextFile(result.filePath, result.content);
            log(`Patch applied: ${result.filePath} — ${result.detail}`, 'ok');
            addChatMessage('system', `✓ Patch applied to ${result.filePath}${result.readOnlyOverridden ? ' (read-only override — operator consent)' : ''}`);

            // Step 4: Confirm the write to Rust for audit trail completion.
            // This logs "applied" (vs "approved") so we can distinguish
            // "Rust validated" from "JS actually wrote the file".
            try {
                await invoke('confirm_patch_applied', {
                    proposalId: proposalId,
                    filePath: result.filePath,
                    readOnlyOverridden: result.readOnlyOverridden || false
                });
            } catch (confirmErr) {
                // Non-fatal — the file was already written; this is just audit logging
                log(`Patch applied but audit confirmation failed: ${(typeof confirmErr === 'string') ? confirmErr : (confirmErr?.message || String(confirmErr))}`, 'warn');
            }
        } catch (writeErr) {
            const writeErrMsg = (typeof writeErr === 'string') ? writeErr : (writeErr?.message || String(writeErr));
            log(`Patch write failed: ${writeErrMsg}`, 'err');
            addChatMessage('system', `✗ Patch validated but write failed: ${writeErrMsg}. The file was not modified.`);
        }
    } catch (e) {
        const errMsg = (typeof e === 'string') ? e : (e?.message || String(e));
        log(`Patch apply error: ${errMsg}`, 'err');
        addChatMessage('system', `✗ Patch apply error: ${errMsg}`);
    }
    renderChat();
}

async function rejectPatch(proposalId) {
  if (!proposalId) {
    log('No proposal ID provided for reject.', 'err');
    return;
  }
  try {
    const result = await invoke('reject_patch', { proposalId });
    log(`Patch rejected: ${proposalId}`, 'info');
    addChatMessage('system', `✗ Patch proposal rejected and removed.`);
  } catch (e) {
    const errMsg = (typeof e === 'string') ? e : (e?.message || String(e));
    log(`Patch reject error: ${errMsg}`, 'err');
    addChatMessage('system', `✗ Patch reject error: ${errMsg}`);
  }
  renderChat();
}

function toggleChatSettings() {
  state.chatSettingsOpen = !state.chatSettingsOpen;
  const settingsEl = $('chat-settings');
  if (settingsEl) {
    settingsEl.classList.toggle('visible', state.chatSettingsOpen);
  }
}

// ── Read Audit Panel ───────────────────────────────────────────────────

function toggleReadAudit() {
  state.readAuditOpen = !state.readAuditOpen;
  const panel = $('read-audit-panel');
  if (panel) {
    panel.classList.toggle('hidden', !state.readAuditOpen);
  }
  if (state.readAuditOpen) {
    refreshReadAudit();
  }
}

async function refreshReadAudit() {
  try {
    const entries = await invoke('get_read_audit_log');
    state.readAuditLog = Array.isArray(entries) ? entries : [];
    renderReadAudit();
  } catch (e) {
    log('Failed to load audit log: ' + e.message, 'warn');
  }
}

async function clearReadAudit() {
  try {
    await invoke('clear_read_audit_log');
    state.readAuditLog = [];
    renderReadAudit();
    log('Read audit log cleared.', 'info');
  } catch (e) {
    log('Failed to clear audit log: ' + e.message, 'err');
  }
}

function renderReadAudit() {
  const entries = state.readAuditLog;
  const countEl = $('read-audit-count');
  const entriesEl = $('read-audit-entries');

  if (countEl) {
    const blocked = entries.filter(e => e.result === 'blocked').length;
    const success = entries.filter(e => e.result === 'success').length;
    countEl.textContent = `${success} reads, ${blocked} blocked`;
  }

  if (!entriesEl) return;

  if (!entries.length) {
    entriesEl.innerHTML = '<p class="read-audit-empty">No file reads recorded yet.</p>';
    return;
  }

  // Show most recent first
  const reversed = [...entries].reverse();
  entriesEl.innerHTML = reversed.map(entry => {
    const timeStr = entry.timestamp
      ? new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
    const resultClass = entry.result === 'success' ? 'audit-success' : entry.result === 'blocked' ? 'audit-blocked' : 'audit-error';
    const resultIcon = entry.result === 'success' ? '✓' : entry.result === 'blocked' ? '✗' : '⚠';
    const detailStr = entry.detail ? ` — ${escapeHtml(entry.detail)}` : '';
    return `
      <div class="read-audit-entry ${resultClass}">
        <span class="read-audit-icon">${resultIcon}</span>
        <span class="read-audit-time">${escapeHtml(timeStr)}</span>
        <span class="read-audit-path" title="${escapeHtml(entry.path)}">${escapeHtml(entry.path)}</span>
        <span class="read-audit-detail">${detailStr}</span>
      </div>
    `;
  }).join('');
}

async function runGovScript(scriptName) {
  const outputEl = $('gov-script-output');
  outputEl.textContent = `Running ${scriptName}...\n`;
  try {
    const result = await invoke('run_script', { scriptName: scriptName });
    outputEl.textContent = result.stdout || '(no stdout)';
    if (result.stderr) { outputEl.textContent += '\n--- STDERR ---\n' + result.stderr; }
    if (result.exit_code !== 0) { outputEl.textContent += `\n--- EXIT CODE: ${result.exit_code} ---`; }
  } catch (e) {
    outputEl.textContent = 'Error: ' + e.message;
  }
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
            invoke('scan_tree', { rootPath: path }),
            invoke('summarize_folder', { rootPath: path })
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
    const result = await callCommand('scan_tree', { rootPath: path });
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
    const result = await callCommand('summarize_folder', { rootPath: path });
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

    const hasTauri = hasTauriRuntime();
    setDiagStatus('diag-tauri', hasTauri ? 'ok' : 'fail');
    log(`Tauri API: ${hasTauri ? '✓' : '✗'}`, hasTauri ? 'ok' : 'warn');

    const hasInvoke = !!resolveTauriInvoke();
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
        await invoke('scan_tree', { rootPath: 'DIAGNOSTIC_CHECK' });
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
  const parsed = saved ? parseFloat(saved) : ZOOM_DEFAULT;
  // Guard against NaN from corrupt localStorage — NaN would cascade
  // through applyZoom and set --text-scale to "NaNpx", making ALL text invisible
  if (!Number.isFinite(parsed)) {
    localStorage.removeItem('archivist-zoom');  // Clean up corrupt value
    return ZOOM_DEFAULT;
  }
  return parsed;
}

function applyZoom(level) {
  // Double-check: if level is NaN/Infinity, fall back to default
  if (!Number.isFinite(level)) level = ZOOM_DEFAULT;
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level));
  // Update CSS custom properties used throughout UI (may be used elsewhere)
  document.documentElement.style.setProperty('--app-zoom', clamped);
  document.documentElement.style.setProperty('--text-scale', `${16 * clamped}px`);
  // Hard visual zoom for Tauri/WebView: set body zoom property
  document.body.style.zoom = String(clamped);
  const display = $('zoom-level');
  if (display) display.textContent = `${Math.round(clamped * 100)}%`;
  localStorage.setItem('archivist-zoom', clamped.toString());
}

function zoomIn() { applyZoom(getZoomLevel() + ZOOM_STEP); }
function zoomOut() { applyZoom(getZoomLevel() - ZOOM_STEP); }
function zoomReset() { applyZoom(ZOOM_DEFAULT); }

// ─── Panel Resize Handles ─────────────────────────────────────────
function initResizeHandles() {
  const main = document.querySelector('main');
  if (!main) return;

  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 600;
  const EVIDENCE_MIN = 180;
  const EVIDENCE_MAX = 700;

  function getColumns() {
    const style = getComputedStyle(main);
    return style.gridTemplateColumns.split(/\s+/).map(c => parseFloat(c));
  }

  function setColumns(sidebarW, evidenceW) {
    const centerW = Math.max(200, main.clientWidth - sidebarW - evidenceW - 10); // 10 = two 5px handles
    main.style.gridTemplateColumns = `${sidebarW}px 5px ${centerW}px 5px ${evidenceW}px`;
    localStorage.setItem('archivist-sidebar-width', sidebarW);
    localStorage.setItem('archivist-evidence-width', evidenceW);
  }

  function setupHandle(handleId, side) {
    const handle = $(handleId);
    if (!handle) return;

    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      const cols = getColumns();
      startWidth = side === 'left' ? cols[0] : cols[4];
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e2) {
        const dx = e2.clientX - startX;
        let newWidth;
        if (side === 'left') {
          newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + dx));
          const cols = getColumns();
          setColumns(newWidth, cols[4]);
        } else {
          newWidth = Math.max(EVIDENCE_MIN, Math.min(EVIDENCE_MAX, startWidth - dx));
          const cols = getColumns();
          setColumns(cols[0], newWidth);
        }
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  setupHandle('resize-left', 'left');
  setupHandle('resize-right', 'right');

  // Restore saved widths
  const savedSidebar = localStorage.getItem('archivist-sidebar-width');
  const savedEvidence = localStorage.getItem('archivist-evidence-width');
  if (savedSidebar || savedEvidence) {
    const cols = getColumns();
    const sw = savedSidebar ? parseFloat(savedSidebar) : cols[0];
    const ew = savedEvidence ? parseFloat(savedEvidence) : cols[4];
    setColumns(sw, ew);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
  if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); zoomReset(); }
  if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
  if (e.key === 'Escape') {
    // Escape from tools panel returns to chat
    const toolsPanel = $('tools-panel');
    if (toolsPanel && !toolsPanel.classList.contains('hidden')) {
      closeToolsPanel();
    }
    // Escape from lane detail panel returns to chat
    const lanePanel = $('lane-detail-panel');
    if (lanePanel && !lanePanel.classList.contains('hidden')) {
      state.activeLane = null;
      state.laneDetail = null;
      renderLaneList();
      showChatPanel();
    }
  }
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
  $('btn-sidebar-toggle').addEventListener('click', toggleSidebar);
  $('btn-tools-close').addEventListener('click', closeToolsPanel);
  $('btn-evidence-toggle-header').addEventListener('click', toggleEvidencePanel);
  if ($('btn-evidence-toggle')) $('btn-evidence-toggle').addEventListener('click', toggleEvidencePanel);
  $('btn-gov-health').addEventListener('click', () => runGovScript('health-check'));
    $('btn-gov-recovery').addEventListener('click', () => runGovScript('recovery-test-suite'));
    $('btn-gov-mode').addEventListener('click', () => runGovScript('mode-check'));
    $('btn-gov-consensus').addEventListener('click', () => runGovScript('consensus-check'));
    $('btn-gov-status').addEventListener('click', () => runGovScript('system-status'));
  $('btn-gov-sovereignty').addEventListener('click', () => runGovScript('sovereignty-enforcer'));
  $('btn-gov-audit').addEventListener('click', () => runGovScript('headless-self-audit'));

  // Evidence panel button handlers
  if ($('btn-ev-refresh-patches')) $('btn-ev-refresh-patches').addEventListener('click', () => { invoke('get_patch_audit_log').then(renderEvidencePatches).catch(() => {}); });
  if ($('btn-ev-clear-patches')) $('btn-ev-clear-patches').addEventListener('click', () => { invoke('clear_patch_audit_log').then(() => { state.patchAuditLog = []; renderEvidencePatches([]); }).catch(() => {}); });
  if ($('btn-ev-refresh-reads')) $('btn-ev-refresh-reads').addEventListener('click', () => { invoke('get_read_audit_log').then(renderEvidenceReads).catch(() => {}); });
if ($('btn-ev-clear-reads')) $('btn-ev-clear-reads').addEventListener('click', () => { invoke('clear_read_audit_log').then(() => { state.readAuditLog = []; renderEvidenceReads([]); }).catch(() => {}); });

// Lane sidebar click handler (delegated event on lane-list container)
// Auto‑populate chat endpoint when a known API key is entered (accessibility aid)
const apiKeyInput = $('chat-api-key');
if (apiKeyInput) {
  apiKeyInput.addEventListener('input', () => {
    const endpointEl = $('chat-endpoint');
    if (!endpointEl) return;
    // Preserve user-specified endpoint.
    if (endpointEl.value && endpointEl.value.trim()) return;
    const raw = apiKeyInput.value.trim();
    // Simple heuristic: OpenAI keys start with "sk-".
    if (raw && raw.startsWith('sk-')) {
      endpointEl.value = 'https://api.openai.com/v1/chat/completions';
      const statusEl = $('chat-endpoint-status');
      if (statusEl) { statusEl.textContent = '✅ Endpoint auto‑filled for OpenAI key'; statusEl.className = 'helper-text success'; }
      log('Auto‑filled chat endpoint based on OpenAI key.', 'info');
    }
  });
}
$('lane-list').addEventListener('click', event => {
  const laneItem = event.target.closest('[data-lane]');
  if (!laneItem) return;
  handleLaneClick(laneItem.dataset.lane);
});

// Chat event handlers
    $('btn-chat-send').addEventListener('click', sendChatMessage);
    $('chat-input').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    });
    $('btn-chat-clear').addEventListener('click', clearChat);
    $('btn-chat-toggle-settings').addEventListener('click', toggleChatSettings);
    $('btn-chat-settings-close').addEventListener('click', toggleChatSettings);
    $('btn-chat-save-settings').addEventListener('click', saveChatConfig);
  $('btn-fetch-models').addEventListener('click', fetchModels);
$('btn-chat-toggle-audit').addEventListener('click', toggleReadAudit);
  $('btn-clear-audit').addEventListener('click', clearReadAudit);
  $('btn-refresh-audit').addEventListener('click', refreshReadAudit);

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

  renderChat();
  showChatPanel(); // Ensure chat-panel is visible on init (not .hidden)
  renderOverview();
  renderRetrieve();
  renderTreePanel();
  updateFooterInfo();

  // Initialize lane list and evidence panel
  loadLaneStatuses();
  loadEvidencePanel();
  setupEvidenceSectionToggles();

  // Restore sidebar collapse state
  const sidebarCollapsed = localStorage.getItem('archivist-sidebar-collapsed') === '1';
  if (sidebarCollapsed) {
    const main = document.querySelector('main');
    if (main) main.classList.add('sidebar-collapsed');
    const btn = $('btn-sidebar-toggle');
    if (btn) btn.textContent = '☰ Sidebar';
  }

  // Restore evidence panel collapse state
  const evidenceCollapsed = localStorage.getItem('archivist-evidence-collapsed') === '1';
  if (evidenceCollapsed) {
    const main = document.querySelector('main');
    if (main) main.classList.add('evidence-collapsed');
    state.evidencePanelOpen = false;
  }

  // Open the governance section in evidence panel by default
  const govBody = document.getElementById('ev-governance-body');
  if (govBody) govBody.classList.add('open');

  setTimeout(() => {
    const inTauri = hasTauriRuntime();
    log(inTauri ? '✓ Running inside Tauri' : '⚠ Running in browser mode with mock read-only data', inTauri ? 'ok' : 'warn');
  }, 100);

  // ── DOM DIAGNOSTICS: log key element visibility/size ──
  setTimeout(() => {
    const ids = ['app', 'sidebar', 'center-panel', 'chat-panel', 'chat-messages', 'chat-input', 'lane-list', 'evidence-panel'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) { console.warn(`[DIAG] #${id} NOT FOUND IN DOM`); return; }
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      console.log(`[DIAG] #${id}: display=${cs.display} visibility=${cs.visibility} width=${Math.round(rect.width)} height=${Math.round(rect.height)} hidden=${el.classList.contains('hidden')} overflow=${cs.overflow}`);
    });
    // Check if chat-panel has children
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) {
      console.log(`[DIAG] #chat-panel children: ${chatPanel.children.length}`, Array.from(chatPanel.children).map(c => c.id || c.className).join(', '));
    }
    // Check main grid
    const main = document.querySelector('main');
    if (main) {
      const cs = getComputedStyle(main);
      const rect = main.getBoundingClientRect();
      console.log(`[DIAG] main: grid-columns=${cs.gridTemplateColumns} grid-rows=${cs.gridTemplateRows} width=${Math.round(rect.width)} height=${Math.round(rect.height)} overflow=${cs.overflow}`);
    }
  }, 500);

  log('UI ready. Analyze a folder to build a working map.', 'info');
setStatus('Ready', 'idle');

// Panel resize handles
initResizeHandles();
});
