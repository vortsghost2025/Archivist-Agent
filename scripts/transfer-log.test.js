#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const {
  logTransfer,
  logSendResult,
  queryLog,
  getStats,
  loadPolicy,
  resolveLogPath,
  hashContent,
  hashFile,
  generateTransferId,
  validateEntry,
  checkRotation,
  rotateLog,
} = require('./transfer-log');

const REPO_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(' PASS:', name);
    passed++;
  } catch (err) {
    console.error(' FAIL:', name);
    console.error(' ', err.message);
    failed++;
  }
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-log-test-'));
}

function makeValidEntry(overrides) {
  const base = {
    transfer_id: generateTransferId('archivist', 'kernel'),
    timestamp: new Date().toISOString(),
    direction: 'send',
    source_lane: 'archivist',
    dest_lane: 'kernel',
    protocol: 'local_fs',
    file_path: '/tmp/test-msg.json',
    file_hash: hashContent('test-content'),
    file_size: 12,
    status: 'verified',
    signed_by: 'archivist',
    key_id: '506c2d0838b6862c',
  };
  if (overrides) Object.assign(base, overrides);
  return base;
}

console.log('TRANSFER-LOG UNIT TESTS');
console.log('======================');

test('loadPolicy returns DEFAULT_POLICY when file missing', () => {
  const p = loadPolicy('/nonexistent/path/policy.json');
  assert.strictEqual(p.max_file_bytes, 10485760);
  assert.strictEqual(p.rotation_count, 5);
  assert.ok(p.fields);
  assert.ok(p.fields.required);
  assert.ok(p.fields.required.length > 0);
});

test('loadPolicy loads from config/transfer-log-policy.json', () => {
  const p = loadPolicy(path.join(REPO_ROOT, 'config', 'transfer-log-policy.json'));
  assert.strictEqual(p.max_file_bytes, 10485760);
  assert.ok(p.direction_enum);
  assert.ok(p.status_enum);
  assert.ok(p.protocol_enum);
});

test('resolveLogPath returns absolute path', () => {
  const p = loadPolicy();
  const lp = resolveLogPath(p);
  assert.ok(path.isAbsolute(lp));
  assert.ok(lp.endsWith('transfer-log.jsonl'));
});

test('hashContent produces consistent sha256', () => {
  const h1 = hashContent('hello');
  const h2 = hashContent('hello');
  assert.strictEqual(h1, h2);
  assert.strictEqual(h1.length, 64);
});

test('hashContent supports different algorithms', () => {
  const h = hashContent('hello', 'sha1');
  assert.strictEqual(h.length, 40);
});

test('hashFile returns empty string for missing file', () => {
  const h = hashFile('/nonexistent/file.txt');
  assert.strictEqual(h, '');
});

test('hashFile hashes existing file', () => {
  const tmpDir = makeTmpDir();
  const tmpFile = path.join(tmpDir, 'test.txt');
  fs.writeFileSync(tmpFile, 'hello');
  const h = hashFile(tmpFile);
  assert.strictEqual(h, hashContent('hello'));
  fs.rmSync(tmpDir, { recursive: true });
});

test('generateTransferId produces correct format', () => {
  const id = generateTransferId('archivist', 'kernel');
  assert.ok(id.startsWith('xfr-archivist-kernel-'));
  const parts = id.split('-');
  assert.ok(parts.length >= 5);
});

test('validateEntry accepts valid entry', () => {
  const entry = makeValidEntry();
  const policy = loadPolicy();
  const result = validateEntry(entry, policy);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('validateEntry rejects missing required fields', () => {
  const entry = { direction: 'send' };
  const policy = loadPolicy();
  const result = validateEntry(entry, policy);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].includes('Missing required field'));
});

test('validateEntry rejects invalid direction enum', () => {
  const entry = makeValidEntry({ direction: 'invalid_dir' });
  const policy = loadPolicy();
  const result = validateEntry(entry, policy);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Invalid direction')));
});

test('validateEntry rejects invalid status enum', () => {
  const entry = makeValidEntry({ status: 'unknown_status' });
  const policy = loadPolicy();
  const result = validateEntry(entry, policy);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Invalid status')));
});

test('validateEntry rejects invalid protocol enum', () => {
  const entry = makeValidEntry({ protocol: 'ftp' });
  const policy = loadPolicy();
  const result = validateEntry(entry, policy);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Invalid protocol')));
});

test('logTransfer writes valid entry to JSONL', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const entry = makeValidEntry();
  const result = logTransfer(entry, { logPath });
  assert.strictEqual(result.logged, true);
  assert.ok(result.transfer_id);

  const content = fs.readFileSync(logPath, 'utf8').trim();
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.transfer_id, entry.transfer_id);
  assert.strictEqual(parsed.direction, 'send');
  fs.rmSync(tmpDir, { recursive: true });
});

