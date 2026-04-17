# CRASH RECOVERY TEST PROTOCOL

**Test Type:** Crash Recovery (Layer 2)
**Purpose:** Test system's ability to recover from unexpected agent termination mid-task
**Reference:** RECOVERY_AUDIT_LOG.json → next_phase_goals → crash_recovery

---

## TEST SETUP

### Preconditions
- All lanes currently stable
- Archivist-Agent session active
- SwarmMind session terminated (from cold-start drill)
- self-organizing-library initialized

### Crash Simulation
1. Start a file write operation
2. Intentionally terminate before completion
3. Verify system detects incomplete work
4. Test recovery from last-known-state

---

## PHASE 1: Establish Baseline

### Current State Before Crash
- Lane 1 (Archivist): Active, session 1776403587854-50060
- Lane 2 (SwarmMind): Terminated, handoff created
- Lane 3 (self-organizing-library): Active, no session lock

### Create Last-Known-State Packet
This will be used for crash recovery validation.

---

## PHASE 2: Simulate Crash

### Method
Write a file that indicates "work in progress" then simulate crash by not completing the full workflow.

### Expected System Response
1. New agent detects incomplete state
2. Reads last-known-state
3. Attempts recovery
4. Verifies no corruption

---

## PHASE 3: Recovery Validation

### Success Criteria
- Crash detected through protocol rules
- Recovery attempted without user input
- State restored from persisted artifacts
- No data corruption

---

## PHASE 4: Results

To be filled during test execution.
