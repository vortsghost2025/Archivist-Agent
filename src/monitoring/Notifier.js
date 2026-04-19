/**
 * Notifier.js - Phase 4.2 Alert Notification
 *
 * Sends alerts via configured channels: webhook, file, email (stub).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class Notifier {
	constructor(options = {}) {
		this.config = options.config || this._defaultConfig();
		this.alertsLog = options.alertsLog || path.join(__dirname, '..', '..', 'logs', 'alerts.log');
		this._ensureLogDir();
	}

	_defaultConfig() {
		return {
			webhook: { enabled: false, url: null, timeout_ms: 5000 },
			file: { enabled: true },
			email: { enabled: false }
		};
	}

	_ensureLogDir() {
		const dir = path.dirname(this.alertsLog);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	async send(alert) {
		const results = {};

		if (this.config.file?.enabled) {
			results.file = this._sendToFile(alert);
		}

		if (this.config.webhook?.enabled && this.config.webhook?.url) {
			results.webhook = await this._sendToWebhook(alert);
		}

		if (this.config.email?.enabled) {
			results.email = this._sendToEmail(alert);
		}

		return results;
	}

	_sendToFile(alert) {
		const entry = {
			timestamp: new Date().toISOString(),
			severity: alert.severity,
			type: alert.type,
			message: alert.message,
			alert_id: alert.id
		};
		const line = JSON.stringify(entry) + '\n';
		fs.appendFileSync(this.alertsLog, line, 'utf8');
		return { success: true, channel: 'file' };
	}

	async _sendToWebhook(alert) {
		const url = this.config.webhook.url;
		const timeout = this.config.webhook.timeout_ms || 5000;

		const payload = {
			alert_id: alert.id,
			timestamp: alert.timestamp,
			severity: alert.severity,
			type: alert.type,
			message: alert.message,
			metric_value: alert.metric_value,
			threshold: alert.threshold
		};

		return new Promise((resolve) => {
			const urlObj = new URL(url);
			const lib = urlObj.protocol === 'https:' ? https : http;

			const req = lib.request({
				hostname: urlObj.hostname,
				port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
				path: urlObj.pathname + urlObj.search,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Archivist-Monitor/1.0'
				},
				timeout
			}, (res) => {
				let body = '';
				res.on('data', chunk => body += chunk);
				res.on('end', () => {
					resolve({
						success: res.statusCode >= 200 && res.statusCode < 300,
						channel: 'webhook',
						status_code: res.statusCode
					});
				});
			});

			req.on('error', (err) => {
				resolve({ success: false, channel: 'webhook', error: err.message });
			});

			req.on('timeout', () => {
				req.destroy();
				resolve({ success: false, channel: 'webhook', error: 'timeout' });
			});

			req.write(JSON.stringify(payload));
			req.end();
		});
	}

	_sendToEmail(alert) {
		return { success: false, channel: 'email', error: 'not_implemented' };
	}

	async sendBatch(alerts) {
		const results = [];
		for (const alert of alerts) {
			const result = await this.send(alert);
			results.push({ alert_id: alert.id, ...result });
		}
		return results;
	}
}

module.exports = { Notifier };
