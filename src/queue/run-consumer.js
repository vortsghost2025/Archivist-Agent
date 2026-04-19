#!/usr/bin/env node
/**
 * run-consumer.js - CLI entry point for Archivist Queue Consumer
 *
 * Usage:
 *   node run-consumer.js --start          # Start continuous polling
 *   node run-consumer.js --process-once   # Process pending items once
 *   node run-consumer.js --stats          # Show queue statistics
 */

const path = require('path');
const { QueueConsumer } = require('./QueueConsumer');

function parseArgs() {
	const args = process.argv.slice(2);
	return {
		start: args.includes('--start'),
		processOnce: args.includes('--process-once'),
		stats: args.includes('--stats'),
		help: args.includes('--help') || args.includes('-h')
	};
}

function printHelp() {
	console.log(`
Archivist Queue Consumer (Phase 4.1)

Usage:
  node run-consumer.js --start          Start continuous polling
  node run-consumer.js --process-once   Process pending items once
  node run-consumer.js --stats          Show queue statistics

Environment:
  QUEUE_DIR    Override queue directory path
`);
}

async function main() {
	const opts = parseArgs();

	if (opts.help) {
		printHelp();
		process.exit(0);
	}

	const consumer = new QueueConsumer();

	if (opts.stats) {
		const stats = consumer.getStats();
		console.log(JSON.stringify(stats, null, 2));
		process.exit(0);
	}

	if (opts.processOnce) {
		console.log('[QueueConsumer] Processing pending items...');
		const incidentResult = consumer.processQueue('INCIDENT');
		const approvalResult = consumer.processQueue('APPROVAL');
		console.log('[QueueConsumer] INCIDENT queue:', incidentResult);
		console.log('[QueueConsumer] APPROVAL queue:', approvalResult);
		process.exit(0);
	}

	if (opts.start) {
		console.log('[QueueConsumer] Starting continuous polling...');
		console.log('[QueueConsumer] Press Ctrl+C to stop');
		consumer.start();

		process.on('SIGINT', () => {
			console.log('\n[QueueConsumer] Stopping...');
			consumer.stop();
			process.exit(0);
		});

		process.on('SIGTERM', () => {
			consumer.stop();
			process.exit(0);
		});

		return;
	}

	printHelp();
	process.exit(1);
}

main().catch(err => {
	console.error('[QueueConsumer] Error:', err.message);
	process.exit(1);
});