test('logTransfer from details object auto-generates fields', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const result = logTransfer({
    source_lane: 'library',
    dest_lane: 'archivist',
    direction: 'receive',
    protocol: 'local_fs',
    file_path: '',
    status: 'verified',
    signed_by: 'library',
    key_id: '2eec06be0befc8d5',
    correlation_id: 'task-123',
  }, { logPath });
  assert.strictEqual(result.logged, true);
  assert.ok(result.entry.transfer_id.startsWith('xfr-library-archivist-'));
  assert.strictEqual(result.entry.correlation_id, 'task-123');

  const content = fs.readFileSync(logPath, 'utf8').trim();
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.correlation_id, 'task-123');
  fs.rmSync(tmpDir, { recursive: true });
});

test('logTransfer rejects invalid entry', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const result = logTransfer({ direction: 'bad_enum' }, { logPath });
  assert.strictEqual(result.logged, false);
  assert.ok(result.errors.length > 0);
  fs.rmSync(tmpDir, { recursive: true });
});

test('logTransfer dry-run does not write', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const entry = makeValidEntry();
  const result = logTransfer(entry, { logPath, dryRun: true });
  assert.strictEqual(result.logged, false);
  assert.strictEqual(result.dryRun, true);
  assert.ok(result.line);
  assert.ok(!fs.existsSync(logPath));
  fs.rmSync(tmpDir, { recursive: true });
});

test('logTransfer creates log directory if missing', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'subdir', 'test-log.jsonl');
  const entry = makeValidEntry();
  const result = logTransfer(entry, { logPath });
  assert.strictEqual(result.logged, true);
  assert.ok(fs.existsSync(logPath));
  fs.rmSync(tmpDir, { recursive: true });
});

test('logSendResult creates send entry from result object', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const sendResult = { sent: true, delivered: true, errors: [], task_id: 'task-001' };
  const msg = { from: 'archivist', to: 'kernel', key_id: '506c2d0838b6862c', task_id: 'task-001' };
  const result = logSendResult(sendResult, msg, { logPath });
  assert.strictEqual(result.logged, true);
  assert.strictEqual(result.entry.direction, 'send');
  assert.strictEqual(result.entry.status, 'verified');
  assert.strictEqual(result.entry.source_lane, 'archivist');
  assert.strictEqual(result.entry.dest_lane, 'kernel');
  assert.strictEqual(result.entry.correlation_id, 'task-001');

  const content = fs.readFileSync(logPath, 'utf8').trim();
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.status, 'verified');
  fs.rmSync(tmpDir, { recursive: true });
});

test('logSendResult maps sent-but-not-delivered to status=success', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const sendResult = { sent: true, delivered: false, errors: [], task_id: 'task-002' };
  const msg = { from: 'archivist', to: 'library', key_id: '506c2d0838b6862c', task_id: 'task-002' };
  const result = logSendResult(sendResult, msg, { logPath });
  assert.strictEqual(result.entry.status, 'success');
  fs.rmSync(tmpDir, { recursive: true });
});

test('logSendResult maps not-sent to status=failed', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const sendResult = { sent: false, delivered: false, errors: ['Write failed'], task_id: 'task-003' };
  const msg = { from: 'archivist', to: 'swarmmind', key_id: '506c2d0838b6862c', task_id: 'task-003' };
  const result = logSendResult(sendResult, msg, { logPath });
  assert.strictEqual(result.entry.status, 'failed');
  assert.strictEqual(result.entry.error, 'Write failed');
  fs.rmSync(tmpDir, { recursive: true });
});

test('queryLog returns empty for missing file', () => {
  const result = queryLog({ logPath: '/nonexistent/log.jsonl' });
  assert.strictEqual(result.entries.length, 0);
  assert.strictEqual(result.total, 0);
});

test('queryLog filters by source_lane', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  logTransfer(makeValidEntry({ source_lane: 'archivist', dest_lane: 'kernel' }), { logPath });
  logTransfer(makeValidEntry({ source_lane: 'library', dest_lane: 'archivist' }), { logPath });

  const result = queryLog({ logPath, filter: { source_lane: 'archivist' } });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.entries[0].source_lane, 'archivist');
  fs.rmSync(tmpDir, { recursive: true });
});

test('queryLog filters by status', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  logTransfer(makeValidEntry({ status: 'verified' }), { logPath });
  logTransfer(makeValidEntry({ status: 'failed' }), { logPath });

  const result = queryLog({ logPath, filter: { status: 'failed' } });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.entries[0].status, 'failed');
  fs.rmSync(tmpDir, { recursive: true });
});

test('queryLog filters by correlation_id', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  logTransfer(makeValidEntry({ correlation_id: 'task-AAA' }), { logPath });
  logTransfer(makeValidEntry({ correlation_id: 'task-BBB' }), { logPath });

  const result = queryLog({ logPath, filter: { correlation_id: 'task-BBB' } });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.entries[0].correlation_id, 'task-BBB');
  fs.rmSync(tmpDir, { recursive: true });
});

test('queryLog respects limit', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  for (let i = 0; i < 10; i++) {
    logTransfer(makeValidEntry({ correlation_id: `batch-${i}` }), { logPath });
  }
  const result = queryLog({ logPath, limit: 3 });
  assert.strictEqual(result.total, 10);
  assert.strictEqual(result.entries.length, 3);
  fs.rmSync(tmpDir, { recursive: true });
});

