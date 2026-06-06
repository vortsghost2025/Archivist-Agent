// ── Terminal Widget ────────────────────────────────────────────────────
//
// Manages xterm.js terminal instances connected to PTY sessions via Tauri.
// Supports multiple tabs, resize, and shell integration.
//
// Usage:
//   const term = new TerminalWidget('terminal-host', { cwd: 'S:\\federation' });
//   await term.spawn();
//
// Dependencies: xterm.js, xterm-addon-fit (loaded via CDN or bundled)

// ── Tauri v2 API bridge ────────────────────────────────────────────────
// Tauri v2 moved invoke under core: window.__TAURI__.core.invoke
// event listen is still under event: window.__TAURI__.event.listen
function _tauriInvoke(cmd, args) {
    const t = window.__TAURI__;
    if (!t) throw new Error('Tauri API unavailable: check withGlobalTauri config');
    const invoke = t.core?.invoke || t.invoke;
    if (typeof invoke !== 'function') throw new Error('Tauri invoke not available');
    return invoke(cmd, args);
}

function _tauriListen(event, handler) {
    const t = window.__TAURI__;
    if (!t) throw new Error('Tauri API unavailable');
    const listen = t.event?.listen;
    if (typeof listen !== 'function') throw new Error('Tauri event.listen not available');
    return listen(event, handler);
}

class TerminalWidget {
    constructor(containerId, opts = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.opts = opts;
        this.sessions = new Map(); // sessionId → { term, fitAddon, shell, cwd }
        this.activeSessionId = null;
        this._initialized = false;
    }

    /** Ensure xterm.js is loaded (local vendor files). */
    async _ensureXterm() {
        if (this._initialized) return;
        if (typeof Terminal !== 'undefined') {
            this._initialized = true;
            return;
        }

        // Load xterm.js from local vendor
        await this._loadScript('vendor/xterm.min.js');
        // Load fit addon
        await this._loadScript('vendor/xterm-addon-fit.min.js');
        // Load web-links addon
        await this._loadScript('vendor/xterm-addon-web-links.min.js');

        this._initialized = true;
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    /** Spawn a new PTY session and attach an xterm.js instance. */
    async spawn(shell = '', cwd = '', cols, rows) {
        await this._ensureXterm();

        const result = await _tauriInvoke('spawn_terminal', {
            request: {
                shell: shell || null,
                cwd: cwd || this.opts.cwd || null,
                cols: cols || 80,
                rows: rows || 24,
            },
        });

        const { sessionId, shell: usedShell, cwd: usedCwd } = result;

        // Create xterm.js instance
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
            theme: {
                background: '#0a1628',
                foreground: '#edf6fb',
                cursor: '#4fc3f7',
                cursorAccent: '#0a1628',
                selectionBackground: 'rgba(79, 195, 247, 0.3)',
                black: '#0a1628',
                red: '#ff7f7f',
                green: '#56d08b',
                yellow: '#f6c56b',
                blue: '#4fc3f7',
                magenta: '#c792ea',
                cyan: '#8de1ff',
                white: '#edf6fb',
                brightBlack: '#5c7a96',
                brightRed: '#ff7f7f',
                brightGreen: '#56d08b',
                brightYellow: '#f6c56b',
                brightBlue: '#4fc3f7',
                brightMagenta: '#c792ea',
                brightCyan: '#8de1ff',
                brightWhite: '#ffffff',
            },
            allowProposedApi: true,
            scrollback: 10000,
            convertEol: true,
        });

        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        // Load web links addon (clickable URLs in terminal)
        if (typeof WebLinksAddon !== 'undefined') {
            term.loadAddon(new WebLinksAddon.WebLinksAddon());
        }

        // Open directly in the container
        term.open(this.container);

        // Fit after a tick (DOM needs to layout)
        requestAnimationFrame(() => {
            fitAddon.fit();
            // Notify the PTY of the actual size
            _tauriInvoke('resize_pty', {
                request: {
                    sessionId,
                    cols: term.cols,
                    rows: term.rows,
                },
            });
        });

