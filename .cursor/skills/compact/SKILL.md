---
name: compact
description: >-
  Summarizes the current conversation into a compact context digest to save tokens.
  Use only when the user explicitly calls /compact.
disable-model-invocation: true
---

# Compact

Condenses the ongoing conversation into a short digest so future turns carry less token overhead, while preserving what is needed to keep working correctly.

## Instructions

1. Review the full conversation so far (user messages, assistant responses, tool results, and any files created or edited).
2. Produce a digest with these sections, in order:
   - **Goal**: one or two sentences on what the user is trying to accomplish overall.
   - **Decisions made**: bullet list of concrete choices/agreements (e.g. approaches picked, options rejected, naming, scope).
   - **Files touched**: bullet list of file paths created or modified, with a one-line note on what changed in each.
   - **Open items**: anything still pending, unanswered questions, or explicitly deferred work.
   - **Next step**: the single next action, if one was implied or agreed.
3. Keep the digest tight — prefer bullets over prose, omit anything not needed to resume work correctly. Drop exploratory dead ends, restated context, and tool-call narration.
4. Do not invent information. If a section has nothing to report, omit that section entirely rather than writing "None".
5. Present the digest to the user as the response to `/compact`. Do not take further action unless the user asks for it next.

## Output template

```markdown
## Compact Summary

### Goal
[one or two sentences]

### Decisions made
- ...

### Files touched
- `path/to/file` — [what changed]

### Open items
- ...

### Next step
[single next action]
```