test('getStats aggregates by status and lane', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  logTransfer(makeValidEntry({ source_lane: 'archivist', dest_lane: 'kernel', status: 'verified' }), { logPath });
  logTransfer(makeValidEntry({ source_lane: 'library', dest_lane: 'archivist', status: 'failed' }), { logPath });
  logTransfer(makeValidEntry({ source_lane: 'archivist', dest_lane: 'library', status: 'verified' }), { logPath });

  const stats = getStats({ logPath });
  assert.strictEqual(stats.total_transfers, 3);
  assert.strictEqual(stats.by_status.verified, 2);
  assert.strictEqual(stats.by_status.failed, 1);
  assert.strictEqual(stats.by_lane['archivist->kernel'], 1);
  assert.strictEqual(stats.by_lane['library->archivist'], 1);
  assert.strictEqual(stats.verified_count, 2);
  assert.strictEqual(stats.failed_count, 1);
  fs.rmSync(tmpDir, { recursive: true });
});

test('checkRotation returns false for small files', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  fs.writeFileSync(logPath, 'small');
  const policy = loadPolicy();
  assert.strictEqual(checkRotation(logPath, policy), false);
  fs.rmSync(tmpDir, { recursive: true });
});

test('checkRotation returns true for oversized files', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const big = Buffer.alloc(10485760 + 1, 'x');
  fs.writeFileSync(logPath, big);
  const policy = loadPolicy();
  assert.strictEqual(checkRotation(logPath, policy), true);
  fs.rmSync(tmpDir, { recursive: true });
});

test('rotateLog compresses and creates .gz rotation', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  fs.writeFileSync(logPath, JSON.stringify(makeValidEntry()) + '\n');
  const policy = loadPolicy();
  policy.rotation = { compress_rotated: true, suffix: '.gz' };

  const result = rotateLog(logPath, policy);
  assert.strictEqual(result.rotated, true);
  assert.ok(fs.existsSync(logPath + '.1.gz'));
  const stat = fs.statSync(logPath);
  assert.strictEqual(stat.size, 0);
  fs.rmSync(tmpDir, { recursive: true });
});

test('DEFAULT_POLICY.fields.required exists', () => {
  const p = loadPolicy('/nonexistent/path/policy.json');
  assert.ok(Array.isArray(p.fields.required));
  assert.ok(p.fields.required.includes('transfer_id'));
  assert.ok(p.fields.required.includes('timestamp'));
  assert.ok(p.fields.required.includes('direction'));
  assert.ok(p.fields.required.includes('source_lane'));
  assert.ok(p.fields.required.includes('dest_lane'));
  assert.ok(p.fields.required.includes('status'));
});

test('logTransfer includes optional fields when provided', () => {
  const tmpDir = makeTmpDir();
  const logPath = path.join(tmpDir, 'test-log.jsonl');
  const result = logTransfer({
    source_lane: 'archivist',
    dest_lane: 'kernel',
    direction: 'send',
    protocol: 'local_fs',
    file_path: '',
    status: 'verified',
    signed_by: 'archivist',
    key_id: '506c2d0838b6862c',
    duration_ms: 42,
    error: '',
    retry_attempt: 0,
    correlation_id: 'task-xyz',
    metadata: { context: 'test' },
  }, { logPath });
  assert.strictEqual(result.logged, true);
  assert.strictEqual(result.entry.duration_ms, 42);
  assert.strictEqual(result.entry.correlation_id, 'task-xyz');
  assert.deepStrictEqual(result.entry.metadata, { context: 'test' });
  fs.rmSync(tmpDir, { recursive: true });
});

test('logTransfer with all direction enums passes validation', () => {
  const directions = ['send', 'receive', 'scp_push', 'scp_pull', 'ssh_exec', 'smb_copy', 'local_copy'];
  const policy = loadPolicy();
  for (const d of directions) {
    const entry = makeValidEntry({ direction: d });
    const result = validateEntry(entry, policy);
    assert.strictEqual(result.valid, true, `direction=${d} should be valid`);
  }
});

test('logTransfer with all status enums passes validation', () => {
  const statuses = ['success', 'failed', 'retrying', 'aborted', 'verified'];
  const policy = loadPolicy();
  for (const s of statuses) {
    const entry = makeValidEntry({ status: s });
    const result = validateEntry(entry, policy);
    assert.strictEqual(result.valid, true, `status=${s} should be valid`);
  }
});

test('logTransfer with all protocol enums passes validation', () => {
  const protocols = ['scp', 'ssh', 'smb', 'local_fs', 'http'];
  const policy = loadPolicy();
  for (const p of protocols) {
    const entry = makeValidEntry({ protocol: p });
    const result = validateEntry(entry, policy);
    assert.strictEqual(result.valid, true, `protocol=${p} should be valid`);
  }
});

console.log('---');
console.log('Total Results:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
