#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ConstraintEngine } = require('./constraint-lattice');

class ExecutionGate {
  constructor(options = {}) {
    this.lane = options.lane || 'swarmmind';
    this.dryRun = options.dryRun !== undefined ? !!options.dryRun : true;
    this.resolver = options.resolver || null;
    this.constraintEngine = null;
    try {
      const policyPath = path.join(__dirname, '..', 'config', 'resilience-policy.json');
      if (fs.existsSync(policyPath)) {
        this.constraintEngine = new ConstraintEngine({ policyPath });
        this.constraintEngine.load();
      }
    } catch (_) {}
  }

  verify(msg) {
    if (!msg || typeof msg !== 'object') {
      return {
        execution_verified: false,
        would_verify: false,
        verification_type: 'none',
        reason: 'INVALID_MESSAGE',
        artifact_path: null,
      };
    }

    const proofType = this._classifyProof(msg);

    if (proofType === 'none') {
      const isActionable = msg.requires_action === true ||
        new Set(['task', 'escalation', 'request']).has(msg.type);
      if (isActionable) {
        return {
          execution_verified: true,
          would_verify: true,
          verification_type: 'actionable_intake',
          reason: 'actionable message, execution verification deferred to completion',
          artifact_path: null,
        };
      }
      return {
        execution_verified: true,
        would_verify: true,
        verification_type: 'no_proof_required',
        reason: 'no completion proof claimed, verification not applicable',
        artifact_path: null,
      };
    }

    if (proofType === 'non_path') {
      return {
        execution_verified: true,
        would_verify: true,
        verification_type: proofType,
        reason: 'non-path proof reference accepted',
        artifact_path: null,
      };
    }

    const artifactPath = this._extractArtifactPath(msg);
    if (!artifactPath) {
      return {
        execution_verified: false,
        would_verify: false,
        verification_type: proofType,
        reason: 'ARTIFACT_PATH_EMPTY',
        artifact_path: null,
      };
    }

    if (this.dryRun) {
      return {
        execution_verified: true,
        would_verify: true,
        verification_type: proofType,
        reason: 'DRY_RUN_SKIP_FS_CHECK',
        artifact_path: artifactPath,
      };
    }

    if (this.resolver) {
      const result = this.resolver.resolveExists(artifactPath);
      if (result.exists) {
        return {
          execution_verified: true,
          would_verify: true,
          verification_type: proofType,
          reason: result.reason,
          artifact_path: result.path || artifactPath,
        };
      }
      return {
        execution_verified: false,
        would_verify: false,
        verification_type: proofType,
        reason: result.reason,
        artifact_path: artifactPath,
      };
    }

    try {
      const resolved = path.resolve(artifactPath);
      fs.accessSync(resolved, fs.constants.R_OK);
      return {
        execution_verified: true,
        would_verify: true,
        verification_type: proofType,
        reason: 'FILE_ACCESSIBLE',
        artifact_path: resolved,
      };
    } catch (_) {
      return {
        execution_verified: false,
        would_verify: false,
        verification_type: proofType,
        reason: 'FILE_NOT_FOUND',
        artifact_path: artifactPath,
      };
    }
  }

  checkLiveness(processedDir) {
    if (!processedDir || typeof processedDir !== 'string') {
      return { alive: false, reason: 'NO_PROCESSED_DIR', recent_count: 0, oldest_age_seconds: null };
    }

    try {
      const resolved = path.resolve(processedDir);
      if (!fs.existsSync(resolved)) {
        return { alive: false, reason: 'PROCESSED_DIR_MISSING', recent_count: 0, oldest_age_seconds: null };
      }

      const files = fs.readdirSync(resolved).filter(f => f.endsWith('.json'));
      const now = Date.now();
      let recentCount = 0;
      let oldestAge = 0;

      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(resolved, file));
          const age = (now - stat.mtimeMs) / 1000;
          if (age < 3600) recentCount++;
          if (age > oldestAge) oldestAge = age;
        } catch (_) {}
      }

      return {
        alive: recentCount > 0,
        reason: recentCount > 0 ? 'RECENT_PROCESSED_FILES' : 'NO_RECENT_FILES',
        recent_count: recentCount,
        oldest_age_seconds: oldestAge > 0 ? Math.round(oldestAge) : null,
      };
    } catch (_) {
      return { alive: false, reason: 'LIVENESS_CHECK_ERROR', recent_count: 0, oldest_age_seconds: null };
    }
  }

  _classifyProof(msg) {
    if (msg.evidence_exchange && msg.evidence_exchange.artifact_path) return 'evidence_exchange';
    if (msg.completion_artifact_path) return 'legacy_artifact_path';
    if (msg.completion_message_id) return 'non_path';
    if (msg.resolved_by_task_id) return 'non_path';
    if (msg.evidence && msg.evidence.required === true && msg.evidence.evidence_path) return 'evidence_path';
    return 'none';
  }

  _extractArtifactPath(msg) {
    if (msg.evidence_exchange && msg.evidence_exchange.artifact_path) return msg.evidence_exchange.artifact_path;
    if (msg.completion_artifact_path) return msg.completion_artifact_path;
    if (msg.evidence && msg.evidence.evidence_path) return msg.evidence.evidence_path;
    return null;
  }

  lookupFailover(source) {
    if (!this.constraintEngine || !this.constraintEngine.policy) return null;
    const reg = this.constraintEngine.policy.equivalence_registry || {};
    const entry = reg[source];
    if (!entry) return null;
    return {
      source,
      equivalents: entry.equivalent_sources || [],
      equivalent_under_constraints: entry.equivalent_under_constraints === true,
      last_tested: entry.last_tested || null,
    };
  }

  checkFailoverRequired(source) {
    const entry = this.lookupFailover(source);
    if (!entry) return { failover: false, reason: 'no_equivalence_entry' };
    const requireEquiv = this.constraintEngine.policy.failover ? this.constraintEngine.policy.failover.require_equivalence : false;
    if (requireEquiv && !entry.equivalent_under_constraints) {
      return { failover: false, reason: 'equivalence_not_verified_under_constraints', source, equivalents: entry.equivalents };
    }
    if (entry.equivalents.length === 0) {
      return { failover: false, reason: 'no_equivalent_sources_listed', source };
    }
    return { failover: true, reason: 'equivalent_available', source, equivalents: entry.equivalents, last_tested: entry.last_tested };
  }
}

module.exports = { ExecutionGate };