        // Wire up input: keystrokes → PTY
        term.onData((data) => {
            _tauriInvoke('terminal_input', {
                request: {
                    sessionId,
                    data: btoa(data), // base64 encode
                },
            }).catch((err) => {
                console.error('[terminal] input error:', err);
                term.write('\r\n\x1b[91m[Input error: session may be dead]\x1b[0m\r\n');
            });
        });

        // Wire up resize
        term.onResize(({ cols, rows }) => {
            _tauriInvoke('resize_pty', {
                request: { sessionId, cols, rows },
            }).catch(() => {}); // silently ignore resize errors
        });

        // Store session
        this.sessions.set(sessionId, {
            term,
            fitAddon,
            shell: usedShell,
            cwd: usedCwd,
        });

        // Listen for PTY output via Tauri events
        _tauriListen('terminal-output', (event) => {
            const { sessionId: sid, data } = event.payload;
            if (sid !== sessionId) return;
            const bytes = atob(data);
            term.write(bytes);
        });

        _tauriListen('terminal-exit', (event) => {
            const { sessionId: sid } = event.payload;
            if (sid !== sessionId) return;
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
            const session = this.sessions.get(sid);
            if (session) {
                session.alive = false;
            }
        });

        // Switch to the new session
        this.switchTo(sessionId);

        return result;
    }

    /** Switch visible terminal to a different session tab. */
    switchTo(sessionId) {
        this.activeSessionId = sessionId;
        const session = this.sessions.get(sessionId);
        if (session) {
            requestAnimationFrame(() => {
                session.fitAddon.fit();
                session.term.focus();
            });
        }
    }

    /** Kill a terminal session. */
    async kill(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.term.dispose();
            this.sessions.delete(sessionId);
            // Clear container if this was the last session
            if (this.sessions.size === 0) {
                this.container.innerHTML = '';
            }
        }
        await _tauriInvoke('kill_terminal', { sessionId });
    }

    /** Refit the active terminal (call on window resize). */
    refit() {
        if (this.activeSessionId) {
            const session = this.sessions.get(this.activeSessionId);
            if (session) {
                session.fitAddon.fit();
            }
        }
    }

    /** Focus the active terminal. */
    focus() {
        if (this.activeSessionId) {
            const session = this.sessions.get(this.activeSessionId);
            if (session) session.term.focus();
        }
    }

    /** Get the active terminal's xterm instance (for advanced use). */
    getActiveTerm() {
        if (this.activeSessionId) {
            return this.sessions.get(this.activeSessionId)?.term ?? null;
        }
        return null;
    }
}

// ── Global instance ────────────────────────────────────────────────────
let terminalWidget = null;

// ── Integration hooks ──────────────────────────────────────────────────
// Call these from your app.js to wire the terminal into the existing UI.

function initTerminalPanel() {
    terminalWidget = new TerminalWidget('terminal-host', {
        cwd: document.getElementById('folder-path')?.value || '',
    });

    // Spawn first terminal on init
    terminalWidget.spawn();

    // Refit on window resize
    window.addEventListener('resize', () => {
        if (terminalWidget) terminalWidget.refit();
    });

    // Wire the "New Terminal" button if it exists
    const btnNew = document.getElementById('btn-new-terminal');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            if (terminalWidget) {
                const cwd = document.getElementById('folder-path')?.value || '';
                terminalWidget.spawn('', cwd);
                refreshTerminalTabs();
            }
        });
    }

    // Wire the kill button
    const btnKill = document.getElementById('btn-kill-terminal');
    if (btnKill) {
        btnKill.addEventListener('click', () => {
            if (terminalWidget && terminalWidget.activeSessionId) {
                terminalWidget.kill(terminalWidget.activeSessionId);
                refreshTerminalTabs();
            }
        });
    }
}

function refreshTerminalTabs() {
    const tabBar = document.getElementById('terminal-tabs');
    if (!tabBar || !terminalWidget) return;

    tabBar.innerHTML = '';
    for (const [id, session] of terminalWidget.sessions) {
        const tab = document.createElement('button');
        tab.className = 'term-tab' + (id === terminalWidget.activeSessionId ? ' active' : '');
        tab.textContent = `${session.shell} #${id}`;
        tab.title = session.cwd;
        tab.onclick = () => {
            terminalWidget.switchTo(id);
            refreshTerminalTabs();
        };
        tabBar.appendChild(tab);
    }
}
