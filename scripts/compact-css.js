/**
 * compact-css.js
 * 
 * Applies a density-focused compact redesign to ui/styles.css.
 * Reduces padding, border-radius, gaps, margins, shadows, and decorative
 * effects throughout the entire stylesheet. Preserves functional layout,
 * accessibility, and JS hooks.
 *
 * Usage: node scripts/compact-css.js
 */

const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'ui', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

const original = css;

// ─── 1. CSS Variables ──────────────────────────────────────────────
css = css.replace(
  '--shadow: 0 2px 8px rgba(0, 0, 0, 0.3);',
  '--shadow: none;'
);
css = css.replace(
  '--radius: 6px;',
  '--radius: 4px;'
);

// Remove backdrop-filter (costly, decorative)
css = css.replace(/backdrop-filter:\s*blur\([^)]+\);\s*/g, '');

// ─── 2. Layout widths: sidebar 13rem→11rem, evidence 16rem→13rem ───
css = css.replace(
  'grid-template-columns: 13rem 4px 1fr 4px 16rem;',
  'grid-template-columns: 11rem 3px 1fr 3px 13rem;'
);
css = css.replace(
  'grid-template-columns: 0px 4px 1fr 4px 16rem;',
  'grid-template-columns: 0px 3px 1fr 3px 13rem;'
);
css = css.replace(
  'grid-template-columns: 13rem 4px 1fr 4px 0px;',
  'grid-template-columns: 11rem 3px 1fr 3px 0px;'
);
// Keep the 0px variants but update the resize gap
css = css.replace(
  'grid-template-columns: 0px 4px 1fr 4px 0px;',
  'grid-template-columns: 0px 3px 1fr 3px 0px;'
);
css = css.replace(
  'grid-template-columns: 8rem 4px 1fr 4px 0px;',
  'grid-template-columns: 7rem 3px 1fr 3px 0px;'
);

// ─── 3. Header ─────────────────────────────────────────────────────
css = css.replace(
  'header {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 12px;',
  'header {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding: 3px 8px;'
);

// ─── 4. Sidebar ────────────────────────────────────────────────────
css = css.replace(
  '#sidebar {\n  grid-column: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 12px;',
  '#sidebar {\n  grid-column: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px;'
);
css = css.replace(
  '#sidebar {\n    display: flex !important;\n    width: 8rem;\n    padding: 10px;',
  '#sidebar {\n    display: flex !important;\n    width: 7rem;\n    padding: 6px;'
);

// ─── 5. Evidence panel ─────────────────────────────────────────────
css = css.replace(
  '.evidence-section-header {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 12px 18px;',
  '.evidence-section-header {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 8px;'
);
css = css.replace(
  '.evidence-section-body {\n  padding: 0 18px 14px;',
  '.evidence-section-body {\n  padding: 0 8px 6px;'
);
css = css.replace(
  '.evidence-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 6px 8px;',
  '.evidence-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 4px 6px;'
);

// ─── 6. Agent tabs ─────────────────────────────────────────────────
css = css.replace(
  '.agent-tabs {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}',
  '.agent-tabs {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n}'
);
css = css.replace(
  '.agent-tab-btn {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 12px 14px;\n  border-radius: 12px;',
  '.agent-tab-btn {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 8px;\n  border-radius: 4px;'
);
css = css.replace(
  '.agent-tab-btn.active {\n  background: linear-gradient(135deg, rgba(79, 195, 247, 0.18), rgba(79, 195, 247, 0.1));\n  border-color: var(--accent-strong);\n  color: var(--accent);\n  box-shadow: 0 0 12px rgba(79, 195, 247, 0.15);',
  '.agent-tab-btn.active {\n  background: rgba(79, 195, 247, 0.12);\n  border-color: var(--accent-strong);\n  color: var(--accent);\n  box-shadow: none;'
);

// Add selectors for the actual HTML classes (.agent-tab, .agent-dot, .agent-name)
// These exist in HTML but CSS has .agent-tab-btn instead. Fix the mismatch:
css = css.replace('.agent-tab-btn', '.agent-tab');
// Re-add .agent-tab-btn as a fallback for JS:
css += `

/* Legacy agent-tab-btn alias (JS fallback) */
.agent-tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.1s, border-color 0.1s;
  width: 100%;
}
.agent-tab-btn:hover { border-color: var(--border-strong); background: rgba(255, 255, 255, 0.05); }
.agent-tab-btn.active { background: rgba(79, 195, 247, 0.12); border-color: var(--accent-strong); color: var(--accent); box-shadow: none; }
`;

