/**
 * Quick integration test for createSignedMessage
 */
const { createSignedMessage } = require('./create-signed-message.js');
const msg = {
  schema_version: '1.3',
  task_id: 'test-123',
  from: 'swarmmind',
  to: 'archivist',
  type: 'test',
  body: 'test',
  timestamp: new Date().toISOString()
};
try {
  const signed = createSignedMessage(msg, 'swarmmind');
  if (!signed.signature || !signed.key_id) throw new Error('Missing signature/key_id');
  console.log('PASS: signature present key_id=' + signed.key_id);
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
