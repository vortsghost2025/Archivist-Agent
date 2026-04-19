/**
 * QueueConsumer.test.js - Tests for Archivist Queue Consumer
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { QueueConsumer, SEVERITY_LEVELS, INCIDENT_CLASSIFICATIONS } = require('./QueueConsumer');

const TEST_QUEUE_DIR = path.join(__dirname, '.test-queue');

function setupTestQueue() {
	if (fs.existsSync(TEST_QUEUE_DIR)) {
		fs.rmSync(TEST_QUEUE_DIR, { recursive: true });
	}
	fs.mkdirSync(TEST_QUEUE_DIR, { recursive: true });
}

function teardownTestQueue() {
	if (fs.existsSync(TEST_QUEUE_DIR)) {
		fs.rmSync(TEST_QUEUE_DIR, { recursive: true });
	}
}

function createTestIncident(overrides = {}) {
	return {
		id: `TEST-${Date.now()}`,
		timestamp: new Date().toISOString(),
		origin_lane: 'swarmmind',
		target_lane: 'archivist',
		type: 'incident_report',
		status: 'pending',
		resolution: null,
		payload: {
			classification: 'transient_error',
			lane: 'test',
			...overrides
		},
		...overrides
	};
}

function createTestApproval(overrides = {}) {
	return {
		id: `APPR-${Date.now()}`,
		timestamp: new Date().toISOString(),
		origin_lane: 'library',
		target_lane: 'archivist',
		type: 'approval_request',
		status: 'pending',
		resolution: null,
		payload: {
			approval_type: 'read_only',
			...overrides
		},
		...overrides
	};
}

console.log('=== QueueConsumer Tests ===\n');

try {
	console.log('Test 1: Classify incident by severity');
	setupTestQueue();
	const consumer = new QueueConsumer({ queueDir: TEST_QUEUE_DIR });
	const incident = createTestIncident();
	const classified = consumer.classifyIncident(incident);
	assert.strictEqual(classified.severity, 'P3', 'Default incident should be P3');
	assert.strictEqual(classified.recommendedAction, 'auto_resolve', 'Default should auto-resolve');
	console.log('  ✓ Incident classified correctly\n');

	console.log('Test 2: Classify lane_degradation as P0');
	const degradation = createTestIncident({ payload: { classification: 'lane_degradation' } });
	const degClassified = consumer.classifyIncident(degradation);
	assert.strictEqual(degClassified.severity, 'P0', 'Lane degradation should be P0');
	assert.strictEqual(degClassified.recommendedAction, 'escalate', 'Should escalate');
	console.log('  ✓ Lane degradation classified as P0\n');

	console.log('Test 3: Auto-resolve P2/P3 incidents');
	const transient = createTestIncident({ payload: { classification: 'transient_error' } });
	const result = consumer.resolveIncident(transient);
	assert.strictEqual(result.status, 'accepted', 'Should be accepted');
	assert.ok(result.resolution.includes('AUTO_RESOLVED'), 'Should have auto-resolve resolution');
	console.log('  ✓ P3 incident auto-resolved\n');

	console.log('Test 4: Escalate P0/P1 to operator');
	const critical = createTestIncident({ payload: { classification: 'lane_degradation' } });
	const criticalResult = consumer.resolveIncident(critical);
	assert.strictEqual(criticalResult.status, 'pending', 'Should remain pending');
	assert.strictEqual(criticalResult.resolution, 'OPERATOR_REVIEW_REQUIRED', 'Should require operator');
	assert.strictEqual(criticalResult.requiresAttention, true, 'Should flag attention');
	console.log('  ✓ P0 incident escalated to operator\n');

	console.log('Test 5: Process queue items');
	const incident1 = createTestIncident({ payload: { classification: 'persistent_dependency' } });
	const incident2 = createTestIncident({ payload: { classification: 'transient_error' } });
	fs.writeFileSync(path.join(TEST_QUEUE_DIR, 'incident.log'), JSON.stringify(incident1) + '\n' + JSON.stringify(incident2) + '\n');
	const processResult = consumer.processQueue('INCIDENT');
	assert.strictEqual(processResult.processed, 2, 'Should process 2 items');
	assert.strictEqual(processResult.escalated, 0, 'P2/P3 should not escalate');
	console.log('  ✓ Queue processed correctly\n');

	console.log('Test 6: Approval auto-approve read_only');
	const approval = createTestApproval({ payload: { approval_type: 'read_only' } });
	const approvalResult = consumer.resolveApproval(approval);
	assert.strictEqual(approvalResult.status, 'accepted', 'Should be approved');
	assert.strictEqual(approvalResult.resolution, 'AUTO_APPROVED', 'Should auto-approve');
	console.log('  ✓ Read-only approval auto-approved\n');

	console.log('Test 7: Approval require review for cross_lane_write');
	const writeApproval = createTestApproval({ payload: { approval_type: 'cross_lane_write' } });
	const writeResult = consumer.resolveApproval(writeApproval);
	assert.strictEqual(writeResult.status, 'pending', 'Should remain pending');
	assert.strictEqual(writeResult.resolution, 'OPERATOR_REVIEW_REQUIRED', 'Should require operator');
	console.log('  ✓ Cross-lane write requires operator review\n');

	console.log('Test 8: Get queue statistics');
	const statsConsumer = new QueueConsumer({ queueDir: TEST_QUEUE_DIR });
	const stats = statsConsumer.getStats();
	assert.ok(stats.incidentQueue !== undefined, 'Should have incident queue stats');
	assert.ok(stats.approvalQueue !== undefined, 'Should have approval queue stats');
	assert.strictEqual(stats.lane, 'archivist', 'Should report lane');
	assert.strictEqual(stats.authority, 100, 'Should report authority');
	console.log('  ✓ Statistics retrieved correctly\n');

	teardownTestQueue();
	console.log('=== All tests passed ===');
} catch (err) {
	teardownTestQueue();
	console.error('\n✗ Test failed:', err.message);
	console.error(err.stack);
	process.exit(1);
}
