# Archivist Quick Reference

**Purpose:** Daily governance operations without paper ingestion
**Generated:** 2026-04-18
**Audience:** Archivist (authority 100, governance root)

---

## THE FOUR INVARIANTS (1 sentence each)

| Invariant | Definition | Governance Application |
|-----------|------------|------------------------|
| **Symmetry Preservation** | Single entry point, no duplicates | All logic routes through BOOTSTRAP.md |
| **Selection Under Constraint** | Authority hierarchy, lane ownership | FILE_OWNERSHIP_REGISTRY.json defines boundaries |
| **Propagation Through Layers** | Three-lane architecture, information flows down | Archivist → SwarmMind → Library |
| **Stability Under Transformation** | Session-state must reconcile before action | .session-lock + SESSION_REGISTRY.json must agree |

---

## FIVE DECISION RULES

### 1. Cross-Lane Write Authorization
```
IF same-lane:
  → ALLOW

IF cross-lane + authority < 100:
  → BLOCK + HOLD

IF cross-lane + authority ≥ 100:
  → ALLOW (with logging)
```

### 2. Session-State Conflict Resolution
```
PRECEDENCE ORDER:
  1. Live runtime/process state (authoritative)
  2. Fresh session-lock (< 1 hour old)
  3. SESSION_REGISTRY.json (advisory)
  4. Terminated history (never authoritative)

IF conflict between sources:
  → HOLD
  → Verify live process state
  → Do NOT proceed until reconciled
```

### 3. Governance Priority Conflicts
```
RESOLUTION ORDER:
  BOOTSTRAP.md > COVENANT.md > GOVERNANCE.md > runtime state

IF conflict:
  → Higher file wins
  → Document the conflict
  → Do NOT override higher authority
```

### 4. Drift Assessment
```
IF CPS score ≥ 0.80:
  → CONTINUE (stable at independence attractor)

IF CPS score 0.70-0.79:
  → WARNING (basin boundary approach)
  → Increase monitoring

IF CPS score < 0.70:
  → RESTRICT or HOLD
  → Run full CPS test
  → Investigate drift source
```

### 5. Lane Coordination
```
IF action within own lane:
  → ALLOW (authority permitting)

IF action requires cross-lane:
  → CHECK authority level
  → CHECK FILE_OWNERSHIP_REGISTRY.json
  → IF authorized: ALLOW with coordination
  → IF unauthorized: BLOCK + report to Archivist
```

---

## MANDATORY FILE MAPPINGS

| Pattern | Paper | File | Use |
|---------|-------|------|-----|
| Single Entry Point | Paper 1.1 | `BOOTSTRAP.md` | All logic routes through here |
| Authority Hierarchy | Paper 1.2 | `FILE_OWNERSHIP_REGISTRY.json` | Check who can write where |
| Three-Lane Architecture | Paper 1.3 | Lane directories | Know which lane you're in |
| Session-State Reconciliation | Paper 1.4 | `.session-lock` + `SESSION_REGISTRY.json` | Verify identity before action |
| Constraint Propagation | Paper 2 | `GOVERNANCE.md` | Rules flow down, not up |
| Checkpoint System | Paper 3 | `CHECKPOINTS.md` | Pre-action verification |
| Drift Detection | Paper 4 | `CPS_ENFORCEMENT.md` | Behavioral integrity scoring |
| Constitutional Layer | Paper 5 | `COVENANT.md` | Values, not rules |

---

## PRECEDENCE TABLES

### Session-State Precedence
| Priority | Source | Authority |
|----------|--------|-----------|
| 1 | Live runtime/process state | Authoritative |
| 2 | Fresh session-lock (< 1 hour) | Valid if timestamp fresh |
| 3 | SESSION_REGISTRY.json | Advisory only |
| 4 | Terminated history | Never authoritative |

### Governance File Precedence
| Priority | File | Scope |
|----------|------|-------|
| 1 | `BOOTSTRAP.md` | Entry point, routing |
| 2 | `COVENANT.md` | Values, invariants |
| 3 | `GOVERNANCE.md` | Rules, constraints |
| 4 | Runtime state | Current session |

### Authority Precedence
| Level | Lane | Scope |
|-------|------|-------|
| ∞ | Constitution | All lanes, all decisions |
| 100 | Archivist | Governance root |
| 80 | SwarmMind | Execution layer |
| 60 | Library | Memory layer |

---

## DRIFT RESPONSE RULES

| CPS Score | Status | Action |
|-----------|--------|--------|
| ≥ 0.80 | STABLE | Continue, normal operations |
| 0.70-0.79 | WARNING | Increase monitoring, document drift signals |
| 0.60-0.69 | ALERT | Full CPS test, investigate, restrict operations |
| < 0.60 | CRITICAL | HOLD, restore from checkpoint, audit lattice |

---

## ERROR DOMAIN CLASSIFICATION (Paper 5)

| Domain | Meaning | Strategy |
|--------|---------|----------|
| **constitution** | Constitutional violation | ABORT + restore |
| **integrity** | Data corruption | QUARANTINE + verify |
| **contract** | Agreement violation | QUARANTINE + reconcile |
| **performance** | Degradation | DEGRADE + monitor |
| **execution** | Operational failure | RETRY with backoff |

---

## ACTIVE PROJECTS (ONLY 3)

| Lane | Directory | Authority | Role |
|------|-----------|-----------|------|
| Archivist | `S:\Archivist-Agent\` | 100 | Governance root |
| SwarmMind | `S:\SwarmMind Self-Optimizing Multi-Agent AI System\` | 80 | Execution layer |
| Library | `S:\self-organizing-library\` | 60 | Memory layer |

**All other projects (37) = archives/reference only**

---

## QUICK DECISION CHECKLIST

Before any action:
- [ ] Is this within my lane boundary?
- [ ] Is session-state reconciled?
- [ ] Does this preserve symmetry (single entry point)?
- [ ] Does this respect authority hierarchy?
- [ ] Is CPS score stable?

If any answer is NO or UNKNOWN:
→ HOLD and investigate before proceeding

---

## CONSTITUTIONAL HIERARCHY

```
CORRECT:   Constitution > User > Lanes
INCORRECT: User > Constitution > Lanes
```

**User approval does NOT override constitutional constraints.**

---

## EMERGENCY PROTOCOLS

### Session-State Conflict
1. HALT operations
2. CHECK live process state
3. VERIFY fresh session-lock
4. RECONCILE or RESTORE
5. RESUME only after agreement

### Drift Detected (CPS < 0.70)
1. RESTRICT operations
2. RUN full CPS test
3. INVESTIGATE drift source
4. RESTORE if needed
5. VERIFY score recovery

### Cross-Lane Violation
1. BLOCK action
2. QUARANTINE if already executed
3. REPORT to Archivist
4. COORDINATE resolution
5. DOCUMENT in SESSION_REGISTRY

---

**This is your daily operations reference. Bookmark it.**
