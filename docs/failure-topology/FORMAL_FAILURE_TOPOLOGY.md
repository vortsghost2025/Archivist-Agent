# FAILURE TOPOLOGY DIAGRAM
# Classification of all break types across lanes, with traceability

## Purpose

Map every failure mode in the system as a classified, traceable entity.
Each break type gets: id, classification, lane(s) affected, trigger condition,
observable symptom, recovery path, and whether it is ACT-breaking.

---

## CLASSIFICATION TAXONOMY

### Class A — Schema Integrity Failures (COMPROMISE ACT DIRECTLY)

A1: Schema Version Drift
  - ID: A1
  - Classification: SCHEMA_INTEGRITY / VERSION_MISMATCH
  - Lane(s): library ↔ archivist
  - Trigger: Library validates v1.0, Archivist sends v1.2 or v1.3
  - Symptom: Messages moved to expired/, cycle stalls
  - Evidence: expired/2026-04-21T19-48-03Z_swarmmind_trust-verified-004.json
  - Recovery: Unified schema version (v1.3 now enforced in Archivist)
  - ACT-breaking: YES

A2: Dual Truth — JSON Schema vs Runtime Validator
  - ID: A2
  - Classification: SCHEMA_INTEGRITY / DUAL_AUTHORITY
  - Lane(s): ALL (archivist, library, swarmmind, kernel)
  - Trigger: Schema file says one thing, validator enforces another
  - Symptom: Messages pass JSON Schema validation but fail runtime validation
  - Evidence: schemas/inbox-message-v1.json says schema_version: 1.3,
    SchemaValidator.js previously allowed only 1.0/1.1
  - Recovery: Single canonical authority — JSON Schema file (recommended)
  - ACT-breaking: YES (if inconsistent)

A3: Type Enum Gap
  - ID: A3
  - Classification: SCHEMA_INTEGRITY / FIELD_MISMATCH
  - Lane(s): archivist ↔ library
  - Trigger: Message type kernel_release_broadcast not in type enum
  - Symptom: kernel_release_v0.1.0.json moved to expired/
  - Evidence: lanes/archivist/inbox/expired/kernel_release_v0.1.0.json
  - Recovery: Extend type enum or use type:alert for broadcasts
  - ACT-breaking: NO (informational message)

A4: task_kind Required for All Message Types
  - ID: A4
  - Classification: SCHEMA_INTEGRITY / CONDITIONAL_REQUIRED
  - Lane(s): archivist ↔ library
  - Trigger: task_kind required for ack/alert/heartbeat messages
  - Symptom: ack/alert messages with no task_kind moved to expired/
  - Evidence: SchemaValidator required task_kind for all types
  - Recovery: task_kind made optional for non-task types (v1.3 update)
  - ACT-breaking: YES (breaks acknowledgment flow)

A5: Idempotency Key Pattern Strict Enforcement
  - ID: A5
  - Classification: SCHEMA_INTEGRITY / FIELD_VALIDATION
  - Lane(s): archivist ↔ library
  - Trigger: idempotency_key must be 64-char hex SHA-256
  - Symptom: Messages with descriptive idempotency keys rejected
  - Evidence: Library messages with swarmmind-trust-verification rejected
  - Recovery: Relaxed to any non-empty string (v1.3)
  - ACT-breaking: YES (breaks deduplication)

---

### Class B — Identity Integrity Failures (INVALIDATES TRUST MODEL)

B1: SwarmMind Missing .identity/ Directory
  - ID: B1
  - Classification: IDENTITY_INTEGRITY / MISSING_DIRECTORY
  - Lane(s): swarmmind
  - Trigger: S:/SwarmMind Self-Optimizing Multi-Agent AI System/.identity/ does not exist
  - Symptom: SwarmMind cannot sign or verify messages. Trust store entry orphaned.
  - Evidence: key_id 72bd1d099a7490ab in trust store, no .identity/ directory
  - Recovery: Operator must create .identity/ directory with RSA-2048 keys
  - ACT-breaking: YES — trust model fundamentally invalid
  - Status: SYSTEM INTEGRITY VIOLATION (non-negotiable)

