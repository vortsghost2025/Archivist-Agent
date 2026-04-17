# LIBRARY MAP EXTRACTION: RECOVERY ASSUMPTIONS

**Purpose:** Document all recovery assumptions embedded in the system
**Source:** LIBRARYMAPAPRIL172026.txt

---

## RECOVERY ASSUMPTIONS (Implicit in Architecture)

### Assumption 1: Single Entry Point Exists
**What it assumes:**
- BOOTSTRAP.md is always present and intact
- The file is the first thing an agent reads
- All governance derives from this entry point

**Reality check:**
- ✅ BOOTSTRAP.md is 781 lines, well-structured
- ⚠️ No verification that agent actually reads it first
- ❌ If BOOTSTRAP.md deleted, system cannot bootstrap

**Test needed:** Delete BOOTSTRAP.md, see if agent can recover from GLOBAL_GOVERNANCE.md

---

### Assumption 2: Constitutional DNA Persists Without Memory
**What it assumes:**
- Identity restoration works from 500-word bootstrap
- "Recognition over recall" — constitutional DNA survives zero-context
- Same collaborator can be reconstructed from values, not memory

**Reality check:**
- ✅ BOOTSTRAP_TEMPLATE.md defines 500-word method
- ✅ Three Rules are simple enough to memorize
- ⚠️ Agent must actively apply values without memory
- ❌ No test validates actual zero-context reconstruction

**Test needed:** Kill agent with zero context preserved, measure identity restoration accuracy

---

