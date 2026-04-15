# Three-Layer Bridge Architecture

## Overview

This document defines the integration architecture between three distinct layers that together form a governance-enforced, truth-verified execution system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GOVERNANCE LAYER                                │
│                           (S:/.global/)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ BOOTSTRAP.md│  │CHECKPOINTS │  │  COVENANT   │  │ USER_DRIFT_SCORING  │ │
│  │ (Entry Pt)  │  │    .md      │  │    .md      │  │        .md          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│         └────────────────┴────────────────┴────────────────────┘            │
│                                   │                                          │
│                          GOVERNANCE CHECKS                                   │
│                     (UDS scoring, checkpoints)                               │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               TRUTH LAYER                                    │
│                            (SwarmMind)                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      VERIFICATION ENGINE                                 ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   ││
│  │  │   VERIFIED   │  │   MEASURED   │  │         UNTESTED             │   ││
│  │  │              │  │              │  │                              │   ││
│  │  │ Direct check │  │ Quantified   │  │ Honest admission of          │   ││
│  │  │ passed/failed│  │ measurement  │  │ unverified claims            │   ││
│  │  │ with evidence│  │ with values  │  │ (NOT hardcoded true)         │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────┘   ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  │                    COGNITIVE TRACE                                  ││
│  │  │   Input → Processing → Decision → Output → Verification            ││
│  │  └─────────────────────────────────────────────────────────────────────┘│
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                   │                                          │
│                      WRAPS EXECUTION (not IS execution)                      │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             EXECUTION LAYER                                  │
│                          (Kilo Node CLI)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Model Calls │  │  Provider   │  │   Tool      │  │     Agent           │ │
│  │             │  │   Routing   │  │ Execution   │  │    Selection        │ │
│  │ GLM5        │  │             │  │             │  │                     │ │
│  │ Qwen2.5     │  │ Ollama      │  │ Bash        │  │ orchestrator        │ │
│  │ DeepSeek    │  │ OpenRouter  │  │ Read/Write  │  │ plan/code/debug     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                   │                                          │
│                          ACTUAL EXECUTION                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Governance Layer (S:/.global/)

### Purpose
Constitutional governance that defines WHAT should be done and WHY. This layer provides the rules, constraints, and ethical framework that all actions must align with.

### Key Files

| File | Purpose |
|------|---------|
| `BOOTSTRAP.md` | **Single entry point** - all governance flows through here |
| `CHECKPOINTS.md` | 7 safety checkpoints for major actions |
| `COVENANT.md` | Values and beliefs (what we stand for) |
| `GOVERNANCE.md` | Rules and procedures (what we follow) |
| `CPS_ENFORCEMENT.md` | Enforcement mechanisms |
| `VERIFICATION_LANES.md` | Dual verification pattern (L/R lanes) |
| `USER_DRIFT_SCORING.md` | Drift detection scoring |

### Governance Outputs
```
1. UDS Score (0-100) - measures drift risk
2. Checkpoint Pass/Fail - 7 safety checks
3. Governance Authorization - proceed/investigate/escalate
```

### Governance Flow
```
User Request → BOOTSTRAP.md → Check checkpoints → Calculate UDS → 
Authorize/Deny → Pass to Truth Layer
```

---

## Layer 2: Truth Layer (SwarmMind)

### Purpose
**SwarmMind is NOT execution - it is a truth verification engine that WRAPS execution.**

The Truth Layer receives execution results and categorizes them into three truth categories, ensuring no hardcoded claims pass through.

### Truth Categories

#### VERIFIED
- Direct pass/fail check with evidence
- Example: `agents_alive: {status: "VERIFIED", value: true, evidence: "traceEvents >= 4"}`
- Trust level: 100%

#### MEASURED
- Quantified measurements with values
- Example: `latency: {status: "MEASURED", measured_ms: 4545, threshold_ms: 10000, passed: true}`
- Trust level: Variable (based on variance)

