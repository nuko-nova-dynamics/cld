---
name: claude-review
description: Have Claude Code review a specific diff, branch, or PR and independently verify its schema-backed findings before reporting them.
---

# Claude code review

Identify the target repository and diff before launching. Include both staged and unstaged changes for an uncommitted review, and inspect relevant untracked files separately. For a branch or PR, verify the actual base reference; do not assume `main` or use stale line numbers.

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox ro \
  --cd <target-repo> --schema <plugin-root>/schemas/review-findings.schema.json \
  -- "Review <exact diff scope> for actionable correctness and security defects. The intended behavior is <intent>. Read the current code and obtain the diff in this repository. For each finding give file and line, the concrete failing input or state, and evidence supporting it. Do not edit files. Report no finding where the evidence does not support one."
```

If Claude cannot run the needed read command, capture the diff/source through an authorized read-only tool and supply it. Do not escalate to write permissions just to complete a review.

Parse the full result artifact only after successful schema output. Independently inspect each cited location and failure scenario, remove unsupported findings, and rank confirmed issues by impact. Cite the current side of the diff and report anything that remains unverified. Include the session ID for follow-up.

The `ro` preset is a permission configuration, not filesystem isolation. Follow `driving-claude` when the task requires stronger isolation.
