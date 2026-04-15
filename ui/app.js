'use strict';

// Tauri invoke helper with fallback for browser mode
const invoke = (() => {
    if (window.__TAURI__?.core?.invoke) {
        return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI__?.invoke) {
        return window.__TAURI__.invoke;
    }
    console.warn('[IPC] No Tauri API found');
    return async (cmd) => {
        console.log(`[MOCK] ${cmd}`);
        if (cmd === 'ping') return 'pong';
        throw new Error('Not in Tauri');
    };
})();

// Application state
const state = {
    currentPath: '',
    scanResult: null,
    summaryResult: null,
    activeTab: 'overview',
    logEntries: [],
    isWorking: false
};

// DOM helper
const $ = id => document.getElementById(id);

/**
 * Log a message to the output log
 * @param {string} message - Message to log
 * @param {string} level - Log level: 'info', 'ok', 'warn', 'err'
 */
function log(message, level = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    state.logEntries.push({ time, message, level });
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${escapeHtml(time)}</span><span class="log-${level}">${escapeHtml(message)}</span>`;
    $('log-output').appendChild(div);
    $('log-output').scrollTop = $('log-output').scrollHeight;
}

/**
 * Update status bar
 * @param {string} text - Status text
 * @param {string} type - Status type: 'idle', 'working', 'success', 'error'
 */
function setStatus(text, type = 'idle') {
    $('status-text').textContent = text;
    $('status-dot').className = `status-dot ${type}`;
}

/**
 * Switch to a different tab
 * @param {string} tabName - Tab to switch to
 */
function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab').forEach(t => {
        const isActive = t.dataset.tab === tabName;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive);
    });
    ['overview', 'tree', 'buckets', 'output'].forEach(p => {
        $(`tab-${p}`).classList.toggle('hidden', p !== tabName);
    });
    if (state.scanResult) $('welcome').classList.add('hidden');
}

/**
 * Get and validate the path input
 * @returns {string|null} Valid path or null
 */
function getValidPath() {
    const raw = $('folder-path').value.trim();
    if (!raw) {
        log('No path entered.', 'warn');
        return null;
    }
    // Input validation: limit path length
    if (raw.length > 4096) {
        log('Path too long (max 4096 characters).', 'err');
        return null;
    }
    return raw;
}

/**
 * Call a Tauri command with error handling
 * @param {string} command - Command name
 * @param {object} args - Command arguments
 * @returns {Promise<object|null>} Result or null on error
 */
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

/**
 * Run scan_tree command
 */
async function runScanTree() {
    const path = getValidPath();
    if (!path) return;
    state.currentPath = path;
    const result = await callCommand('scan_tree', { root_path: path });
    if (!result) return;
    state.scanResult = result;
    $('footer-info').textContent = `Scanned: ${result.total_files} files, ${result.total_dirs} dirs`;
    renderTree(result.tree);
    $('welcome').classList.add('hidden');
    switchTab('tree');
}

/**
 * Render tree structure
 * @param {object} node - Tree node
 * @param {HTMLElement} container - Container element
 * @param {number} depth - Current depth
 */
function renderTree(node, container = null, depth = 0) {
    if (depth === 0) {
        $('tree-output').textContent = '';
        container = $('tree-output');
    }
    const icon = node.is_dir ? '📁' : getFileIcon(node.extension);
    const prefix = '  '.repeat(depth);
    const line = `${prefix}${icon} ${node.name}\n`;
    container.textContent += line;
    if (node.is_dir && node.children?.length > 0) {
        node.children.forEach(child => renderTree(child, container, depth + 1));
    }
}

/**
 * Run summarize_folder command
 */
async function runClassify() {
    const path = getValidPath();
    if (!path) return;
    const result = await callCommand('summarize_folder', { root_path: path });
    if (!result) return;
    state.summaryResult = result;
    renderBuckets(result);
    $('welcome').classList.add('hidden');
    switchTab('buckets');
}

/**
 * Render bucket statistics
 * @param {object} summary - Folder summary
 */
function renderBuckets(summary) {
    const stats = $('bucket-stats');
    stats.innerHTML = '<h3>File Buckets</h3><ul class="bucket-list">';
    Object.entries(summary.bucket_counts || {}).forEach(([bucket, count]) => {
        stats.innerHTML += `<li class="bucket-item">📦 <strong>${escapeHtml(bucket)}</strong>: ${count}</li>`;
    });
    stats.innerHTML += '</ul>';
}

/**
 * Run build_index command
 */
async function runBuildIndex() {
    const path = getValidPath();
    if (!path) return;
    const result = await callCommand('build_index', { root: path });
    if (!result) return;
    log(`📋 INDEX.md written to: ${result.index_path}`, 'ok');
    switchTab('output');
}

/**
 * Run build_registry command
 */
async function runBuildRegistry() {
    const result = await callCommand('build_registry');
    if (!result) return;
    log(`🗄️ Registry written: ${result}`, 'ok');
    switchTab('output');
}

/**
 * Run generate_handoff command
 */
async function runGenerateHandoff() {
    const path = getValidPath();
    if (!path) return;
    const result = await callCommand('generate_handoff', { path });
    if (!result) return;
    log(`📤 Handoff generated: ${result}`, 'ok');
    switchTab('output');
}

/**
 * Run system diagnostics
 */
async function runDiagnostics() {
    log('═══ Running diagnostics ═══', 'info');
    $('diag-panel').classList.remove('hidden');
    switchTab('overview');
    $('welcome').classList.add('hidden');

    const hasTauri = !!(window.__TAURI__);
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
    } catch (e) {
        setDiagStatus('diag-ping', 'fail');
        log(`ping failed: ${e}`, 'err');
    }

    setDiagStatus('diag-scan', 'check');
    try {
        await invoke('scan_tree', { root_path: 'DIAGNOSTIC_CHECK' });
        setDiagStatus('diag-scan', 'ok');
        log('scan_tree: registered', 'ok');
    } catch (e) {
        const msg = e?.message || '';
        const isRegistered = msg.includes('validation') || msg.includes('not exist') || msg.includes('allowed') || msg.includes('DIAGNOSTIC');
        setDiagStatus('diag-scan', isRegistered ? 'ok' : 'fail');
        log(`scan_tree: ${isRegistered ? '✓ registered' : '✗ not found'}`, isRegistered ? 'ok' : 'err');
    }
}

/**
 * Set diagnostic status indicator
 * @param {string} id - Element ID
 * @param {string} status - Status: 'ok', 'fail', 'check', 'unknown'
 */
function setDiagStatus(id, status) {
    const el = $(id);
    if (el) el.className = `diag-status ${status}`;
}

/**
 * Get file icon by extension
 * @param {string} ext - File extension
 * @returns {string} Icon character
 */
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
    return icons[ext?.toLowerCase()] || '📄';
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Handle keyboard navigation for tabs
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleTabKeyboard(e) {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const currentIndex = tabs.findIndex(t => t === document.activeElement);
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        tabs[nextIndex].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        tabs[prevIndex].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (document.activeElement.classList.contains('tab')) {
            switchTab(document.activeElement.dataset.tab);
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    log('Archivist Agent initializing…', 'info');

    // Tab click handlers
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        tab.addEventListener('keydown', handleTabKeyboard);
    });

    // Button handlers
    $('btn-scan').addEventListener('click', runScanTree);
    $('btn-scan-welcome').addEventListener('click', () => $('folder-path').focus());
    $('btn-classify').addEventListener('click', runClassify);
    $('btn-index').addEventListener('click', runBuildIndex);
    $('btn-registry').addEventListener('click', runBuildRegistry);
    $('btn-handoff').addEventListener('click', runGenerateHandoff);
    $('btn-diag').addEventListener('click', runDiagnostics);
    $('btn-clear-log').addEventListener('click', () => {
        state.logEntries = [];
        $('log-output').innerHTML = '';
    });

    // Enter key on path input
    $('folder-path').addEventListener('keydown', e => {
        if (e.key === 'Enter') runScanTree();
    });

    // Check Tauri environment
    setTimeout(() => {
        const inTauri = !!(window.__TAURI__);
        log(inTauri ? '✓ Running inside Tauri' : '⚠ Not in Tauri (browser mode)', inTauri ? 'ok' : 'warn');
    }, 100);

    log('UI ready. Enter a path and click Scan Folder.', 'info');
    setStatus('Ready', 'idle');
});
