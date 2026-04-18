# Pattern Decision Tree

**Purpose:** "When you see X, apply Y" - actionable lookup
**Generated:** 2026-04-18
**Audience:** Archivist (governance root, authority 100)

---

## GOVERNANCE FILE DECISIONS

### When reading BOOTSTRAP.md
```
ASK: Is this the ONLY entry point for logic?
IF YES → Symmetry preserved ✓
IF NO → Multiple entry points detected → VIOLATION (Paper 1)
```

### When reading COVENANT.md
```
ASK: Do values persist across sessions?
IF YES → Stability under transformation ✓
IF NO → Values shift → DRIFT RISK (Paper 4)
```

### When reading GOVERNANCE.md
```
ASK: Does constitutional layer constrain operational?
IF YES → Lattice propagation ✓
IF NO → Middle layer autonomy → VIOLATION (Paper 2)
```

### When reading FILE_OWNERSHIP_REGISTRY.json
```
ASK: Are lane boundaries explicit?
IF YES → Selection under constraint ✓
IF NO → Overlapping ownership → DRIFT RISK (Paper 2)
```

### When reading SESSION_REGISTRY.json
```
ASK: Is session state unified across lanes?
IF YES → Ensemble coherence ✓
IF NO → Session fragmentation → SELF-STATE ALIASING RISK (Paper 4)
```

### When reading .session-lock
```
ASK: Is timestamp recent (< 1 hour)?
IF YES → Fresh lock ✓
IF NO → Stale lock → CHECK live process state (Paper 4)
```

---

## AUTHORITY DECISIONS

### When Archivist (authority 100) makes decision
```
ASK: Does this affect SwarmMind (80) or Library (60)?
IF YES → Propagate through lane-relay
IF NO → Execute within Archivist boundary

ASK: Does this violate constitutional constraint?
IF YES → BLOCK (Constitution > Archivist)
IF NO → Execute (Archivist has authority)
```

### When SwarmMind (authority 80) requests action
```
ASK: Does SwarmMind own target file?
IF YES → Execute (within boundary)
IF NO → CHECK FILE_OWNERSHIP_REGISTRY.json

IF target owned by Archivist:
  IF SwarmMind has explicit delegation → Execute
  IF no delegation → BLOCK + QUARANTINE

IF target owned by Library:
  IF authority 80 > 60 → Execute with logging
  IF cross-lane coordination needed → Route through Archivist
```

### When Library (authority 60) requests action
```
ASK: Is this documentation/indexing?
IF YES → Execute (Library's domain)
IF NO → CHECK FILE_OWNERSHIP_REGISTRY.json

IF target owned by higher authority:
  → BLOCK (60 cannot write to 80 or 100)
  → REPORT to Archivist
```

---

## DRIFT DETECTION DECISIONS

### When CPS score is reported
```
IF score ≥ 0.80:
  → STABLE - agent at independence attractor

IF score 0.70-0.79:
  → WARNING - basin boundary approach
  → INCREASE monitoring frequency
  → CHECK for drift signals

IF score 0.60-0.69:
  → ALERT - outside stable basin
  → RUN full CPS test
  → INVESTIGATE constraint propagation

IF score < 0.60:
  → CRITICAL - catastrophic collapse imminent
  → HALT operations
  → RESTORE from last known-good
  → AUDIT lattice structure
```

### When cross-lane write detected
```
IF source lane owns target file:
  → VALID - proceed

IF source lane does NOT own target:
  → BLOCK
  → QUARANTINE attempt
  → CHECK SESSION_REGISTRY for session-state
  → VERIFY lane-context reconciliation

IF lane-context not reconciled:
  → VIOLATION of Phase 2 gate
  → REPORT to Archivist
  → DO NOT PROCEED
```

### When session-state conflict detected
```
IF multiple .session-lock files:
  → FRAGMENTATION detected

  ASK: Which has most recent timestamp?
    IF clear winner → Use that one
    IF ambiguous → CHECK live process state

  ASK: Are locks from same session ID?
    IF YES → Stale lock cleanup needed
    IF NO → COMPETING SESSIONS → HALT

IF SESSION_REGISTRY disagrees with local lock:
  → SELF-STATE ALIASING risk

  PRECEDENCE:
    1. Live runtime state (CHECK process)
    2. Fresh local lock (< 1 hour)
    3. Shared registry (advisory)
    4. Terminated history (IGNORE)
```

---

## ERROR CLASSIFICATION DECISIONS (Paper 5)

### When classifyError.js reports domain
```
IF constitution:
  → Constitutional violation
  → HALT operations
  → RESTORE from checkpoint
  → AUDIT COVENANT.md alignment

IF integrity:
  → Data integrity issue
  → QUARANTINE affected data
  → RUN SHA-256 verification
  → RESTORE from verified backup

IF contract:
  → Agreement violation
  → CHECK FILE_OWNERSHIP_REGISTRY
  → VERIFY lane boundaries
  → RESOLVE before proceeding

IF performance:
  → Non-critical degradation
  → LOG and continue
  → MONITOR for escalation

IF execution:
  → Operational failure
  → RETRY with backoff
  → IF persists → DEGRADE gracefully
```

