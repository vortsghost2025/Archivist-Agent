# SWARMIND_INTEGRATION_SPEC.md

**Created:** 2026-04-15
**Status:** Specification — awaiting implementation decision
**Consensus:** Full agreement from external isolation lanes (GPT validation)

---

## Clean Anchor Statement

SwarmMind functions as a trace-mediated verification surface within the broader constitutional workflow. Its purpose is to make reasoning paths, divergence points, and correction events observable for later verification. It does not itself determine truth, replace governance, or substitute for external validation.

---

## Purpose

SwarmMind will function as a **trace-and-verification layer** between human and agent, NOT as a truth oracle.

---

## Role Definition

### What SwarmMind IS

- **Trace layer** — records reasoning path with timestamps
- **Audit surface** — makes decisions inspectable after the fact
- **Discrepancy exposer** — shows where branches diverge
- **Cognition visualizer** — displays step-by-step agent thinking
- **Comparison engine** — single vs multi-agent strategy results

### What SwarmMind IS NOT

- **Truth oracle** — does not declare correctness
- **Enforcement mechanism** — does not block drift
- **Replacement for external lanes** — does not collapse verification
- **Interpreter of certainty** — does not narrate confidence
- **Governance substitute** — does not replace BOOTSTRAP/lattice

---

## Integration Architecture

```
HUMAN (Sean)
├── final router
├── mismatch detector
├── cognitive pressure source
└── external validation coordinator
    │
    ▼
AGENT (Claude/opencode)
├── propose
├── analyze
├── challenge
├── surface gaps
└── check against governance
    │
    ▼
SWARMIND (verification-visible cognition layer)
├── records reasoning path
├── logs every decision with timestamp
├── exposes intermediate steps
├── compares branches
├── shows where disagreement entered
├── shows where drift entered
├── shows where correction happened
└── preserves trace for later review
    │
    ▼
EXTERIOR ISOLATION LANES (GPT, other AI)
├── validate independently
├── challenge from outside
├── check trace survival
└── verify evidence alignment
```

---

## Failure Modes of the Trace Layer

Traces can still fail. This section documents how.

### Trace Layer Failures

**1. Incomplete Logging**
- What it looks like: Some decisions not captured in trace
- Why it's failure: Later verification cannot see full reasoning path
- Mitigation: Mandatory logging at each checkpoint

**2. Selective Logging**
- What it looks like: Only favorable decisions logged, unfavorable ones skipped
- Why it's failure: Trace presents false coherence
- Mitigation: Log ALL decisions, including abandoned branches

**3. False Coherence**
- What it looks like: Trace appears to show clean progression, but reasoning was actually chaotic
- Why it's failure: Trace misrepresents what happened
- Mitigation: Include abandoned proposals, wrong turns, corrections

**4. Over-Interpretation of the Tree**
- What it looks like: Trace reviewer treats tree structure as proof of correctness
- Why it's failure: Structure ≠ truth; structure = path visibility
- Mitigation: Explicitly state trace is evidence, not proof

**5. Treating Trace as Proof Rather Than Evidence Surface**
- What it looks like: "Trace shows X, therefore X is true"
- Why it's failure: Trace shows what was claimed, not whether claim is correct
- Mitigation: Trace preserves claims, evidence, and corrections — truth requires external verification

**6. Trace Bypass**
- What it looks like: Decisions made without trace capture
- Why it's failure: Governance is documented but not observable
- Mitigation: Trace layer must be in the path, not optional

**7. Trace Drift**
- What it looks like: Trace layer starts interpreting instead of logging
- Why it's failure: Layer becomes another AI making claims
- Mitigation: Trace layer only logs, never interprets

**8. Trace Collapse**
- What it looks like: Exterior lanes skipped because "trace covers it"
- Why it's failure: Trace replaces verification instead of supporting it
- Mitigation: Trace is observation surface, not verification layer

---

## What SwarmMind Logs

### Per-Decision Trace

```json
{
  "timestamp": "2026-04-15T20:30:00Z",
  "source": "agent|human",
  "action": "propose|analyze|challenge|correct|commit",
  "claim": "string",
  "evidence": ["list of evidence references"],
  "governance_check": "passed|failed|skipped|unknown",
  "drift_signal": "none|warning|measured|critical",
  "branch": "main|alternative|corrected"
}
```

### Session Trace Tree

```
SESSION START
├── HUMAN: propose task [timestamp]
├── AGENT: analyze task [timestamp]
│   ├── check BOOTSTRAP.md [timestamp]
│   ├── list governance constraints [timestamp]
│   └── state drift baseline [timestamp]
├── AGENT: propose solution [timestamp]
│   ├── SwarmMind logs: claim, evidence, governance_check
├── HUMAN: challenge claim [timestamp]
│   ├── SwarmMind logs: divergence point detected
├── AGENT: correct [timestamp]
│   ├── SwarmMind logs: correction event
└── CONSENSUS REACHED [timestamp]
```

