// PRE-COMPACTION VALIDATION BUFFER
// Flow: message → validate → quarantine (if invalid) → analyze → THEN compact
// NOT: message → validate → expire (which causes re-expiry loop)

// PURPOSE:
// Prevents the C1 (re-expiry loop) failure mode by making quarantine the
// permanent destination for invalid messages instead of expired/.

// DIRECTORY STRUCTURE:
// inbox/
// ├── inbox/          ← live messages to process
// ├── processed/      ← successfully processed
// ├── expired/        ← TEMPORARY (messages that may be retried)
// ├── quarantine/    ← PERMANENT (messages that failed validation permanently)
// └── quarantine/archive/ ← quarantined messages analyzed and archived

// QUARANTINE CRITERIA:
// A message goes to quarantine/ if ANY of:
// 1. No signature (empty signature field)
// 2. key_id does not match trust store
// 3. Schema version not in allowed enum
// 4. type field not in allowed enum
// 5. schema_validation errors on 3+ consecutive attempts
// 6. Message was in expired/ for >24h without being processed

// MESSAGE LIFECYCLE:
// NEW → inbox/ → validate → PROCESS (if valid) → processed/
// NEW → inbox/ → validate → QUARANTINE (if invalid, permanent failure)
// NEW → inbox/ → validate → EXPIRED (if transient failure, retry in 24h)
// QUARANTINE → analyze → ARCHIVE (after analysis, logged)

// LOG FORMAT (logs/quarantine.log):
// {
//   "timestamp": "ISO8601",
//   "lane": "archivist|swarmmind|kernel|library",
//   "file": "filename.json",
//   "reason": "UNSIGNED|KEY_MISMATCH|SCHEMA_VERSION|SCHEMA_TYPE|RETRY_LIMIT|EXPIRED_TTL",
//   "errors": ["error1", "error2"],
//   "action": "quarantine",
//   "requires_review": true|false
// }

// ARCHIVE SUBDIRECTORY:
// quarantine/archive/YYYY-MM/ — organized by month
// Files in archive/ are gzip compressed

// REVIEW SCHEDULE:
// - Daily: Daemon or operator reviews quarantine/ for critical failures
// - Weekly: Full quarantine analysis pass
// - Monthly: Quarantine archive compression pass
