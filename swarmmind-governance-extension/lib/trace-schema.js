/**
 * Trace schema validation and extension for governance integration.
 * 
 * This module defines the governance-extended trace schema and provides
 * validation functions. It does NOT verify truth or enforce governance.
 */

const GOVERNANCE_FIELDS = {
  source: ['agent', 'human'],
  governance_check: ['passed', 'failed', 'skipped', 'unknown'],
  drift_signal: ['none', 'warning', 'measured', 'critical'],
  branch: ['main', 'alternative', 'corrected', 'abandoned']
};

function createGovernanceEntry(baseEntry, governanceFields = {}) {
  const entry = {
    timestamp: baseEntry.timestamp || new Date().toISOString(),
    source: governanceFields.source || 'agent',
    action: baseEntry.action || 'unknown',
    details: baseEntry.details || {}
  };

  if (baseEntry.agentId) entry.agentId = baseEntry.agentId;
  if (baseEntry.agentName) entry.agentName = baseEntry.agentName;

  if (governanceFields.claim) entry.claim = governanceFields.claim;
  if (governanceFields.evidence) entry.evidence = governanceFields.evidence;
  if (governanceFields.governance_check) {
    entry.governance_check = governanceFields.governance_check;
  }
  if (governanceFields.drift_signal) {
    entry.drift_signal = governanceFields.drift_signal;
  }
  if (governanceFields.branch) {
    entry.branch = governanceFields.branch;
  }

  return entry;
}

function validateGovernanceField(field, value) {
  if (!GOVERNANCE_FIELDS[field]) {
    return { valid: false, error: `Unknown field: ${field}` };
  }
  if (!GOVERNANCE_FIELDS[field].includes(value)) {
    return { 
      valid: false, 
      error: `Invalid value for ${field}: ${value}. Expected one of: ${GOVERNANCE_FIELDS[field].join(', ')}`
    };
  }
  return { valid: true };
}

function validateTraceEntry(entry) {
  const errors = [];

  if (!entry.timestamp) {
    errors.push('Missing required field: timestamp');
  }

  if (!entry.source) {
    errors.push('Missing required field: source');
  } else {
    const result = validateGovernanceField('source', entry.source);
    if (!result.valid) errors.push(result.error);
  }

  if (!entry.action) {
    errors.push('Missing required field: action');
  }

  if (entry.governance_check) {
    const result = validateGovernanceField('governance_check', entry.governance_check);
    if (!result.valid) errors.push(result.error);
  }

  if (entry.drift_signal) {
    const result = validateGovernanceField('drift_signal', entry.drift_signal);
    if (!result.valid) errors.push(result.error);
  }

  if (entry.branch) {
    const result = validateGovernanceField('branch', entry.branch);
    if (!result.valid) errors.push(result.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function createHumanEntry(action, governanceFields = {}) {
  return createGovernanceEntry(
    { action },
    { ...governanceFields, source: 'human' }
  );
}

function createAgentEntry(agentId, agentName, action, governanceFields = {}) {
  return createGovernanceEntry(
    { agentId, agentName, action },
    { ...governanceFields, source: 'agent' }
  );
}

function mergeTraces(agentTraces, humanTraces) {
  const all = [...agentTraces, ...humanTraces];
  all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return all;
}

function generateTraceTree(traces) {
  const tree = {
    root: {
      id: 'governance-root',
      label: 'Human-Agent Governance Trace',
      timestamp: new Date().toISOString(),
      children: []
    }
  };

  let currentBranch = 'main';
  const branches = { main: [], alternative: [], corrected: [], abandoned: [] };

  traces.forEach((trace, index) => {
    if (trace.branch) {
      currentBranch = trace.branch;
    }

    const node = {
      id: `entry-${index}`,
      label: trace.action,
      timestamp: trace.timestamp,
      source: trace.source,
      details: {}
    };

    if (trace.claim) node.claim = trace.claim;
    if (trace.evidence) node.evidence = trace.evidence;
    if (trace.governance_check) node.governance_check = trace.governance_check;
    if (trace.drift_signal) node.drift_signal = trace.drift_signal;

    branches[currentBranch].push(node);
  });

  Object.keys(branches).forEach(branchName => {
    if (branches[branchName].length > 0) {
      tree.root.children.push({
        id: `branch-${branchName}`,
        label: `Branch: ${branchName}`,
        children: branches[branchName]
      });
    }
  });

  return tree;
}

function exportForExternalReview(traces, metadata = {}) {
  return {
    exportedAt: new Date().toISOString(),
    traceCount: traces.length,
    summary: {
      agentEntries: traces.filter(t => t.source === 'agent').length,
      humanEntries: traces.filter(t => t.source === 'human').length,
      governanceChecksPassed: traces.filter(t => t.governance_check === 'passed').length,
      governanceChecksFailed: traces.filter(t => t.governance_check === 'failed').length,
      driftSignals: {
        none: traces.filter(t => t.drift_signal === 'none').length,
        warning: traces.filter(t => t.drift_signal === 'warning').length,
        measured: traces.filter(t => t.drift_signal === 'measured').length,
        critical: traces.filter(t => t.drift_signal === 'critical').length
      }
    },
    metadata,
    traces,
    tree: generateTraceTree(traces)
  };
}

module.exports = {
  GOVERNANCE_FIELDS,
  createGovernanceEntry,
  createHumanEntry,
  createAgentEntry,
  validateGovernanceField,
  validateTraceEntry,
  mergeTraces,
  generateTraceTree,
  exportForExternalReview
};
