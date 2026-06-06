import pathlib
css = """
:root {
  --bg-app: #060b17; --bg-panel: #0d1b2a; --bg-panel-strong: #112240;
  --bg-card: #1a2d4a; --bg-input: #0a1628;
  --border: rgba(148,184,213,0.18); --border-strong: rgba(148,184,213,0.32);
  --border-accent: rgba(86,208,139,0.4);
  --text-primary: #edf6fb; --text-muted: #9cb2c4;
  --accent: #8de1ff; --accent-strong: #4fc3f7;
  --success: #56d08b; --warning: #f6c56b; --error: #ff7f7f;
  --radius: 6px; --text-scale: 16px;
  --rail-width: 56px; --header-height: 36px; --footer-height: 24px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { height: 100vh; overflow: hidden; background: var(--bg-app); color: var(--text-primary);
  font-family: 'Segoe UI Variable', Aptos, 'Segoe UI', sans-serif; font-size: var(--text-scale); line-height: 1.5; }
#app { display: grid; grid-template-columns: 320px 1fr 340px var(--rail-width);
  grid-template-rows: 1fr var(--footer-height); height: 100vh; width: 100vw; }
.panel { display: flex; flex-direction: column; background: var(--bg-panel); min-height: 0; overflow: hidden; }
.panel-left { grid-column: 1; grid-row: 1; border-right: 2px solid var(--border-accent); }
.panel-center { grid-column: 2; grid-row: 1; border-right: 1px solid var(--border); }
.panel-right { grid-column: 3; grid-row: 1; border-right: 1px solid var(--border); }
.panel-header { display: flex; align-items: center; justify-content: space-between;
  height: var(--header-height); padding: 0 12px; background: var(--bg-panel-strong);
  border-bottom: 1px solid var(--border); flex-shrink: 0; }
.panel-title { font-size: calc(var(--text-scale)*0.875); font-weight: 600; color: var(--text-primary); }
.panel-badge { font-size: calc(var(--text-scale)*0.6875); padding: 2px 8px; border-radius: 3px;
  background: rgba(86,208,139,0.15); color: var(--success); border: 1px solid rgba(86,208,139,0.3); }
.panel-actions { display: flex; gap: 4px; }
.panel-body { flex: 1; overflow: auto; padding: 8px; min-height: 0; }
.panel-footer { padding: 8px; border-top: 1px solid var(--border); flex-shrink: 0; background: var(--bg-panel-strong); }
.tool-rail { grid-column: 4; grid-row: 1/3; background: var(--bg-panel-strong);
  border-left: 1px solid var(--border); display: flex; flex-direction: column;
  align-items: center; padding: 8px 0; gap: 4px; }
.rail-btn { display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; border-radius: var(--radius);
  background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.12s ease; gap: 2px; }
.rail-btn:hover { background: rgba(79,195,247,0.1); color: var(--text-primary); }
.rail-btn.active { background: rgba(79,195,247,0.15); color: var(--accent); border: 1px solid var(--border-accent); }
.rail-icon { font-size: calc(var(--text-scale)*1.125); }
.rail-label { font-size: calc(var(--text-scale)*0.5625); line-height: 1; }
.rail-spacer { flex: 1; }
#status-bar { grid-column: 1/4; grid-row: 2; background: var(--bg-panel-strong);
  border-top: 1px solid var(--border); display: flex; align-items: center;
  justify-content: space-between; padding: 0 12px; font-size: calc(var(--text-scale)*0.6875); color: var(--text-muted); }
.feed-welcome { padding: 16px 8px; text-align: center; color: var(--text-muted); }
.feed-welcome h3 { font-size: calc(var(--text-scale)*1.125); color: var(--text-primary); margin-bottom: 4px; }
.feed-status { margin-top: 8px; font-size: calc(var(--text-scale)*0.75); color: var(--text-muted); }
#tool-approvals, #chat-messages { padding: 4px 0; }
.tool-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 12px; margin-bottom: 6px; }
.tool-card-title { font-size: calc(var(--text-scale)*0.8125); font-weight: 600; color: var(--accent); margin-bottom: 4px; }
.tool-card-item { font-size: calc(var(--text-scale)*0.6875); color: var(--text-muted);
  padding: 2px 0; font-family: 'Cascadia Code', Consolas, monospace; }
.tool-card-item.check { color: var(--success); }
.tool-card-item.check::before { content: "\\2713 "; }
.tool-actions { display: flex; gap: 6px; margin-top: 8px; }
.chat-msg { padding: 6px 10px; margin-bottom: 4px; border-radius: var(--radius);
  font-size: calc(var(--text-scale)*0.875); }
.chat-msg.user { background: var(--bg-card); border-left: 3px solid var(--accent-strong); }
.chat-msg.assistant { background: var(--bg-input); border-left: 3px solid var(--success); }
.chat-msg.error { background: rgba(255,127,127,0.1); border-left: 3px solid var(--error); color: var(--error); }
.chat-input-row { display: flex; gap: 6px; align-items: flex-end; }
.chat-input-row textarea { flex: 1; background: var(--bg-input); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text-primary); font-family: inherit;
  font-size: calc(var(--text-scale)*0.875); padding: 8px; resize: none; min-height: 36px; max-height: 120px; }
.chat-input-row textarea:focus { outline: none; border-color: var(--accent-strong); }
.btn-send { width: 36px; height: 36px; border: none; border-radius: var(--radius);
  background: var(--success); color: #042233; font-size: calc(var(--text-scale)*1);
  cursor: pointer; flex-shrink: 0; }
.btn-send:hover { background: var(--accent-strong); }
.chat-settings-row { margin-top: 6px; text-align: center; }
#terminal-host { width: 100%; height: 100%; background: #0a1628; }
#terminal-host .xterm { padding: 4px; }
#terminal-host .xterm-viewport { background: #0a1628 !important; }
.right-toolbar { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.right-output { font-family: 'Cascadia Code', Consolas, monospace;
  font-size: calc(var(--text-scale)*0.75); white-space: pre-wrap; word-break: break-all;
  color: var(--text-primary); line-height: 1.4; }
.right-placeholder { color: var(--text-muted); text-align: center; padding: 40px 16px;
  font-size: calc(var(--text-scale)*0.875); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  padding: 4px 10px; border-radius: var(--radius); border: 1px solid var(--border);
  cursor: pointer; font-size: calc(var(--text-scale)*0.75); font-weight: 600;
  background: rgba(255,255,255,0.04); color: var(--text-primary); font-family: inherit; transition: all 0.12s ease; }
.btn:hover { border-color: var(--border-strong); background: rgba(255,255,255,0.08); }
.btn-sm { padding: 3px 8px; font-size: calc(var(--text-scale)*0.6875); }
.btn-primary { background: var(--accent-strong); color: #042233; border-color: var(--accent-strong); }
.btn-primary:hover { background: var(--accent); }
.btn-ghost { background: transparent; border-color: transparent; color: var(--text-muted); }
.btn-ghost:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
.btn-icon { display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; border-radius: 4px;
  background: transparent; color: var(--text-muted); font-size: calc(var(--text-scale)*1);
  cursor: pointer; transition: all 0.12s ease; }
.btn-icon:hover { background: rgba(79,195,247,0.1); color: var(--text-primary); }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal.hidden { display: none; }
.modal-content { background: var(--bg-panel); border: 1px solid var(--border-strong);
  border-radius: var(--radius); width: 420px; max-height: 80vh; overflow: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border); }
.modal-header h3 { font-size: calc(var(--text-scale)*1); }
.modal-body { padding: 16px; }
.setting-group { margin-bottom: 12px; }
.setting-group label { display: block; font-size: calc(var(--text-scale)*0.75);
  color: var(--text-muted); margin-bottom: 4px; }
.setting-group input, .setting-group select { width: 100%; padding: 6px 10px;
  background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text-primary); font-size: calc(var(--text-scale)*0.8125); font-family: inherit; }
.setting-group input:focus, .setting-group select:focus { outline: none; border-color: var(--accent-strong); }
.setting-row { display: flex; gap: 12px; }
.setting-row .setting-group { flex: 1; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: rgba(148,184,213,0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(148,184,213,0.4); }
.hidden { display: none !important; }
""".strip()
pathlib.Path(r'S:\Archivist-Agent\ui\styles.css').write_text(css, encoding='utf-8')
print('CSS written:', len(css), 'bytes')
