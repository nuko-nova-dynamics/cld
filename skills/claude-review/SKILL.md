---
name: claude-review
description: Have Claude Code review a diff, branch, or PR with schema-backed findings that get verified before reporting. Invoke explicitly with $claude-review, or use when the user wants Claude's code review or second opinion on changes.
---

# Claude code review

Use the driving-claude skill's invocation contract. Review path:

1. Determine the diff scope: uncommitted changes (`git diff` +
   `git diff --staged`), a branch (`git diff <base>...HEAD`), or a
   commit — whatever the user pointed at. Default: uncommitted, else
   the current branch against the default branch.
2. Launch the runner from the plugin root:

```bash
node scripts/claude-run.mjs --sandbox ro \
  --schema schemas/review-findings.schema.json \
  -- "Review the following change for correctness bugs, security
  issues, and significant quality problems. Repo: <path>. Scope:
  <described diff scope, e.g. 'git diff main...HEAD'>. Run the diff
  yourself with the read-only shell you have. For every finding cite
  file and line and give a concrete failure scenario. Only report
  findings you verified against the actual code — no speculation."
```

3. Parse the findings JSON. **Verify each finding against the repo
   yourself** before reporting — read the cited file:line, confirm the
   failure scenario is plausible. Drop or mark as unverified anything
   that doesn't hold up.
4. Report verified findings ranked by severity, with your
   agree/disagree assessment and the session id.

For a second opinion on YOUR own pending work, include your intent in
the prompt ("the change is supposed to X") so Claude reviews against
intent, not just the diff.
