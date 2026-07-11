---
name: claude-fleet
description: Fan out 2-4 parallel Claude Code workers on a task — decomposition, multi-angle second opinions, or A/B implementations. Invoke explicitly with $claude-fleet, or use when the user wants multiple Claude workers or parallel Claude runs.
---

# Claude fleet

Use the driving-claude skill's invocation contract. Fan out N parallel
runner invocations (from the plugin root), then synthesize.

Rules:

- Default 2 workers; cap at 4 unless the user explicitly asks for
  more.
- If the user gave angles (e.g. "correctness; performance; security"),
  one worker per angle, each `--sandbox ro`, reporting via `--schema
  schemas/task-report.schema.json` (or review-findings for review
  angles).
- Without angles, decompose the task into non-overlapping subtasks
  yourself. Mutating workers get `--sandbox write` and MUST have
  disjoint file scopes stated explicitly in their prompts — two
  workers editing the same file is a corruption risk, not parallelism.
- Launch every worker concurrently (background execution if your
  harness supports it), each with its own `--scratch` dir.
- A/B implementations: run them in separate git worktrees (create
  them yourself) or have both report patches via `--schema
  schemas/patch-plan.schema.json` instead of writing directly.
- When all report: synthesize — dedupe, note agreements/disagreements,
  pick winners. Present one unified result with per-worker session
  ids.
