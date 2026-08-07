'use strict';
const fs = require('fs');
const r = JSON.parse(fs.readFileSync('S:/Archivist-Agent/context-buffer/archivist-node-verification-report-v2.json', 'utf8'));
const nv = r.classifications.NEEDS_VERIFICATION;

const byCat = {};
nv.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
console.log('NEEDS_VERIFICATION by category:');
Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n--- Title patterns ---');
console.log('Question-like:', nv.filter(i => /^(what|how|why|when|where|should|can|is|are|do)\s/i.test(i.title)).length);
console.log('Long titles (>60):', nv.filter(i => i.title.length > 60).length);
console.log('Short titles (<=20):', nv.filter(i => i.title.length <= 20).length);
console.log('Path-like (has ext):', nv.filter(i => /\.(rs|js|ts|json|md|yaml|yml|toml|html|css|py|txt|sh|jsx|tsx|lock)$/i.test(i.title)).length);
console.log('Has underscores:', nv.filter(i => /_/.test(i.title)).length);
console.log('Has dashes:', nv.filter(i => /-/.test(i.title)).length);
console.log('ALL_CAPS:', nv.filter(i => /^[A-Z0-9_]+$/.test(i.title)).length);
console.log('Contains spaces:', nv.filter(i => /\s/.test(i.title)).length);
console.log('Looks like sentence:', nv.filter(i => /^[A-Z].*[a-z]/.test(i.title) && i.title.length > 30).length);
console.log('Contains slash (path-like):', nv.filter(i => /\//.test(i.title)).length);

console.log('\n--- Category + extension breakdown ---');
const catExt = {};
nv.forEach(i => {
  const ext = i.title.match(/\.([a-z]+)$/i);
  const e = ext ? ext[1] : 'no-ext';
  const key = `${i.category}/${e}`;
  catExt[key] = (catExt[key] || 0) + 1;
});
Object.entries(catExt).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n--- Sample titles by category (first 15 each) ---');
for (const cat of Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])) {
  console.log(`\n[${cat}] (${byCat[cat]} items)`);
  nv.filter(i => i.category === cat).slice(0, 15).forEach(i => {
    const cands = i.candidate_paths && i.candidate_paths.length ? ` [cands: ${i.candidate_paths.slice(0, 2).join(', ')}]` : '';
    console.log(`  "${i.title.substring(0, 100)}"${cands}`);
  });
}

// Check how many have candidate_paths
const withCands = nv.filter(i => i.candidate_paths && i.candidate_paths.length > 0);
console.log(`\n--- Items with candidate paths: ${withCands.length} / ${nv.length} ---`);
withCands.slice(0, 20).forEach(i => {
  console.log(`  "${i.title.substring(0, 60)}" -> ${i.candidate_paths.slice(0, 3).join(', ')}`);
});