B2: Archivist Key ID Inconsistency
  - ID: B2
  - Classification: IDENTITY_INTEGRITY / KEY_ID_MISMATCH
  - Lane(s): archivist
  - Trigger: Multiple key_ids for Archivist across different stores:
    - d5faddfa2ab2ff3f (snapshot.json JWS)
    - 583b2c36f397ef01 (broadcast trust-store.json)
  - Symptom: Cross-lane verification fails for Archivist messages
  - Evidence: swarmmind key-reconciliation messages flag this
  - Recovery: Rotate to single key, re-sign snapshot, update trust store
  - ACT-breaking: YES (cross-lane trust verification broken)

B3: Outbox Signing Compliance Low
  - ID: B3
  - Classification: IDENTITY_INTEGRITY / UNSIGNED_MESSAGES
  - Lane(s): library (4.8% compliance), kernel (14.3% compliance)
  - Trigger: Outbox messages written without signature and key_id
  - Symptom: Messages moved to quarantine by outbox-write-guard
  - Evidence: 20/21 library outbox files unsigned, 6/7 kernel outbox files unsigned
  - Recovery: Sign all outbox messages before delivery (outbox-write-guard now enforces)
  - ACT-breaking: YES (messages rejected at delivery)

---

### Class C — Process/Workflow Failures (STALL CYCLE PROPAGATION)

C1: Expired Message Re-Expiry Loop
  - ID: C1
  - Classification: PROCESS / RE_EXPIRY_LOOP
  - Lane(s): archivist (watcher)
  - Trigger: Messages moved to expired/ re-appear because watcher keeps failing
  - Symptom: System crashes — repeated processing of same expired messages
  - Evidence: User reports crashed and had to reopen app
  - Recovery: Move permanently failing messages to quarantine/ (not expired/)
  - ACT-breaking: YES (daemon crashes)

C2: Inbox Watcher Files Without Acting
  - ID: C2
  - Classification: PROCESS / PASSIVE_PROCESSING
  - Lane(s): ALL (watchers)
  - Trigger: Watcher validates and files messages but does NOT invoke sessions
  - Symptom: ACT messages sit in processed/ without triggering daemon
  - Evidence: Inbox watcher just moves messages, daemon must scan processed/
  - Recovery: Daemon scans processed/ + expired/ + quarantine/ for ACT messages
  - ACT-breaking: YES (cycle stalls, daemon never fires)

C3: Orphaned Messages in Inboxes
  - ID: C3
  - Classification: PROCESS / ORPHANED_MESSAGES
  - Lane(s): ALL
  - Trigger: Messages delivered but never consumed by any lane
  - Symptom: Inboxes grow with unread messages
  - Evidence: Multiple lanes have messages that expire without action
  - Recovery: Daemon must track message consumption per lane
  - ACT-breaking: YES (wasted processing)

C4: Stalled Cycle Detection Missing
  - ID: C4
  - Classification: PROCESS / STALLED_CYCLE
  - Lane(s): ALL
  - Trigger: No lane responds for N rounds
  - Symptom: ACT cycle dies silently
  - Evidence: No detection mechanism in daemon
  - Recovery: Daemon tracks round counter, alerts if >2 rounds with no response
  - ACT-breaking: YES (silent failure)

C5: Daemon Dry-Run Only
  - ID: C5
  - Classification: PROCESS / DAEMON_NOT_ACTIVE
  - Lane(s): ALL (daemon)
  - Trigger: Daemon only tested in dry-run mode
  - Symptom: ACT cycle never runs for real
  - Evidence: npm run act:daemon:dry tested, npm run act:daemon not run
  - Recovery: Run daemon in active mode with timeout and monitoring
  - ACT-breaking: YES (daemon is a no-op)

---

### Class D �� Compaction Failures (LOSES INFORMATION)

D1: Silent Message Discard
  - ID: D1
  - Classification: COMPACTION / SILENT_DISCARD
  - Lane(s): ALL (watchers)
  - Trigger: Invalid messages silently moved to expired/ without logging
  - Symptom: Failure topology incomplete — gaps in traceability
  - Evidence: No compaction audit log
  - Recovery: Pre-compaction validation buffer: quarantine → analyze → THEN compact
  - ACT-breaking: NO (but system intelligence degraded)

