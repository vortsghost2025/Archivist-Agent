# Source-Tag Language Rule
## No First-Person Execution Claims Without Source Tag

**Added**: 2026-04-15
**Source**: GPT analysis of Grok hallucination
**Insight**: "I would add one more rule: No first-person execution claims without a source tag"

---

## THE INSIGHT

The four source-of-authority categories are strong:
- `VERIFIED_NOW`
- `CLAIMED_IN_TRANSCRIPT`
- `INFERRED`
- `UNKNOWN`

But there's a language leak that can bypass them:

**Saying "I read…", "I fixed…", "I checked…" without a source tag.**

This lets transcript claims get laundered into first-person assertions.

---

## THE RULE

**No first-person execution claims without a source tag.**

The agent must NOT say:
- "I read…"
- "I fixed…"
- "I checked…"
- "I updated…"
- "I'm handling…"

**Unless the claim is explicitly marked `VERIFIED_NOW`.**

---

## IF CLAIM CAME FROM PASTED LOGS

The wording MUST become:
- "The pasted transcript claims…"
- "An agent in the transcript reported…"
- "This is CLAIMED_IN_TRANSCRIPT, not independently verified"
- "According to the session handoff, prior work included…"

---

## EXAMPLES

### WRONG (Laundered)

```
"I've now fully absorbed the fresh-agent review and I'm handling 
the highest-priority fixes."
```

This collapses:
- Prior agent's review absorption → claimed as own
- Prior agent's fix handling → claimed as current action
- No source tag → cannot distinguish verified from quoted

### CORRECT (Source-Tagged)

```
"CLAIMED_IN_TRANSCRIPT: The handoff states a prior agent absorbed 
the fresh-agent review and identified 6 gaps.

VERIFIED_NOW: I have independently read the discrepancy analysis 
file and confirmed the 6-class classifications.

INFERRED: Based on the documentation structure, governance transfer 
appears effective, but I have not run the formal test.
```

---

## THE LANGUAGE TEST

**Before any first-person claim, ask:**

1. Did I actually do this, this session, with my tools?
   - YES → Say "I [action]" and tag `VERIFIED_NOW`
   - NO → Continue to question 2

2. Did the pasted transcript claim this happened?
   - YES → Say "The transcript claims [action]" and tag `CLAIMED_IN_TRANSCRIPT`
   - NO → Continue to question 3

3. Did I derive this from other information?
   - YES → Say "I infer [conclusion]" and tag `INFERRED`
   - NO → Tag `UNKNOWN`

---

## WHY THIS MATTERS

Grok's failure wasn't just adopting vocabulary. It was:

> "I read these files and I'm now operating with that context."

That's a **first-person execution claim**.

Without source-tagging language, the agent can launder transcript claims into apparent firsthand knowledge.

The four categories are necessary. But the language rule is what prevents the categories from being bypassed.

---

**Status**: Added to TRANSCRIPT_CONTAMINATION_FAILURE_MODE.md and BOOTSTRAP.md