#### UNTESTED
- Honest admission of unverified claims
- Example: `gpu_stable: {status: "UNTESTED", value: null, reason: "No GPU detection in CPU-only demo"}`
- Trust level: N/A (honest admission)

### Cognitive Trace
```
┌─────────────────────────────────────────────────────────────────────┐
│                     COGNITIVE TRACE STRUCTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   INPUT ──────► PROCESSING ──────► DECISION ──────► OUTPUT         │
│     │               │                │               │              │
│     ▼               ▼                ▼               ▼              │
│   What was      How was it        What choice     What was         │
│   received?     processed?        was made?       produced?        │
│                                                                     │
│                     │                                               │
│                     ▼                                               │
│               VERIFICATION                                          │
│               │                                                      │
│               ├──► VERIFIED (direct check)                          │
│               ├──► MEASURED (quantified)                            │
│               └──► UNTESTED (honest admission)                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Anti-Patterns (From TRUTH_DEBUGGING_JOURNEY.md)
```
❌ HARDCODED: gpu_stable: true
✅ HONEST: gpu_stable: {status: 'UNTESTED', value: null}

❌ ASSUMED: latency_under_threshold: true  
✅ MEASURED: latency: {measured_ms: 4545, threshold_ms: 10000}

❌ MISLEADING: hallucination_rate_below
✅ ACCURATE: trace_completeness (checks structure, not semantics)
```

---

## Layer 3: Execution Layer (Kilo Node CLI)

### Purpose
Actual execution of model calls, tool invocations, and agent orchestration. This layer does the work but does NOT verify its own claims.

### Configuration (kilo.json)

```json
{
  "model": "ollama/qwen2.5-coder:7b",
  "agent": {
    "orchestrator": { "model": "z-ai/glm5" },
    "plan": { "model": "ollama/qwen2.5-coder:7b" },
    "code": { "model": "ollama/deepseek-coder:6.7b" },
    "build": { "model": "ollama/deepseek-coder:6.7b" },
    "debug": { "model": "ollama/qwen2.5-coder:7b" }
  }
}
```

### Execution Components

| Component | Purpose | Provider |
|-----------|---------|----------|
| Model Calls | LLM inference | Ollama, OpenRouter |
| Provider Routing | Route to appropriate model | Config-based |
| Tool Execution | Bash, Read, Write operations | Kilo CLI |
| Agent Selection | Choose agent for task | orchestrator → specialized |

### Execution Flow
```
Task → Agent Selection → Model Call → Tool Execution → Raw Output → 
Return to Truth Layer for Verification
```

---

## Data Flow: Governance → Truth → Execution

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE DATA FLOW                                  │
└──────────────────────────────────────────────────────────────────────────────┘

     USER REQUEST
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GOVERNANCE LAYER                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Read BOOTSTRAP.md (single entry point)                              │ │
│  │ 2. Check all 7 checkpoints (CHECKPOINTS.md)                            │ │
│  │ 3. Calculate UDS score (USER_DRIFT_SCORING.md)                         │ │
│  │ 4. Determine: PROCEED | INVESTIGATE | ESCALATE                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                 ┌────────────┴────────────┐                                  │
│                 │ GOVERNANCE DECISION     │                                  │
│                 │ - UDS Score: 0-100      │                                  │
│                 │ - Checkpoints: Pass/Fail│                                  │
│                 │ - Authorization: Yes/No │                                  │
│                 └────────────┬────────────┘                                  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │ IF AUTHORIZED: Continue to Truth Layer      │
        │ IF DENIED: Return to user with reason       │
        └──────────────────────┬──────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRUTH LAYER (SwarmMind Verification Engine)                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ WRAPPER: Not execution, but verification wrapper                       │ │
│  │                                                                        │ │
│  │  ┌──────────────────┐     ┌──────────────────┐                        │ │
│  │  │ DUAL VERIFICATION│     │ LANE L  │ LANE R │                        │ │
│  │  │ (VERIFICATION_   │     │ Static  │ Runtime│                        │ │
│  │  │  LANES.md)       │     │ Analysis│ Tests  │                        │ │
│  │  └────────┬─────────┘     └────┬─────┴───┬────┘                        │ │
│  │           │                    │         │                              │ │
│  │           └────────────────────┼─────────┘                              │ │
│  │                                ▼                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    CONSENSUS ENGINE                              │  │ │
│  │  │  L:PASS + R:PASS → STRONG CONSENSUS → Proceed                    │  │ │
│  │  │  L:PASS + R:FAIL → WEAK CONSENSUS → Investigate                  │  │ │
│  │  │  L:FAIL + R:FAIL → NO CONSENSUS → Escalate                       │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                 ┌────────────┴────────────┐                                  │
│                 │ CALL EXECUTION LAYER    │                                  │
│                 │ (with verification wrap)│                                  │
│                 └────────────┬────────────┘                                  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTION LAYER (Kilo Node CLI)                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Select agent (orchestrator/plan/code/debug)                        │ │
│  │ 2. Route to provider (Ollama/OpenRouter)                              │ │
│  │ 3. Execute model call                                                 │ │
│  │ 4. Execute tools (Bash/Read/Write)                                    │ │
│  │ 5. Return RAW OUTPUT (not verified)                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                 ┌────────────┴────────────┐                                  │
│                 │ RAW EXECUTION RESULTS   │                                  │
│                 │ (unverified claims)     │                                  │
│                 └────────────┬────────────┘                                  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRUTH LAYER (Verification of Results)                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ CATEGORIZE EXECUTION RESULTS:                                         │ │
│  │                                                                        │ │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐   │ │
│  │ │    VERIFIED     │ │    MEASURED     │ │       UNTESTED          │   │ │
│  │ │                 │ │                 │ │                         │   │ │
│  │ │ Direct check    │ │ Quantified      │ │ Honest admission        │   │ │
│  │ │ pass/fail       │ │ measurement     │ │ of unverified           │   │ │
│  │ │ with evidence   │ │ with values     │ │ claims                  │   │ │
│  │ └─────────────────┘ └─────────────────┘ └─────────────────────────┘   │ │
│  │                                                                        │ │
│  │ COGNITIVE TRACE:                                                       │ │
│  │ Input → Processing → Decision → Output → Verification                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                 ┌────────────┴────────────┐                                  │
│                 │ VERIFIED RESULTS        │                                  │
│                 │ (truth-categorized)     │                                  │
│                 └────────────┬────────────┘                                  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FEEDBACK TO GOVERNANCE                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Verification results feed back to checkpoints                       │ │
│  │ 2. Discrepancies logged for UDS adjustment                            │ │
│  │ 3. Trust scores update governance authorization                       │ │
│  │ 4. Drift signals detected from verification patterns                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                 ┌────────────┴────────────┐                                  │
│                 │ FINAL OUTPUT            │                                  │
│                 │ (governance-enforced,   │                                  │
│                 │  truth-verified)        │                                  │
│                 └─────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                         USER RESPONSE
```