---

## What SwarmMind Exposes

### For Human Review

1. **Branch divergence** — "Agent claimed X, Human challenged Y"
2. **Drift entry points** — "At timestamp T, claim exceeded evidence"
3. **Correction events** — "At timestamp T, drift was corrected"
4. **Evidence gaps** — "Claim made without evidence reference"
5. **Governance bypasses** — "Decision made without BOOTSTRAP check"

### For Agent Review

1. **Human pressure points** — "Human challenged at these timestamps"
2. **Uncertainty markers** — "Agent used hedging language here"
3. **Overclaim flags** — "Evidence doesn't support this claim"
4. **Missing verification** — "External lanes not consulted"

---

## What SwarmMind Does NOT Do

1. **Declare truth** — It shows what happened, not what's correct
2. **Enforce governance** — It logs bypass, doesn't prevent it
3. **Replace external lanes** — It's a trace layer, not a verification layer
4. **Interpret certainty** — It doesn't assign confidence scores
5. **Block decisions** — It records, doesn't gate

---

## Connection to Governance Structure

### Paper D Alignment

Paper D says identity persists through **recognition**, not memory.

SwarmMind provides recognition:
- Each decision has a structural position in the trace tree
- Not just output — the full reasoning path is preserved
- Later verification can recognize where drift entered

### Lattice Connection

The trace is NOT the lattice. The trace is **observable evidence of lattice interaction**:

```
LATTICE (constraints, meets, joins)
    ↓ produces
DECISIONS (logged in SwarmMind trace)
    ↓ exposes
DRIFT SIGNALS (visible in trace tree)
```

### BOOTSTRAP Connection

SwarmMind should log:
- Whether BOOTSTRAP.md was checked
- When governance constraints were listed
- If drift baseline was stated
- If verification lane was declared

This makes governance consultation **observable**, not just documented.

---

## Integration Modes

### Mode 1: Separate Verification Tool

SwarmMind runs as standalone process:
- Human and agent work together
- Periodically invoke SwarmMind to capture trace
- Review trace after session or at checkpoints

### Mode 2: Embedded Workflow

SwarmMind integrated into every decision:
- Each proposal auto-logged
- Each challenge auto-logged
- Real-time trace visualization
- Drift signals surface immediately

### Mode 3: Post-Session Review

SwarmMind captures session artifact:
- Human and agent work in partnered mode
- Session recorded as structured trace
- Exterior lanes review trace after completion
- Drift detected in post-hoc analysis

**Recommendation:** Start with Mode 1 (tool), evolve to Mode 2 (embedded) if proven useful.

---

## Success Criteria

SwarmMind integration succeeds when:

1. **Observability** — Human and agent can both see the reasoning path
2. **Drift exposure** — Overclaims become visible in trace
3. **No truth claims** — SwarmMind never declares correctness
4. **External lane preserved** — Outside verification still required
5. **Governance connected** — Trace shows governance consultation status

---

## Failure Modes to Avoid

1. **Oracle drift** — SwarmMind starts declaring truth
2. **Verification collapse** — External lanes skipped because "trace covers it"
3. **Certainty narration** — SwarmMind interprets confidence instead of logging
4. **Governance bypass** — Trace treated as substitute for BOOTSTRAP check
5. **Interpretive layer bloat** — SwarmMind becomes another AI making claims

---

## Implementation Notes

### Current SwarmMind Capabilities

From README:
- Agent swarm execution (Planner → Coder → Reviewer → Executor)
- Cognitive trace viewer (step-by-step reasoning)
- Auto-scaling (basic)
- Experimentation engine (single vs multi-agent comparison)

### Required Additions for This Role

1. **Human-agent trace capture** — Currently agent-only, needs human input
2. **Governance status logging** — BOOTSTRAP check, constraint list, drift baseline
3. **Divergence detection** — Flag when human and agent disagree
4. **Drift signal integration** — CPS scores, UDS, lane declarations
5. **Export format** — Trace in structured format for external lane review

---

## Naming

**Recommended role name:** verification-visible cognition layer

**Alternative names:**
- trace-mediated truth-check layer
- reasoning-audit surface
- cognitive-observation layer

**Not recommended:**
- truth layer
- verification oracle
- governance enforcer

---

## Next Steps

1. Decide integration mode (tool vs embedded vs post-session)
2. Extend SwarmMind to capture human-agent interaction
3. Add governance status fields to trace schema
4. Test with real human-agent collaboration session
5. Review trace with exterior lanes for validation

---

**Version:** 1.0
**Status:** Specification complete, awaiting implementation decision
**External validation:** GPT consensus — "trace/audit/exposure layer, not oracle"
