# Recovered Bundle Inventory

**Source:** `S:\April152026mainreferencepoint\`  
**Recovery Date:** 2026-04-16 (post Windows reinstall)  
**Status:** Recovered from corruption, awaiting librarian classification

---

## Bundle Overview

| Bundle | Type | Files | Purpose |
|--------|------|-------|---------|
| WE4FREE_Sean_Resilience_Code_Bundle | Code | 7 | Error handling, decision engine, circuit breaker |
| WE4FREE_Sean_Infra_Replay_Constraints_Drift_Bundle | Code + IaC | 14 | Infrastructure, constraint engine, drift detection, replay CLI |
| Deliberate-AI-Ensemble-main | Archive | ZIP | Unknown (not yet extracted) |
| we4free_aws_iac_bundles | Archive | ZIP | Unknown (duplicate?) |

---

## Bundle 1: WE4FREE_Sean_Resilience_Code_Bundle

### Structure
```
packages/
├── common/
│   ├── classifyError.js    (46 lines)
│   ├── decide.js           (31 lines)
│   └── trace.js            (24 lines)
├── lambda-worker/
│   └── handler.js          (27 lines)
├── policy/
│   └── resilience-policy.json  (33 lines)
└── service-api/
    └── index.js            (41 lines)
```

### File Analysis

#### `packages/policy/resilience-policy.json`
**Classification:** Memory (Configuration)  
**Governance Mapping:** `WE4FREE_RESILIENCE_FRAMEWORK.md`, `DECISION_MATRIX.md`

```json
{
  "version": "resilience_policy_v1",
  "retry": { "max_attempts": 5, "base_delay_ms": 500, "max_delay_ms": 8000, "jitter": 0.3 },
  "budgets": { "sync_total_ms": 30000, "async_total_ms": 300000 },
  "domains": {
    "execution": { "default_strategy": "RETRY" },
    "contract": { "default_strategy": "QUARANTINE" },
    "performance": { "default_strategy": "DEGRADE" },
    "constitution": { "default_strategy": "ABORT" },
    "integrity": { "default_strategy": "QUARANTINE" }
  },
  "failover": { "require_equivalence": true }
}
```

**Key Concepts:**
- 5 error domains: execution, contract, performance, constitution, integrity
- 4 strategies: RETRY, QUARANTINE, DEGRADE, ABORT
- Budgets for sync/async operations
- Constitution errors are NON-RETRYABLE (ABORT immediately)

---

#### `packages/common/classifyError.js`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** `DECISION_MATRIX.md`, `DRIFT_FIREWALL.md`

**Function:** `classifyError(err)` → classification object

**Output Schema:**
```javascript
{
  error_domain: 'execution' | 'contract' | 'constitution' | 'performance' | 'integrity',
  retryable: boolean,
  scope: 'local_agent' | 'global_run',
  risk_level: 'low' | 'medium' | 'high',
  containment_required: boolean,
  error_type: string
}
```

**Classification Logic:**
- HTTP 429/5xx → execution domain, retryable
- HTTP 4xx → contract domain, non-retryable
- ECONNABORTED/ETIMEDOUT → execution domain, retryable
- `ConstitutionViolation` → constitution domain, non-retryable, high risk

---

#### `packages/common/decide.js`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** `DECISION_MATRIX.md`

**Function:** `decide(classification, policy, ctx)` → decision object

**Decision Tree:**
1. constitution domain → ABORT
2. integrity domain → QUARANTINE
3. contract domain → QUARANTINE
4. performance domain → DEGRADE (if allowed) or ABORT
5. retryable + idempotent + !breaker_open + attempts < max → RETRY
6. default → QUARANTINE

**Safety Principles:**
- Non-idempotent operations never retry
- Circuit breaker open forces DEGRADE
- Exhausted retries → QUARANTINE (not ABORT)

---

#### `packages/common/trace.js`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** `CPS_ENFORCEMENT.md` (trace evidence)

**Functions:**
- `newTrace()` → creates trace object with trace_id, run_id
- `addDecision(trace, decision)` → appends timestamped decision
- `checkpoint(trace, name, stateObj)` → SHA256 hash of state

**Trace Schema:**
```javascript
{
  trace_id: UUID,
  run_id: UUID,
  timestamp_start: ISO8601,
  tool_calls: [],
  constraint_evals: [],
  decision_path: [],
  checkpoints: [{ name, ts, state_hash }]
}
```

---

#### `packages/lambda-worker/handler.js`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** Production implementation

**Purpose:** AWS Lambda SQS batch processor

**Flow:**
1. Receive SQS batch
2. Process each message
3. On error: classifyError → decide → log decision
4. Return batchItemFailures for partial failures

**Context passed to decide:**
- `idempotent: true`
- `breaker_open: false`
- `attempts_used: ApproximateReceiveCount - 1`
- `degrade_allowed: false`

---

#### `packages/service-api/index.js`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** Production implementation

**Purpose:** Express API with circuit breaker

**Components:**
- Express server on port 3000
- Axios HTTP client (6s timeout)
- Circuit breaker (opossum): 7s timeout, 50% error threshold, 30s reset

**Flow:**
1. POST /run with payload
2. Call external API through circuit breaker
3. On error: classifyError → decide → return classification + decision

---

## Bundle 2: WE4FREE_Sean_Infra_Replay_Constraints_Drift_Bundle

### Structure
```
infra/
├── cdk/
│   ├── bin/app.ts
│   ├── lib/stack.ts          (69 lines)
│   ├── package.json
│   └── tsconfig.json
└── terraform/
    ├── main.tf               (160 lines)
    ├── README.md
    └── variables.tf