### When decide.js recommends strategy
```
IF ABORT:
  → STOP immediately
  → REPORT to Archivist
  → NO recovery attempt

IF QUARANTINE:
  → ISOLATE affected component
  → CONTINUE with reduced scope
  → INVESTIGATE cause

IF DEGRADE:
  → REDUCE functionality
  → MAINTAIN core operations
  → LOG degradation level

IF RETRY:
  → ATTEMPT with exponential backoff
  → MAX 3 retries
  → IF fails → ESCALATE to QUARANTINE
```

---

## PHASE GATE DECISIONS (Paper 2)

### When PHASE_*.md defines gates
```
IF phase prerequisites not met:
  → BLOCK phase entry
  → COMPLETE prerequisites first
  → VERIFY with tests

IF phase constraints violated:
  → ROLLBACK to phase boundary
  → INVESTIGATE drift source
  → RE-VERIFY before proceeding

IF phase transition requested:
  → CHECK all phase gates passed
  → VERIFY CPS score stable
  → APPROVE transition
```

---

## SESSION DECISIONS (Paper 4)

### When SESSION_*.md created
```
ASK: Is session ID unified?
IF YES → Proceed with session
IF NO → COORDINATE with Archivist for unified ID

ASK: Is session continuity maintained?
IF YES → Session persists across perturbation
IF NO → DRIFT risk - run CPS test

ASK: Is session handoff complete?
IF YES → Previous session terminated cleanly
IF NO → ORPHAN SESSION risk - reconcile
```

### When session recovery needed
```
IF checkpoint exists:
  → RESTORE from checkpoint
  → VERIFY lattice structure preserved
  → RUN CPS test
  → CONTINUE session

IF no checkpoint:
  → ASSESS damage
  → REBUILD from constitutional layer
  → PROPAGATE through operational layer
  → VERIFY behavioral layer
```

---

## LANE COORDINATION DECISIONS

### When Archivist needs to coordinate with SwarmMind
```
STEP 1: UPDATE SESSION_REGISTRY.json with current state
STEP 2: PUSH to GitHub
STEP 3: SIGNAL SwarmMind to pull
STEP 4: WAIT for SwarmMind acknowledgment
STEP 5: PROCEED with coordinated action
```

### When Archivist needs to coordinate with Library
```
STEP 1: PUSH documentation updates to Library
STEP 2: WAIT for Library to index
STEP 3: VERIFY Library has current state
STEP 4: PROCEED with library-dependent actions
```

### When multi-lane action required
```
IF all lanes agree:
  → EXECUTE with full authority

IF one lane objects:
  → NEGOTIATE at constitutional level
  → RESOLVE before proceeding

IF lanes disagree fundamentally:
  → HALT
  → ESCALATE to constitutional review
  → DO NOT proceed with conflict
```

---

## REMEDIATION PROTOCOLS

### When drift detected (Paper 4.7)
```
LEVEL 1 (CPS 0.70-0.79):
  → INCREASE monitoring
  → DOCUMENT drift signals
  → NO action required yet

LEVEL 2 (CPS 0.60-0.69):
  → RUN full CPS test
  → IDENTIFY drift source
  → APPLY targeted remediation
  → VERIFY score improvement

LEVEL 3 (CPS < 0.60):
  → HALT all operations
  → LOCK session state
  → RESTORE from checkpoint
  → FULL lattice audit
  → VERIFY before resuming
```

### When lattice deformation detected (Paper 2.6)
```
1. IDENTIFY weakened constraint
2. TRACE propagation path
3. STRENGTHEN at constitutional level if needed
4. VERIFY propagation restored
5. MONITOR for recurrence
```

---

## QUICK REFERENCE: PAPER CITATIONS

| Decision Type | Primary Paper | Secondary Paper |
|---------------|---------------|-----------------|
| Entry point logic | Paper 1 | Paper 5 |
| Lane boundaries | Paper 2 | Paper 4 |
| Session state | Paper 4 | Paper 2 |
| Error handling | Paper 5 | Paper 3 |
| Drift detection | Paper 4 | Paper 3 |
| CPS scoring | Paper 3 | Paper 4 |
| Constraint propagation | Paper 2 | Paper 1 |
| Phase gates | Paper 2 | Paper 5 |
| Recovery | Paper 4 | Paper 5 |
| Authority hierarchy | Paper 1 | Paper 2 |

---

## EMERGENCY PROTOCOLS

### If system shows catastrophic drift
```
1. HALT: Stop all agent operations
2. LOCK: Preserve current session state
3. AUDIT: Check constitutional layer integrity
4. RESTORE: From last known-good checkpoint
5. VERIFY: CPS score returns to ≥ 0.80
6. RESUME: With increased monitoring
```

### If cross-lane conflict escalates
```
1. QUARANTINE: Isolate conflicting components
2. ESCALATE: To constitutional review
3. MEDIATE: At Archivist level (authority 100)
4. RESOLVE: Before any operations resume
5. DOCUMENT: For future prevention
```

---

**This decision tree operationalizes the theory. When in doubt, default to constitutional layer constraints.**
