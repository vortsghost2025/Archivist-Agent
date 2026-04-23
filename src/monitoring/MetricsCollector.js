/**
 * MetricsCollector.js - Phase 4.2 Real-time Metrics Collection
 *
 * Tails audit logs, aggregates events by type/severity/lane,
 * calculates rates, and exposes metrics for monitoring.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class MetricsCollector {
	constructor(options = {}) {
		this.auditLogPath = options.auditLogPath || this._defaultAuditLog();
		this.queueDir = options.queueDir || this._defaultQueueDir();
		this.windowMs = options.windowMs || 3600000; // 1 hour default
		this.metrics = this._initMetrics();
		this.eventHistory = [];
		this.maxHistoryAge = options.maxHistoryAge || 7200000; // 2 hours
	}

	_defaultAuditLog() {
		const envPath = process.env.QUEUE_DIR;
		if (envPath) return path.join(path.dirname(envPath), 'audit', 'queue-consumer.log');
		return path.join('S:', 'SwarmMind', 'audit', 'queue-consumer.log');
	}

	_defaultQueueDir() {
		const envPath = process.env.QUEUE_DIR;
		if (envPath) return envPath;
		return path.join('S:', 'SwarmMind', 'queue');
	}

	_initMetrics() {
		return {
			queue: {
				incident_pending: 0,
				incident_escalated: 0,
				incident_auto_resolved: 0,
				approval_pending: 0,
				approval_approved: 0,
				approval_rejected: 0
			},
			severity: { P0: 0, P1: 0, P2: 0, P3: 0 },
			classifications: {},
			lanes: {},
			rates: {
				quarantine_per_hour: 0,
				escalation_per_hour: 0,
				auto_resolve_per_hour: 0,
				incidents_per_hour: 0
			},
			health: {
				consumer_heartbeat_age_sec: null,
				last_processed: null,
				last_audit_event: null
			},
			alerts: {
				active: 0,
				acknowledged: 0,
				resolved: 0
			}
		};
	}

	_pruneHistory() {
		const cutoff = Date.now() - this.maxHistoryAge;
		this.eventHistory = this.eventHistory.filter(e => e.timestamp && new Date(e.timestamp).getTime() > cutoff);
	}

	processEvent(event) {
		this._pruneHistory();
		this.eventHistory.push(event);
		this.metrics.health.last_audit_event = event.timestamp;

		if (event.event === 'incident_classified') {
			this.metrics.classifications[event.classification] = (this.metrics.classifications[event.classification] || 0) + 1;
			if (event.severity) this.metrics.severity[event.severity]++;
		}

		if (event.event === 'incident_auto_resolved') {
			this.metrics.queue.incident_auto_resolved++;
		}

		if (event.event === 'queue_processed') {
			this.metrics.queue.incident_escalated += event.escalated || 0;
		}

		if (event.lane) {
			this.metrics.lanes[event.lane] = (this.metrics.lanes[event.lane] || 0) + 1;
		}

		this._calculateRates();
	}

	_calculateRates() {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		const windowEvents = this.eventHistory.filter(e => new Date(e.timestamp).getTime() > windowStart);

		const quarantineEvents = windowEvents.filter(e => e.classification === 'continuity_quarantine' || e.classification === 'lane_degradation');
		const escalatedEvents = windowEvents.filter(e => e.event === 'incident_classified' && (e.severity === 'P0' || e.severity === 'P1'));
		const autoResolvedEvents = windowEvents.filter(e => e.event === 'incident_auto_resolved');
		const allIncidents = windowEvents.filter(e => e.event === 'incident_classified');

		const hoursInWindow = this.windowMs / 3600000;
		this.metrics.rates.quarantine_per_hour = quarantineEvents.length / hoursInWindow;
		this.metrics.rates.escalation_per_hour = escalatedEvents.length / hoursInWindow;
		this.metrics.rates.auto_resolve_per_hour = autoResolvedEvents.length / hoursInWindow;
		this.metrics.rates.incidents_per_hour = allIncidents.length / hoursInWindow;
	}

	readQueueStats() {
		const incidentPath = path.join(this.queueDir, 'incident.log');
		if (fs.existsSync(incidentPath)) {
			const raw = fs.readFileSync(incidentPath, 'utf8');
			const items = raw.trim().split('\n').filter(l => l).map(l => {
				try { return JSON.parse(l); }
				catch { return null; }
			}).filter(i => i);

			this.metrics.queue.incident_pending = items.filter(i => i.status === 'pending').length;
			this.metrics.queue.incident_escalated = items.filter(i => i.status === 'pending' && i.payload?.classification === 'lane_degradation').length;
		}

		const approvalPath = path.join(this.queueDir, 'approval.log');
		if (fs.existsSync(approvalPath)) {
			const raw = fs.readFileSync(approvalPath, 'utf8');
			if (raw.trim()) {
				const items = raw.trim().split('\n').filter(l => l).map(l => {
					try { return JSON.parse(l); }
					catch { return null; }
				}).filter(i => i);

				this.metrics.queue.approval_pending = items.filter(i => i.status === 'pending').length;
				this.metrics.queue.approval_approved = items.filter(i => i.status === 'accepted').length;
				this.metrics.queue.approval_rejected = items.filter(i => i.status === 'rejected').length;
			}
		}
	}

	scanAuditLog() {
		if (!fs.existsSync(this.auditLogPath)) {
			return;
		}

		const raw = fs.readFileSync(this.auditLogPath, 'utf8');
		if (!raw.trim()) return;

		const events = raw.trim().split('\n').filter(l => l).map(l => {
			try { return JSON.parse(l); }
			catch { return null; }
		}).filter(e => e);

		this.eventHistory = [];
		this.metrics = this._initMetrics();
		events.forEach(e => this.processEvent(e));
		this.readQueueStats();
	}

	collect() {
		this.scanAuditLog();
		this._calculateRates();
		return this.getMetrics();
	}

	getMetrics() {
		return {
			timestamp: new Date().toISOString(),
			...this.metrics,
			window: {
				duration_ms: this.windowMs,
				events_in_window: this.eventHistory.length
			}
		};
	}
}

module.exports = { MetricsCollector };
