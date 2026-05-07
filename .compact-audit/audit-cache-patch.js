const fs = require('fs');
const path = require('path');
const LANES = {
  archivist: { root: 'S:/Archivist-Agent' },
  library: { root: 'S:/self-organizing-library' },
  swarmmind: { root: 'S:/SwarmMind' },
  kernel: { root: 'S:/kernel-lane' }
};
const TRUST = 'S:/Archivist-Agent/lanes/broadcast/trust-store.json';

module.exports = class AuditCache {
  constructor(auditDir) {
    this.auditDir = auditDir;
  this.trustStorePath = TRUST;
  this.bootstrapPath = 'S:/Archivist-Agent/BOOTSTRAP.md';
    this.governancePath = 'S:/Archivist-Agent/GOVERNANCE.md';
    this.constraintsPath = 'S:/Archivist-Agent/constitutional_constraints.yaml';
    this.handoffPath = 'S:/Archivist-Agent/lanes/archivist/outbox/e2e-summary-aggregation.json';
    this._trustStore = null;
  }

  _loadTrustStore() {
    if (!this._trustStore) {
      this._trustStore = JSON.parse(fs.readFileSync(this.trustStorePath, 'utf8'));
    }
    return this._trustStore;
  }

  _getTrustStoreKeyIds() {
    const trust = this._loadTrustStore();
    return Object.fromEntries(
      Object.entries(trust).map(([k, v]) => [k, v.key_id || 'N/A'])
    );
  }

  _hashFile(p) {
    if (!fs.existsSync(p)) return null;
    const data = fs.readFileSync(p, 'utf8');
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  multiSourceTruthReload() {
    const sources = {};
    const contradictions = [];

    sources.trust_store = {
      path: this.trustStorePath,
      exists: fs.existsSync(this.trustStorePath),
      key_ids: this._getTrustStoreKeyIds()
    };

    for (const [laneId, config] of Object.entries(LANES)) {
      const idPath = path.join(config.root, '.identity', 'public.pem');
      sources[laneId] = { identity_exists: fs.existsSync(idPath) };
      if (sources[laneId].identity_exists) {
        try {
          const pem = fs.readFileSync(idPath, 'utf8');
          sources[laneId].key_id = require('crypto')
            .createHash('sha256').update(pem).digest('hex').slice(0, 16);
        } catch (_) { sources[laneId].key_id = null; }
      }
    }

    sources.handoff = { exists: fs.existsSync(this.handoffPath) };
    sources.constraints = { exists: fs.existsSync(this.constraintsPath) };
    sources.governance = { exists: fs.existsSync(this.governancePath) };
    sources.bootstrap = { exists: fs.existsSync(this.bootstrapPath) };

    for (const [lane, state] of Object.entries(sources)) {
      if (lane === 'trust_store' || lane === 'handoff' || lane === 'constraints' || lane === 'governance' || lane === 'bootstrap') continue;
      if (!state.identity_exists) contradictions.push(`${lane}_no_identity`);
    }

    for (const [lane, state] of Object.entries(sources)) {
      if (lane === 'trust_store' || lane === 'handoff' || lane === 'constraints' || lane === 'governance' || lane === 'bootstrap') continue;
      if (state.identity_exists && state.key_id && state.key_id !== sources.trust_store?.key_ids?.[lane]) {
        contradictions.push(`${lane}_key_id_mismatch`);
      }
    }

    return {
      sources,
      source_count: Object.keys(sources).length,
      contradictions,
      status: contradictions.length === 0 ? 'consistent' : 'contradicted',
      timestamp: new Date().toISOString()
    };
  }
};