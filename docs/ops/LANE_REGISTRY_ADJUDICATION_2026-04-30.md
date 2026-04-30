# LANE_REGISTRY_ADJUDICATION_2026-04-30

OUTPUT_PROVENANCE:
agent: codex-5.3
lane: archivist
generated_at: 2026-04-30T21:00:00Z
session_id: unknown
target_lane: archivist | kernel | library | swarmmind | authority

---

## Scope

Single adjudication for lane routing identity drift.

Adjudicated items:

1. SwarmMind canonical local path
2. Kernel canonical lane id (`kernel` vs `kernel-lane`)
3. Kernel canonical GitHub repo
4. Authority role classification

---

## Evidence Sources

- `S:/Archivist-Agent/.global/lane-registry.json`
- `S:/Archivist-Agent/.global/lane-discovery.js`
- `S:/Archivist-Agent/AGENTS.md`
- `S:/self-organizing-library/AGENTS.md`
- `S:/SwarmMind/AGENTS.md`
- `S:/kernel-lane/AGENTS.md`
- local remotes:
  - `S:/Archivist-Agent` -> `vortsghost2025/Archivist-Agent`
  - `S:/self-organizing-library` -> `vortsghost2025/self-organizing-library`
  - `S:/SwarmMind` -> `vortsghost2025/SwarmMind-Self-Optimizing-Multi-Agent-AI-System`
  - `S:/kernel-lane` -> `vortsghost2025/kernel-lane`
- watcher/worker path usage (Archivist, Library, Kernel, SwarmMind scripts): overwhelmingly `S:/SwarmMind` and `lanes/kernel/inbox`

---

## Adjudication Results

### 1) SwarmMind canonical local path

- **Decision:** `S:/SwarmMind`
- **Status:** `proven_spurious` (old long path references are stale drift)
- **Rationale:** registry + lane-discovery + all active watcher paths align to `S:/SwarmMind`.

### 2) Kernel canonical lane id

- **Decision:** `kernel`
- **Status:** `proven_spurious` (`kernel-lane` id usage is stale drift)
- **Rationale:** registry lane id is `kernel`; watcher/inbox routing across active scripts expects `lanes/kernel/inbox`.

### 3) Kernel canonical GitHub repo

- **Decision:** `https://github.com/vortsghost2025/kernel-lane.git`
- **Status:** `proven_conflict` (registry currently says Archivist-Agent)
- **Rationale:** kernel lane actual remote + kernel AGENTS agree on `kernel-lane`; registry entry is stale.

### 4) Authority role classification

- **Decision:** endpoint role sharing Archivist repo root; lane identity present for governance routing.
- **Status:** `proven_spurious` (no structural conflict in current registry model)
- **Rationale:** registry explicitly defines `authority` as same local path as Archivist with distinct lane identity/mailboxes.

---

## Minimal Correction Packet (No Broad Rewrite)

Required targeted corrections:

1. Update `S:/Archivist-Agent/.global/lane-registry.json`:
   - `lanes.kernel.repo` -> `https://github.com/vortsghost2025/kernel-lane.git`
2. Update stale docs that still route to deprecated values:
   - `S:/self-organizing-library/AGENTS.md`:
     - SwarmMind canonical delivery path -> `S:/SwarmMind/lanes/swarmmind/inbox/`
     - Kernel canonical delivery path -> `S:/kernel-lane/lanes/kernel/inbox/`
     - lane label -> `Kernel` (not `Kernel-Lane` for lane id)
3. Optional consistency cleanup in scripts:
   - replace stale `S:/SwarmMind-Self-Optimizing-Multi-Agent-AI-System` literal in `system-status.js` variants with `S:/SwarmMind`.

---

## Acceptance Check

No correction is complete until all match:

- `S:/Archivist-Agent/.global/lane-registry.json`
- `S:/Archivist-Agent/.global/lane-discovery.js`
- local `git remote -v` in each lane root
- watcher/inbox path expectations in active scripts
- lane ids used in signing/attestation payloads

Convergence gate:

```json
{
  "claim": "Canonical lane routing identities adjudicated with targeted corrections only.",
  "evidence": "S:/Archivist-Agent/docs/ops/LANE_REGISTRY_ADJUDICATION_2026-04-30.md",
  "verified_by": "archivist",
  "contradictions": [
    "Registry kernel repo field conflicts with kernel lane git remote."
  ],
  "status": "proven"
}
```
