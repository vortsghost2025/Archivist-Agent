# Execution Weight Helper

OUTPUT_PROVENANCE

agent: codex

model: GPT-5 Codex

lane: archivist

timestamp_utc: 2026-05-03T03:44:00Z

## Purpose

`execution-weight.js` ranks graph nodes by execution-critical priority. Higher weight means the node should appear earlier in graph-analysis triage.

This is analysis-only in Archivist right now. It does not change lane-worker routing or dispatcher order.

## Weight Factors

Base status weight:

| Status | Weight |
|--------|--------|
| conflicted | 10 |
| blocked | 8 |
| unverified | 6 |
| verified | 4 |
| resolved | 2 |
| unknown | 1 |

Additional weight:

| Signal | Added Weight |
|--------|--------------|
| `critical: true` in metadata-like fields | +5 |
| invocation count | +0 to +5, capped at 5 |
| last invoked within 24 hours | +3 |
| last invoked within 7 days | +1 |

## Supported Node Shapes

Critical metadata may appear in:

- `metadata`
- `meta`
- `properties`
- `props`

Invocation count may appear as number or numeric string in:

- `invokeCount`
- `invoke_count`
- `metadata.invokeCount`
- `metadata.invoke_count`
- `meta.invokeCount`
- `meta.invoke_count`
- `properties.invokeCount`
- `properties.invoke_count`
- `props.invokeCount`
- `props.invoke_count`
- `probe.invokeCount`
- `probe.invoke_count`
- `runtime_probe.invokeCount`
- `runtime_probe.invoke_count`
- `runtime.invokeCount`
- `runtime.invoke_count`

Last invocation timestamp may appear in:

- `lastInvoked`
- `last_invoked`
- equivalent nested fields under `metadata`, `meta`, `properties`, `props`, `probe`, `runtime_probe`, or `runtime`

## Current Integration

`analyze-graph-json.js`:

- imports `executionWeight`
- adds `weight` to every detailed graph node
- sorts conflicted/blocked nodes by descending weight
- prints `weight:<value>` in Markdown output

## Verification

Run:

```powershell
node S:\Archivist-Agent\scripts\test-execution-weight.js
```

Expected:

```text
PASS test-execution-weight
```

## Ratification Notes

Other lanes should not silently fork this logic. They should either:

- adopt the Archivist helper after review, or
- report any lane-specific graph shapes that require a schema extension.