// ─── 7. Footer ─────────────────────────────────────────────────────
css = css.replace(
  'footer {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 24px;',
  'footer {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 3px 8px;'
);

// ─── 8. Buttons ────────────────────────────────────────────────────
css = css.replace(
  '.btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 6px 10px;\n  border-radius: 8px;',
  '.btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  padding: 4px 8px;\n  border-radius: 4px;'
);
// Remove btn hover transform
css = css.replace(
  '.btn:hover:not(:disabled) {\n    transform: translateY(-1px);\n}',
  '.btn:hover:not(:disabled) {\n    transform: none;\n}'
);
// Remove btn-primary box-shadow and gradient
css = css.replace(
  '.btn-primary {\n  color: #042233;\n  background: linear-gradient(135deg, var(--accent), var(--accent-strong));\n  box-shadow: 0 10px 26px rgba(79, 195, 247, 0.26);',
  '.btn-primary {\n  color: #042233;\n  background: var(--accent-strong);\n  box-shadow: none;'
);
css = css.replace(
  '.btn-primary:hover:not(:disabled) {\n    background: linear-gradient(135deg, #a5e7ff, #70d0ff);',
  '.btn-primary:hover:not(:disabled) {\n    background: var(--accent);'
);

// ─── 9. Cards / Sections / Panels ──────────────────────────────────
// Common pattern: large border-radius → 6px
function reduceRadiuses(css) {
  // Radius mapping: large → small
  const radiusMap = [
    [28, 6], [24, 6], [22, 6], [20, 6], [18, 6],
    [16, 4], [14, 4], [12, 4], [10, 4], [999, 4]
  ];
  for (const [from, to] of radiusMap) {
    // Skip border-radius: 50% (circles)
    css = css.replace(
      new RegExp(`border-radius:\\s*${from}px(?![%])`, 'g'),
      `border-radius: ${to}px`
    );
  }
  // Handle border-radius: 8px specifically (keep at 4px)
  css = css.replace(/border-radius:\s*8px(?![%])/g, 'border-radius: 4px');
  // Handle the 50% circle case specifically for avatars & dots - preserve them
  // Make sure we don't touch these
  return css;
}
css = reduceRadiuses(css);

// Fix specific over-reduced radii back for circle elements
css = css.replace(/\.ev-status-dot\s*\{[^}]*border-radius:\s*4px/g, '.ev-status-dot { width: 8px; height: 8px; border-radius: 50%;');
css = css.replace(/\.status-dot\s*\{[^}]*border-radius:\s*4px/g, '.status-dot {\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;');
css = css.replace(/\.lane-health-dot\s*\{[^}]*border-radius:\s*4px/g, '.lane-health-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;');
css = css.replace(/\.diag-status\s*\{(?:[^}]*\n)*[^}]*?width:\s*10px[^}]*?\}/g, '.diag-status {\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    flex-shrink: 0;\n}');
css = css.replace(/\.gov-status-dot\s*\{(?:[^}]*\n)*[^}]*?width:\s*10px[^}]*?\}/g, '.gov-status-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  flex-shrink: 0;\n}');

// ─── 10. Gradient backgrounds → flat ──────────────────────────────
css = css.replace(
  'background: linear-gradient(180deg, rgba(18, 36, 51, 0.94), rgba(12, 28, 39, 0.94));',
  'background: var(--bg-card);'
);
css = css.replace(
  'background: linear-gradient(180deg, rgba(18, 36, 51, 0.86), rgba(9, 20, 28, 0.92));',
  'background: var(--bg-panel);'
);
css = css.replace(
  'background: linear-gradient(180deg, rgba(19, 40, 56, 0.92), rgba(12, 28, 39, 0.95));',
  'background: var(--bg-card);'
);
css = css.replace(
  'background: linear-gradient(180deg, rgba(12, 28, 39, 0.6), rgba(7, 17, 24, 0.8));',
  'background: var(--bg-primary);'
);
css = css.replace(
  'background: linear-gradient(180deg, rgba(18, 36, 51, 0.96), rgba(11, 24, 34, 0.96));',
  'background: var(--bg-panel);'
);
css = css.replace(
  'background: linear-gradient(135deg, rgba(79, 195, 247, 0.24), rgba(141, 225, 255, 0.12));',
  'background: rgba(79, 195, 247, 0.12);'
);

