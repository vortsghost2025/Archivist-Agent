/**
 * AlertEngine.js - Phase 4.2 Alert Threshold Engine
 *
 * Checks metrics against configurable thresholds, applies cooldowns,
 * deduplicates alerts, and routes to notifiers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_THRESHOLDS = {
	quarantine_rate: { value: 0, window: '1h', severity: 'CRITICAL', metric: 'rates.quarantine_per_hour' },
	p0_pending: { value: 0, window: 'now', severity: 'CRITICAL', metric: 'severity.P0' },
	p1_pending: { value: 3, window: 'now', severity: 'HIGH', metric: 'severity.P1' },
	escalation_rate: { value: 5, window: '1h', severity: 'HIGH', metric: 'rates.escalation_per_hour' },
	queue_backlog: { value: 50, window: 'now', severity: 'MEDIUM', metric: 'queue.incident_pending' },
	auto_resolve_rate_drop: { value: 50, window: '1h', severity: 'MEDIUM', metric: 'rates.auto_resolve_per_hour', comparison: 'below' }
};

const DEFAULT_COOLDOWNS = {
	CRITICAL: 300000, // 5 minutes
	HIGH: 900000,     // 15 minutes
	MEDIUM: 1800000   // 30 minutes
};

class AlertEngine {
	constructor(options = {}) {
		this.thresholds = options.thresholds || DEFAULT_THRESHOLDS;
		this.cooldowns = options.cooldowns || DEFAULT_COOLDOWNS;
		this.alertsFile = options.alertsFile || path.join(__dirname, '..', '..', 'logs', 'alerts.json');
		this.activeAlerts = new Map();
		this.alertHistory = [];
		this._loadAlerts();
	}

	_loadAlerts() {
		if (fs.existsSync(this.alertsFile)) {
			try {
				const raw = fs.readFileSync(this.alertsFile, 'utf8');
				const data = JSON.parse(raw);
				this.alertHistory = data.history || [];
			} catch (e) {
				this.alertHistory = [];
			}
		}
	}

	_saveAlerts() {
		const dir = path.dirname(this.alertsFile);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(this.alertsFile, JSON.stringify({ history: this.alertHistory }, null, 2), 'utf8');
	}

	_getMetricValue(metrics, metricPath) {
		const parts = metricPath.split('.');
		let value = metrics;
		for (const part of parts) {
			if (value === undefined || value === null) return null;
			value = value[part];
		}
		return value;
	}

	_generateAlertId() {
		return `ALERT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
	}

	_isInCooldown(alertType, severity) {
		const key = `${alertType}:${severity}`;
		const lastAlert = this.activeAlerts.get(key);
		if (!lastAlert) return false;

		const cooldownMs = this.cooldowns[severity] || 300000;
		const elapsed = Date.now() - new Date(lastAlert.timestamp).getTime();
		return elapsed < cooldownMs;
	}

	check(metrics) {
		const triggeredAlerts = [];

		for (const [alertType, config] of Object.entries(this.thresholds)) {
			const metricValue = this._getMetricValue(metrics, config.metric);
			if (metricValue === null) continue;

			const threshold = config.value;
			const severity = config.severity;
			const comparison = config.comparison || 'above';

			let triggered = false;
			if (comparison === 'above') {
				triggered = metricValue > threshold;
			} else if (comparison === 'below') {
				triggered = metricValue < threshold;
			} else if (comparison === 'equal') {
				triggered = metricValue === threshold;
			}

			if (triggered) {
				if (this._isInCooldown(alertType, severity)) {
					continue;
				}

				const alert = {
					id: this._generateAlertId(),
					timestamp: new Date().toISOString(),
					type: alertType,
					severity,
					message: this._formatMessage(alertType, metricValue, threshold, comparison),
					metric_value: metricValue,
					threshold,
					comparison,
					acknowledged: false,
					resolved_at: null
				};

				const key = `${alertType}:${severity}`;
				this.activeAlerts.set(key, alert);
				this.alertHistory.push(alert);
				triggeredAlerts.push(alert);
			}
		}

		if (triggeredAlerts.length > 0) {
			this._saveAlerts();
		}

		return triggeredAlerts;
	}

	_formatMessage(alertType, value, threshold, comparison) {
		const operator = comparison === 'above' ? '>' : comparison === 'below' ? '<' : '=';
		const descriptions = {
			quarantine_rate: `Quarantine rate ${operator} threshold`,
			p0_pending: `P0 incidents pending ${operator} threshold`,
			p1_pending: `P1 incidents pending ${operator} threshold`,
			escalation_rate: `Escalation rate ${operator} threshold`,
			queue_backlog: `Queue backlog ${operator} threshold`,
			auto_resolve_rate_drop: `Auto-resolve rate ${operator} threshold`
		};
		const desc = descriptions[alertType] || `Alert ${alertType}`;
		return `${desc}: ${value.toFixed(2)} ${operator} ${threshold}`;
	}

	acknowledge(alertId) {
		const alert = this.alertHistory.find(a => a.id === alertId);
		if (alert) {
			alert.acknowledged = true;
			this._saveAlerts();
			return alert;
		}
		return null;
	}

	resolve(alertId) {
		const alert = this.alertHistory.find(a => a.id === alertId);
		if (alert) {
			alert.resolved_at = new Date().toISOString();
			const key = `${alert.type}:${alert.severity}`;
			this.activeAlerts.delete(key);
			this._saveAlerts();
			return alert;
		}
		return null;
	}

	getActiveAlerts() {
		return this.alertHistory.filter(a => !a.resolved_at);
	}

	getStats() {
		return {
			total_alerts: this.alertHistory.length,
			active: this.alertHistory.filter(a => !a.resolved_at).length,
			acknowledged: this.alertHistory.filter(a => a.acknowledged).length,
			resolved: this.alertHistory.filter(a => a.resolved_at).length,
			by_severity: {
				CRITICAL: this.alertHistory.filter(a => a.severity === 'CRITICAL').length,
				HIGH: this.alertHistory.filter(a => a.severity === 'HIGH').length,
				MEDIUM: this.alertHistory.filter(a => a.severity === 'MEDIUM').length
			}
		};
	}
}

module.exports = { AlertEngine, DEFAULT_THRESHOLDS, DEFAULT_COOLDOWNS };
