# HOW THIS SYSTEM ACTUALLY WORKS

> **Purpose** – Provide a concise, mental‑model of the system so that any new agent (human or AI) can reconstruct the full state from the *structure* alone, without relying on hidden memory.

---
## 1. System Overview  

The organism consists of three coordinated layers that operate in a continuous loop:

| Layer | Role | Primary Artifacts |
|------|------|-------------------|
| **Archivist‑Agent** | Governance / verification | `BOOTSTRAP.md`, `RUNTIME_STATE.json`, `SESSION_REGISTRY.json`, authority hierarchy |
| **SwarmMind** | Execution of tasks | task scripts, `src/` code, `kilo.json` (lane config) |
| **self‑organizing‑library** | Persistent memory & indexing | `MEMORY_REGISTRY.json`, indexed artifacts (`*.md`, `*.json`), `library.html` etc. |

**Loop**  

1. **SwarmMind** performs a task (scan, classification, transformation).  
2. **Library** records the output as an immutable artifact and updates its index.  
3. **Archivist** reads the new artifact, runs the dual‑lane verification, enforces constraints, and writes any corrections back to the Library.  
4. All state is persisted to the external JSON registries.  
5. The next iteration starts – any lane may be restarted at any moment.

---
## 2. Entry Condition (Cold Start)

A fresh agent begins with **no memory**. To bootstrap it must:

1. Read `BOOTSTRAP.md` – the single entry point that defines the truth hierarchy.  
2. Load `RUNTIME_STATE.json` – current lane identity, capabilities, and governance flag.  
3. Load `SESSION_REGISTRY.json` – list of active sessions, lock files, and heartbeat timestamps.  
4. Load `MEMORY_REGISTRY.json` (or the Library index) – the authoritative snapshot of all persisted artifacts.  

**Key principle:** *Identity* (e.g., “I am SwarmMind”) is derived **exclusively** from these structural files; no hidden in‑process state is assumed.

---
## 3. Authority Model

Authority is a strict hierarchy (higher wins):

1. **Bootstrap / Governance** (`BOOTSTRAP.md`, `GOVERNANCE.md`) – immutable truth.  
2. **Registry** (`SESSION_REGISTRY.json`, `RUNTIME_STATE.json`) – declared structure.  
3. **Runtime State** – current lane capabilities.  
4. **Session Output** – artifacts produced by the lane.  
5. **Agent Output** – transient results.

**Conflict resolution** uses:

* **Authority level** (higher overrides lower).  
* **Recency** – newer timestamps win when authority is equal.  
* **Dual‑lane agreement** – if both L and R produce the same result, it is accepted automatically; otherwise the Archivist adjudicates.

No single lane ever defines truth alone.

---
## 4. Dual Verification Lanes (L / R)

* **Lane L** – implementation / generation.  
* **Lane R** – verification / critique.

Both lanes run **independently**; each reads the same structural artifacts but does not trust the other’s in‑memory state. After completing a step they each emit a **state snapshot** (JSON artifact).  

### Reconciliation when L ≠ R

1. Re‑reconstruct both snapshots from their artifacts.  
2. Classify the discrepancy:  
   * **authoritative conflict** – different values in a higher‑authority artifact.  
   * **advisory conflict** – differing suggestions only.  
   * **temporal conflict** – one lane is ahead in time.  
3. Archivist applies the authority rules, selects the winning value, writes a **reconciliation artifact**, and notifies both lanes.  

No single lane ever defines truth alone.

---
## 5. Session + Heartbeat Model

* Every active lane registers itself in `SESSION_REGISTRY.json` with a unique `session_id` and a lock file (`.session-lock`).  
* A heartbeat (default 60 s) updates `last_heartbeat`.  
* If a heartbeat is missing beyond `lock_timeout_ms` (5 min), the session is marked **stale**, the lock is cleared, and the registry is updated.  

Consequences:

* Stale sessions may be **terminated** automatically.  
* New agents can safely acquire the lock and continue work.  
* Multi‑window operation is possible because each lane checks the registry before any write.

---
## 6. Crash Recovery

When an agent terminates unexpectedly:

1. A new agent reads the latest `RUNTIME_STATE.json` and `SESSION_REGISTRY.json`.  
2. It inspects the Library for **incomplete artifacts** (e.g., a task folder without a “finished” flag).  
3. It also checks the session lock – if the previous lock is stale, it removes it and creates a fresh lock.  
4. Using the last valid snapshots, the agent reconstructs the missing state and **resumes** the task from the point of failure.  

All critical state lives in the external JSON/markdown artifacts; no hidden memory is required.

---
## 7. Memory Model

Memory is *explicit* and *typed*:

| Memory Type | Persistence | Role |
|------------|--------------|------|
| **Authoritative** | `MEMORY_REGISTRY.json` + indexed artifacts | Required for correct recovery; never overwritten by lower lanes. |
| **Advisory** | separate `*_advisory.json` files | Hints, suggestions; may be ignored if conflict arises. |
| **Historical** | versioned snapshots (`artifact_2026‑04‑17.json`) | Auditing, rollback. |
| **Ambient** | external URLs, user‑provided data | Untrusted; must be validated before use. |

> **Rule:** *No critical state lives solely in an agent’s runtime memory.*

---
## 8. Conflict Resolution Process (Recap)

1. **Detect** a conflict (different JSON values, divergent artifacts).  
2. **Reconstruct** both sides from their authoritative sources.  
3. **Compare** using (a) authority level, (b) timestamp, (c) dual‑lane agreement.  
4. **Select** the winning value, write a **reconciliation artifact** (`RECONCILIATION_*.md`).  
5. **Notify** both lanes via the `SESSION_NOTIFICATIONS` folder.  

All resolutions are logged for later audit.

---
## 9. What Makes This System Different

* **No reliance on persistent chat or hidden session memory.**  
* **All truth is externalized** in version‑controlled artifacts.  
* **Dual independent verification** guarantees that a single faulty lane cannot corrupt the system.  
* **Self‑reconstruction** is possible from a handful of JSON/MD files, even after total agent loss.

---
## 10. How to Use This Document

* Treat it as the **mental model** for any newcomer.  
* When onboarding a new lane or a human dev, have them **read** this file first, then open the referenced artifacts.  
* Link it from:  
  * `README.md` of each repository.  
  * `BOOTSTRAP.md` (e.g., “See HOW_THIS_SYSTEM_ACTUALLY_WORKS.md for runtime flow”).  
  * The Library’s index page.  

---
## 11. Final Principle

> **Structure > Identity**  
> **Persistence > Memory**  
> **Verification > Assumption**

When those three inequalities hold, the organism remains self‑consistent, recoverable, and verifiable—even after every agent has been shut down and restarted.

---
*End of document*