// ─── 11. Padding reduction in components ────────────────────────────
// Define a padding reducer for numeric px values
function reducePaddingVals(css) {
  const padMap = [
    // 2-value shorthand patterns
    { from: 'padding: 12px 14px;', to: 'padding: 6px 8px;' },
    { from: 'padding: 10px 12px;', to: 'padding: 5px 6px;' },
    { from: 'padding: 8px 12px;', to: 'padding: 4px 6px;' },
    { from: 'padding: 8px 10px;', to: 'padding: 4px 6px;' },
    { from: 'padding: 7px 11px;', to: 'padding: 3px 5px;' },
    { from: 'padding: 6px 12px;', to: 'padding: 3px 6px;' },
    { from: 'padding: 6px 10px;', to: 'padding: 3px 5px;' },
    { from: 'padding: 5px 9px;', to: 'padding: 2px 5px;' },
    { from: 'padding: 4px 12px;', to: 'padding: 2px 6px;' },
    { from: 'padding: 3px 10px;', to: 'padding: 2px 5px;' },
    { from: 'padding: 2px 10px;', to: 'padding: 1px 5px;' },
    { from: 'padding: 2px 8px;', to: 'padding: 1px 4px;' },
    // 1-value patterns
    { from: 'padding: 48px 24px;', to: 'padding: 16px 12px;' },
    { from: 'padding: 24px;', to: 'padding: 10px;' },
    { from: 'padding: 20px;', to: 'padding: 8px;' },
    { from: 'padding: 18px;', to: 'padding: 6px;' },
    { from: 'padding: 16px;', to: 'padding: 6px;' },
    { from: 'padding: 14px;', to: 'padding: 6px;' },
    { from: 'padding: 12px;', to: 'padding: 5px;' }, // careful: impacts many things
    { from: 'padding: 11px 12px;', to: 'padding: 5px 6px;' },
    // But don't touch certain critical ones - we'll fix later
  ];
  for (const { from, to } of padMap) {
    css = css.split(from).join(to);
  }
  return css;
}
css = reducePaddingVals(css);

// Restore some padding values that got over-reduced
// .btn-sm and .btn-xs need a bit more padding
css = css.replace('.btn-sm {\n  font-size: 10px;\n  padding: 2px 6px;', '.btn-sm {\n  font-size: 10px;\n  padding: 3px 6px;');

// ─── 12. Gap reduction ─────────────────────────────────────────────
function reduceGaps(css) {
  const gapMap = [
    { from: 'gap: 18px;', to: 'gap: 6px;' },
    { from: 'gap: 16px;', to: 'gap: 6px;' },
    { from: 'gap: 14px;', to: 'gap: 6px;' },
    { from: 'gap: 12px;', to: 'gap: 4px;' },
    { from: 'gap: 10px;', to: 'gap: 4px;' },
  ];
  for (const { from, to } of gapMap) {
    css = css.split(from).join(to);
  }
  return css;
}
css = reduceGaps(css);

// ─── 13. Margin reduction ──────────────────────────────────────────
function reduceMargins(css) {
  const marginMap = [
    { from: 'margin-bottom: 18px;', to: 'margin-bottom: 6px;' },
    { from: 'margin-bottom: 16px;', to: 'margin-bottom: 6px;' },
    { from: 'margin-bottom: 14px;', to: 'margin-bottom: 6px;' },
    { from: 'margin-bottom: 12px;', to: 'margin-bottom: 4px;' },
    { from: 'margin-bottom: 10px;', to: 'margin-bottom: 4px;' },
    { from: 'margin-bottom: 8px;', to: 'margin-bottom: 3px;' },
    { from: 'margin-top: 14px;', to: 'margin-top: 6px;' },
    { from: 'margin-top: 12px;', to: 'margin-top: 4px;' },
    { from: 'margin-top: 10px;', to: 'margin-top: 4px;' },
    { from: 'margin-top: 8px;', to: 'margin-top: 3px;' },
    { from: 'margin-top: 6px;', to: 'margin-top: 2px;' },
    { from: 'margin-right: 18px;', to: 'margin-right: 6px;' },
  ];
  for (const { from, to } of marginMap) {
    css = css.split(from).join(to);
  }
  return css;
}
css = reduceMargins(css);

