---
name: claude-fleet
description: Coordinate independent Claude Code workers for decomposed tasks, review angles, or controlled model comparisons, then verify and combine their results.
---

# Claude fleet

Delegate only when independent work can save time or improve coverage. Start with two workers; use more only when each has a useful bounded task. Do not multiply workers merely to obtain agreement.

For each worker, record its task, target `--cd`, file scope, model/effort, completion criteria, budget if applicable, returned artifact directory, and eventual session ID. The runner isolates each call beneath its scratch parent. Use an absolute runner and schema path. Allocate any shared task budget across workers so their caps do not each reuse the full allowance. Track cumulative usage before retries or resumes. Keep the parent working on independent tasks while workers run.

For reviews, give workers distinct questions and require source evidence. For writes, use isolated worktrees where practical; shared working trees require disjoint files and no overlapping formatters, generated outputs, lockfiles, or Git operations. Worktrees start from a commit and do not automatically contain dirty work: explicitly provide the intended starting state without discarding existing changes.

For A/B comparisons, hold task, source, tools, and checks constant; pin full model IDs and explicit effort. Use separate working trees for independent implementations. `patch-plan.schema.json` describes a plan, not an executable patch.

Collect every worker's completion or failure, inspect artifacts and changes, verify substantive findings, and resolve conflicts before synthesizing one result. Agreement is not independent proof. Report completed work, unresolved items, actual models used, and per-worker session IDs. One failed worker does not justify discarding useful independent results or silently narrowing the task.