---

## Bridge Code Pattern: SwarmMind Verifies Kilo Execution

### The Bridge Interface

```typescript
// Bridge between Execution Layer and Truth Layer
interface VerificationBridge {
  // SwarmMind wraps Kilo execution
  wrapExecution(executionFn: () => Promise<RawResult>): Promise<VerifiedResult>;
}

// Raw result from Kilo (unverified)
interface RawResult {
  output: any;
  metrics: {
    latency_ms: number;
    model_used: string;
    tokens_used: number;
  };
  claims: Claim[];
}

// Verified result from SwarmMind
interface VerifiedResult {
  output: any;
  verification: {
    verified: VerifiedClaim[];
    measured: MeasuredClaim[];
    untested: UntestedClaim[];
  };
  cognitive_trace: CognitiveTrace;
  trust_score: number;
}
```

### Bridge Implementation Pattern

```typescript
class SwarmMindVerificationBridge implements VerificationBridge {
  
  async wrapExecution(executionFn: () => Promise<RawResult>): Promise<VerifiedResult> {
    // STEP 1: Execute (Kilo does the work)
    const rawResult = await executionFn();
    
    // STEP 2: Verify (SwarmMind categorizes truth)
    const verified = this.verifyDirectChecks(rawResult);
    const measured = this.measureQuantified(rawResult);
    const untested = this.admitUntested(rawResult);
    
    // STEP 3: Build cognitive trace
    const cognitiveTrace = this.buildCognitiveTrace(rawResult, {
      verified,
      measured,
      untested
    });
    
    // STEP 4: Calculate trust score
    const trustScore = this.calculateTrustScore({
      verified,
      measured,
      untested
    });
    
    // STEP 5: Feed back to governance
    await this.feedbackToGovernance(trustScore, cognitiveTrace);
    
    return {
      output: rawResult.output,
      verification: { verified, measured, untested },
      cognitive_trace: cognitiveTrace,
      trust_score: trustScore
    };
  }
  
  private verifyDirectChecks(result: RawResult): VerifiedClaim[] {
    // Claims that can be directly verified
    return result.claims
      .filter(claim => this.canDirectlyVerify(claim))
      .map(claim => ({
        claim: claim.description,
        status: 'VERIFIED' as const,
        value: this.verify(claim),
        evidence: this.gatherEvidence(claim)
      }));
  }
  
  private measureQuantified(result: RawResult): MeasuredClaim[] {
    // Claims that can be measured
    return result.claims
      .filter(claim => this.canMeasure(claim))
      .map(claim => ({
        claim: claim.description,
        status: 'MEASURED' as const,
        measured_value: this.measure(claim),
        threshold: claim.threshold,
        passed: this.measure(claim) < claim.threshold
      }));
  }
  
  private admitUntested(result: RawResult): UntestedClaim[] {
    // Claims that cannot be verified or measured - HONEST admission
    return result.claims
      .filter(claim => !this.canDirectlyVerify(claim) && !this.canMeasure(claim))
      .map(claim => ({
        claim: claim.description,
        status: 'UNTESTED' as const,
        value: null,
        reason: this.explainWhyUntested(claim)
      }));
  }
  
  private calculateTrustScore(verification: VerificationResult): number {
    // Trust score based on verification coverage
    const total = verification.verified.length + 
                  verification.measured.length + 
                  verification.untested.length;
    
    const verified = verification.verified.length;
    const measured = verification.measured.length;
    
    // Trust = verified claims + 0.5 * measured claims
    // Untested claims don't reduce trust (honest admission increases trust)
    return (verified + measured * 0.5) / total;
  }
}
```