// ─── 14. Reduce large decorative font sizes ────────────────────────
const fontReduceMap = [
  { from: '.hero-card h2 {\n    margin-top: 4px;\n    font-size: 28px;', to: '.hero-card h2 {\n    margin-top: 4px;\n    font-size: 18px;' },
  { from: '.stat-value {\n    font-size: 28px;', to: '.stat-value {\n    font-size: 20px;' },
  { from: '.gov-cps-value {\n  font-size: 48px;', to: '.gov-cps-value {\n  font-size: 24px;' },
  { from: '.gov-mode-box {\n  font-size: 28px;', to: '.gov-mode-box {\n  font-size: 20px;' },
  { from: '.bucket-count {\n    font-size: 26px;', to: '.bucket-count {\n    font-size: 18px;' },
  { from: '.bucket-icon {\n    font-size: 22px;', to: '.bucket-icon {\n    font-size: 16px;' },
  { from: '.ev-cps-value {\n  font-size: calc(var(--text-scale, 14px) * 1.375);', to: '.ev-cps-value {\n  font-size: calc(var(--text-scale, 14px) * 1.0);' },
  { from: '#welcome .icon {\n    font-size: 56px;', to: '#welcome .icon {\n    font-size: 32px;' },
  { from: '#welcome h2,\n.empty-panel h3 {\n    font-size: 24px;', to: '#welcome h2,\n.empty-panel h3 {\n    font-size: 16px;' },
  { from: '.gov-git-stat .num {\n  font-weight: 700;\n  font-size: 20px;', to: '.gov-git-stat .num {\n  font-weight: 700;\n  font-size: 14px;' },
];
for (const { from, to } of fontReduceMap) {
  css = css.split(from).join(to);
}

// ─── 15. Specific Chat area compactions ────────────────────────────
css = css.replace(
  '.chat-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 6px 12px;',
  '.chat-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 3px 6px;'
);
css = css.replace(
  '.chat-input-area {\n  display: flex;\n  gap: 8px;\n  padding: 8px 12px;',
  '.chat-input-area {\n  display: flex;\n  gap: 4px;\n  padding: 4px 6px;'
);
css = css.replace(
  '.chat-messages {\n  flex: 1;\n  min-height: 120px;\n  overflow-y: auto;\n  overflow-x: hidden;\n  padding: 10px 12px;',
  '.chat-messages {\n  flex: 1;\n  min-height: 60px;\n  overflow-y: auto;\n  overflow-x: hidden;\n  padding: 6px 8px;'
);
css = css.replace(
  '.chat-input {\n  flex: 1;\n  padding: 8px 10px;\n  border-radius: 8px;',
  '.chat-input {\n  flex: 1;\n  padding: 4px 6px;\n  border-radius: 4px;'
);
css = css.replace(
  '.chat-msg-content {\n  padding: 8px 12px;\n  border-radius: 10px;\n  font-size: var(--text-scale, 14px);',
  '.chat-msg-content {\n  padding: 4px 8px;\n  border-radius: 4px;\n  font-size: var(--text-scale, 14px);'
);
css = css.replace(
  '.chat-msg {\n  display: flex;\n  gap: 8px;\n  max-width: 88%;',
  '.chat-msg {\n  display: flex;\n  gap: 4px;\n  max-width: 92%;'
);
css = css.replace(
  '.chat-msg-avatar {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;',
  '.chat-msg-avatar {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 22px;\n  height: 22px;\n  border-radius: 4px;'
);
css = css.replace(
  '.chat-settings.visible {\n  width: 280px;\n  min-width: 280px;\n  padding: 12px;',
  '.chat-settings.visible {\n  width: 220px;\n  min-width: 220px;\n  padding: 6px;'
);

// ─── 16. Tab bar ──────────────────────────────────────────────────
css = css.replace(
  '#tab-bar {\n  display: flex;\n  gap: 6px;\n  padding: 14px 20px 0;',
  '#tab-bar {\n  display: flex;\n  gap: 2px;\n  padding: 6px 8px 0;'
);
css = css.replace(
  '.tab {\n    padding: 12px 16px;\n    border-top-left-radius: 14px;\n    border-top-right-radius: 14px;',
  '.tab {\n    padding: 6px 10px;\n    border-top-left-radius: 4px;\n    border-top-right-radius: 4px;'
);
css = css.replace(
  '#tab-content {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  overflow-y: auto;\n  padding: 20px;',
  '#tab-content {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  overflow-y: auto;\n  padding: 8px;'
);

// ─── 17. Tool panel header ────────────────────────────────────────
css = css.replace(
  '.tools-panel-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-shrink: 0;\n  border-bottom: 1px solid var(--border);\n  background: rgba(8, 18, 27, 0.7);\n}',
  '.tools-panel-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-shrink: 0;\n  border-bottom: 1px solid var(--border);\n  background: rgba(8, 18, 27, 0.7);\n  min-height: 28px;\n}'
);

// ─── 18. Governance card padding ──────────────────────────────────
css = css.replace(
  '.gov-card {\n  background: var(--card);\n  border: 1px solid var(--border);\n  border-radius: 8px;\n  padding: 16px 20px;',
  '.gov-card {\n  background: var(--card);\n  border: 1px solid var(--border);\n  border-radius: 4px;\n  padding: 8px 10px;'
);

