/**
 * QueueConsumer.js - Archivist Queue Consumer (Phase 4.1)
 *
 * Consumes INCIDENT and APPROVAL queues for governance-root lane.
 * Implements closed-loop coordination between lanes.
 *
 * Queue Types:
 * - INCIDENT: Recovery events, drift detection, quarantine alerts
 * - APPROVAL: Cross-lane action requests requiring governance approval
 *
 * Consumer Behavior:
 * 1. Poll pending items from queue
 * 2. Classify by severity (P0/P1/P2/P3)
 * 3. Apply governance rules (from BOOTSTRAP.md)
 * 4. Execute resolution or escalate to operator
 * 5. Update queue status with proof
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEVERITY_LEVELS = {
	P0: { label: 'CRITICAL', auto_resolve: false, requires_operator: true },
	P1: { label: 'HIGH', auto_resolve: false, requires_operator: true },
	P2: { label: 'MEDIUM', auto_resolve: true, requires_operator: false },
	P3: { label: 'LOW', auto_resolve: true, requires_operator: false }
};

const INCIDENT_CLASSIFICATIONS = {
	lane_degradation: { severity: 'P0', action: 'escalate' },
	fingerprint_drift: { severity: 'P1', action: 'review_continuity' },
	continuity_quarantine: { severity: 'P1', action: 'review_quarantine' },
	persistent_dependency: { severity: 'P2', action: 'auto_resolve' },
	transient_error: { severity: 'P3', action: 'auto_resolve' }
};

const APPROVAL_TYPES = {
	cross_lane_write: { authority_required: 100, auto_approve: false },
	state_modification: { authority_required: 80, auto_approve: false },
	read_only: { authority_required: 60, auto_approve: true }
};

class QueueConsumer {
	constructor(options = {}) {
		this.laneId = 'archivist';
		this.authority = 100;
		this.queueDir = options.queueDir || this._resolveQueueDir();
		this.auditLog = options.auditLog || path.join(this.queueDir, '..', 'audit', 'queue-consumer.log');
		this.pollIntervalMs = options.pollIntervalMs || 5000;
		this.running = false;
		this.pollTimer = null;
		this._ensureQueueDir();
	}

	_resolveQueueDir() {
		const envPath = process.env.QUEUE_DIR;
		if (envPath) return envPath;
		const registryPath = path.join('S:', 'Archivist-Agent', 'LANE_REGISTRY.json');
		try {
			const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
			return registry.global_state?.queue_directory || path.join('S:', 'queue');
		} catch {
			return path.join('S:', 'SwarmMind Self-Optimizing Multi-Agent AI System', 'queue');
		}
	}

	_ensureQueueDir() {
		if (!fs.existsSync(this.queueDir)) {
			fs.mkdirSync(this.queueDir, { recursive: true });
		}
		const auditDir = path.dirname(this.auditLog);
		if (!fs.existsSync(auditDir)) {
			fs.mkdirSync(auditDir, { recursive: true });
		}
	}

	_loadQueue(queueType) {
		const filePath = path.join(this.queueDir, `${queueType.toLowerCase()}.log`);
		if (!fs.existsSync(filePath)) return [];
		const raw = fs.readFileSync(filePath, 'utf8');
		if (!raw.trim()) return [];
		return raw.trim().split('\n').map(line => {
			try { return JSON.parse(line); }
			catch { return null; }
		}).filter(item => item !== null);
	}

	_writeQueue(queueType, items) {
		const filePath = path.join(this.queueDir, `${queueType.toLowerCase()}.log`);
		const data = items.map(item => JSON.stringify(item)).join('\n') + '\n';
		const tempPath = filePath + '.tmp';
		fs.writeFileSync(tempPath, data, 'utf8');
		fs.renameSync(tempPath, filePath);
	}

	_audit(event) {
		const entry = {
			timestamp: new Date().toISOString(),
			lane: this.laneId,
			...event
		};
		const line = JSON.stringify(entry) + '\n';
		fs.appendFileSync(this.auditLog, line, 'utf8');
	}

	getPending(queueType) {
		const items = this._loadQueue(queueType);
		return items.filter(item => item.status === 'pending' && item.target_lane === this.laneId);
	}

	classifyIncident(item) {
		const classification = item.payload?.classification || item.payload?.type || 'unknown';
		const rule = INCIDENT_CLASSIFICATIONS[classification] || { severity: 'P3', action: 'auto_resolve' };
		return {
			...item,
			severity: rule.severity,
			severityInfo: SEVERITY_LEVELS[rule.severity],
			recommendedAction: rule.action,
			classificationType: classification
		};
	}

	classifyApproval(item) {
		const type = item.payload?.approval_type || 'read_only';
		const rule = APPROVAL_TYPES[type] || APPROVAL_TYPES.read_only;
		const canApprove = this.authority >= rule.authority_required;
		return {
			...item,
			approvalType: type,
			authorityRequired: rule.authority_required,
			canApprove,
			autoApprove: rule.auto_approve && canApprove
		};
	}

	resolveIncident(item) {
		const classified = this.classifyIncident(item);
		this._audit({ event: 'incident_classified', itemId: item.id, classification: classified.classificationType, severity: classified.severity });

		if (classified.severityInfo.auto_resolve) {
			const resolution = this._autoResolveIncident(classified);
			return { ...classified, status: 'accepted', resolution };
		}

		if (classified.severityInfo.requires_operator) {
			return { ...classified, status: 'pending', resolution: 'OPERATOR_REVIEW_REQUIRED', requiresAttention: true };
		}

		return { ...classified, status: 'accepted', resolution: 'NO_ACTION_REQUIRED' };
	}

	resolveApproval(item) {
		const classified = this.classifyApproval(item);
		this._audit({ event: 'approval_classified', itemId: item.id, type: classified.approvalType, canApprove: classified.canApprove });

		if (!classified.canApprove) {
			return { ...classified, status: 'rejected', resolution: 'INSUFFICIENT_AUTHORITY' };
		}

		if (classified.autoApprove) {
			return { ...classified, status: 'accepted', resolution: 'AUTO_APPROVED' };
		}

		return { ...classified, status: 'pending', resolution: 'OPERATOR_REVIEW_REQUIRED', requiresAttention: true };
	}

	_autoResolveIncident(item) {
		const proofHash = crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex').substring(0, 16);
		const resolution = `AUTO_RESOLVED_${item.recommendedAction.toUpperCase()}_PROOF_${proofHash}`;
		this._audit({ event: 'incident_auto_resolved', itemId: item.id, resolution });
		return resolution;
	}

	processQueue(queueType) {
		const pending = this.getPending(queueType);
		if (pending.length === 0) return { processed: 0, escalated: 0 };

		const allItems = this._loadQueue(queueType);
		let processed = 0;
		let escalated = 0;

		for (const item of pending) {
			let result;
			if (queueType === 'INCIDENT') {
				result = this.resolveIncident(item);
			} else if (queueType === 'APPROVAL') {
				result = this.resolveApproval(item);
			} else {
				continue;
			}

			const idx = allItems.findIndex(i => i.id === item.id);
			if (idx !== -1) {
				allItems[idx] = { ...allItems[idx], status: result.status, resolution: result.resolution };
				processed++;
				if (result.requiresAttention) escalated++;
			}
		}

		this._writeQueue(queueType, allItems);
		this._audit({ event: 'queue_processed', queueType, processed, escalated });
		return { processed, escalated };
	}

	start() {
		if (this.running) return;
		this.running = true;
		this._audit({ event: 'consumer_started', lane: this.laneId });
		this._poll();
	}

	stop() {
		this.running = false;
		if (this.pollTimer) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
		this._audit({ event: 'consumer_stopped', lane: this.laneId });
	}

	_poll() {
		if (!this.running) return;

		try {
			this.processQueue('INCIDENT');
			this.processQueue('APPROVAL');
		} catch (err) {
			this._audit({ event: 'poll_error', error: err.message });
		}

		this.pollTimer = setTimeout(() => this._poll(), this.pollIntervalMs);
	}

	getStats() {
		const incidentPending = this.getPending('INCIDENT');
		const approvalPending = this.getPending('APPROVAL');

		const incidentsBySeverity = incidentPending.reduce((acc, item) => {
			const classified = this.classifyIncident(item);
			acc[classified.severity] = (acc[classified.severity] || 0) + 1;
			return acc;
		}, {});

		return {
			lane: this.laneId,
			authority: this.authority,
			incidentQueue: {
				pending: incidentPending.length,
				bySeverity: incidentsBySeverity
			},
			approvalQueue: {
				pending: approvalPending.length
			},
			running: this.running
		};
	}
}

module.exports = { QueueConsumer, SEVERITY_LEVELS, INCIDENT_CLASSIFICATIONS, APPROVAL_TYPES };