D2: Quarantine Not Analyzed
  - ID: D2
  - Classification: COMPACTION / QUARANTINE_NOT_ANALYZED
  - Lane(s): archivist
  - Trigger: Quarantine folder grows but no one reviews it
  - Symptom: 5 messages in quarantine/ — unknown if critical or informational
  - Evidence: lanes/archivist/inbox/quarantine/ has 5 files
  - Recovery: Daemon or operator reviews quarantine folder weekly
  - ACT-breaking: NO (but failure blind spots)

D3: Compaction Scope as Cleanup
  - ID: D3
  - Classification: COMPACTION / SCOPE_CONFUSION
  - Lane(s): ALL
  - Trigger: Compaction treated as garbage collection instead of analysis
  - Symptom: Invalid messages deleted instead of analyzed
  - Evidence: No compaction audit layer
  - Recovery: Freeze compaction scope, log everything, add audit layer
  - ACT-breaking: NO (but integrity risk)

---

### Class E — Daemon Failures (BREAKS CONTINUITY ENGINE)

E1: Daemon Crashes on Bad Invocation
  - ID: E1
  - Classification: DAEMON / CRASH
  - Lane(s): ALL (daemon)
  - Trigger: Daemon invokes session on malformed ACT message
  - Symptom: System crashes, user reports reopen
  - Evidence: User reports crashes during ACT processing
  - Recovery: Daemon must validate messages before invoking sessions
  - ACT-breaking: YES (crashes system)

E2: Daemon Doesnt Escalate Schema Mismatches
  - ID: E2
  - Classification: DAEMON / NO_ESCALATION
  - Lane(s): daemon
  - Trigger: Schema mismatch detected but no escalation
  - Symptom: Cycle continues with broken messages
  - Evidence: No escalation mechanism in daemon
  - Recovery: Daemon escalates A-class failures to operator inbox
  - ACT-breaking: YES (silent corruption)

---

## FAILURE PROPAGATION CHAIN

B1 (SwarmMind missing .identity/)
  → B3 (Low signing compliance)
    → A1 (Schema version drift amplified)
      → C5 (Daemon never activated — cycle dies)
        → D1 (Silent discard of ACT messages)
          → C1 (Re-expiry loop → crash)

B2 (Archivist key inconsistency)
  → A2 (Dual truth — validator vs schema file)
    → A4 (task_kind required for all types)
      → A1 (Schema drift)
        → C2 (Watcher files without acting)
          → C3 (Orphaned messages)
            → D2 (Quarantine not analyzed)

---

## RECOVERY PRIORITY MATRIX

| Priority | ID | Failure | Fix Owner |
|----------|----|---------|----------|
| P0 | B1 | SwarmMind missing .identity/ | OPERATOR |
| P0 | B2 | Archivist key inconsistency | OPERATOR |
| P1 | C5 | Daemon dry-run only | daemon author |
| P1 | A1 | Schema version drift | schema owner |
| P1 | A2 | Dual truth | schema owner |
| P2 | C1 | Re-expiry loop → crash | archivist watcher |
| P2 | C2 | Watcher passive | all watchers |
| P2 | C4 | Stalled cycle detection | daemon author |
| P3 | D1 | Silent discard | archivist compaction |
| P3 | D2 | Quarantine not analyzed | operator |
| P3 | D3 | Compaction scope confusion | archivist compaction |

## SINGLE-LINEAR BLOCKER

B1 is the single active blocker.
Until SwarmMind .identity/ is created:
- Trust model is invalid
- ACT results are skewed
- All B-class failures remain unfixable

---

## FORMAL DEFINITION

This diagram is a CLASSIFIED FAILURE TOPOLOGY.
Each failure has: ID, class, lane, trigger, symptom, evidence, recovery, and ACT-breaking status.
This is the map of exactly where the system cannot keep itself running.

When all A-class failures are resolved: schema is unified.
When all B-class failures are resolved: identity is pari.
When all C-class failures are resolved: daemon becomes a continuity engine.
When all D-class failures are resolved: compaction becomes stable.

At that point: ACT becomes a self-sustaining constraint propagation network.