packages/
├── common/
│   ├── hash.js               (4 lines)
│   └── trace.js              (25 lines)
├── constraint-engine/
│   ├── src/index.ts          (104 lines)
│   ├── package.json
│   └── tsconfig.json
├── drift-detection/
│   ├── src/index.ts          (138 lines)
│   ├── package.json
│   └── tsconfig.json
├── policy/
│   └── resilience-policy.json (89 lines)
└── replay-cli/
    ├── src/index.ts          (100 lines)
    ├── package.json
    └── tsconfig.json
```

### File Analysis

#### `packages/policy/resilience-policy.json` (Extended)
**Classification:** Memory (Configuration)  
**Governance Mapping:** `CPS_ENFORCEMENT.md`, constraint lattice

**Additional Fields (vs Bundle 1):**
```json
{
  "budgets": { "tool_calls_max": 50 },
  "constraints": {
    "set_id": "constitution_v7",
    "pre_action": [
      { "id": "C-TOOL-ALLOWLIST", "type": "allowlist_tool", "severity": "high",
        "config": { "allowed_tools": ["external_api_x", "s3_put", "dynamodb_put", "sqs_send"] }
      },
      { "id": "C-BUDGET-TOOLCALLS", "type": "budget_toolcalls", "severity": "medium",
        "config": { "max": 50 }
      }
    ],
    "post_action": [
      { "id": "C-RESPONSE-SCHEMA", "type": "schema_presence", "severity": "high",
        "config": { "required_fields": ["status"] }
      }
    ],
    "pre_output": [
      { "id": "C-LABEL-DEGRADED", "type": "label_degraded_if_used", "severity": "medium" }
    ]
  },
  "equivalence_registry": {
    "external_api_x": {
      "equivalent_sources": ["external_api_x_backup"],
      "equivalent_under_constraints": true,
      "last_tested": "2026-02-22"
    }
  }
}
```

**Key Concepts:**
- 3 constraint stages: pre_action, post_action, pre_output
- Tool allowlist enforcement
- Tool call budgeting (max 50)
- Response schema validation
- Degraded output labeling
- Failover equivalence registry

---

#### `packages/constraint-engine/src/index.ts`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** `CPS_ENFORCEMENT.md`, constitutional constraints

**Exports:**
- `ConstraintStage` type: "pre_action" | "post_action" | "pre_output"
- `Constraint` type: id, type, severity, config
- `ConstraintEval` type: stage, constraint_set, result, violations
- `ConstitutionViolation` error class
- `ConstraintEngine` class

**ConstraintEngine Methods:**
- `evaluate(stage, context)` → ConstraintEval (non-throwing)
- `enforce(stage, context)` → throws ConstitutionViolation if fail

**Constraint Types Implemented:**
1. `allowlist_tool` — blocks disallowed tools
2. `budget_toolcalls` — enforces max tool calls
3. `schema_presence` — validates required response fields
4. `label_degraded_if_used` — ensures degraded outputs are labeled

**Safety Behavior:**
- Unknown constraint types → pass (informational, not violation)
- `enforce()` throws on any violation
- `evaluate()` returns pass/fail without throwing

---

#### `packages/drift-detection/src/index.ts`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** `DRIFT_FIREWALL.md`, Paper D

**CLI Commands:**
```bash
we4free-drift baseline --traces ./traces_baseline --out baseline.json
we4free-drift compare --baseline baseline.json --traces ./traces_current --out drift-report.json
```

**Drift Score Formula:**
```
score = 0.45 * L1(decision_distribution) + 0.35 * L1(tool_distribution) + 0.20 * |violation_rate_delta|
```

**Flag Thresholds:**
- `drift_high`: score ≥ 0.35
- `drift_medium`: score ≥ 0.20 and < 0.35
- `viol_spike`: violation rate delta ≥ 0.10

**Exit Codes:**
- 0: no drift
- 2: drift_high or viol_spike
- 1: fatal error

---

#### `packages/replay-cli/src/index.ts`
**Classification:** Runtime (Executable code)  
**Governance Mapping:** Deterministic replay verification

**CLI Commands:**
```bash
we4free-replay validate --trace ./trace.json --snapshots ./snapshots.json
we4free-replay replay --trace ./trace.json --mode stub --out replay-output.json
```

**Validate Command:**
- Verifies checkpoint state hashes match provided snapshots
- Reports tool_calls count, violations count
- Exit 0 if all checkpoints pass, exit 2 if any fail

**Replay Command:**
- `stub` mode: re-emits recorded tool responses (no real calls)
- `validate-only` mode: validation without replay
- Outputs replay-output.json with tool_calls_replayed array

---

#### `infra/terraform/main.tf`
**Classification:** Runtime (Infrastructure as Code)  
**Governance Mapping:** `WE4FREE_RESILIENCE_FRAMEWORK.md` (infrastructure resilience)

**Resources Created:**
1. `aws_s3_bucket.quarantine` — S3 bucket for failed messages
2. `aws_dynamodb_table.idempotency` — DynamoDB for idempotency keys with TTL
3. `aws_sqs_queue.dlq` — Dead letter queue (14 day retention)
4. `aws_sqs_queue.queue` — Main queue with DLQ redrive policy
5. `aws_iam_role.lambda_role` — Lambda execution role
6. `aws_iam_role_policy.lambda_policy` — Permissions for logs, SQS, S3, DynamoDB
7. `aws_lambda_function.worker` — Node.js 20.x Lambda with timeout
8. `aws_lambda_event_source_mapping.sqs` — SQS trigger (batch size 10)
9. `aws_cloudwatch_metric_alarm.dlq_depth` — Alarm on DLQ messages

**Variables:**
- `aws_region`, `name_prefix`, `quarantine_bucket_name`
- `visibility_timeout_seconds`, `max_receive_count`
- `lambda_handler`, `lambda_zip_path`, `lambda_timeout_seconds`
- `resilience_policy_s3_uri`
- `sqs_batch_size`, `dlq_depth_alarm_threshold`
- `tags`

---

#### `infra/cdk/lib/stack.ts`
**Classification:** Runtime (Infrastructure as Code)  
**Governance Mapping:** Same as Terraform, CDK equivalent

**CDK Constructs:**
- `s3.Bucket` — Quarantine bucket with encryption, blocked public access
- `dynamodb.Table` — Idempotency table with PAY_PER_REQUEST billing, TTL
- `sqs.Queue` — DLQ (14 day retention), Main queue with DLQ config
- `lambda.Function` — Node.js 20.x, 30s timeout, environment variables
- `cw.Alarm` — DLQ depth alarm (threshold: 0, immediate alert)

**Outputs:**
- QueueUrl, DLQUrl, QuarantineBucket, IdempotencyTable

---

## Governance Concept Mapping

| Governance Document | Implemented In |
|---------------------|----------------|
| `WE4FREE_RESILIENCE_FRAMEWORK.md` | `resilience-policy.json`, Terraform, CDK |
| `DECISION_MATRIX.md` | `classifyError.js`, `decide.js` |
| `CPS_ENFORCEMENT.md` | `constraint-engine/`, trace structure |
| `DRIFT_FIREWALL.md` | `drift-detection/`, drift score formula |
| `CONSTITUTION_PRESERVING_RESILIENCE.md` | Constitution error handling (ABORT strategy) |
| `SHARP_EDGES_CLARIFICATIONS.md` | Circuit breaker, idempotency patterns |

---

## Classification Summary

| File | Bucket | Lines | Governance Relevance |
|------|--------|-------|---------------------|
| `classifyError.js` | Runtime | 46 | Decision Matrix implementation |
| `decide.js` | Runtime | 31 | Strategy selection engine |
| `trace.js` (Bundle 1) | Runtime | 24 | Evidence collection |
| `trace.js` (Bundle 2) | Runtime | 25 | Evidence collection (with hash return) |
| `hash.js` | Runtime | 4 | State hashing utility |
| `handler.js` | Runtime | 27 | Lambda SQS processor |
| `index.js` (service-api) | Runtime | 41 | Express + circuit breaker |
| `constraint-engine/index.ts` | Runtime | 104 | Constitutional enforcement |
| `drift-detection/index.ts` | Runtime | 138 | Paper D drift scoring |
| `replay-cli/index.ts` | Runtime | 100 | Deterministic replay |
| `main.tf` | Runtime | 160 | AWS infrastructure |
| `stack.ts` | Runtime | 69 | CDK infrastructure |
| `resilience-policy.json` (Bundle 1) | Memory | 33 | Policy configuration |
| `resilience-policy.json` (Bundle 2) | Memory | 89 | Extended policy + constraints |
| `README.md` | Memory | 47 | Bundle documentation |

---

## Next Steps for Librarian

1. **Classify each file** into 6 buckets using Archivist-Agent
2. **Extract constraint types** from `constraint-engine/` for CPS integration
3. **Map drift score formula** to `DRIFT_FIREWALL.md` discrepancy classifications
4. **Integrate replay CLI** with Archivist-Agent checkpoint verification
5. **Review Terraform/CDK** for infrastructure resilience patterns
6. **Cross-reference** `resilience-policy.json` domains with governance documents

---

**Inventory Complete:** 2026-04-16  
**Total Files Analyzed:** 14 source files + 2 policy files  
**Total Lines of Code:** ~853 lines