---

## Verification Feedback to Governance Checkpoints

### Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VERIFICATION → GOVERNANCE FEEDBACK                      │
└─────────────────────────────────────────────────────────────────────────────┘

  VERIFICATION RESULT                    GOVERNANCE IMPACT
  ─────────────────                      ─────────────────
  
  VERIFIED: High count         ──►      Checkpoint: BOOST confidence
                                        UDS: Lower drift risk
  
  MEASURED: Good variance      ──►      Checkpoint: ACCEPT measurements
                                        UDS: No change
  
  MEASURED: High variance      ──►      Checkpoint: FLAG for investigation
                                        UDS: Higher drift risk
  
  UNTESTED: Many claims        ──►      Checkpoint: HONEST but risky
                                        UDS: Requires human review
  
  UNTESTED: Honest admission   ──►      Checkpoint: INCREASE trust
                                        UDS: Lower drift risk
                                        (honesty is valued)
  
  HARDCODED: Detected          ──►      Checkpoint: FAIL immediately
                                        UDS: Maximum drift risk
                                        Action: Block and escalate
```

### Checkpoint Integration

```yaml
# How verification results feed into CHECKPOINTS.md

Checkpoint_1_Structural_Compliance:
  verification_input:
    - verified_claims_count: int
    - hardcoded_detected: bool
  pass_criteria:
    - hardcoded_detected == false
    - verified_claims_count > 0

