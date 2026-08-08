#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function argValue(args, flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return null;
}

function toInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function loadMetrics(args) {
  const metricsPath = argValue(args, '--metrics');
  if (!metricsPath) {
    return {
      session_id: argValue(args, '--session-id') || 'unknown',
      timestamp: new Date().toISOString(),
      new_contradiction_edges: toInt(argValue(args, '--new-edges'), 0),
      adjudications_completed: toInt(argValue(args, '--adjudications'), 0),
      backlog_open: toInt(argValue(args, '--backlog-open'), 0),
      waiver_reason: argValue(args, '--waiver-reason') || '',
      waiver_owner: argValue(args, '--waiver-owner') || '',
      waiver_makeup_target: argValue(args, '--waiver-makeup-target') || ''
    };
  }

  const raw = fs.readFileSync(metricsPath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    session_id: parsed.session_id || 'unknown',
    timestamp: parsed.timestamp || new Date().toISOString(),
    new_contradiction_edges: toInt(parsed.new_contradiction_edges, 0),
    adjudications_completed: toInt(parsed.adjudications_completed, 0),
    backlog_open: toInt(parsed.backlog_open, 0),
    waiver_reason: parsed.waiver_reason || '',
    waiver_owner: parsed.waiver_owner || '',
    waiver_makeup_target: parsed.waiver_makeup_target || ''
  };
}

function evaluateGate(metrics) {
  const requiredByRatio = Math.ceil(metrics.new_contradiction_edges / 10);
  const minFloorMet = metrics.adjudications_completed >= 1;
  const ratioGateMet = metrics.adjudications_completed >= requiredByRatio;
  const ratioWaived = !ratioGateMet
    && !!metrics.waiver_reason
    && !!metrics.waiver_owner
    && !!metrics.waiver_makeup_target;

  const pass = minFloorMet && (ratioGateMet || ratioWaived);

  return {
    pass,
    checks: {
      min_floor_met: minFloorMet,
      ratio_gate_met: ratioGateMet,
      ratio_gate_waived: ratioWaived
    },
    required_adjudications_by_ratio: requiredByRatio
  };
}

function defaultReportPath() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(
    'S:/Archivist-Agent/context-buffer/contradiction-burndown',
    `session-gate-${ts}.json`
  );
}

(function main() {
  const args = process.argv.slice(2);
  const reportPath = argValue(args, '--report') || defaultReportPath();
  const failCode = toInt(argValue(args, '--fail-code'), 42);

  let metrics;
  try {
    metrics = loadMetrics(args);
  } catch (err) {
    console.error(`Failed to load metrics: ${err.message}`);
    process.exit(2);
  }

  const evalResult = evaluateGate(metrics);
  const output = {
    gate: 'contradiction-burndown',
    version: '1.0',
    evaluated_at: new Date().toISOString(),
    metrics,
    ...evalResult,
    status: evalResult.pass ? 'PASS' : 'BLOCKED',
    reason: evalResult.pass ? 'gate_requirements_met' : 'adjudication_floor_or_ratio_not_met'
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(JSON.stringify(output, null, 2));
  console.log(`report_path: ${reportPath}`);

  if (!evalResult.pass) process.exit(failCode);
})();

