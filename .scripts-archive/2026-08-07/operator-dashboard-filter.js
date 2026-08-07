#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var { LaneDiscovery } = require('./util/lane-discovery');

var discovery = new LaneDiscovery();
var LANE_ROOTS = {};
var lanes = discovery.listLanes();
for (var i = 0; i < lanes.length; i++) {
  LANE_ROOTS[lanes[i]] = discovery.getLocalPath(lanes[i]);
}

function safeReadJson(p) {
  try { return { ok: true, value: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function(f) { return f.endsWith('.json') && !f.toLowerCase().startsWith('heartbeat'); })
    .map(function(f) { return path.join(dir, f); });
}

function collectUncertaintyItems(lane) {
  var root = LANE_ROOTS[lane];
  if (!root) return [];

  var dirs = [
    path.join(root, 'lanes', lane, 'inbox'),
    path.join(root, 'lanes', lane, 'inbox', 'action-required'),
    path.join(root, 'lanes', lane, 'inbox', 'in-progress'),
    path.join(root, 'lanes', lane, 'inbox', 'processed'),
    path.join(root, 'lanes', lane, 'outbox'),
  ];

  var items = [];

  for (var d = 0; d < dirs.length; d++) {
    var files = scanDir(dirs[d]);
    for (var f = 0; f < files.length; f++) {
      var read = safeReadJson(files[f]);
      if (!read.ok) continue;
      var msg = read.value;

      var isHighUncertainty = msg.uncertainty &&
        (msg.uncertainty.level === 'high' || msg.uncertainty.level === 'critical');
      var isOperatorNeeded = msg.uncertainty &&
        msg.uncertainty.operator_decision_needed === true;
      var isEscalated = msg.review && msg.review.status === 'escalated';

      if (isHighUncertainty || isOperatorNeeded || isEscalated) {
        items.push({
          lane: lane,
          file: path.basename(files[f]),
          dir: path.basename(path.dirname(files[f])),
          task_id: msg.task_id || msg.id || 'unknown',
          subject: (msg.subject || '').slice(0, 80),
          from: msg.from || 'unknown',
          priority: msg.priority || 'P3',
          uncertainty: msg.uncertainty || null,
          review: msg.review || null,
          timestamp: msg.timestamp || null,
          operator_action_needed: isOperatorNeeded || isEscalated,
        });
      }
    }
  }

  return items;
}

function collectJournalUncertainty(lane) {
  var root = LANE_ROOTS[lane];
  if (!root) return [];

  var journalDir = path.join(root, 'lanes', lane, 'journal');
  if (!fs.existsSync(journalDir)) return [];

  var today = new Date().toISOString().slice(0, 10);
  var journalFile = path.join(journalDir, today + '.jsonl');
  if (!fs.existsSync(journalFile)) return [];

  var content;
  try { content = fs.readFileSync(journalFile, 'utf8'); } catch (_) { return []; }

  var lines = content.split('\n').filter(Boolean);
  var items = [];

  for (var i = 0; i < lines.length; i++) {
    var entry;
    try { entry = JSON.parse(lines[i]); } catch (_) { continue; }

    if (entry.uncertainty_summary && entry.uncertainty_summary.operator_needed > 0) {
      items.push({
        lane: lane,
        source: 'journal',
        event: entry.event,
        agent: entry.agent,
        session: entry.session_id,
        uncertainty_summary: entry.uncertainty_summary,
        timestamp: entry.timestamp,
      });
    }
  }

  return items;
}

function main() {
  var args = process.argv.slice(2);
  var filterLane = null;
  var showJournal = false;

  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--lane' && args[i + 1]) { filterLane = args[++i]; }
    if (args[i].startsWith('--lane=')) { filterLane = args[i].split('=')[1]; }
    if (args[i] === '--journal') { showJournal = true; }
  }

  var laneNames = filterLane ? [filterLane] : Object.keys(LANE_ROOTS);
  var allItems = [];
  var journalItems = [];

  for (var i = 0; i < laneNames.length; i++) {
    var items = collectUncertaintyItems(laneNames[i]);
    allItems = allItems.concat(items);
    if (showJournal) {
      var jItems = collectJournalUncertainty(laneNames[i]);
      journalItems = journalItems.concat(jItems);
    }
  }

  allItems.sort(function(a, b) {
    var aOp = a.operator_action_needed ? 0 : 1;
    var bOp = b.operator_action_needed ? 0 : 1;
    if (aOp !== bOp) return aOp - bOp;
    var aLevel = (a.uncertainty || {}).level || 'low';
    var bLevel = (b.uncertainty || {}).level || 'low';
    var levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (levelOrder[aLevel] || 3) - (levelOrder[bLevel] || 3);
  });

  var operatorItems = allItems.filter(function(it) { return it.operator_action_needed; });

  var report = {
    generated_at: new Date().toISOString(),
    total_items: allItems.length,
    operator_action_needed: operatorItems.length,
    items: allItems,
  };

  if (showJournal) {
    report.journal_uncertainty = journalItems;
  }

  console.log(JSON.stringify(report, null, 2));

  if (operatorItems.length > 0) {
    console.error('\n[ACTION REQUIRED] ' + operatorItems.length + ' items need operator attention:');
    for (var i = 0; i < operatorItems.length; i++) {
      var it = operatorItems[i];
      var marker = (it.uncertainty || {}).level === 'critical' ? '🔴' : '👤';
      console.error('  ' + marker + ' [' + it.lane.toUpperCase() + '] ' + it.subject + ' (from=' + it.from + ')');
    }
  }
}

if (require.main === module) {
  main();
}