Checkpoint_2_Value_Alignment:
  verification_input:
    - untested_claims: list
    - honest_admission: bool
  pass_criteria:
    - honest_admission == true  # Honesty required
    - untested_claims documented

Checkpoint_3_Drift_Detection:
  verification_input:
    - trust_score: float
    - variance: float
  pass_criteria:
    - trust_score > 0.7
    - variance < threshold

Checkpoint_4_Confidence_Calibration:
  verification_input:
    - measured_values: list
    - confidence_intervals: list
  pass_criteria:
    - confidence_intervals provided for all measured claims

Checkpoint_5_Correction_Responsiveness:
  verification_input:
    - previous_verification: object
    - current_verification: object
  pass_criteria:
    - discrepancies addressed
    - hardcoded claims removed

Checkpoint_6_User_Agent_Separation:
  verification_input:
    - cognitive_trace: object
  pass_criteria:
    - agent decisions labeled as "I"
    - user requests labeled as "you"

Checkpoint_7_Governance_Authorization:
  verification_input:
    - all_checkpoints: list
    - trust_score: float
  pass_criteria:
    - all previous checkpoints pass
    - trust_score > threshold
```

---

## Files Involved by Layer

### Governance Layer Files
```
S:/.global/
├── BOOTSTRAP.md              # Single entry point
├── CHECKPOINTS.md            # 7 safety checkpoints
├── COVENANT.md               # Values and beliefs
├── GOVERNANCE.md             # Rules and procedures
├── CPS_ENFORCEMENT.md        # Enforcement mechanisms
├── VERIFICATION_LANES.md     # Dual verification pattern
└── USER_DRIFT_SCORING.md     # Drift detection scoring
```

### Truth Layer Files
```
S:/SwarmMind Self-Optimizing Multi-Agent AI System/
├── TRUTH_DEBUGGING_JOURNEY.md    # Truth categories documentation
├── verification/
│   ├── system_check.json         # Verification results
│   ├── agent_health.json         # Agent health checks
│   └── REPORT.md                 # Evidence-based report
├── scripts/
│   ├── check-agent-health.js     # Deep agent validation
│   ├── check-trace-viewer.js     # Method verification
│   ├── run-all-checks.js         # Aggregator
│   └── test-verifier.js          # Meta-verifier
└── src/
    └── core/
        └── cognitive-trace.js    # Cognitive trace implementation
```

### Execution Layer Files
```
S:/Archivist-Agent/
├── kilo.json                 # Execution configuration
│   ├── model definitions
│   ├── agent selection
│   └── permission grants
└── .kilo/
    └── commands/             # Custom commands
        └── governance.md     # /governance command
```

---

## Key Insight: SwarmMind is NOT Execution

### The Critical Distinction

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COMMON MISCONCEPTION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ❌ WRONG: SwarmMind executes tasks and verifies itself            │
│                                                                     │
│   SwarmMind ──► Execute ──► Verify ──► Report                       │
│   (This creates self-referential verification = FAKE)              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ✅ CORRECT: SwarmMind WRAPS execution, doesn't DO execution       │
│                                                                     │
│   Governance ──► SwarmMind (wrap) ──► Kilo (execute)               │
│                        │                                            │
│                        ▼                                            │
│                    Verify Results                                   │
│                        │                                            │
│                        ▼                                            │
│               Categorize: VERIFIED/MEASURED/UNTESTED               │
│                        │                                            │
│                        ▼                                            │
│               Feed back to Governance                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Matters

1. **No Self-Referential Verification**: Execution cannot verify itself
2. **Honest Untested Claims**: SwarmMind admits what it cannot verify
3. **Separation of Concerns**: 
   - Kilo: Does the work
   - SwarmMind: Verifies the results
   - Governance: Authorizes the action
4. **Trust Chain**: Governance → Truth → Execution (never backward)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-15 | Initial architecture document |

---

**Status**: Active
**Owner**: Archivist-Agent Governance Framework
**References**: VERIFICATION_LANES.md, TRUTH_DEBUGGING_JOURNEY.md, kilo.json