// ─── 19. Remove box-shadows from specific elements ────────────────
css = css.replace(/box-shadow:\s*var\(--shadow\);\s*/g, '');
css = css.replace(/box-shadow:\s*0\s+0\s+12px\s+rgba\(79,\s*195,\s*247,\s*0\.15\);\s*/g, '');
css = css.replace(/box-shadow:\s*0\s+4px\s+12px\s+rgba\(0,0,0,0\.3\);\s*/g, 'box-shadow: none;');
css = css.replace(/box-shadow:\s*0\s+0\s+16px\s+rgba\(79,\s*195,\s*247,\s*0\.1\);\s*/g, '');
css = css.replace(/box-shadow:\s*0\s+0\s+16px\s+rgba\(255,\s*193,\s*7,\s*0\.08\);\s*/g, '');

// ─── 20. Text-shadow removal ──────────────────────────────────────
css = css.replace(/text-shadow:\s*[^;]+;\s*/g, '');

// ─── 21. Reduce max-height on scrollable panels ───────────────────
function reduceMaxHeight(css) {
  const mhMap = [
    { from: 'max-height: 200px;', to: 'max-height: 120px;' },
    { from: 'max-height: 250px;', to: 'max-height: 140px;' },
    { from: 'max-height: 300px;', to: 'max-height: 160px;' },
    { from: 'max-height: 400px;', to: 'max-height: 200px;' },
    { from: 'min-height: 320px;', to: 'min-height: 120px;' },
    { from: 'max-height: 640px;', to: 'max-height: 360px;' },
  ];
  for (const { from, to } of mhMap) {
    css = css.split(from).join(to);
  }
  return css;
}
css = reduceMaxHeight(css);

// ─── 22. Scrollbar width reduction ────────────────────────────────
css = css.replace(
  '::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}',
  '::-webkit-scrollbar {\n  width: 4px;\n  height: 4px;\n}'
);

// ─── 23. `@media` overrides for ultra-compact ──────────────────────
// For 720px - reduce header padding
css = css.replace(
  'header {\n        padding-block: 10px;',
  'header {\n        padding-block: 4px;'
);
css = css.replace(
  'footer {\n        flex-direction: column;\n        align-items: flex-start;\n        gap: 4px;\n        padding-block: 8px;',
  'footer {\n        flex-direction: column;\n        align-items: flex-start;\n        gap: 2px;\n        padding-block: 4px;'
);

// ─── 24. Fix the .btn-sm rule that got broken ─────────────────────
// Check what it looks like now and fix
// The original was: .btn-sm { font-size: calc(var(--text-scale, 14px) * 0.6875); padding: 4px 10px; border-radius: 8px; }
// After earlier replacements, it should be approximately: .btn-sm { font-size: 10px; padding: 2px 6px; border-radius: 4px; }
// Let's make sure it's reasonable
css = css.replace(/(\.btn-sm\s*\{[^}]*?font-size:\s*)[^;]+;(?![^}]*?border-radius)/g, '$110px;');

// ─── 25. Some final general cleanup ───────────────────────────────
// Remove duplicate newlines from excessive replacements
css = css.replace(/\n{3,}/g, '\n\n');

// ─── Write output ────────────────────────────────────────────────
fs.writeFileSync(cssPath, css, 'utf8');

const removed = original.length - css.length;
const ratio = ((1 - css.length / original.length) * 100).toFixed(1);
console.log(`✅ Compact CSS written to ${cssPath}`);
console.log(`   Original: ${original.length} bytes`);
console.log(`   Compact:  ${css.length} bytes`);
console.log(`   Removed:  ${removed} bytes (${ratio}%)`);
console.log();
console.log('Key changes applied:');
console.log('  - Layout: sidebar 13rem→11rem, evidence 16rem→13rem');
console.log('  - Border-radius: all oversized values reduced to 4px-6px');
console.log('  - Padding/Margins/Gaps: reduced ~50% across all components');
console.log('  - Box-shadows: removed from most elements');
console.log('  - Gradients: replaced with flat backgrounds');
console.log('  - Decorations: backdrop-filter, text-shadow removed');
console.log('  - Font sizes: large decorative values reduced');
console.log('  - Header/Footer: slimmed down');
console.log('  - Agent-tab CSS mismatch fixed (.agent-tab-btn → .agent-tab)');
console.log();
console.log('⚠️  Manual review recommended for any edge cases.');
