import json, sys
import os

input_path = r'S:/Archivist-Agent/tmp/graph-snapshot-2026-04-30-18-53-01-755.json'
output_path = r'S:/Archivist-Agent/tmp/top25-contradiction-triage-report.json'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
# Expect data is a list of node dicts
if not isinstance(data, list):
    # maybe data contains "nodes" key
    data = data.get('nodes', [])
# Filter nodes with contradictionCount
nodes = [n for n in data if isinstance(n, dict) and 'contradictionCount' in n]
# Sort descending
nodes.sort(key=lambda x: x.get('contradictionCount', 0), reverse=True)
# Take top 25 non-zero
top = [n for n in nodes[:25] if n.get('contradictionCount', 0) > 0]
report = []
for n in top:
    report.append({
        'id': n.get('id'),
        'repo': n.get('repo'),
        'path': n.get('path'),
        'category': n.get('category'),
        'contradictionCount': n.get('contradictionCount'),
        'recommendedFixOrder': 'high'
    })
with open(output_path, 'w', encoding='utf-8') as out:
    json.dump(report, out, indent=2)
print(f'Wrote {len(report)} entries to {output_path}')
