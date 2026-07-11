---
name: claude-task
description: Delegate a task to Claude Code with full flag control (model, effort, sandbox, schema, resume, budget). Invoke explicitly with $claude-task, or use when the user asks to hand a specific task to Claude.
---

# Delegate a task to Claude

Use the driving-claude skill's invocation contract. Delegate the user's
task to Claude via the bundled runner (from the plugin root):

```bash
node scripts/claude-run.mjs --sandbox <ro|write|full> [flags] -- <prompt>
```

Rules:

- Any flag the user did not set: choose per the driving-claude
  heuristics. Do not ask.
- Mutating asks default to `--sandbox write`; review/research to `ro`;
  `full` only on explicit user request, confirmed once per session.
- If the result will be parsed and acted on, add `--schema
  schemas/<name>.schema.json` (review-findings | verdict | task-report
  | patch-plan) — a user-supplied path passes through.
- `--resume` with no id from the user means `--resume last`.
- Tighten the prompt per the prompting-claude skill before launching.
- After the run: parse/verify/act per driving-claude "Acting on
  results", then report outcome + session id so the thread can be
  resumed later.
