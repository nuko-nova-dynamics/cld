---
name: claude-task
description: Delegate one task to Claude Code, select the required model, effort, tools, and result contract, then verify and act on the result within the user's scope.
---

# Delegate a task

Follow `driving-claude` for the invocation and result contract, and `prompting-claude` for substantial prompts.

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox <ro|write|full> \
  --cd <target-project> [flags] -- <task-and-completion-criteria>
```

Choose unset flags from the task and configured defaults. Use `ro` for assessment, `write` for authorized implementation, and `full` only for explicitly authorized permission bypass. Use absolute schema paths when the caller needs structured fields. Give each run a clear file scope and completion condition.

After Claude returns, inspect the artifacts and actual workspace, verify the relevant checks, and complete any remaining authorized work. Preserve the session ID, target directory, model usage, and necessary launch flags so a follow-up can resume correctly. A successful process exit does not prove the task was completed.