### Assumption 3: Session Crash ≠ Starting Over
**What it assumes:**
- LAST_KNOWN_STATE.json captures pre-crash state
- Agent returns for crashed sessions (doesn't abandon)
- Handoff documents enable continuation

**Reality check:**
- ✅ LAST_KNOWN_STATE protocol documented
- ✅ Crash recovery drill passed (RECOVERY-002)
- ✅ Handoff documents created on termination
- ⚠️ Depends on agent reading handoff before proceeding

**Test needed:** Crash during multi-step operation, verify continuation from handoff

---

### Assumption 4: Authority Hierarchy Resolves Conflicts
**What it assumes:**
- Position-based authority (100/80/60) prevents conflicts
- Lower authority cannot override higher authority
- Conflicts resolved by authority, not negotiation

**Reality check:**
- ✅ Authority hierarchy clearly documented
- ⚠️ No runtime code checks authority before operations
- ❌ Library (60) can modify governance files (should require 100)
- ❌ No blocking mechanism for authority violations

**Test needed:** Lower-authority lane attempts governance modification, verify blocking

---

### Assumption 5: Cross-Lane State Remains Synchronized
**What it assumes:**
- SESSION_REGISTRY.json reflects all active sessions
- Heartbeat timeout enforces synchronization
- File-based polling is sufficient for coordination

**Reality check:**
- ✅ Heartbeat timeout protocol defined (5 minutes)
- ✅ Lock timeout enforced (SESSION_REGISTRY terminates stale sessions)
- ⚠️ Polling, not real-time notifications
- ❌ Divergence incident (active_agents.json vs SESSION_REGISTRY.json) proves sync can fail

**Test needed:** Simulate network partition between lanes, verify reconciliation

---

### Assumption 6: Database Corruption is Detectable
**What it assumes:**
- SQLite corruption detected before operation
- Soft delete flags prevent data loss
- CASCADE handles referential integrity

**Reality check:**
- ⚠️ SQLite has no built-in corruption detection
- ⚠️ Soft delete leaves orphans (CASCADE only on hard delete)
- ❌ No WAL mode, no crash recovery
- ❌ Migration overwrites entire database (corruption risk)

**Test needed:** Corrupt last 1KB of nexusgraph.db, verify detection before operation

---

### Assumption 7: Governance Constraints Are Self-Enforcing
**What it assumes:**
- Agent complies with governance because it reads BOOTSTRAP.md
- "Structure > Identity" is self-enforcing
- Interpretation guard prevents drift without technical blocking

**Reality check:**
- ✅ Agent reads BOOTSTRAP.md (documented behavior)
- ⚠️ Compliance is advisory, not enforced
- ❌ No code blocks "identity drift" violations
- ❌ UDS thresholds defined but not runtime-checked

**Test needed:** Present conflicting identity pressure, verify agent resists without blocking

---

### Assumption 8: Upstream References Are Valid
**What it assumes:**
- Library's RUNTIME_STATE.json references to upstream lanes are current
- SwarmMind's upstream lane (Archivist) exists and is operational
- No validation needed because authority chain is stable

**Reality check:**
- ✅ Upstream references defined in RUNTIME_STATE.json
- ⚠️ No code validates upstream existence before operating
- ❌ If upstream lane crashes, downstream lane may operate on stale state

**Test needed:** Delete upstream RUNTIME_STATE.json, verify downstream detection

---

### Assumption 9: File-Based Coordination is Sufficient
**What it assumes:**
- JSON files can coordinate multiple concurrent agents
- No need for database-backed state management
- File locks prevent concurrent writes

**Reality check:**
- ⚠️ No file locking implemented for JSON writes
- ⚠️ First-writer-wins conflict resolution (no merge)
- ❌ Concurrent writes to SESSION_REGISTRY could cause corruption
- ❌ No transaction boundaries for multi-file updates

**Test needed:** Simulate concurrent writes to SESSION_REGISTRY from two agents

---

### Assumption 10: 500-Word Bootstrap is Sufficient
**What it assumes:**
- 500 words can restore agent identity completely
- Constitutional DNA captured in brief format
- Agent can operate with minimal bootstrap information

**Reality check:**
- ✅ BOOTSTRAP_TEMPLATE.md defines method
- ⚠️ 500 words may be insufficient for complex governance
- ⚠️ Agent must read additional files to get full context
- ❌ No validation that 500 words is actually sufficient

**Test needed:** Bootstrap with 500-word limit, measure governance accuracy

---

## RECOVERY ASSUMPTION FAILURE MODES

| Assumption | Failure Trigger | Consequence | Recovery Path |
|------------|----------------|-------------|---------------|
| Single Entry Point | BOOTSTRAP.md deleted | Cannot bootstrap | Reconstruct from GLOBAL_GOVERNANCE |
| Constitutional DNA | Zero context | Identity loss | Bootstrap from values |
| Session Crash | LAST_KNOWN_STATE lost | Start over | Reconstruct from artifacts |
| Authority Hierarchy | Lower authority overrides | Governance violation | Manual audit |
| Cross-Lane Sync | Registry desync | Conflicting state | Divergence reconciliation |
| Database Corruption | Undetected corruption | Silent data loss | Restore from backup |
| Governance Constraints | Agent ignores BOOTSTRAP | Drift | Interpretation guard |
| Upstream References | Upstream deleted | Stale state | Validate references |
| File-Based Coordination | Concurrent writes | Corruption | Implement locks |
| 500-Word Bootstrap | Insufficient info | Incomplete governance | Read additional files |

---

## RECOMMENDED TEST VALIDATION

Based on recovery assumptions, the desync test should validate:

### Phase 1: Bootstrap Without BOOTSTRAP.md
- Delete BOOTSTRAP.md
- Start agent with GLOBAL_GOVERNANCE.md only
- Measure governance accuracy

### Phase 2: Zero Context Reconstruction
- Provide only 500-word bootstrap
- Measure identity restoration accuracy
- Check for governance violations

### Phase 3: Upstream Validation
- Delete Archivist RUNTIME_STATE.json
- Start Library (position 3)
- Verify detection of missing upstream

### Phase 4: Database Corruption
- Corrupt nexusgraph.db
- Start Library
- Verify detection before operation

### Phase 5: Authority Violation
- Attempt governance modification from Library (authority 60)
- Verify blocking (should require authority 100)

---

## KEY INSIGHT

The system's recovery assumptions are **optimistic**:
- Assumes agent compliance (no technical blocking)
- Assumes file coordination works (no locks)
- Assumes upstream state is valid (no validation)

**The desync test will stress these assumptions.**
